using System.Net.Http.Headers;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingAuthService
{
    string GetAuthorizationUrl();
    Task<BlingTokenResponse> ExchangeCodeAsync(string code);
    Task<BlingTokenResponse> RefreshTokenAsync(string refreshToken);
    BlingTokenResponse? GetCurrentToken();
    Task GarantirTokenAsync(CancellationToken cancellationToken = default);
    void SetToken(BlingTokenResponse token);
}

public class BlingAuthService : IBlingAuthService
{
    private readonly IBlingEffectiveSettings _settings;
    private readonly IBlingConfigRepository _config;
    private readonly IServiceProvider _servicos;
    private readonly HttpClient _http;
    private readonly ILogger<BlingAuthService> _log;
    private readonly string _tokenPath;
    private readonly string _tokenUploadsPath;
    private readonly object _gate = new();
    private BlingTokenResponse? _currentToken;

    private string ClientId
    {
        get
        {
            var v = _settings.Current.ClientId;
            if (string.IsNullOrWhiteSpace(v))
                throw new InvalidOperationException("Bling ClientId não configurado. Vá em Configurações → Bling.");
            return v;
        }
    }

    private string ClientSecret
    {
        get
        {
            var v = _settings.Current.ClientSecret;
            if (string.IsNullOrWhiteSpace(v))
                throw new InvalidOperationException("Bling ClientSecret não configurado. Vá em Configurações → Bling.");
            return v;
        }
    }

    private string RedirectUri
    {
        get
        {
            var v = _settings.Current.RedirectUri;
            if (string.IsNullOrWhiteSpace(v))
                throw new InvalidOperationException("Bling RedirectUri não configurado. Vá em Configurações → Bling.");
            return v;
        }
    }

