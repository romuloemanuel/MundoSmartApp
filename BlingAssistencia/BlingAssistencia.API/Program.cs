using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Services;
using MundoSmart.BlingAssistencia.API.Settings;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

builder.Services.Configure<BlingSettings>(builder.Configuration.GetSection("Bling"));
builder.Services.Configure<AuthSettings>(builder.Configuration.GetSection(AuthSettings.SectionName));
var authSettings = builder.Configuration.GetSection(AuthSettings.SectionName).Get<AuthSettings>() ?? new AuthSettings();

// OAuth Bling só para consulta de produtos/capinhas.
// Clientes, OS e orçamentos permanecem 100% no Mongo (LocalBypass) — sem sync com Bling.
builder.Services.AddHttpClient("BlingAuth");
builder.Services.AddSingleton<IBlingAuthService, BlingAuthService>();

// Domínio local — nunca chama API Bling de contatos/OS/orçamentos
builder.Services.AddScoped<IClienteConsultaService, ClienteConsultaService>();
builder.Services.AddScoped<IBlingClienteService, BlingClienteServiceLocalBypass>();
builder.Services.AddScoped<IBlingOrdemServicoService, BlingOrdemServicoServiceLocalBypass>();
builder.Services.AddScoped<IBlingOrcamentoService, BlingOrcamentoServiceLocalBypass>();

// MongoDB
builder.Services.Configure<MongoSettings>(builder.Configuration.GetSection("MongoDB"));
builder.Services.Configure<EstoqueSettings>(builder.Configuration.GetSection("Estoque"));
builder.Services.Configure<AssistenciaSettings>(builder.Configuration.GetSection("Assistencia"));
builder.Services.Configure<IntakeSettings>(builder.Configuration.GetSection(IntakeSettings.SectionName));
builder.Services.AddSingleton<MongoDbService>();
builder.Services.AddSingleton<IDevSequenceRepository, DevSequenceRepository>();
builder.Services.AddSingleton<IOsLocalRepository, OsLocalRepository>();
builder.Services.AddSingleton<IClienteLocalRepository, ClienteLocalRepository>();
builder.Services.AddSingleton<IOrcamentoLocalRepository, OrcamentoLocalRepository>();
builder.Services.AddSingleton<IAparelhoRepository, AparelhoRepository>();
builder.Services.AddSingleton<IPecaEstoqueRepository, PecaEstoqueRepository>();
builder.Services.AddSingleton<ICategoriaPecaRepository, CategoriaPecaRepository>();
builder.Services.AddSingleton<IAssistenciaConfigRepository, AssistenciaConfigRepository>();
builder.Services.AddSingleton<IAssistenciaConfigService, AssistenciaConfigService>();
builder.Services.AddSingleton<ITecnicoRepository, TecnicoRepository>();
builder.Services.AddSingleton<IUsuarioRepository, UsuarioRepository>();
builder.Services.AddSingleton<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddSingleton<IQrSessaoHandoffRepository, QrSessaoHandoffRepository>();
builder.Services.AddSingleton<IAppAuthService, AppAuthService>();
builder.Services.AddSingleton<IEstoqueLoteService, EstoqueLoteService>();
builder.Services.AddSingleton<IEstoqueNivelService, EstoqueNivelService>();
builder.Services.AddSingleton<IOsEstoqueBaixaService, OsEstoqueBaixaService>();
builder.Services.AddHttpClient("BlingProdutos", client =>
{
    // Host oficial da API v3 (www.bling.com.br retorna 403 em /produtos).
    client.BaseAddress = new Uri("https://api.bling.com.br/Api/v3/");
    client.Timeout = TimeSpan.FromSeconds(20);
});
builder.Services.AddSingleton<IBlingProdutoAcessorioRepository, BlingProdutoAcessorioRepository>();
builder.Services.AddSingleton<IBlingProdutoConsultaService, BlingProdutoConsultaService>();
builder.Services.AddScoped<IOsIntakeService, OsIntakeService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<IOsHistoricoRepository, OsHistoricoRepository>();
builder.Services.AddScoped<IOsHistoricoService, OsHistoricoService>();

var jwtKey = authSettings.Jwt.Key;
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("Auth:Jwt:Key deve ter ao menos 32 caracteres.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = authSettings.Jwt.Issuer,
            ValidAudience = authSettings.Jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1),
            RoleClaimType = System.Security.Claims.ClaimTypes.Role,
            NameClaimType = System.Security.Claims.ClaimTypes.Name,
        };
    });

builder.Services.AddAuthorization(options =>
{
    if (authSettings.Enabled)
    {
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();
    }
});

var loginPorMinuto = Math.Max(3, authSettings.Security.LoginRateLimitPorMinuto);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPorMinuto,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

var origins = authSettings.AllowedOrigins?
    .Where(o => !string.IsNullOrWhiteSpace(o))
    .Select(o => o.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray() ?? [];

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 20 * 1024 * 1024;
    options.ValueLengthLimit = 20 * 1024 * 1024;
    options.MemoryBufferThreshold = 2 * 1024 * 1024;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        // Dev: celular na LAN pode vir de qualquer IP; produção usa AllowedOrigins.
        if (builder.Environment.IsDevelopment() || origins.Length == 0)
        {
            policy.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod();
            return;
        }

        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

var versao = Assembly.GetExecutingAssembly()
    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "?";
Console.WriteLine($"[MundoSmart API] v{versao} — MODO LOCAL (sem Bling/produção)");
if (!authSettings.Enabled)
    Console.WriteLine("[MundoSmart API] Auth DESATIVADO (Auth:Enabled=false) — acesso livre (dev).");

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(self), microphone=(), geolocation=()";
    context.Response.Headers["X-XSS-Protection"] = "0";
    await next();
});

