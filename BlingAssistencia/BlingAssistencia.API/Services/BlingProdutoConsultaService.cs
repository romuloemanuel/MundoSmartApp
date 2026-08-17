using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingProdutoConsultaService
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<ConsultaProdutosResponse> ConsultarAsync(string categoria, string? termo, bool incluirZerados = false);
}

public class BlingProdutoConsultaService : IBlingProdutoConsultaService
{
    public const string CatCapinhas = "capinhas";
    public const string CatPeliculas = "peliculas";
    public const string CatTermicos = "termicos";

    private static readonly Dictionary<string, string[]> PalavrasCategoria = new(StringComparer.OrdinalIgnoreCase)
    {
        [CatCapinhas] = ["capinha", "capa ", "capa-", "case"],
        [CatPeliculas] = ["pelicula", "película", "film", "vidro temperado"],
        [CatTermicos] = ["termico", "térmico", "garrafa", "copo térmico", "squeeze"],
    };

    private static readonly string[] CoresConhecidas =
    [
        "transparente", "crystal", "grafite", "cinza", "preto", "preta", "branco", "branca",
        "azul", "vermelho", "vermelha", "verde", "rosa", "lilás", "lilas", "roxo", "roxa",
        "amarelo", "amarela", "laranja", "dourado", "dourada", "prata", "marrom", "nude",
        "bege", "tiffany", "colorido", "colorida", "smoke", "clear",
    ];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    private readonly IBlingProdutoAcessorioRepository _repo;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<BlingProdutoConsultaService> _log;

