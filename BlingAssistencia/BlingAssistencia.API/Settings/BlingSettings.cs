namespace MundoSmart.BlingAssistencia.API.Settings;

public class BlingSettings
{
    /// <summary>Quando true, usa MongoDB local em vez da API do Bling (não envia dados à produção).</summary>
    public bool ModoLocal { get; set; } = true;

    /// <summary>Integração real com a API Bling. Só tem efeito quando ModoLocal = false.</summary>
    public bool Habilitado { get; set; } = false;

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public bool ExigirAutenticacao { get; set; } = false;
}