app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (UnauthorizedAccessException ex)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { erro = ex.Message });
        }
    }
    catch (BlingDesabilitadoException ex)
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { erro = ex.Message });
        }
    }
});

app.UseCors();
app.UseRateLimiter();

var uploadsPath = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        await next();
        if (context.Response.StatusCode >= 400)
        {
            var path = context.Request.Path + context.Request.QueryString;
            Console.WriteLine($"[API {context.Response.StatusCode}] {context.Request.Method} {path}");
        }
    });

    app.MapOpenApi().AllowAnonymous();
}

app.UseAuthentication();

if (!authSettings.Enabled)
{
    // Depois do JWT: identidade fake Root para [Authorize(Roles=…)] sem token.
    app.Use(async (context, next) =>
    {
        var identity = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, "dev"),
                new Claim(ClaimTypes.Name, "dev"),
                new Claim(ClaimTypes.Role, AppRoles.Root),
                new Claim("loja_origem", ""),
            ],
            authenticationType: "DevBypass");
        context.User = new ClaimsPrincipal(identity);
        await next();
    });
}

app.UseAuthorization();
app.MapControllers();

// Aquece MongoDB e índices na subida — primeira busca de cliente fica instantânea
try
{
    var mongo = app.Services.GetRequiredService<MongoDbService>();
    await mongo.WarmupAsync();
    var clientesRepo = app.Services.GetRequiredService<IClienteLocalRepository>();
    await clientesRepo.EnsureIndexesAsync();
    _ = await clientesRepo.ListarAsync();
    var aparelhosRepo = app.Services.GetRequiredService<IAparelhoRepository>();
    await aparelhosRepo.EnsureIndexesAsync();
    var catalogoSeed = await aparelhosRepo.GarantirModelosDoCatalogoAsync();
    Console.WriteLine($"[MundoSmart API] Catálogo modelos: {catalogoSeed.Criados} novos, {catalogoSeed.JaExistentes} já existiam, {catalogoSeed.Renomeados} renomeados.");
    var realmePrune = await aparelhosRepo.RemoverModelosForaDoCatalogoAsync("Realme");
    Console.WriteLine($"[MundoSmart API] Realme fora do catálogo BR: {realmePrune.Removidos} removidos, {realmePrune.Preservados} preservados (em uso).");
    var marcasSeed = await aparelhosRepo.ListarMarcasAsync(limite: 200);
    Console.WriteLine($"[MundoSmart API] Marcas: {string.Join(", ", marcasSeed.Select(m => m.Nome))} ({marcasSeed.Count}).");
    _ = await aparelhosRepo.ListarModelosAsync(limite: 50);
    var pecasRepo = app.Services.GetRequiredService<IPecaEstoqueRepository>();
    await pecasRepo.EnsureIndexesAsync();
    var categoriasPecaRepo = app.Services.GetRequiredService<ICategoriaPecaRepository>();
    await categoriasPecaRepo.EnsureIndexesAsync();
    await categoriasPecaRepo.GarantirSeedAsync();
    Console.WriteLine("[MundoSmart API] Categorias de peça seedadas.");
    var acessoriosRepo = app.Services.GetRequiredService<IBlingProdutoAcessorioRepository>();
    await acessoriosRepo.EnsureIndexesAsync();
    Console.WriteLine("[MundoSmart API] Consulta de acessórios: só Bling (sem catálogo local).");
    var estoqueLote = app.Services.GetRequiredService<IEstoqueLoteService>();
    await estoqueLote.EnsureIndexesAsync();
    if (app.Environment.IsDevelopment())
        await pecasRepo.GarantirCatalogoDemonstracaoAsync();
    _ = await pecasRepo.ConsultarServicosValoresAsync("warmup");
    var osRepo = app.Services.GetRequiredService<IOsLocalRepository>();
    await osRepo.EnsureIndexesAsync();
    var osHistoricoRepo = app.Services.GetRequiredService<IOsHistoricoRepository>();
    await osHistoricoRepo.EnsureIndexesAsync();
    var tecnicosRepo = app.Services.GetRequiredService<ITecnicoRepository>();
    await tecnicosRepo.EnsureIndexesAsync();
    await tecnicosRepo.GarantirSeedAsync(["Rômulo", "Liniker"]);
    Console.WriteLine("[MundoSmart API] Técnicos seed: Rômulo, Liniker.");
    var appAuth = app.Services.GetRequiredService<IAppAuthService>();
    await appAuth.GarantirSeedAsync();
    var sequences = app.Services.GetRequiredService<IDevSequenceRepository>();
    await osRepo.NormalizarNumeracaoSeNecessarioAsync(sequences, uploadsPath);
    _ = await osRepo.ListarParaListaAsync(null);
    Console.WriteLine("[MundoSmart API] MongoDB pronto.");
}
catch (Exception ex)
{
    Console.WriteLine($"[MundoSmart API] Aviso: MongoDB indisponível na subida — {ex.Message}");
}

app.Run();
