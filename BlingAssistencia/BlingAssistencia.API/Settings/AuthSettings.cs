namespace MundoSmart.BlingAssistencia.API.Settings;

public class AuthSettings
{
    public const string SectionName = "Auth";

    /// <summary>
    /// Se false, API libera tudo sem JWT (só para Development).
    /// Em produção mantenha true (ou omita — default true).
    /// </summary>
    public bool Enabled { get; set; } = true;

    public JwtSettings Jwt { get; set; } = new();
    public SeedSettings Seed { get; set; } = new();
    public SecuritySettings Security { get; set; } = new();
    /// <summary>Origens CORS permitidas (front na LAN).</summary>
    public string[] AllowedOrigins { get; set; } =
    [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://192.168.0.14:4200",
    ];
}

public class JwtSettings
{
    public string Issuer { get; set; } = "MundoSmart.API";
    public string Audience { get; set; } = "MundoSmart.App";
    /// <summary>Chave simétrica (≥ 32 chars). Em produção use variável de ambiente Auth__Jwt__Key.</summary>
    public string Key { get; set; } = "MundoSmart-Dev-Troque-Em-Producao-32chars!!";
    public int AccessTokenMinutos { get; set; } = 480; // 8h — turno de oficina
    /// <summary>Validade do refresh token (renovação silenciosa do access de 8h).</summary>
    public int RefreshTokenDias { get; set; } = 14;
}

public class SeedSettings
{
    public string AdminUsuario { get; set; } = "admin";
    public string AdminSenha { get; set; } = "Admin@4552";
    public string AdminNome { get; set; } = "Administrador";
    public string RootUsuario { get; set; } = "root";
    public string RootSenha { get; set; } = "Root@123";
    public string RootNome { get; set; } = "Root";
}

public class SecuritySettings
{
    public int MaxFalhasLogin { get; set; } = 5;
    public int BloqueioMinutos { get; set; } = 15;
    public int LoginRateLimitPorMinuto { get; set; } = 10;
}
