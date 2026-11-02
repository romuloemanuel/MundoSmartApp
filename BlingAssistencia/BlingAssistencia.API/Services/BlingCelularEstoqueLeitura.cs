using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Lê um produto do Bling como unidade de celular.
/// O preço de venda não vira custo. Sem IMEI de 15 dígitos não há unidade.
/// </summary>
public sealed class BlingCelularEstoqueLeitura
{
    private static readonly Regex ImeiRx = new(@"\b(\d{15})\b", RegexOptions.Compiled);
    private static readonly Regex CapacidadeRx = new(@"\b(16|32|64|128|256|512)\s*gb\b|\b(1|2)\s*tb\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly string[] Cores =
    [
        "meia-noite", "meia noite", "starlight", "estelar", "grafite", "titânio", "titanio",
        "midnight", "dourado", "prata", "preto", "branco", "azul", "vermelho", "verde",
        "roxo", "rosa", "cinza", "amarelo", "laranja", "bege", "coral", "lilás", "lilas",
        "natural", "deserto",
    ];
    private static readonly string[] Acessorio =
    [
        "capinha", "capa ", "capa de", "case", "pelicula", "película", "carregador", "cabo",
        "fone", "suporte", "vidro", "pulseira", "relogio", "relógio", "watch", "ipad", "tablet",
        "pelicula", "fonte", "adaptador", "caixa de som",
    ];

    public string Marca { get; init; } = "";
    public string Modelo { get; init; } = "";
    public string Cor { get; init; } = "";
    public string Configuracao { get; init; } = "";
    public string Condicao { get; init; } = "usado";
    public decimal Custo { get; init; }
    public decimal ValorVenda { get; init; }
    public decimal Saldo { get; init; }
    public IReadOnlyList<string> Imeis { get; init; } = [];
    public bool PareceCelular { get; init; }

    public static BlingCelularEstoqueLeitura Ler(
        string? nome,
        string? codigo,
        string? descricao,
        string? gtin,
        IEnumerable<string>? extras,
        decimal preco,
        decimal precoCusto,
        decimal saldo)
    {
        var nomeLimpo = (nome ?? "").Trim();
        var textos = new List<string>();
        if (!string.IsNullOrWhiteSpace(codigo)) textos.Add(codigo);
        if (!string.IsNullOrWhiteSpace(nomeLimpo)) textos.Add(nomeLimpo);
        if (!string.IsNullOrWhiteSpace(descricao)) textos.Add(descricao);
        if (!string.IsNullOrWhiteSpace(gtin)) textos.Add(gtin);
        if (extras is not null) textos.AddRange(extras.Where(x => !string.IsNullOrWhiteSpace(x))!);

        var normal = Normalizar(string.Join(" ", textos));
        var acessorio = Acessorio.Any(p => normal.Contains(Normalizar(p), StringComparison.Ordinal));
        var celular = !acessorio && (
            normal.Contains("iphone", StringComparison.Ordinal)
            || normal.Contains("galaxy", StringComparison.Ordinal)
            || normal.Contains("motorola", StringComparison.Ordinal)
            || normal.Contains("moto g", StringComparison.Ordinal)
            || normal.Contains("moto e", StringComparison.Ordinal)
            || normal.Contains("xiaomi", StringComparison.Ordinal)
            || normal.Contains("redmi", StringComparison.Ordinal)
            || normal.Contains("poco", StringComparison.Ordinal)
            || normal.Contains("realme", StringComparison.Ordinal)
            || normal.Contains("smartphone", StringComparison.Ordinal)
            || normal.Contains("celular", StringComparison.Ordinal)
            || normal.Contains("zenfone", StringComparison.Ordinal)
            || normal.Contains("pixel", StringComparison.Ordinal));

        var (marca, modelo) = MarcaModelo(nomeLimpo, normal);
        return new BlingCelularEstoqueLeitura
        {
            Marca = marca,
            Modelo = modelo,
            Cor = CorDe(normal),
            Configuracao = CapacidadeDe(nomeLimpo),
            Condicao = CondicaoDe(normal),
            Custo = Dinheiro(precoCusto),
            ValorVenda = Dinheiro(preco),
            Saldo = saldo < 0 ? 0 : saldo,
            Imeis = ImeisDe(textos),
            PareceCelular = celular && marca.Length > 0 && modelo.Length > 0,
        };
    }

    public static List<string> ImeisDe(IEnumerable<string> textos)
    {
        var lista = new List<string>();
        var vistos = new HashSet<string>(StringComparer.Ordinal);
        foreach (var texto in textos)
        {
            if (string.IsNullOrWhiteSpace(texto)) continue;
            foreach (Match m in ImeiRx.Matches(texto))
            {
                var d = m.Groups[1].Value;
                if (d.Distinct().Count() <= 1) continue;
                if (vistos.Add(d)) lista.Add(d);
            }
        }
        return lista;
    }

    public static string Normalizar(string? valor)
    {
        var t = (valor ?? "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(t.Length);
        foreach (var ch in t)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(ch);
        }
        return sb.ToString();
    }

    private static (string Marca, string Modelo) MarcaModelo(string nome, string normal)
    {
        var marca = normal switch
        {
            _ when normal.Contains("iphone", StringComparison.Ordinal) || normal.Contains("apple", StringComparison.Ordinal) => "Apple",
            _ when normal.Contains("samsung", StringComparison.Ordinal) || normal.Contains("galaxy", StringComparison.Ordinal) => "Samsung",
            _ when normal.Contains("motorola", StringComparison.Ordinal) || normal.Contains("moto g", StringComparison.Ordinal) || normal.Contains("moto e", StringComparison.Ordinal) => "Motorola",
            _ when normal.Contains("xiaomi", StringComparison.Ordinal) || normal.Contains("redmi", StringComparison.Ordinal) || normal.Contains("poco", StringComparison.Ordinal) => "Xiaomi",
            _ when normal.Contains("realme", StringComparison.Ordinal) => "Realme",
            _ when normal.Contains("zenfone", StringComparison.Ordinal) || normal.Contains("asus", StringComparison.Ordinal) => "Asus",
            _ when normal.Contains("pixel", StringComparison.Ordinal) || normal.Contains("google", StringComparison.Ordinal) => "Google",
            _ => "",
        };
        var modelo = nome.Trim();
        return (marca, modelo);
    }

    private static string CapacidadeDe(string nome)
    {
        var m = CapacidadeRx.Match(nome);
        if (!m.Success) return "";
        if (m.Groups[1].Success) return m.Groups[1].Value + " GB";
        return m.Groups[2].Value + " TB";
    }

    private static string CorDe(string normal)
    {
        foreach (var cor in Cores.OrderByDescending(c => c.Length))
        {
            if (normal.Contains(Normalizar(cor), StringComparison.Ordinal))
                return Cultura(cor);
        }
        return "";
    }

    private static string CondicaoDe(string normal)
    {
        if (normal.Contains("seminovo", StringComparison.Ordinal)
            || normal.Contains("semi-novo", StringComparison.Ordinal)
            || normal.Contains("semi novo", StringComparison.Ordinal)
            || normal.Contains("usado", StringComparison.Ordinal)
            || normal.Contains("vitrine", StringComparison.Ordinal))
            return "usado";
        if (normal.Contains("lacrado", StringComparison.Ordinal) || Regex.IsMatch(normal, @"\bnovo\b"))
            return "novo";
        return "usado";
    }

    private static string Cultura(string texto)
    {
        if (texto.Length == 0) return "";
        return char.ToUpper(texto[0], new CultureInfo("pt-BR")) + texto[1..];
    }

    private static decimal Dinheiro(decimal valor) =>
        valor <= 0 ? 0 : Math.Round(valor, 2, MidpointRounding.AwayFromZero);
}
