using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

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
    private readonly BlingSettings _bling;
    private readonly ILogger<BlingProdutoConsultaService> _log;

    public BlingProdutoConsultaService(
        IBlingProdutoAcessorioRepository repo,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        IOptions<BlingSettings> bling,
        ILogger<BlingProdutoConsultaService> log)
    {
        _repo = repo;
        _auth = auth;
        _httpFactory = httpFactory;
        _bling = bling.Value;
        _log = log;
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _repo.EnsureIndexesAsync(cancellationToken);

    public async Task<ConsultaProdutosResponse> ConsultarAsync(string categoria, string? termo, bool incluirZerados = false)
    {
        var cat = NormalizarCategoria(categoria);
        var t = (termo ?? "").Trim();
        if (t.Length > 80) t = t[..80];

        var bling = await TentarBuscarBlingAsync(cat, t);
        if (!bling.Ok)
        {
            return new ConsultaProdutosResponse
            {
                Categoria = cat,
                Termo = t,
                Origem = "bling",
                Aviso = bling.Aviso ?? "Conecte o Bling para consultar o estoque real.",
                Grupos = [],
            };
        }

        if (bling.Itens.Count > 0)
        {
            try
            {
                await _repo.UpsertMuitosAsync(bling.Itens);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha ao cachear produtos Bling no Mongo (consulta segue normalmente)");
            }
        }

        var itens = bling.Itens
            .Where(x => incluirZerados || x.Saldo > 0)
            .Where(x => TermoCombina(x, t))
            .ToList();

        return new ConsultaProdutosResponse
        {
            Categoria = cat,
            Termo = t,
            Origem = "bling",
            Aviso = bling.Aviso
                ?? (itens.Count == 0 && bling.Itens.Count > 0
                    ? "Produtos encontrados no Bling, mas todos com saldo zero. Marque «incluir zerados» se quiser vê-los."
                    : null),
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
        if (!_bling.ConsultaProdutosHabilitada)
            return (false, [], "Consulta Bling de produtos desabilitada. Ative Bling:ConsultaProdutosHabilitada.");

        var token = await ObterTokenValidoAsync();
        if (token is null)
        {
            return (false, [], "Bling não conectado. No topo do sistema, clique em «Conectar Bling (capinhas)» e autorize a conta.");
        }

        try
        {
            var http = _httpFactory.CreateClient("BlingProdutos");
            using var authScope = new AuthHeaderScope(http, token.AccessToken);

            var idCategoria = await ResolverIdCategoriaAsync(http, categoria);
            var mapa = new Dictionary<long, BlingProdutoListaItem>();

            if (idCategoria is > 0)
            {
                // Lista pela categoria do Bling (ex.: Capinha de Celular).
                // criterio: 1=últimos incluídos, 2=ativos, 3=inativos (API v3).
                for (var pagina = 1; pagina <= 5; pagina++)
                {
                    var url =
                        $"produtos?pagina={pagina}&limite=100&criterio=2&tipo=P" +
                        $"&idCategoria={idCategoria.Value}";
                    if (termo.Length >= 2)
                        url += $"&nome={Uri.EscapeDataString(termo)}";

                    var lote = await BuscarPaginaProdutosAsync(http, url);
                    if (lote.Count == 0) break;
                    foreach (var p in lote)
                    {
                        if (p.Id > 0) mapa[p.Id] = p;
                    }
                    if (lote.Count < 100) break;
                }
            }
            else
            {
                // Fallback por nome se a categoria não for encontrada no Bling.
                foreach (var nome in MontarBuscasBling(categoria, termo))
                {
                    var url = $"produtos?pagina=1&limite=100&criterio=2&tipo=P&nome={Uri.EscapeDataString(nome)}";
                    foreach (var p in await BuscarPaginaProdutosAsync(http, url))
                    {
                        if (p.Id > 0) mapa[p.Id] = p;
                    }
                }
            }

            _log.LogInformation(
                "Bling produtos: categoria={Cat} idCategoria={IdCat} termo={Termo} brutos={N}",
                categoria, idCategoria, termo, mapa.Count);

            var filtrados = mapa.Values
                .Where(p => idCategoria is > 0 || EhDaCategoria(p.Nome, categoria))
                .Take(120)
                .ToList();

            if (filtrados.Count == 0)
            {
                var msg = idCategoria is null
                    ? $"Nenhum produto retornado. Categoria Bling não encontrada para «{categoria}». Confira o nome (ex.: Capinha de Celular)."
                    : mapa.Count == 0
                        ? "Nenhum produto ativo nessa categoria no Bling."
                        : "Produtos encontrados, mas nenhum bateu com o filtro de nome.";
                return (true, [], msg);
            }

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
        catch (UnauthorizedAccessException)
        {
            return (false, [], "Token Bling expirado. Clique em «Conectar Bling (capinhas)» e autorize de novo.");
        }
        catch (InvalidOperationException ex)
        {
            return (false, [], ex.Message);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao consultar produtos no Bling");
            return (false, [], "Não foi possível falar com o Bling agora. Verifique a conexão e tente de novo.");
        }
    }

    private async Task<List<BlingProdutoListaItem>> BuscarPaginaProdutosAsync(HttpClient http, string url)
    {
        using var resp = await http.GetAsync(url);
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("Token Bling expirado.");
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            _log.LogWarning("Bling produtos {Status} url={Url} body={Body}", (int)resp.StatusCode, url, body[..Math.Min(300, body.Length)]);
            if (resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
                throw new InvalidOperationException(
                    "Bling recusou acesso aos produtos (403). Confira se o app tem permissão de Produtos/Estoque e reconecte.");
            return [];
        }

        var json = await resp.Content.ReadAsStringAsync();
        var lista = JsonSerializer.Deserialize<BlingListaProdutos>(json, JsonOpts);
        return lista?.Data ?? [];
    }

    private async Task<long?> ResolverIdCategoriaAsync(HttpClient http, string categoriaApp)
    {
        var candidatos = NomesCategoriaBling(categoriaApp);
        for (var pagina = 1; pagina <= 10; pagina++)
        {
            using var resp = await http.GetAsync($"categorias/produtos?pagina={pagina}&limite=100");
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("Bling categorias/produtos HTTP {Status}", (int)resp.StatusCode);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync();
            var lista = JsonSerializer.Deserialize<BlingListaCategorias>(json, JsonOpts);
            var itens = lista?.Data ?? [];
            if (itens.Count == 0) break;

            foreach (var c in itens)
            {
                var nome = (c.Descricao ?? c.Nome ?? "").Trim();
                if (string.IsNullOrEmpty(nome) || c.Id <= 0) continue;
                foreach (var cand in candidatos)
                {
                    if (string.Equals(nome, cand, StringComparison.OrdinalIgnoreCase)
                        || nome.Contains(cand, StringComparison.OrdinalIgnoreCase))
                    {
                        _log.LogInformation("Categoria Bling resolvida: {Nome} -> {Id}", nome, c.Id);
                        return c.Id;
                    }
                }
            }

            if (itens.Count < 100) break;
        }

        return null;
    }

    private static string[] NomesCategoriaBling(string categoriaApp) => categoriaApp switch
    {
        CatCapinhas => ["Capinha de Celular", "Capinhas", "Capinha"],
        CatPeliculas => ["Película", "Peliculas", "Películas", "Película de Celular"],
        CatTermicos => ["Térmico", "Termicos", "Garrafa", "Copo Térmico"],
        _ => [categoriaApp],
    };

    /// <summary>Define Authorization no HttpClient e limpa ao sair (client compartilhado).</summary>
    private sealed class AuthHeaderScope : IDisposable
    {
        private readonly HttpClient _http;
        public AuthHeaderScope(HttpClient http, string accessToken)
        {
            _http = http;
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        }
        public void Dispose() => _http.DefaultRequestHeaders.Authorization = null;
    }

    private async Task<BlingTokenResponse?> ObterTokenValidoAsync()
    {
        var token = _auth.GetCurrentToken();
        if (token is null
            || string.IsNullOrWhiteSpace(token.AccessToken)
            || token.AccessToken.StartsWith("local-bypass", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (token.ExpiresAt > DateTime.UtcNow.AddMinutes(1))
            return token;

        if (string.IsNullOrWhiteSpace(token.RefreshToken))
            return null;

        try
        {
            return await _auth.RefreshTokenAsync(token.RefreshToken);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao renovar token Bling");
            return null;
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

    private sealed class BlingListaCategorias
    {
        public List<BlingCategoriaItem>? Data { get; set; }
    }

    private sealed class BlingCategoriaItem
    {
        public long Id { get; set; }
        public string? Descricao { get; set; }
        public string? Nome { get; set; }
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
