namespace MundoSmart.BlingAssistencia.API.Settings;

/// <summary>
/// Limites de cores do indicador de estoque (appsettings / variáveis Estoque__*).
/// </summary>
public class EstoqueSettings
{
    /// <summary>Laranja quando 0 &lt; quantidade &lt; este valor (padrão: 3).</summary>
    public int LimiteLaranja { get; set; } = 3;

    /// <summary>Amarelo quando LimiteLaranja &lt;= quantidade &lt; este valor (padrão: 5).</summary>
    public int LimiteAmarelo { get; set; } = 5;
}
