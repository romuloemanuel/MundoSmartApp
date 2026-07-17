namespace MundoSmart.BlingAssistencia.API.Config;

/// <summary>
/// Horário de Brasília (America/Sao_Paulo) — datas operacionais da OS usam este fuso, não UTC.
/// </summary>
public static class HorarioBrasil
{
    private static readonly TimeZoneInfo Zona = ResolverZona();

    public static TimeZoneInfo TimeZone => Zona;

    /// <summary>Agora em horário de Brasília (Kind = Unspecified).</summary>
    public static DateTime Agora
    {
        get
        {
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona);
            return DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
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
        return DateTime.SpecifyKind(data, DateTimeKind.Unspecified);
    }

    public static DateTime ParaBrasil(DateTime valor)
    {
        return valor.Kind switch
        {
            DateTimeKind.Utc => DateTime.SpecifyKind(
                TimeZoneInfo.ConvertTimeFromUtc(valor, Zona),
                DateTimeKind.Unspecified),
            DateTimeKind.Local => DateTime.SpecifyKind(
                TimeZoneInfo.ConvertTime(valor, TimeZoneInfo.Local, Zona),
                DateTimeKind.Unspecified),
            _ => valor
        };
    }

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
