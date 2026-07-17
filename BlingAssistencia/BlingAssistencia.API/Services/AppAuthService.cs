using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public record LoginResult(
    string AccessToken,
    DateTime ExpiraEm,
    string RefreshToken,
    DateTime RefreshExpiraEm,
    UsuarioPublicoDto Usuario);

public record UsuarioPublicoDto(
    string Id,
    string Usuario,
    string Nome,
    string Role,
    bool Ativo,
    string? TecnicoId,
    string? LojaOrigem,
    bool DeveTrocarSenha,
    DateTime? UltimoLoginEm);

public interface IAppAuthService
{
    Task GarantirSeedAsync(CancellationToken cancellationToken = default);
    Task<LoginResult> LoginAsync(string usuario, string senha, CancellationToken cancellationToken = default);
    Task<LoginResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default);
    /// <summary>Código curto (QR) que o celular troca por access+refresh da mesma conta.</summary>
    Task<string> CriarHandoffQrAsync(string usuarioId, CancellationToken cancellationToken = default);
    Task<LoginResult> TrocarHandoffQrAsync(string codigo, CancellationToken cancellationToken = default);
    Task<UsuarioPublicoDto?> ObterMeAsync(string userId, CancellationToken cancellationToken = default);
    Task AlterarSenhaAsync(string userId, string senhaAtual, string senhaNova, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UsuarioPublicoDto>> ListarAsync(CancellationToken cancellationToken = default);
    Task<UsuarioPublicoDto> CriarAsync(CriarUsuarioRequest request, CancellationToken cancellationToken = default);
    Task<UsuarioPublicoDto> AtualizarAsync(string id, AtualizarUsuarioRequest request, CancellationToken cancellationToken = default);
    Task ExcluirAsync(string id, string solicitanteId, CancellationToken cancellationToken = default);
    Task ResetarSenhaAsync(string id, string senhaNova, CancellationToken cancellationToken = default);
}

public record CriarUsuarioRequest(
    string Usuario,
    string Nome,
    string Senha,
    string Role,
    string? TecnicoId,
    string? LojaOrigem,
    bool Ativo = true);

public record AtualizarUsuarioRequest(
    string Nome,
    string Role,
    string? TecnicoId,
    string? LojaOrigem,
    bool Ativo);

public class AppAuthService : IAppAuthService
{
    private readonly IUsuarioRepository _usuarios;
    private readonly IRefreshTokenRepository _refreshTokens;
    private readonly IQrSessaoHandoffRepository _handoffs;
    private readonly AuthSettings _auth;

    public AppAuthService(
        IUsuarioRepository usuarios,
        IRefreshTokenRepository refreshTokens,
        IQrSessaoHandoffRepository handoffs,
        IOptions<AuthSettings> auth)
    {
        _usuarios = usuarios;
        _refreshTokens = refreshTokens;
        _handoffs = handoffs;
        _auth = auth.Value;
    }

    public async Task GarantirSeedAsync(CancellationToken cancellationToken = default)
    {
        await _usuarios.EnsureIndexesAsync(cancellationToken);
        await _refreshTokens.EnsureIndexesAsync(cancellationToken);
        await _handoffs.EnsureIndexesAsync(cancellationToken);
        var seed = _auth.Seed;

        await GarantirUsuarioSeedAsync(
            seed.RootUsuario,
            seed.RootNome,
            seed.RootSenha,
            AppRoles.Root,
            cancellationToken);

        await GarantirUsuarioSeedAsync(
            seed.AdminUsuario,
            seed.AdminNome,
            seed.AdminSenha,
            AppRoles.Admin,
            cancellationToken);
    }

    private async Task GarantirUsuarioSeedAsync(
        string usuario,
        string? nome,
        string senha,
        string role,
        CancellationToken cancellationToken)
    {
        var chave = UsuarioRepository.NormalizarUsuario(usuario);
        if (chave.Length == 0) return;
        if (await _usuarios.ObterPorUsuarioAsync(chave, cancellationToken) is not null) return;

        var user = new UsuarioData
        {
            Usuario = chave,
            Nome = string.IsNullOrWhiteSpace(nome) ? chave : nome.Trim(),
            SenhaHash = HashSenha(senha),
            Role = role,
            Ativo = true,
            DeveTrocarSenha = true,
            CriadoEm = DateTime.UtcNow,
        };
        await _usuarios.CriarAsync(user, cancellationToken);
        Console.WriteLine($"[MundoSmart API] Usuário seed criado: {user.Usuario} ({role}) — troque a senha no primeiro acesso.");
    }

