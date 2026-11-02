namespace MundoSmart.BlingAssistencia.API.Settings;

/// <summary>Configuração da recepção mobile (QR / fotos).</summary>
public class IntakeSettings
{
    public const string SectionName = "Intake";

    /// <summary>
    /// URL pública do front usada no QR.
    /// Em produção configure via Intake:AppBaseUrl ou variável Intake__AppBaseUrl.
    /// Em Development o front pode enviar o IP da LAN no query appUrl.
    /// </summary>
    public string AppBaseUrl { get; set; } = "";

    /// <summary>
    /// Site que o celular já abre. O domínio automático do painel (*.easypanel.host) não entrega a página.
    /// </summary>
    public const string UrlPublicaPadrao = "https://gestaosmart.mundosmartoficial.com.br";

    public string UrlDoQr(string? appUrlDoCliente, bool desenvolvimento)
    {
        if (desenvolvimento)
        {
            if (UrlAbsoluta(appUrlDoCliente))
                return Limpar(appUrlDoCliente!);
            if (UrlAbsoluta(AppBaseUrl))
                return Limpar(AppBaseUrl);
            return "http://localhost:4200";
        }

        if (UrlPublicaUtil(AppBaseUrl))
            return Limpar(AppBaseUrl);

        return UrlPublicaPadrao;
    }

    private static bool UrlPublicaUtil(string? url)
    {
        if (!Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var uri)) return false;
        if (!string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)) return false;
        var host = uri.IdnHost;
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1") return false;
        if (host.EndsWith(".easypanel.host", StringComparison.OrdinalIgnoreCase)) return false;
        if (System.Net.IPAddress.TryParse(host, out _)) return false;
        return true;
    }

    private static bool UrlAbsoluta(string? url) =>
        Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static string Limpar(string url) => url.Trim().TrimEnd('/');
}
