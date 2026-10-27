using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Data;

public sealed class ProdutoCelularParseResult
{
    public string Marca { get; init; } = string.Empty;
    public string Modelo { get; init; } = string.Empty;
    public string? MarcaId { get; init; }
    public string? ModeloId { get; init; }
    public string Cor { get; init; } = string.Empty;
    public string Configuracao { get; init; } = string.Empty;
}

/// <summary>
/// Extrai marca, modelo, cor e configuração (armazenamento) do nome do produto no Bling.
/// </summary>
public static class ProdutoCelularNomeParser
{
    private static readonly Regex CapacidadeRx = new(
        @"\b(\d{1,4})\s*(GB|TB)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex LixoRx = new(
        @"\b(smartphone|celular|telefone|aparelho|novo|seminovo|usado|recondicionado|lacrado|nacional|global|dual\s*sim|5g|4g|lte)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly (string Phrase, string Label)[] Cores =
    [
        ("space gray", "Space Gray"),
        ("space grey", "Space Gray"),
        ("product red", "Product Red"),
        ("midnight green", "Midnight Green"),
        ("pacific blue", "Pacific Blue"),
        ("sierra blue", "Sierra Blue"),
        ("alpine green", "Alpine Green"),
        ("deep purple", "Deep Purple"),
        ("starlight", "Starlight"),
        ("midnight", "Midnight"),
        ("graphite", "Graphite"),
        ("grafite", "Grafite"),
        ("titânio", "Titânio"),
        ("titanio", "Titânio"),
        ("titanium", "Titanium"),
        ("ultramarine", "Ultramarine"),
        ("champagne", "Champagne"),
        ("dourado", "Dourado"),
        ("gold", "Gold"),
        ("prata", "Prata"),
        ("silver", "Silver"),
        ("branco", "Branco"),
        ("white", "White"),
        ("preto", "Preto"),
        ("black", "Black"),
        ("azul", "Azul"),
        ("blue", "Blue"),
        ("verde", "Verde"),
        ("green", "Green"),
        ("vermelho", "Vermelho"),
        ("red", "Red"),
        ("rosa", "Rosa"),
        ("pink", "Pink"),
        ("rosé", "Rosé"),
        ("rose", "Rose"),
        ("roxo", "Roxo"),
        ("purple", "Purple"),
        ("lilás", "Lilás"),
        ("lilas", "Lilás"),
        ("amarelo", "Amarelo"),
        ("yellow", "Yellow"),
        ("cinza", "Cinza"),
        ("gray", "Gray"),
        ("grey", "Grey"),
        ("laranja", "Laranja"),
        ("orange", "Orange"),
        ("coral", "Coral"),
        ("bronze", "Bronze"),
        ("creme", "Creme"),
        ("cream", "Cream"),
        ("natural", "Natural"),
        ("desert", "Desert"),
        ("teal", "Teal"),
    ];

    private static readonly Dictionary<string, string> MarcaAlias = new(StringComparer.OrdinalIgnoreCase)
    {
        ["apple"] = "iPhone",
        ["iphone"] = "iPhone",
        ["samsung"] = "Samsung",
        ["galaxy"] = "Samsung",
        ["motorola"] = "Motorola",
        ["moto"] = "Motorola",
        ["xiaomi"] = "Xiaomi",
        ["redmi"] = "Xiaomi",
        ["poco"] = "Xiaomi",
        ["realme"] = "Realme",
        ["lg"] = "LG",
        ["asus"] = "Asus",
        ["infinix"] = "Infinix",
        ["tecno"] = "Tecno",
        ["nokia"] = "Nokia",
        ["huawei"] = "Huawei",
        ["honor"] = "Honor",
        ["oneplus"] = "OnePlus",
        ["google"] = "Google",
        ["pixel"] = "Google",
    };

    public static ProdutoCelularParseResult Parse(string? produtoNome, IReadOnlyList<ModeloAparelho> catalogo)
    {
        var original = (produtoNome ?? "").Trim();
        if (original.Length == 0)
            return new ProdutoCelularParseResult();

        var cor = ExtrairCor(original);
        var config = ExtrairConfiguracao(original);
        var trabalho = RemoverExtra(original, cor, config);
        var trabalhoNorm = Normalizar(trabalho);

        var marcaCatalogo = DetectarMarca(trabalhoNorm, catalogo);
        var modelo = EncontrarModelo(trabalhoNorm, marcaCatalogo, catalogo);

        if (modelo is not null)
        {
            return new ProdutoCelularParseResult
            {
                Marca = modelo.MarcaNome ?? marcaCatalogo ?? "",
                Modelo = modelo.Nome,
                MarcaId = modelo.MarcaId,
                ModeloId = modelo.Id,
                Cor = cor,
                Configuracao = config,
            };
        }

        var marca = marcaCatalogo ?? DetectarMarcaAlias(trabalhoNorm);
        var modeloLivre = InferirModeloLivre(trabalho, marca);
        return new ProdutoCelularParseResult
        {
            Marca = marca ?? "",
            Modelo = modeloLivre,
            Cor = cor,
            Configuracao = config,
        };
    }

    public static bool MesmoModelo(
        string? osMarca,
        string? osModelo,
        string? osModeloId,
        BlingVendaCelularData venda)
    {
        if (!string.IsNullOrWhiteSpace(osModeloId)
            && !string.IsNullOrWhiteSpace(venda.ModeloId)
            && string.Equals(osModeloId.Trim(), venda.ModeloId.Trim(), StringComparison.OrdinalIgnoreCase))
            return true;

        var osMod = ModelosCatalogo.NormalizarNomeModelo(osModelo);
        var vendaMod = ModelosCatalogo.NormalizarNomeModelo(venda.Modelo);
        if (string.IsNullOrWhiteSpace(osMod) && string.IsNullOrWhiteSpace(vendaMod))
            return false;

        var osNorm = Normalizar(osMod);
        var vendaNorm = Normalizar(vendaMod);
        if (osNorm.Length > 0 && osNorm == vendaNorm)
            return MarcaCompativel(osMarca, venda.Marca);

        var osSemGeracao = SemGeracao(osNorm);
        var vendaSemGeracao = SemGeracao(vendaNorm);
        if (osSemGeracao.Length >= 2 && osSemGeracao == vendaSemGeracao)
            return MarcaCompativel(osMarca, venda.Marca);

        if (osNorm.Length >= 2 && ContemToken(Normalizar(venda.ProdutoNome), osNorm))
            return MarcaCompativel(osMarca, venda.Marca);

        if (vendaNorm.Length >= 2 && ContemToken(Normalizar(osModelo), vendaNorm))
            return MarcaCompativel(osMarca, venda.Marca);

        return false;
    }

    private static string SemGeracao(string textoNorm) =>
        Regex.Replace(Regex.Replace(textoNorm ?? "", @"\b[45]g\b", " "), @"\s+", " ").Trim();

    private static bool MarcaCompativel(string? a, string? b)
    {
        var na = CanonicalMarca(a);
        var nb = CanonicalMarca(b);
        if (string.IsNullOrEmpty(na) || string.IsNullOrEmpty(nb)) return true;
        return string.Equals(na, nb, StringComparison.OrdinalIgnoreCase);
    }

    private static string CanonicalMarca(string? marca)
    {
        var n = Normalizar(marca);
        if (n.Length == 0) return "";
        return MarcaAlias.TryGetValue(n, out var canon) ? canon : (marca ?? "").Trim();
    }

    private static string ExtrairCor(string nome)
    {
        var lower = RemoverAcentos(nome).ToLowerInvariant();
        foreach (var (phrase, label) in Cores)
        {
            var p = RemoverAcentos(phrase).ToLowerInvariant();
            if (ContemToken(lower, p)) return label;
        }
        return "";
    }

    private static string ExtrairConfiguracao(string nome)
    {
        var caps = CapacidadeRx.Matches(nome)
            .Select(m => $"{m.Groups[1].Value}{m.Groups[2].Value.ToUpperInvariant()}")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        return caps.Count == 0 ? "" : string.Join(" / ", caps);
    }

    private static string RemoverExtra(string nome, string cor, string config)
    {
        var t = nome;
        foreach (Match m in CapacidadeRx.Matches(nome))
            t = t.Replace(m.Value, " ", StringComparison.OrdinalIgnoreCase);
        if (!string.IsNullOrEmpty(cor))
            t = Regex.Replace(t, Regex.Escape(cor), " ", RegexOptions.IgnoreCase);
        t = LixoRx.Replace(t, " ");
        return Regex.Replace(t, @"\s+", " ").Trim();
    }

    private static string? DetectarMarca(string textoNorm, IReadOnlyList<ModeloAparelho> catalogo)
    {
        var nomes = catalogo
            .Select(m => (m.MarcaNome ?? "").Trim())
            .Where(n => n.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(n => n.Length)
            .ToList();

        foreach (var nome in nomes)
        {
            if (ContemToken(textoNorm, Normalizar(nome)))
                return nome;
        }

        return DetectarMarcaAlias(textoNorm);
    }

    private static string? DetectarMarcaAlias(string textoNorm)
    {
        foreach (var kv in MarcaAlias.OrderByDescending(k => k.Key.Length))
        {
            if (ContemToken(textoNorm, kv.Key))
                return kv.Value;
        }
        return null;
    }

    private static ModeloAparelho? EncontrarModelo(
        string textoNorm,
        string? marca,
        IReadOnlyList<ModeloAparelho> catalogo)
    {
        IEnumerable<ModeloAparelho> candidatos = catalogo
            .Where(m => !string.IsNullOrWhiteSpace(m.Nome));

        if (!string.IsNullOrWhiteSpace(marca))
        {
            var marcaCanon = CanonicalMarca(marca);
            candidatos = candidatos.Where(m =>
                string.Equals(CanonicalMarca(m.MarcaNome), marcaCanon, StringComparison.OrdinalIgnoreCase));
        }

        ModeloAparelho? melhor = null;
        var melhorLen = 0;
        foreach (var modelo in candidatos)
        {
            var nomeCurto = ModelosCatalogo.NormalizarNomeModelo(modelo.Nome);
            var precisaMarca = PrecisaMarcaParaBater(nomeCurto);
            if (precisaMarca && string.IsNullOrWhiteSpace(marca))
                continue;

            var variantes = new[]
            {
                Normalizar(nomeCurto),
                Normalizar(modelo.Nome),
                Normalizar($"{modelo.MarcaNome} {nomeCurto}"),
                Normalizar($"galaxy {nomeCurto}"),
                Normalizar($"moto {nomeCurto}"),
                Normalizar($"iphone {nomeCurto}"),
            }.Where(v => v.Length >= 2).Distinct().ToArray();

            foreach (var v in variantes)
            {
                if (!ContemToken(textoNorm, v)) continue;
                if (v.Length > melhorLen)
                {
                    melhor = modelo;
                    melhorLen = v.Length;
                }
            }
        }

        return melhor;
    }

    private static bool PrecisaMarcaParaBater(string nomeModelo)
    {
        var n = (nomeModelo ?? "").Trim();
        if (n.Length <= 2) return true;
        return n.All(c => char.IsDigit(c) || char.IsWhiteSpace(c));
    }

    private static string InferirModeloLivre(string trabalho, string? marca)
    {
        var t = trabalho;
        if (!string.IsNullOrWhiteSpace(marca))
        {
            t = Regex.Replace(t, $@"\b{Regex.Escape(marca)}\b", " ", RegexOptions.IgnoreCase);
            foreach (var kv in MarcaAlias.Where(a =>
                         string.Equals(a.Value, marca, StringComparison.OrdinalIgnoreCase)))
                t = Regex.Replace(t, $@"\b{Regex.Escape(kv.Key)}\b", " ", RegexOptions.IgnoreCase);
        }
        t = ModelosCatalogo.NormalizarNomeModelo(Regex.Replace(t, @"\s+", " ").Trim());
        return t;
    }

    public static string Normalizar(string? valor)
    {
        var t = RemoverAcentos((valor ?? "").Trim()).ToLowerInvariant();
        t = Regex.Replace(t, @"[^a-z0-9]+", " ");
        return Regex.Replace(t, @"\s+", " ").Trim();
    }

    public static bool ContemToken(string textoNorm, string termoNorm)
    {
        if (string.IsNullOrEmpty(textoNorm) || string.IsNullOrEmpty(termoNorm)) return false;
        var idx = 0;
        while ((idx = textoNorm.IndexOf(termoNorm, idx, StringComparison.Ordinal)) >= 0)
        {
            var before = idx == 0 || !char.IsLetterOrDigit(textoNorm[idx - 1]);
            var afterIdx = idx + termoNorm.Length;
            var after = afterIdx >= textoNorm.Length || !char.IsLetterOrDigit(textoNorm[afterIdx]);
            if (before && after) return true;
            idx++;
        }
        return false;
    }

    private static string RemoverAcentos(string texto)
    {
        var norm = texto.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(norm.Length);
        foreach (var c in norm)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }
}