    public async Task<LoginResult> LoginAsync(string usuario, string senha, CancellationToken cancellationToken = default)
    {
        ValidarCredenciaisEntrada(usuario, senha);

        var user = await _usuarios.ObterPorUsuarioAsync(usuario, cancellationToken)
            ?? throw new UnauthorizedAccessException("Usuário ou senha inválidos.");

        if (!user.Ativo)
            throw new UnauthorizedAccessException("Usuário desativado. Contate o administrador.");

        if (user.BloqueadoAte is { } ate && ate > DateTime.UtcNow)
        {
            var mins = Math.Max(1, (int)Math.Ceiling((ate - DateTime.UtcNow).TotalMinutes));
            throw new UnauthorizedAccessException(
                $"Conta temporariamente bloqueada. Tente novamente em cerca de {mins} min.");
        }

        if (!BCrypt.Net.BCrypt.Verify(senha, user.SenhaHash))
        {
            await RegistrarFalhaLoginAsync(user, cancellationToken);
            throw new UnauthorizedAccessException("Usuário ou senha inválidos.");
        }

        user.TentativasLoginFalhas = 0;
        user.BloqueadoAte = null;
        user.UltimoLoginEm = DateTime.UtcNow;
        await _usuarios.AtualizarAsync(user, cancellationToken);

        return await EmitirSessaoAsync(user, cancellationToken);
    }

    public async Task<LoginResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new UnauthorizedAccessException("Refresh token inválido.");

        var hash = RefreshTokenRepository.HashToken(refreshToken.Trim());
        var salvo = await _refreshTokens.ObterPorHashAsync(hash, cancellationToken)
            ?? throw new UnauthorizedAccessException("Sessão expirada. Faça login novamente.");

