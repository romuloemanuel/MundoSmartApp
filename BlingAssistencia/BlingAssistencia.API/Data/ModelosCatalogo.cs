namespace MundoSmart.BlingAssistencia.API.Data;

/// <summary>
/// Linha da tabela de modelos (CSV). NomeModelo = só o modelo (ex.: G24), sem prefixo.
/// PrefixoMarca = como o mercado chama (ex.: Moto, Galaxy) — usado para limpar digitação.
/// </summary>
public sealed record ModeloCatalogoLinha(
    string Marca,
    string NomeModelo,
    string PrefixoMarca,
    string Linha,
    int? Ano = null);

/// <summary>
/// Catálogo multi-marca carregado de Data/modelos_catalogo.csv.
/// Colunas: Marca, NomeModelo, PrefixoMarca, Linha, Ano.
/// </summary>
public static class ModelosCatalogo
{
    private static readonly Lazy<IReadOnlyList<ModeloCatalogoLinha>> _linhas = new(Carregar);
    private static readonly string[] PrefixosExtras =
    [
        // Digitacao comum; "Redmi" NAO entra — alguns nomes do catalogo usam "Redmi 10" p/ nao colidir com Mi 10.
        "Galaxy", "POCO", "Poco", "iPhone", "Iphone", "Realme",
    ];

    private static readonly Lazy<string[]> _prefixos = new(() =>
        Todos
            .SelectMany(l => new[] { l.PrefixoMarca, l.Marca })
            .Concat(PrefixosExtras)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Select(p => p.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderByDescending(p => p.Length)
            .ToArray());

    public static IReadOnlyList<ModeloCatalogoLinha> Todos => _linhas.Value;

    public static IEnumerable<IGrouping<string, ModeloCatalogoLinha>> PorMarca()
        => Todos.GroupBy(l => l.Marca, StringComparer.OrdinalIgnoreCase);

    /// <summary>Remove prefixos conhecidos do catálogo (Moto, Motorola, Galaxy…).</summary>
    public static string NormalizarNomeModelo(string? nome)
    {
        var n = (nome ?? "").Trim();
        if (string.IsNullOrEmpty(n)) return n;

        foreach (var prefixo in _prefixos.Value)
        {
            if (n.StartsWith(prefixo + " ", StringComparison.OrdinalIgnoreCase))
            {
                n = n[(prefixo.Length + 1)..].TrimStart();
                break;
            }
        }

        // Legado curto Motorola
        if (n.StartsWith("MT ", StringComparison.OrdinalIgnoreCase))
            n = n[3..].TrimStart();

        return n;
    }

    private static IReadOnlyList<ModeloCatalogoLinha> Carregar()
    {
        var caminho = LocalizarArquivo();
        if (caminho is null)
            throw new FileNotFoundException(
                "Catálogo de modelos não encontrado. Esperado: Data/modelos_catalogo.csv");

        var lista = new List<ModeloCatalogoLinha>();
        foreach (var raw in File.ReadLines(caminho))
        {
            var linha = raw.Trim();
            if (linha.Length == 0 || linha.StartsWith('#')) continue;
            if (linha.StartsWith("Marca,", StringComparison.OrdinalIgnoreCase)) continue;

            var cols = ParseCsv(linha);
            if (cols.Count < 4) continue;

            var marca = cols[0].Trim();
            var nome = cols[1].Trim();
            var prefixo = cols[2].Trim();
            var linhaModelo = cols[3].Trim();
            if (string.IsNullOrWhiteSpace(marca) || string.IsNullOrWhiteSpace(nome)) continue;

            int? ano = null;
            if (cols.Count >= 5 && int.TryParse(cols[4].Trim(), out var a) && a > 1990)
                ano = a;

            lista.Add(new ModeloCatalogoLinha(marca, nome, prefixo, linhaModelo, ano));
        }

        return lista;
    }

    private static string? LocalizarArquivo()
    {
        var nome = Path.Combine("Data", "modelos_catalogo.csv");
        var candidatos = new[]
        {
            Path.Combine(AppContext.BaseDirectory, nome),
            Path.Combine(Directory.GetCurrentDirectory(), nome),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", nome)),
        };

        return candidatos.FirstOrDefault(File.Exists);
    }

    private static List<string> ParseCsv(string linha)
    {
        var cols = new List<string>();
        var atual = new System.Text.StringBuilder();
        var emAspas = false;

        for (var i = 0; i < linha.Length; i++)
        {
            var c = linha[i];
            if (c == '"')
            {
                if (emAspas && i + 1 < linha.Length && linha[i + 1] == '"')
                {
                    atual.Append('"');
                    i++;
                }
                else
                {
                    emAspas = !emAspas;
                }
                continue;
            }

            if (c == ',' && !emAspas)
            {
                cols.Add(atual.ToString());
                atual.Clear();
                continue;
            }

            atual.Append(c);
        }

        cols.Add(atual.ToString());
        return cols;
    }
}
