namespace MundoSmart.BlingAssistencia.API.Config;

/// <summary>
/// Horário de Brasília (America/Sao_Paulo) — datas operacionais da OS usam este fuso.
/// Convenção: gravar o relógio de parede com Kind=Utc (sem converter), para o MongoDB
/// não aplicar Local→UTC de novo (o que somava +3h ou +6h após idas e voltas).
/// A UI exibe com timeZone: 'UTC' para mostrar o mesmo relógio.
/// </summary>
public static class HorarioBrasil
{
    private static readonly TimeZoneInfo Zona = ResolverZona();

    public static TimeZoneInfo TimeZone => Zona;

    /// <summary>Agora em horário de Brasília (Kind = Utc, valor = relógio de parede).</summary>
    public static DateTime Agora
    {
        get
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona);
            return DateTime.SpecifyKind(local, DateTimeKind.Utc);
        }
    }

    /// <summary>Soma N dias úteis (seg–sex) a partir da data base em Brasília.</summary>
    public static DateTime AdicionarDiasUteis(int diasUteis, DateTime? baseLocal = null)
    {
        var data = (baseLocal ?? Agora).Date;
        var restantes = Math.Max(0, diasUteis);
        while (restantes > 0)
        {
            data = data.AddDays(1);
            if (data.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday)
                restantes--;
        }
        return DateTime.SpecifyKind(data, DateTimeKind.Utc);
    }

    /// <summary>
    /// Preserva o relógio de parede e marca Utc — evita conversão de fuso no Mongo/JSON.
    /// </summary>
    public static DateTime ComoUtcParede(DateTime valor)
    {
        if (valor.Kind == DateTimeKind.Utc)
            return valor;

        return DateTime.SpecifyKind(
            new DateTime(valor.Year, valor.Month, valor.Day, valor.Hour, valor.Minute, valor.Second, valor.Millisecond),
            DateTimeKind.Utc);
    }

    public static DateTime? ComoUtcParede(DateTime? valor) =>
        valor.HasValue ? ComoUtcParede(valor.Value) : null;

    /// <summary>
    /// Normaliza para a convenção operacional (relógio de parede + Kind Utc).
    /// Não converte fuso — evita deslocar datas já no horário de Brasília.
    /// </summary>
    public static DateTime ParaBrasil(DateTime valor) => ComoUtcParede(valor);

    private static TimeZoneInfo ResolverZona()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows()
                    ? "E. South America Standard Time"
                    : "America/Sao_Paulo");
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.CreateCustomTimeZone(
                "America/Sao_Paulo",
                TimeSpan.FromHours(-3),
                "Horário de Brasília",
                "Horário de Brasília");
        }
    }
}