        if (salvo.RevogadoEm is not null || salvo.ExpiraEm <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Sessão expirada. Faça login novamente.");

        var user = await _usuarios.ObterPorIdAsync(salvo.UsuarioId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Sessão inválida. Faça login novamente.");

        if (!user.Ativo)
            throw new UnauthorizedAccessException("Usuário desativado. Contate o administrador.");

        // Rotação: invalida o refresh usado e emite um novo par.
        await _refreshTokens.RevogarAsync(salvo.Id!, cancellationToken);
        return await EmitirSessaoAsync(user, cancellationToken);
    }

    public async Task<string> CriarHandoffQrAsync(string usuarioId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(usuarioId))
            throw new ArgumentException("Usuário inválido para handoff do QR.");

        var user = await _usuarios.ObterPorIdAsync(usuarioId.Trim(), cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");
        if (!user.Ativo)
            throw new UnauthorizedAccessException("Usuário inativo.");

        var codigo = QrSessaoHandoffRepository.GerarCodigo();
        await _handoffs.CriarAsync(new QrSessaoHandoffData
        {
            Codigo = codigo,
            UsuarioId = user.Id!,
            ExpiraEm = DateTime.UtcNow.AddMinutes(15),
            CriadoEm = DateTime.UtcNow,
        }, cancellationToken);
        return codigo;
    }

    public async Task<LoginResult> TrocarHandoffQrAsync(string codigo, CancellationToken cancellationToken = default)
    {
        var handoff = await _handoffs.ConsumirAsync(codigo ?? "", cancellationToken)
            ?? throw new UnauthorizedAccessException("Código do QR inválido ou expirado. Gere um novo QR no balcão.");

        var user = await _usuarios.ObterPorIdAsync(handoff.UsuarioId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Usuário do QR não encontrado.");
        if (!user.Ativo)
            throw new UnauthorizedAccessException("Usuário inativo.");

        return await EmitirSessaoAsync(user, cancellationToken);
    }

    public async Task<UsuarioPublicoDto?> ObterMeAsync(string userId, CancellationToken cancellationToken = default)
    {
        var user = await _usuarios.ObterPorIdAsync(userId, cancellationToken);
        return user is null ? null : ParaDto(user);
    }

    public async Task AlterarSenhaAsync(
        string userId, string senhaAtual, string senhaNova, CancellationToken cancellationToken = default)
    {
        ValidarSenhaForte(senhaNova);
        var user = await _usuarios.ObterPorIdAsync(userId, cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (!BCrypt.Net.BCrypt.Verify(senhaAtual, user.SenhaHash))
            throw new UnauthorizedAccessException("Senha atual incorreta.");

        user.SenhaHash = HashSenha(senhaNova);
        user.DeveTrocarSenha = false;
        await _usuarios.AtualizarAsync(user, cancellationToken);
        await _refreshTokens.RevogarTodosDoUsuarioAsync(userId, cancellationToken);
    }

    public async Task<IReadOnlyList<UsuarioPublicoDto>> ListarAsync(CancellationToken cancellationToken = default)
    {
        var lista = await _usuarios.ListarAsync(cancellationToken);
        return lista.Select(ParaDto).ToList();
    }

    public async Task<UsuarioPublicoDto> CriarAsync(CriarUsuarioRequest request, CancellationToken cancellationToken = default)
    {
        ValidarCredenciaisEntrada(request.Usuario, request.Senha);
        ValidarSenhaForte(request.Senha);

        if (!AppRoles.EhAtribuivel(request.Role))
            throw new ArgumentException("Perfil inválido. Use Admin ou Operador.");

        var chave = UsuarioRepository.NormalizarUsuario(request.Usuario);
        if (chave == "root")
            throw new ArgumentException("O usuário root é reservado do sistema.");
        if (await _usuarios.ObterPorUsuarioAsync(chave, cancellationToken) is not null)
            throw new ArgumentException("Já existe um usuário com esse login.");

        var role = AppRoles.Normalizar(request.Role);
        var loja = NormalizarLojaOpcional(request.LojaOrigem);

        var user = new UsuarioData
        {
            Usuario = chave,
            Nome = (request.Nome ?? "").Trim(),
            SenhaHash = HashSenha(request.Senha),
            Role = role,
            Ativo = request.Ativo,
            TecnicoId = string.IsNullOrWhiteSpace(request.TecnicoId) ? null : request.TecnicoId.Trim(),
            LojaOrigem = AppRoles.EhAdminOuRoot(role) ? null : loja,
            DeveTrocarSenha = true,
        };
        if (user.Nome.Length < 2)
            throw new ArgumentException("Informe o nome do usuário.");

        await _usuarios.CriarAsync(user, cancellationToken);
        return ParaDto(user);
    }

    public async Task<UsuarioPublicoDto> AtualizarAsync(
        string id, AtualizarUsuarioRequest request, CancellationToken cancellationToken = default)
    {
        var user = await _usuarios.ObterPorIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        var nome = (request.Nome ?? "").Trim();
        if (nome.Length < 2)
            throw new ArgumentException("Informe o nome do usuário.");

        // Conta Root: mantém o perfil Root (não rebaixa) e sem restrição de loja.
        if (AppRoles.EhRoot(user.Role))
        {
            user.Nome = nome;
            user.Ativo = true;
            user.TecnicoId = string.IsNullOrWhiteSpace(request.TecnicoId) ? null : request.TecnicoId.Trim();
            user.LojaOrigem = null;
        }
        else
        {
            if (!AppRoles.EhAtribuivel(request.Role))
                throw new ArgumentException("Perfil inválido. Use Admin ou Operador.");

            user.Nome = nome;
            user.Role = AppRoles.Normalizar(request.Role);
            user.Ativo = request.Ativo;
            user.TecnicoId = string.IsNullOrWhiteSpace(request.TecnicoId) ? null : request.TecnicoId.Trim();
            user.LojaOrigem = AppRoles.EhAdminOuRoot(user.Role)
                ? null
                : NormalizarLojaOpcional(request.LojaOrigem);
        }

        await _usuarios.AtualizarAsync(user, cancellationToken);
        if (!user.Ativo)
            await _refreshTokens.RevogarTodosDoUsuarioAsync(id, cancellationToken);
        return ParaDto(user);
    }

    public async Task ExcluirAsync(string id, string solicitanteId, CancellationToken cancellationToken = default)
    {
        if (string.Equals(id, solicitanteId, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Você não pode excluir o próprio usuário.");

        var alvo = await _usuarios.ObterPorIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        if (AppRoles.EhRoot(alvo.Role) || alvo.Usuario == "root")
            throw new ArgumentException("O usuário root não pode ser excluído.");

        var ok = await _usuarios.ExcluirAsync(id, cancellationToken);
        if (!ok) throw new KeyNotFoundException("Usuário não encontrado.");
        await _refreshTokens.RevogarTodosDoUsuarioAsync(id, cancellationToken);
    }

    public async Task ResetarSenhaAsync(string id, string senhaNova, CancellationToken cancellationToken = default)
    {
        ValidarSenhaForte(senhaNova);
        var user = await _usuarios.ObterPorIdAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Usuário não encontrado.");

        user.SenhaHash = HashSenha(senhaNova);
        user.DeveTrocarSenha = true;
        user.TentativasLoginFalhas = 0;
        user.BloqueadoAte = null;
        await _usuarios.AtualizarAsync(user, cancellationToken);
        await _refreshTokens.RevogarTodosDoUsuarioAsync(id, cancellationToken);
    }

    private async Task<LoginResult> EmitirSessaoAsync(UsuarioData user, CancellationToken cancellationToken)
    {
        var accessExpira = DateTime.UtcNow.AddMinutes(Math.Max(15, _auth.Jwt.AccessTokenMinutos));
        var accessToken = GerarJwt(user, accessExpira);

        var refreshDias = Math.Max(1, _auth.Jwt.RefreshTokenDias);
        var refreshExpira = DateTime.UtcNow.AddDays(refreshDias);
        var refreshToken = RefreshTokenRepository.GerarTokenOpaco();
        await _refreshTokens.CriarAsync(new RefreshTokenData
        {
            UsuarioId = user.Id!,
            TokenHash = RefreshTokenRepository.HashToken(refreshToken),
            ExpiraEm = refreshExpira,
            CriadoEm = DateTime.UtcNow,
        }, cancellationToken);

        return new LoginResult(accessToken, accessExpira, refreshToken, refreshExpira, ParaDto(user));
    }

    private async Task RegistrarFalhaLoginAsync(UsuarioData user, CancellationToken cancellationToken)
    {
        user.TentativasLoginFalhas++;
        var max = Math.Max(3, _auth.Security.MaxFalhasLogin);
        if (user.TentativasLoginFalhas >= max)
        {
            user.BloqueadoAte = DateTime.UtcNow.AddMinutes(Math.Max(5, _auth.Security.BloqueioMinutos));
            user.TentativasLoginFalhas = 0;
        }
        await _usuarios.AtualizarAsync(user, cancellationToken);
    }

    private string GerarJwt(UsuarioData user, DateTime expira)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_auth.Jwt.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id!),
            new(JwtRegisteredClaimNames.UniqueName, user.Usuario),
            new(ClaimTypes.NameIdentifier, user.Id!),
            new(ClaimTypes.Name, user.Nome),
            new(ClaimTypes.Role, user.Role),
            new("uid", user.Id!),
        };
        if (!string.IsNullOrWhiteSpace(user.TecnicoId))
            claims.Add(new Claim("tecnicoId", user.TecnicoId));
        if (!string.IsNullOrWhiteSpace(user.LojaOrigem))
            claims.Add(new Claim("lojaOrigem", user.LojaOrigem));

        var token = new JwtSecurityToken(
            issuer: _auth.Jwt.Issuer,
            audience: _auth.Jwt.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expira,
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string HashSenha(string senha) => BCrypt.Net.BCrypt.HashPassword(senha, workFactor: 11);

    private static void ValidarCredenciaisEntrada(string? usuario, string? senha)
    {
        if (string.IsNullOrWhiteSpace(usuario) || string.IsNullOrWhiteSpace(senha))
            throw new ArgumentException("Informe usuário e senha.");
        if (usuario.Trim().Length < 3)
            throw new ArgumentException("Usuário deve ter ao menos 3 caracteres.");
    }

    private static void ValidarSenhaForte(string? senha)
    {
        if (string.IsNullOrWhiteSpace(senha) || senha.Length < 8)
            throw new ArgumentException("A senha deve ter no mínimo 8 caracteres.");
        if (!senha.Any(char.IsLetter) || !senha.Any(char.IsDigit))
            throw new ArgumentException("A senha deve conter letras e números.");
    }

    private static string? NormalizarLojaOpcional(string? loja)
    {
        if (string.IsNullOrWhiteSpace(loja)) return null;
        var n = Config.OsLojaHelper.Normalizar(loja);
        if (!Config.OsLojaHelper.CodigosValidos.Contains(n, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("Loja inválida.");
        return n;
    }

    private static UsuarioPublicoDto ParaDto(UsuarioData u) => new(
        u.Id!,
        u.Usuario,
        u.Nome,
        u.Role,
        u.Ativo,
        u.TecnicoId,
        u.LojaOrigem,
        u.DeveTrocarSenha,
        u.UltimoLoginEm);
}