    public BlingProdutoConsultaService(
        IBlingProdutoAcessorioRepository repo,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        ILogger<BlingProdutoConsultaService> log)
    {
        _repo = repo;
        _auth = auth;
        _httpFactory = httpFactory;
        _log = log;
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _repo.EnsureIndexesAsync(cancellationToken);

    public async Task<ConsultaProdutosResponse> ConsultarAsync(string categoria, string? termo, bool incluirZerados = false)
    {
        var cat = NormalizarCategoria(categoria);
        var t = (termo ?? "").Trim();
        if (t.Length > 80) t = t[..80];

        var origem = "cache";
        string? aviso = null;
        List<BlingProdutoAcessorioCache> itens;

        var bling = await TentarBuscarBlingAsync(cat, t);
        if (bling.Ok)
        {
            origem = "bling";
            if (bling.Itens.Count > 0)
                await _repo.UpsertMuitosAsync(bling.Itens);
            itens = bling.Itens
                .Where(x => incluirZerados || x.Saldo > 0)
                .Where(x => TermoCombina(x, t))
                .ToList();

            if (itens.Count == 0)
            {
                var cache = await _repo.BuscarAsync(cat, t, incluirZerados);
                if (cache.Count > 0)
                {
                    itens = cache;
                    origem = "cache";
                    aviso = "Bling não retornou estoque para este modelo; mostrando último cache.";
                }
            }
        }
        else
        {
            aviso = bling.Aviso;
            itens = await _repo.BuscarAsync(cat, t, incluirZerados);
        }

        return new ConsultaProdutosResponse
        {
            Categoria = cat,
            Termo = t,
            Origem = origem,
            Aviso = aviso,
            Grupos = Agrupar(itens),
        };
    }

    private static string NormalizarCategoria(string? categoria)
    {
        var c = (categoria ?? "").Trim().ToLowerInvariant()
            .Replace("í", "i").Replace("é", "e").Replace("á", "a").Replace("ã", "a");
        return c switch
        {
            "capinha" or "capa" or "capas" => CatCapinhas,
            "pelicula" or "peliculas" => CatPeliculas,
            "termico" or "termicos" or "garrafa" or "garrafas" => CatTermicos,
            CatCapinhas or CatPeliculas or CatTermicos => c,
            _ => throw new ArgumentException("Categoria inválida. Use capinhas, peliculas ou termicos."),
        };
    }

    private static bool TermoCombina(BlingProdutoAcessorioCache x, string termo)
    {
        if (termo.Length < 2) return true;
        return Contem(x.Nome, termo) || Contem(x.NomeBase, termo)
            || Contem(x.Modelo, termo) || Contem(x.Codigo, termo);
    }

    private static bool Contem(string? valor, string termo) =>
        !string.IsNullOrWhiteSpace(valor)
        && valor.Contains(termo, StringComparison.OrdinalIgnoreCase);

    private async Task<(bool Ok, List<BlingProdutoAcessorioCache> Itens, string? Aviso)> TentarBuscarBlingAsync(
        string categoria, string termo)
    {
        var token = _auth.GetCurrentToken();
        if (token is null
            || string.IsNullOrWhiteSpace(token.AccessToken)
            || token.AccessToken.StartsWith("local-bypass", StringComparison.OrdinalIgnoreCase)
            || token.ExpiresAt <= DateTime.UtcNow)
        {
            return (false, [], "Consulta no Bling indisponível no momento — usando catálogo local.");
        }

        try
        {
            var http = _httpFactory.CreateClient("BlingProdutos");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

            var nomesBusca = MontarBuscasBling(categoria, termo);
            var mapa = new Dictionary<long, BlingProdutoListaItem>();

            foreach (var nome in nomesBusca)
            {
                var url = $"produtos?pagina=1&limite=100&criterio=2&tipo=P&nome={Uri.EscapeDataString(nome)}";
                using var resp = await http.GetAsync(url);
                if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                    return (false, [], "Token Bling expirado. Reconecte o Bling e tente de novo.");
                if (!resp.IsSuccessStatusCode)
                {
                    _log.LogWarning("Bling produtos {Status} para {Nome}", (int)resp.StatusCode, nome);
                    continue;
                }

                var json = await resp.Content.ReadAsStringAsync();
                var lista = JsonSerializer.Deserialize<BlingListaProdutos>(json, JsonOpts);
                foreach (var p in lista?.Data ?? [])
                {
                    if (p.Id <= 0) continue;
                    mapa[p.Id] = p;
                }
            }

            var filtrados = mapa.Values
                .Where(p => EhDaCategoria(p.Nome, categoria))
                .Take(80)
                .ToList();

            if (filtrados.Count == 0)
                return (true, [], null);

            var ids = filtrados.Select(p => p.Id).ToList();
            var saldos = await ObterSaldosAsync(http, ids);

            var itens = new List<BlingProdutoAcessorioCache>();
            foreach (var p in filtrados)
            {
                var saldo = saldos.GetValueOrDefault(p.Id, p.Estoque?.SaldoVirtualTotal ?? 0);
                var (baseNome, cor) = SepararNomeCor(p.Nome);
                itens.Add(new BlingProdutoAcessorioCache
                {
                    BlingId = p.Id,
                    Categoria = categoria,
                    Nome = p.Nome ?? baseNome,
                    NomeBase = baseNome,
                    Modelo = ExtrairModelo(p.Nome, termo),
                    Cor = cor,
                    Codigo = p.Codigo,
                    Saldo = saldo,
                    Preco = p.Preco,
                    ImagemUrl = p.ImagemURL,
                    AtualizadoEm = DateTime.UtcNow,
                });
            }

            return (true, itens, null);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao consultar produtos no Bling");
            return (false, [], "Não foi possível falar com o Bling agora — usando catálogo local.");
        }
    }

    private static List<string> MontarBuscasBling(string categoria, string termo)
    {
        var keyword = categoria switch
        {
            CatCapinhas => "capinha",
            CatPeliculas => "pelicula",
            _ => "termico",
        };
        var buscas = new List<string>();
        if (termo.Length >= 2)
        {
            buscas.Add($"{keyword} {termo}");
            buscas.Add(termo);
        }
        else
        {
            buscas.Add(keyword);
        }
        return buscas.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static bool EhDaCategoria(string? nome, string categoria)
    {
        if (!PalavrasCategoria.TryGetValue(categoria, out var palavras)) return false;
        var n = (nome ?? "").ToLowerInvariant();
        return palavras.Any(p => n.Contains(p, StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<Dictionary<long, decimal>> ObterSaldosAsync(HttpClient http, List<long> ids)
    {
        var saldos = new Dictionary<long, decimal>();
        if (ids.Count == 0) return saldos;

        var qs = string.Join("&", ids.Take(50).Select(id => $"idsProdutos[]={id}"));
        using var resp = await http.GetAsync($"estoques?{qs}");
        if (!resp.IsSuccessStatusCode) return saldos;

        var json = await resp.Content.ReadAsStringAsync();
        var lista = JsonSerializer.Deserialize<BlingListaEstoques>(json, JsonOpts);
        foreach (var e in lista?.Data ?? [])
        {
            var id = e.Produto?.Id ?? 0;
            if (id > 0)
                saldos[id] = e.SaldoVirtualTotal != 0 ? e.SaldoVirtualTotal : e.SaldoFisicoTotal;
        }
        return saldos;
    }

    internal static (string NomeBase, string Cor) SepararNomeCor(string? nome)
    {
        var raw = (nome ?? "").Trim();
        if (string.IsNullOrEmpty(raw)) return ("Produto", "Única");

        var lower = raw.ToLowerInvariant();
        foreach (var cor in CoresConhecidas.OrderByDescending(c => c.Length))
        {
            var idx = lower.LastIndexOf(cor, StringComparison.Ordinal);
            if (idx < 0) continue;
            var depois = idx + cor.Length;
            if (depois < raw.Length && char.IsLetter(raw[depois])) continue;
            if (idx > 0 && char.IsLetter(raw[idx - 1])) continue;

            var baseNome = raw[..idx].Trim(' ', '-', '–', '—', '/', '|');
            var corLabel = char.ToUpper(raw[idx]) + raw[(idx + 1)..depois];
            return (string.IsNullOrWhiteSpace(baseNome) ? raw : baseNome, corLabel);
        }

        var partes = raw.Split(['-', '–', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length >= 2 && partes[^1].Length <= 18)
            return (string.Join(" - ", partes[..^1]), partes[^1]);

        return (raw, "Única");
    }

    internal static string? ExtrairModelo(string? nome, string termo)
    {
        if (!string.IsNullOrWhiteSpace(termo) && termo.Length >= 2 && Contem(nome, termo))
            return termo.Trim();
        return null;
    }

    private static List<ConsultaProdutoGrupo> Agrupar(List<BlingProdutoAcessorioCache> itens)
    {
        return itens
            .GroupBy(x => string.IsNullOrWhiteSpace(x.NomeBase) ? x.Nome : x.NomeBase, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var cores = g
                    .GroupBy(x => string.IsNullOrWhiteSpace(x.Cor) ? "Única" : x.Cor.Trim(), StringComparer.OrdinalIgnoreCase)
                    .Select(cg => new ConsultaProdutoCor
                    {
                        Cor = cg.First().Cor,
                        Saldo = cg.Sum(x => x.Saldo),
                        Codigo = cg.Select(x => x.Codigo).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
                        Preco = cg.Select(x => x.Preco).FirstOrDefault(p => p is > 0),
                    })
                    .OrderByDescending(c => c.Saldo)
                    .ThenBy(c => c.Cor, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return new ConsultaProdutoGrupo
                {
                    Nome = g.Key,
                    Modelo = g.Select(x => x.Modelo).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)),
                    SaldoTotal = cores.Sum(c => c.Saldo),
                    Cores = cores,
                };
            })
            .OrderByDescending(g => g.SaldoTotal)
            .ThenBy(g => g.Nome, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private sealed class BlingListaProdutos
    {
        public List<BlingProdutoListaItem>? Data { get; set; }
    }

    private sealed class BlingProdutoListaItem
    {
        public long Id { get; set; }
        public string? Nome { get; set; }
        public string? Codigo { get; set; }
        public decimal? Preco { get; set; }
        public string? Formato { get; set; }
        public string? ImagemURL { get; set; }
        public BlingProdutoEstoque? Estoque { get; set; }
    }

    private sealed class BlingProdutoEstoque
    {
        public decimal SaldoVirtualTotal { get; set; }
    }

    private sealed class BlingListaEstoques
    {
        public List<BlingEstoqueItem>? Data { get; set; }
    }

    private sealed class BlingEstoqueItem
    {
        public BlingEstoqueProdutoRef? Produto { get; set; }
        public decimal SaldoVirtualTotal { get; set; }
        public decimal SaldoFisicoTotal { get; set; }
    }

    private sealed class BlingEstoqueProdutoRef
    {
        public long Id { get; set; }
    }
}
