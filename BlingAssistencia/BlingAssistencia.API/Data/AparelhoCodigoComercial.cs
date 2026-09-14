using System.Text.RegularExpressions;

namespace MundoSmart.BlingAssistencia.API.Data;

/// <summary>
/// Códigos de fábrica (PayMobi/IMEI) → nome comercial usado na loja.
/// </summary>
public static class AparelhoCodigoComercial
{
    private static readonly Dictionary<string, string> Nomes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["RMX5303"] = "C71",
        ["RMX3933"] = "Note 60",
        ["RMX3938"] = "Note 60x",
        ["RMX5020"] = "C75x",
        ["XT2421-7"] = "Moto G04s",
        ["XT24217"] = "Moto G04s",
        ["MOTOG04S"] = "Moto G04s",
        ["SM-A042M"] = "Galaxy A04e",
        ["SMA042M"] = "Galaxy A04e",
        ["SM-A125M"] = "Galaxy A12",
        ["SMA125M"] = "Galaxy A12",
        ["2312BPC51X"] = "POCO C61",
        ["24095PCADG"] = "POCO X7",
        ["2409BRN2CA"] = "Redmi 14C",
        ["25028RN03L"] = "Redmi A5",
        ["25078PC3EG"] = "POCO C85",
        ["25078RA3EA"] = "Redmi 15C",
    };

    private static readonly Regex TokenFabrica = new(
        @"RMX\d{3,}|SM-[A-Z0-9]+(?:/[A-Z]+)?|XT\d{3,}(?:-\d+)?|\d{4}[A-Z]{2,}[A-Z0-9]{2,}",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string Nome(string? modelo)
    {
        var original = (modelo ?? "").Trim();
        if (original.Length == 0) return original;

        if (Nomes.TryGetValue(Chave(original), out var comercial))
            return comercial;

        var semHifen = Chave(original).Replace("-", "", StringComparison.Ordinal);
        if (Nomes.TryGetValue(semHifen, out comercial))
            return comercial;

        foreach (Match m in TokenFabrica.Matches(original))
        {
            var token = Chave(m.Value);
            if (Nomes.TryGetValue(token, out comercial))
                return comercial;
            var tokenSemHifen = token.Replace("-", "", StringComparison.Ordinal);
            if (Nomes.TryGetValue(tokenSemHifen, out comercial))
                return comercial;
        }

        return original;
    }

    public static bool PareceCodigoFabrica(string? modelo)
    {
        var t = (modelo ?? "").Trim();
        if (t.Length == 0) return false;
        if (TokenFabrica.IsMatch(t)) return true;
        var compacto = Chave(t).Replace("-", "", StringComparison.Ordinal);
        return compacto.StartsWith("RMX", StringComparison.OrdinalIgnoreCase)
            || compacto.StartsWith("SM", StringComparison.OrdinalIgnoreCase)
            || Regex.IsMatch(compacto, @"^\d{4}[A-Z]{2,}");
    }

    public static IReadOnlyDictionary<string, string> Todos => Nomes;

    public static string Chave(string? modelo)
    {
        var t = (modelo ?? "").Trim().ToUpperInvariant().Replace(" ", "");
        if (t.EndsWith("/DS", StringComparison.Ordinal))
            t = t[..^3];
        return t;
    }
}
