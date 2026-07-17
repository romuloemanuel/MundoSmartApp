namespace MundoSmart.BlingAssistencia.API.Settings;

/// <summary>Configuração da recepção mobile (QR / fotos).</summary>
public class IntakeSettings
{
    public const string SectionName = "Intake";

    /// <summary>
    /// URL pública do front usada no QR (ex.: https://app.mundosmart.com.br).
    /// Em produção configure via variável Intake__AppBaseUrl.
    /// Em Development o front pode enviar o IP da LAN no query appUrl.
    /// </summary>
    public string AppBaseUrl { get; set; } = "";
}
