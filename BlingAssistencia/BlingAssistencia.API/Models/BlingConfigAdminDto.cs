namespace MundoSmart.BlingAssistencia.API.Models;

public class BlingConfigAdminDto
{
    public string ClientId { get; set; } = string.Empty;
    /// <summary>True se há secret configurado (appsettings ou Mongo). O valor nunca é devolvido.</summary>
    public bool ClientSecretConfigurado { get; set; }
    public string RedirectUri { get; set; } = string.Empty;
    public bool ConsultaProdutosHabilitada { get; set; }
    public int ConsultaProdutosSyncMinutos { get; set; }
    public long IdCampoPermitePersonalizacao { get; set; }
    public bool ModoLocal { get; set; }
    public bool Habilitado { get; set; }
    public bool TokenConectado { get; set; }
    public DateTime? TokenExpiraEm { get; set; }
    public bool TemOverrideMongo { get; set; }
    public DateTime? AtualizadoEm { get; set; }
}

public class BlingConfigAdminSalvarDto
{
    public string? ClientId { get; set; }
    /// <summary>Vazio/null = mantém o secret atual.</summary>
    public string? ClientSecret { get; set; }
    public string? RedirectUri { get; set; }
    public bool ConsultaProdutosHabilitada { get; set; }
    public int ConsultaProdutosSyncMinutos { get; set; }
    public long IdCampoPermitePersonalizacao { get; set; }
}