    public BlingAuthService(
        IBlingEffectiveSettings settings,
        IBlingConfigRepository config,
        IServiceProvider servicos,
        IHttpClientFactory httpClientFactory,
        IHostEnvironment env,
        ILogger<BlingAuthService> log)
    {
        _settings = settings;
        _config = config;
        _servicos = servicos;
        _http = httpClientFactory.CreateClient("BlingAuth");
        _log = log;
        var dir = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dir);
        _tokenPath = Path.Combine(dir, "bling-consulta-token.json");
        var uploads = Path.Combine(env.ContentRootPath, "uploads");
        Directory.CreateDirectory(uploads);
        _tokenUploadsPath = Path.Combine(uploads, "bling-consulta-token.json");
        var carregado = CarregarTokenDisco();
        _currentToken = carregado;
        if (carregado is not null && TokenUtil(carregado))
            _ = SalvarTokenBancoAsync(carregado);
    }

    public string GetAuthorizationUrl()
    {
        // Garante override Mongo carregado antes de montar a URL.
        _settings.EnsureLoadedAsync().GetAwaiter().GetResult();
        var state = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16))
            .ToLowerInvariant();
        return $"https://www.bling.com.br/Api/v3/oauth/authorize" +
               $"?response_type=code" +
               $"&client_id={Uri.EscapeDataString(ClientId)}" +
               $"&state={state}" +
               $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}";
    }

    public async Task<BlingTokenResponse> ExchangeCodeAsync(string code)
    {
        await _settings.EnsureLoadedAsync();
        var credentials = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.bling.com.br/Api/v3/oauth/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = RedirectUri
        });

        var response = await _http.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Bling token HTTP {(int)response.StatusCode}: {json}");
        }

        var result = JsonSerializer.Deserialize<BlingTokenRaw>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Resposta de token Bling inválida.");

        var mapped = MapToken(result);
        SetToken(mapped);
        DispararLeituraDaComissao();
        return mapped;
    }

    public async Task<BlingTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        await _settings.EnsureLoadedAsync();
        var credentials = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.bling.com.br/Api/v3/oauth/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken
        });

        var response = await _http.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Bling refresh HTTP {(int)response.StatusCode}: {json}");
        }

        var result = JsonSerializer.Deserialize<BlingTokenRaw>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
        var mapped = MapToken(result);
        SetToken(mapped);
        return mapped;
    }

    public BlingTokenResponse? GetCurrentToken()
    {
        lock (_gate) return _currentToken;
    }

    public async Task GarantirTokenAsync(CancellationToken cancellationToken = default)
    {
        if (TokenUtil(GetCurrentToken())) return;

        var doDisco = CarregarTokenDisco();
        if (TokenUtil(doDisco))
        {
            SetToken(doDisco!);
            return;
        }

        var doc = await _config.ObterAsync(cancellationToken);
        if (doc is null || string.IsNullOrWhiteSpace(doc.BlingAccessToken)) return;
        var doBanco = new BlingTokenResponse
        {
            AccessToken = doc.BlingAccessToken,
            RefreshToken = doc.BlingRefreshToken ?? "",
            ExpiresAt = doc.BlingTokenExpiraEm ?? DateTime.UtcNow,
            TokenType = "Bearer",
        };
        if (!TokenUtil(doBanco)) return;
        SetToken(doBanco);
        _log.LogInformation("Token Bling de consulta carregado do banco (expira {Exp})", doBanco.ExpiresAt);
    }

    public void SetToken(BlingTokenResponse token)
    {
        lock (_gate)
        {
            _currentToken = token;
            SalvarTokenDisco(token);
        }

        _ = SalvarTokenBancoAsync(token);
    }

    private void DispararLeituraDaComissao()
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var comissao = _servicos.GetRequiredService<IComissaoOrigemService>();
                await comissao.AtualizarLojaAsync(CancellationToken.None);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha ao ler os pedidos do Bling depois de conectar.");
            }
        });
    }

    private async Task SalvarTokenBancoAsync(BlingTokenResponse token)
    {
        try
        {
            var doc = await _config.ObterAsync() ?? new Models.Mongo.BlingConfigData();
            doc.BlingAccessToken = token.AccessToken;
            doc.BlingRefreshToken = token.RefreshToken;
            doc.BlingTokenExpiraEm = token.ExpiresAt;
            await _config.SalvarAsync(doc);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao gravar token Bling no banco");
        }
    }

    private static bool TokenUtil(BlingTokenResponse? token) =>
        token is not null
        && !string.IsNullOrWhiteSpace(token.AccessToken)
        && !token.AccessToken.StartsWith("local-bypass", StringComparison.OrdinalIgnoreCase)
        && (token.ExpiresAt > DateTime.UtcNow.AddMinutes(1) || !string.IsNullOrWhiteSpace(token.RefreshToken));

    private BlingTokenResponse? CarregarTokenDisco()
    {
        try
        {
            var caminho = File.Exists(_tokenUploadsPath) ? _tokenUploadsPath
                : File.Exists(_tokenPath) ? _tokenPath
                : null;
            if (caminho is null) return null;
            var json = File.ReadAllText(caminho);
            var token = JsonSerializer.Deserialize<BlingTokenResponse>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
            if (token is null || string.IsNullOrWhiteSpace(token.AccessToken)) return null;
            if (token.ExpiresAt <= DateTime.UtcNow.AddMinutes(1)
                && string.IsNullOrWhiteSpace(token.RefreshToken))
            {
                return null;
            }

            _log.LogInformation("Token Bling de consulta carregado do disco (expira {Exp})", token.ExpiresAt);
            return token;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao ler token Bling do disco");
            return null;
        }
    }

    private void SalvarTokenDisco(BlingTokenResponse token)
    {
        try
        {
            var json = JsonSerializer.Serialize(token);
            File.WriteAllText(_tokenPath, json);
            File.WriteAllText(_tokenUploadsPath, json);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao gravar token Bling no disco");
        }
    }

    private static BlingTokenResponse MapToken(BlingTokenRaw raw) => new()
    {
        AccessToken = raw.Access_token ?? string.Empty,
        RefreshToken = raw.Refresh_token ?? string.Empty,
        ExpiresIn = raw.Expires_in,
        TokenType = raw.Token_type ?? "Bearer",
        ExpiresAt = DateTime.UtcNow.AddSeconds(raw.Expires_in)
    };

    private sealed class BlingTokenRaw
    {
        public string? Access_token { get; set; }
        public string? Refresh_token { get; set; }
        public int Expires_in { get; set; }
        public string? Token_type { get; set; }
    }
}
