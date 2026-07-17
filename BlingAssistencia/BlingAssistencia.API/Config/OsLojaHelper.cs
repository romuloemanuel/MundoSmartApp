namespace MundoSmart.BlingAssistencia.API.Config;

/// <summary>
/// Lojas de origem. Só Mococa possui assistência técnica;
/// as demais criam OS e enviam o aparelho para Mococa.
/// </summary>
public static class OsLojaHelper
{
    public const string Mococa = "MCC";
    public const string Arceburgo = "ARCE";
    public const string SaoJose = "SJ";
    public const string Cajuru = "CJR";

    /// <summary>Padrão = Mococa (única assistência técnica).</summary>
    public const string Padrao = Mococa;

    public static readonly string[] CodigosValidos = [Mococa, Arceburgo, SaoJose, Cajuru];

    public static string Normalizar(string? codigo)
    {
        var raw = codigo?.Trim().ToUpperInvariant();
        if (string.IsNullOrEmpty(raw)) return Padrao;

        return raw switch
        {
            // Legado AST / “Assistência” → Mococa
            "AST" or "ASS" or "ASSISTENCIA" or "ASSISTÊNCIA" => Mococa,
            "MCC" or "MOCOCA" => Mococa,
            "ARCE" or "ARCEBURGO" => Arceburgo,
            "SJ" or "SAO JOSE" or "SÃO JOSÉ" or "SAO JOSÉ" => SaoJose,
            "CJR" or "CAJURU" => Cajuru,
            _ => CodigosValidos.Contains(raw) ? raw : raw
        };
    }
}
