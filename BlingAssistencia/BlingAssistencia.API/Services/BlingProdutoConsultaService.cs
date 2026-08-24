using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingProdutoConsultaService
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<ConsultaProdutosResponse> ConsultarAsync(string categoria, string? termo, bool incluirZerados = false);
    /// <summary>Puxa Bling → Mongo (uma categoria ou todas). Usado pelo job e pelo botão Atualizar.</summary>
    Task<ConsultaProdutosSyncResult> SincronizarAsync(string? categoria = null, CancellationToken cancellationToken = default);
    Task<ConsultaProdutosSyncStatus> ObterStatusSyncAsync();
}

public class BlingProdutoConsultaService : IBlingProdutoConsultaService
{
    public const string CatCapinhas = "capinhas";
    public const string CatPeliculas = "peliculas";
    public const string CatTermicos = "termicos";

    private static readonly TimeSpan CatalogoTtl = TimeSpan.FromSeconds(30);
    private readonly ConcurrentDictionary<string, (DateTime Em, List<BlingProdutoAcessorioCache> Itens)> _catalogo = new();
    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private DateTime? _ultimaSyncEm;
    private string? _ultimoSyncAviso;
    private int _syncEmAndamento;

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
        "bege", "tiffany", "colorido", "colorida", "smoke", "clear", "glitter",
    ];

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    private readonly IBlingProdutoAcessorioRepository _repo;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IBlingEffectiveSettings _blingEff;
    private readonly ILogger<BlingProdutoConsultaService> _log;
    private readonly string _campoPersoPath;
    private long? _idCampoPersoMemoria;

    private BlingSettings _bling => _blingEff.Current;

    public BlingProdutoConsultaService(
        IBlingProdutoAcessorioRepository repo,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        IBlingEffectiveSettings blingEff,
        IHostEnvironment env,
        ILogger<BlingProdutoConsultaService> log)
    {
        _repo = repo;
        _auth = auth;
        _httpFactory = httpFactory;
        _blingEff = blingEff;
        _log = log;
        var dir = Path.Combine(env.ContentRootPath, "App_Data");
        Directory.CreateDirectory(dir);
        _campoPersoPath = Path.Combine(dir, "bling-campo-personalizacao.json");
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _repo.EnsureIndexesAsync(cancellationToken);

    public async Task<ConsultaProdutosResponse> ConsultarAsync(string categoria, string? termo, bool incluirZerados = false)
    {
        try
        {
            var cat = NormalizarCategoria(categoria);
            var t = (termo ?? "").Trim();
            if (t.Length > 80) t = t[..80];

            // Catálogo completo da categoria (sem termo no Bling). Filtro aparelho/marca/tipo é local.
            var (itensBrutos, origem, avisoSync) = await ObterCatalogoCategoriaAsync(cat);
            itensBrutos ??= [];

            if (itensBrutos.Count == 0 && !string.IsNullOrEmpty(avisoSync))
            {
                return new ConsultaProdutosResponse
                {
                    Categoria = cat,
                    Termo = t,
                    Origem = origem,
                    Aviso = avisoSync,
                    Grupos = [],
                };
            }

            var itens = itensBrutos
                .Where(x => EhCacheConsultaValido(x, cat))
                .Where(x => incluirZerados || x.Saldo > 0)
                .Where(x => TermoCombina(x, t))
                .ToList();

            string? aviso = avisoSync;
            if (aviso is null && itens.Count == 0 && itensBrutos.Count > 0)
            {
                aviso = t.Length >= 2
                    ? $"Nada encontrado para «{t}». Tente aparelho (A54), marca (Samsung) ou tipo (silicone)."
                    : "Produtos no cache com saldo zero. Marque «Mostrar sem estoque» se quiser vê-los.";
            }

            List<ConsultaProdutoGrupo> grupos;
            try
            {
                grupos = Agrupar(itens);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Falha ao agrupar produtos da consulta");
                grupos = [];
                aviso ??= "Não foi possível organizar o estoque. Tente buscar de novo.";
            }

            DateTime? atualizadoEm = itensBrutos.Count > 0
                ? itensBrutos.Max(x => (DateTime?)x.AtualizadoEm)
                : await _repo.ObterUltimaAtualizacaoAsync(cat);

            // Aviso se cache antigo (mais que 2 ciclos de sync).
            var syncMin = Math.Max(5, _bling.ConsultaProdutosSyncMinutos);
            if (aviso is null && atualizadoEm is DateTime au)
            {
                var idade = DateTime.UtcNow - au;
                if (idade > TimeSpan.FromMinutes(syncMin * 2))
                    aviso = $"Estoque em cache desatualizado (última sync {au.ToLocalTime():dd/MM HH:mm}). Clique em «Atualizar» ou aguarde o sync automático.";
            }

            return new ConsultaProdutosResponse
            {
                Categoria = cat,
                Termo = t,
                Origem = origem,
                Aviso = aviso,
                AtualizadoEm = atualizadoEm,
                SyncIntervaloMinutos = syncMin,
                Grupos = grupos,
            };
        }
        catch (ArgumentException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "ConsultaProdutos.ConsultarAsync falhou");
            return new ConsultaProdutosResponse
            {
                Categoria = (categoria ?? "").Trim().ToLowerInvariant(),
                Termo = (termo ?? "").Trim(),
                Origem = "erro",
                Aviso = "Consulta de produtos falhou inesperadamente. Tente novamente em instantes.",
                SyncIntervaloMinutos = Math.Max(5, _bling.ConsultaProdutosSyncMinutos),
                Grupos = [],
            };
        }
    }

    public async Task<ConsultaProdutosSyncStatus> ObterStatusSyncAsync()
    {
        var ultimaMongo = await _repo.ObterUltimaAtualizacaoAsync();
        return new ConsultaProdutosSyncStatus
        {
            SyncIntervaloMinutos = Math.Max(5, _bling.ConsultaProdutosSyncMinutos),
            UltimaSyncEm = _ultimaSyncEm ?? ultimaMongo,
            UltimoAviso = _ultimoSyncAviso,
            SyncEmAndamento = Interlocked.CompareExchange(ref _syncEmAndamento, 0, 0) == 1,
        };
    }

    public async Task<ConsultaProdutosSyncResult> SincronizarAsync(
        string? categoria = null,
        CancellationToken cancellationToken = default)
    {
        if (!_bling.ConsultaProdutosHabilitada)
        {
            return new ConsultaProdutosSyncResult
            {
                Ok = false,
                Aviso = "Consulta Bling desabilitada. Ative Bling:ConsultaProdutosHabilitada.",
            };
        }

        await _blingEff.EnsureLoadedAsync(cancellationToken);

        if (!await _syncLock.WaitAsync(0, cancellationToken))
        {
            return new ConsultaProdutosSyncResult
            {
                Ok = false,
                Aviso = "Já existe uma sincronização em andamento. Aguarde.",
            };
        }

        Interlocked.Exchange(ref _syncEmAndamento, 1);
        try
        {
            var cats = string.IsNullOrWhiteSpace(categoria)
                ? new[] { CatCapinhas, CatPeliculas, CatTermicos }
                : [NormalizarCategoria(categoria)];

            var porCat = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var avisos = new List<string>();
            var total = 0;

            foreach (var cat in cats)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var bling = await TentarBuscarBlingAsync(cat);
                if (bling.Ok && bling.Itens.Count > 0)
                {
                    try
                    {
                        await _repo.UpsertMuitosAsync(bling.Itens);
                    }
                    catch (Exception ex)
                    {
                        _log.LogWarning(ex, "Falha ao gravar sync Bling no Mongo ({Cat})", cat);
                        avisos.Add($"Falha ao gravar {cat} no cache.");
                    }

                    // Sempre relê o Mongo: sync parcial (429) não pode sobrescrever o catálogo em memória.
                    var refreshed = await _repo.BuscarAsync(cat, "", incluirZerados: true);
                    _catalogo[cat] = (DateTime.UtcNow, refreshed.Count > 0 ? refreshed : bling.Itens);
                    porCat[cat] = bling.Itens.Count;
                    total += bling.Itens.Count;
                    if (bling.Itens.Count < 20 && refreshed.Count > bling.Itens.Count * 2)
                    {
                        avisos.Add(
                            $"Sync {cat} veio incompleto ({bling.Itens.Count} itens). Cache anterior mantido; tente Atualizar de novo.");
                    }
                    if (!string.IsNullOrWhiteSpace(bling.Aviso))
                        avisos.Add(bling.Aviso!);
                }
                else
                {
                    porCat[cat] = 0;
                    // Não zera o catálogo em memória se o Bling falhou.
                    avisos.Add(bling.Aviso ?? $"Sem dados do Bling para {cat}.");
                }

                // Evita rajada 429 entre categorias.
                await Task.Delay(800, cancellationToken);
            }

            _ultimaSyncEm = DateTime.UtcNow;
            _ultimoSyncAviso = avisos.Count > 0
                ? string.Join(" ", avisos.Distinct().Take(3))
                : null;

            return new ConsultaProdutosSyncResult
            {
                Ok = total > 0,
                Itens = total,
                AtualizadoEm = _ultimaSyncEm,
                PorCategoria = porCat,
                Aviso = total > 0
                    ? _ultimoSyncAviso
                    : (_ultimoSyncAviso ?? "Nenhum produto sincronizado do Bling."),
            };
        }
        finally
        {
            Interlocked.Exchange(ref _syncEmAndamento, 0);
            _syncLock.Release();
        }
    }

    /// <summary>
    /// Consulta do balcão: só Mongo (+ memória). Bling entra via sync em background / botão.
    /// </summary>
    private async Task<(List<BlingProdutoAcessorioCache> Itens, string Origem, string? Aviso)> ObterCatalogoCategoriaAsync(
        string categoria)
    {
        if (_catalogo.TryGetValue(categoria, out var mem)
            && DateTime.UtcNow - mem.Em < CatalogoTtl
            && mem.Itens.Count > 0)
        {
            return (mem.Itens, "cache", null);
        }

        try
        {
            await _repo.GarantirSeedAsync();
            var cache = await _repo.BuscarAsync(categoria, "", incluirZerados: true);
            if (cache.Count > 0)
            {
                _catalogo[categoria] = (DateTime.UtcNow, cache);
                string? aviso = null;
                if (_ultimoSyncAviso != null
                    && (_ultimaSyncEm is null || DateTime.UtcNow - _ultimaSyncEm > TimeSpan.FromMinutes(1)))
                {
                    // Só ecoa aviso de sync recente se ainda relevante.
                }

                var ultima = cache.Max(x => x.AtualizadoEm);
                var syncMin = Math.Max(5, _bling.ConsultaProdutosSyncMinutos);
                if (DateTime.UtcNow - ultima > TimeSpan.FromMinutes(syncMin * 2)
                    && !_bling.ConsultaProdutosHabilitada)
                {
                    aviso = "Catálogo local. Ative e conecte o Bling para sincronizar estoque real.";
                }

                return (cache, "cache", aviso);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao ler cache Mongo de produtos");
        }

        return ([], "cache",
            "Nenhum produto no cache. Conecte o Bling e clique em «Atualizar» (ou aguarde o sync automático).");
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

        // Aparelho, marca, tipo de capinha, cor, nome e código.
        var haystack = NormalizarBusca(
            $"{x.Modelo} {x.Marca} {x.NomeBase} {x.Cor} {x.Nome} {x.Codigo}");
        var needle = NormalizarBusca(termo);
        if (needle.Length < 2) return true;

        if (haystack.Contains(needle, StringComparison.Ordinal))
            return true;

        var hayCompact = haystack.Replace(" ", "");
        var needleCompact = needle.Replace(" ", "");
        if (needleCompact.Length >= 2 && hayCompact.Contains(needleCompact, StringComparison.Ordinal))
            return true;

        // "iphone 15" / "capinha silicone" → todos os tokens.
        var tokens = needle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tokens.Length > 1
            && tokens.All(tok => tok.Length < 2
                || haystack.Contains(tok, StringComparison.Ordinal)
                || hayCompact.Contains(tok, StringComparison.Ordinal));
    }

    private static string NormalizarBusca(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "";
        var t = RemoverAcentos(valor).ToLowerInvariant();
        return Regex.Replace(t, @"\s+", " ").Trim();
    }

    private static bool Contem(string? valor, string termo) =>
        !string.IsNullOrWhiteSpace(valor)
        && valor.Contains(termo, StringComparison.OrdinalIgnoreCase);

    private async Task<(bool Ok, List<BlingProdutoAcessorioCache> Itens, string? Aviso)> TentarBuscarBlingAsync(
        string categoria)
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
            var tokenHeader = token.AccessToken;

            // Só usa id já conhecido (config/disco) antes do catálogo — evita gastar cota Bling e tomar 429.
            var idCampoPersonalizacao = await ObterIdCampoPersonalizacaoAsync(http, tokenHeader, permitirRede: false);

            var idCategoria = await ResolverIdCategoriaAsync(http, tokenHeader, categoria);
            var mapa = new Dictionary<long, BlingProdutoListaItem>();
            var usouCategoria = false;

            if (idCategoria is > 0)
            {
                usouCategoria = true;
                await BuscarProdutosPorCategoriaAsync(http, tokenHeader, idCategoria.Value, mapa);
            }

            // Garante personalizáveis (ex.: CAP-IP-COURO) mesmo se a categoria paginou incompleta.
            if (categoria == CatCapinhas)
                await EnriquecerProdutosPersonalizaveisAsync(http, tokenHeader, mapa);

            // Categoria vazia/errada → busca pela palavra da categoria (capinha, etc.).
            if (mapa.Count == 0)
            {
                usouCategoria = false;
                foreach (var nome in MontarBuscasBling(categoria))
                {
                    // V = variações (SKU real); T = todos; sem tipo = padrão Bling.
                    // Acumula vários tipos/páginas — não para no primeiro lote.
                    foreach (var tipo in new[] { "V", "T", "" })
                    foreach (var criterio in new[] { 2, 5 })
                    {
                        for (var pagina = 1; pagina <= 10; pagina++)
                        {
                            var url =
                                $"produtos?pagina={pagina}&limite=100&criterio={criterio}" +
                                $"&nome={Uri.EscapeDataString(nome)}";
                            if (!string.IsNullOrEmpty(tipo))
                                url += $"&tipo={tipo}";

                            var lote = await BuscarPaginaProdutosAsync(http, tokenHeader, url);
                            if (lote.Count == 0) break;
                            foreach (var p in lote)
                            {
                                if (p.Id > 0) mapa[p.Id] = p;
                            }
                            if (lote.Count < 100) break;
                        }

                        if (mapa.Count >= 800) break;
                    }
                    if (mapa.Count >= 400) break;
                }

                if (categoria == CatCapinhas)
                    await EnriquecerProdutosPersonalizaveisAsync(http, tokenHeader, mapa);
            }

            _log.LogInformation(
                "Bling produtos: categoria={Cat} idCategoria={IdCat} usouCat={Usou} brutos={N}",
                categoria, idCategoria, usouCategoria, mapa.Count);

            var filtrados = mapa.Values
                .Where(p => usouCategoria || EhDaCategoria(p.Nome, categoria) || CandidatoPersonalizacao(p.Nome, p.Codigo))
                .Take(2500)
                .ToList();

            if (filtrados.Count == 0)
            {
                var msg = idCategoria is null && mapa.Count == 0
                    ? $"Nenhum produto retornado do Bling para «{categoria}». Reconecte o Bling ou confira a categoria (ex.: Capinha de Celular)."
                    : mapa.Count == 0
                        ? "Nenhum produto ativo encontrado no Bling para essa busca."
                        : "Produtos encontrados, mas nenhum bateu com o filtro.";
                return (true, [], msg);
            }

            // Pais com formato V não têm estoque — expandir para SKUs de variação (cores/modelos).
            var folhas = await ExpandirVariacoesAsync(http, tokenHeader, filtrados);
            // Capinhas: só "Capa…" com SKU (código) cadastrado — evita lixo sem cadastro.
            folhas = folhas.Where(p => EhProdutoConsultaValido(p, categoria)).ToList();
            _log.LogInformation(
                "Bling após filtro Capa+SKU: folhas={F} (categoria={Cat})",
                folhas.Count, categoria);

            // Descobre o id do campo DEPOIS do catálogo (com retry), se ainda não temos.
            if (idCampoPersonalizacao is null)
            {
                await Task.Delay(1500);
                idCampoPersonalizacao = await ObterIdCampoPersonalizacaoAsync(http, tokenHeader, permitirRede: true);
            }

            _log.LogInformation(
                "Campo «Permite Personalização»: id={Id}",
                idCampoPersonalizacao?.ToString() ?? "(não encontrado)");

            var flagPersonalizacaoCache = new Dictionary<long, bool>();

            // Só consulta detalhe Bling nos candidatos (couro/case/personaliz) — evita 429 em 800 GETs.
            var idsParaDetalhe = folhas
                .Where(p => CandidatoPersonalizacao(p.Nome, p.Codigo))
                .Select(p => p.IdProdutoPai is > 0 ? p.IdProdutoPai.Value : p.Id)
                .Where(id => id > 0)
                .Distinct()
                .ToList();

            _log.LogInformation(
                "Personalização: {N} produtos candidatos a detalhe (de {Total})",
                idsParaDetalhe.Count, folhas.Count);

            foreach (var idDetalhe in idsParaDetalhe)
            {
                var amostra = folhas.FirstOrDefault(p =>
                    (p.IdProdutoPai is > 0 ? p.IdProdutoPai.Value : p.Id) == idDetalhe);
                await ObterPermitePersonalizacaoAsync(
                    http, tokenHeader, idDetalhe, idCampoPersonalizacao, flagPersonalizacaoCache, amostra?.Nome);
                await Task.Delay(400); // throttle anti-429
            }

            var ids = folhas.Select(p => p.Id).Where(id => id > 0).Distinct().ToList();
            var saldos = await ObterSaldosAsync(http, tokenHeader, ids);

            var itens = new List<BlingProdutoAcessorioCache>();
            foreach (var p in folhas)
            {
                decimal saldo;
                if (saldos.TryGetValue(p.Id, out var sEstoque))
                    saldo = sEstoque;
                else
                    saldo = p.Estoque?.SaldoVirtualTotal
                        ?? p.Estoque?.SaldoFisicoTotal
                        ?? 0;

                var campos = ExtrairCamposProduto(p.Nome, p.VariacaoNome);
                var idParaCampo = p.IdProdutoPai is > 0 ? p.IdProdutoPai.Value : p.Id;
                var permite = false;
                if (flagPersonalizacaoCache.TryGetValue(idParaCampo, out var flagCache))
                    permite = flagCache;
                else
                    permite = NomeSugerePersonalizacao(p.Nome) || NomeSugerePersonalizacao(campos.Tipo);

                itens.Add(new BlingProdutoAcessorioCache
                {
                    BlingId = p.Id,
                    Categoria = categoria,
                    Nome = p.Nome ?? campos.Tipo,
                    NomeBase = campos.Tipo,
                    Modelo = campos.Aparelho,
                    Marca = campos.Marca,
                    Cor = campos.Cor,
                    Codigo = p.Codigo,
                    Saldo = saldo,
                    Preco = p.Preco,
                    ImagemUrl = p.ImagemURL,
                    PermitePersonalizacao = permite,
                    AtualizadoEm = DateTime.UtcNow,
                });
            }

            var qtdPerso = itens.Count(x => x.PermitePersonalizacao);
            _log.LogInformation(
                "Personalização: {Perso}/{Total} itens com flag ativa (categoria={Cat})",
                qtdPerso, itens.Count, categoria);

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

    private async Task BuscarProdutosPorCategoriaAsync(
        HttpClient http,
        string accessToken,
        long idCategoria,
        Dictionary<long, BlingProdutoListaItem> mapa)
    {
        // Sem &nome=: o modelo do aparelho fica na variação; filtro é local depois.
        // Pagina tudo (antes parava em 400 e produtos como CAP-IP-COURO ficavam de fora).
        foreach (var tipo in new[] { "V", "T", "" })
        foreach (var criterio in new[] { 2, 5 })
        {
            for (var pagina = 1; pagina <= 25; pagina++)
            {
                var url =
                    $"produtos?pagina={pagina}&limite=100&criterio={criterio}" +
                    $"&idCategoria={idCategoria}";
                if (!string.IsNullOrEmpty(tipo))
                    url += $"&tipo={tipo}";

                var lote = await BuscarPaginaProdutosAsync(http, accessToken, url);
                if (lote.Count == 0) break;
                foreach (var p in lote)
                {
                    if (p.Id > 0) mapa[p.Id] = p;
                }
                if (lote.Count < 100) break;
                await Task.Delay(150);
            }
        }
    }

    /// <summary>Inclui CAP-IP-COURO / Case Couro que a listagem por categoria pode omitir.</summary>
    private async Task EnriquecerProdutosPersonalizaveisAsync(
        HttpClient http,
        string accessToken,
        Dictionary<long, BlingProdutoListaItem> mapa)
    {
        var antes = mapa.Count;
        var urls = new[]
        {
            "produtos?pagina=1&limite=50&codigo=CAP-IP-COURO",
            "produtos?pagina=1&limite=100&criterio=2&nome=" + Uri.EscapeDataString("Case Couro"),
            "produtos?pagina=1&limite=100&criterio=2&nome=" + Uri.EscapeDataString("Couro"),
            "produtos?pagina=1&limite=100&criterio=5&nome=" + Uri.EscapeDataString("Couro"),
        };

        foreach (var url in urls)
        {
            try
            {
                var lote = await BuscarPaginaProdutosComRetryAsync(http, accessToken, url);
                foreach (var p in lote)
                {
                    if (p.Id > 0) mapa[p.Id] = p;
                }
                await Task.Delay(200);
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Enrich personalizáveis falhou em {Url}", url);
            }
        }

        // Produto do print Bling (id conhecido).
        if (!mapa.ContainsKey(16531104605))
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "produtos/16531104605");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var resp = await http.SendAsync(req);
                if (resp.IsSuccessStatusCode)
                {
                    var json = await resp.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    if (TryGetPropertyCI(doc.RootElement, "data", out var data))
                    {
                        var item = JsonSerializer.Deserialize<BlingProdutoListaItem>(
                            data.GetRawText(),
                            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                        if (item is { Id: > 0 })
                            mapa[item.Id] = item;
                    }
                }
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Falha ao buscar produto 16531104605");
            }
        }

        _log.LogInformation(
            "Enrich personalizáveis: +{Add} (mapa {Antes}→{Depois})",
            mapa.Count - antes, antes, mapa.Count);
    }

    /// <summary>
    /// Produtos com formato V (pai) não carregam saldo — busca SKUs em /produtos/variacoes/{id}.
    /// Pais não expandidos (rate limit / 403) continuam no resultado para não sumir do catálogo.
    /// </summary>
    private async Task<List<BlingProdutoListaItem>> ExpandirVariacoesAsync(
        HttpClient http,
        string accessToken,
        List<BlingProdutoListaItem> produtos)
    {
        var resultado = new Dictionary<long, BlingProdutoListaItem>();
        var paisParaExpandir = new List<BlingProdutoListaItem>();

        foreach (var p in produtos)
        {
            var formato = (p.Formato ?? "").Trim().ToUpperInvariant();
            // V / E com variação: estoque fica nas filhas. S = simples (já é SKU).
            if (formato is "V" or "C")
                paisParaExpandir.Add(p);
            else
                resultado[p.Id] = p;
        }

        // Expande o máximo possível; o restante dos pais entra como item (melhor que descartar).
        const int maxExpand = 200;
        var expandido = 0;
        var scopeBloqueado = false;
        foreach (var pai in paisParaExpandir)
        {
            if (scopeBloqueado || expandido >= maxExpand)
            {
                resultado[pai.Id] = pai;
                continue;
            }

            var (filhos, bloqueado) = await ObterVariacoesDoPaiAsync(http, accessToken, pai.Id);
            expandido++;
            if (bloqueado) scopeBloqueado = true;

            if (filhos.Count == 0)
            {
                resultado[pai.Id] = pai;
                continue;
            }

            foreach (var filho in filhos)
            {
                if (filho.Id <= 0) continue;
                if (string.IsNullOrWhiteSpace(filho.Nome))
                    filho.Nome = pai.Nome;
                if (string.IsNullOrWhiteSpace(filho.ImagemURL))
                    filho.ImagemURL = pai.ImagemURL;
                filho.IdProdutoPai ??= pai.Id;
                resultado[filho.Id] = filho;
            }

            // Pausa leve para reduzir 429 em catálogos grandes.
            if (expandido % 20 == 0)
                await Task.Delay(200);
        }

        _log.LogInformation(
            "Expandir variações: pais={P} expandidos={E} folhas={F} scopeBloqueado={B}",
            paisParaExpandir.Count, Math.Min(expandido, maxExpand), resultado.Count, scopeBloqueado);

        return resultado.Values.ToList();
    }

    private async Task<(List<BlingProdutoListaItem> itens, bool scopeBloqueado)> ObterVariacoesDoPaiAsync(
        HttpClient http, string accessToken, long idPai)
    {
        // Endpoint dedicado de variações.
        var (viaVariacoes, status) = await BuscarPaginaProdutosComStatusAsync(
            http, accessToken, $"produtos/variacoes/{idPai}");
        if (status == System.Net.HttpStatusCode.Forbidden)
            return ([], true);
        if (viaVariacoes.Count > 0) return (viaVariacoes, false);

        // Fallback: detalhe do produto com array variacoes.
        using var req = new HttpRequestMessage(HttpMethod.Get, $"produtos/{idPai}");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req);
        if (resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
            return ([], true);
        if (!resp.IsSuccessStatusCode) return ([], false);

        var json = await resp.Content.ReadAsStringAsync();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data)) return ([], false);

            if (data.TryGetProperty("variacoes", out var arr) && arr.ValueKind == JsonValueKind.Array)
            {
                var lista = new List<BlingProdutoListaItem>();
                foreach (var v in arr.EnumerateArray())
                {
                    var item = ParseVariacaoElement(v);
                    if (item is not null) lista.Add(item);
                }
                return (lista, false);
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao ler variações do produto {Id}", idPai);
        }

        return ([], false);
    }

    private static BlingProdutoListaItem? ParseVariacaoElement(JsonElement v)
    {
        if (!v.TryGetProperty("id", out var idEl) || !idEl.TryGetInt64(out var id) || id <= 0)
            return null;

        var item = new BlingProdutoListaItem
        {
            Id = id,
            Nome = v.TryGetProperty("nome", out var n) ? n.GetString() : null,
            Codigo = v.TryGetProperty("codigo", out var c) ? c.GetString() : null,
            Formato = "S",
            ImagemURL = v.TryGetProperty("imagemURL", out var img) ? img.GetString() : null,
        };

        if (v.TryGetProperty("preco", out var preco) && preco.TryGetDecimal(out var p))
            item.Preco = p;

        if (v.TryGetProperty("estoque", out var est) && est.ValueKind == JsonValueKind.Object)
        {
            item.Estoque = new BlingProdutoEstoque();
            if (est.TryGetProperty("saldoVirtualTotal", out var sv) && sv.TryGetDecimal(out var vSaldo))
                item.Estoque.SaldoVirtualTotal = vSaldo;
            if (est.TryGetProperty("saldoFisicoTotal", out var sf) && sf.TryGetDecimal(out var fSaldo))
                item.Estoque.SaldoFisicoTotal = fSaldo;
        }

        if (v.TryGetProperty("variacao", out var meta) && meta.ValueKind == JsonValueKind.Object)
        {
            // Junta todos os textos úteis do bloco variação (nome, atributos, etc.).
            var partes = new List<string>();
            if (meta.TryGetProperty("nome", out var vn))
            {
                var s = vn.GetString();
                if (!string.IsNullOrWhiteSpace(s)) partes.Add(s);
            }

            foreach (var prop in meta.EnumerateObject())
            {
                if (prop.NameEquals("nome")) continue;
                if (prop.Value.ValueKind != JsonValueKind.String) continue;
                var s = prop.Value.GetString();
                if (string.IsNullOrWhiteSpace(s)) continue;
                // Só campos que parecem atributo (evita poluir com URLs etc.).
                var propName = prop.Name.ToLowerInvariant();
                if (propName.Contains("cor") || propName.Contains("modelo") || propName.Contains("aparelho")
                    || propName.Contains("celular") || propName.Contains("atribut"))
                    partes.Add($"{prop.Name}:{s}");
            }

            item.VariacaoNome = string.Join(";", partes);
        }

        return item;
    }

    private async Task<List<BlingProdutoListaItem>> BuscarPaginaProdutosAsync(
        HttpClient http, string accessToken, string url)
    {
        var (itens, _) = await BuscarPaginaProdutosComStatusAsync(http, accessToken, url, throwOnForbidden: true);
        return itens;
    }

    private async Task<(List<BlingProdutoListaItem> itens, System.Net.HttpStatusCode status)> BuscarPaginaProdutosComStatusAsync(
        HttpClient http,
        string accessToken,
        string url,
        bool throwOnForbidden = false)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req);
        if (resp.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("Token Bling expirado.");
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            _log.LogWarning("Bling produtos {Status} url={Url} body={Body}", (int)resp.StatusCode, url, body[..Math.Min(300, body.Length)]);
            if (throwOnForbidden && resp.StatusCode == System.Net.HttpStatusCode.Forbidden)
                throw new InvalidOperationException(
                    "Bling recusou acesso aos produtos (403). Confira se o app tem permissão de Produtos/Estoque e reconecte.");
            return ([], resp.StatusCode);
        }

        var json = await resp.Content.ReadAsStringAsync();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data))
                return ([], resp.StatusCode);

            // Lista padrão: data = [ ... ]
            if (data.ValueKind == JsonValueKind.Array)
            {
                var lista = JsonSerializer.Deserialize<BlingListaProdutos>(json, JsonOpts);
                return (lista?.Data ?? [], resp.StatusCode);
            }

            // produtos/variacoes/{id}: data = { ..., variacoes: [ ... ] } ou data = produto pai
            if (data.ValueKind == JsonValueKind.Object)
            {
                if (data.TryGetProperty("variacoes", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    var lista = new List<BlingProdutoListaItem>();
                    foreach (var v in arr.EnumerateArray())
                    {
                        var item = ParseVariacaoElement(v);
                        if (item is not null) lista.Add(item);
                    }
                    return (lista, resp.StatusCode);
                }
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao deserializar resposta Bling {Url}", url);
        }

        return ([], resp.StatusCode);
    }

    private async Task<long?> ResolverIdCategoriaAsync(HttpClient http, string accessToken, string categoriaApp)
    {
        var candidatos = NomesCategoriaBling(categoriaApp);
        (long Id, string Nome, int Score)? melhor = null;

        for (var pagina = 1; pagina <= 10; pagina++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"categorias/produtos?pagina={pagina}&limite=100");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogWarning("Bling categorias/produtos HTTP {Status}", (int)resp.StatusCode);
                break;
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
                    var score = ScoreCategoria(nome, cand);
                    if (score <= 0) continue;
                    if (melhor is null || score > melhor.Value.Score)
                        melhor = (c.Id, nome, score);
                }
            }

            if (itens.Count < 100) break;
        }

        if (melhor is null)
        {
            _log.LogWarning("Categoria Bling não encontrada para {Cat}. Candidatos: {Cands}",
                categoriaApp, string.Join(", ", candidatos));
            return null;
        }

        _log.LogInformation("Categoria Bling resolvida: {Nome} -> {Id} (score {Score})",
            melhor.Value.Nome, melhor.Value.Id, melhor.Value.Score);
        return melhor.Value.Id;
    }

    private static int ScoreCategoria(string nomeBling, string candidato)
    {
        var a = NormalizarBusca(nomeBling);
        var b = NormalizarBusca(candidato);
        if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) return 0;
        if (a == b) return 100 + b.Length;
        if (a.StartsWith(b, StringComparison.Ordinal)) return 50 + b.Length;
        if (a.Contains(b, StringComparison.Ordinal)) return 20 + b.Length;
        return 0;
    }

    private static string[] NomesCategoriaBling(string categoriaApp) => categoriaApp switch
    {
        CatCapinhas =>
        [
            "Capinha de Celular", "Capinhas", "Capinha", "Capa de Celular", "Capas",
            "Acessorios", "Acessórios", "Cases",
        ],
        CatPeliculas => ["Película", "Peliculas", "Películas", "Película de Celular", "Pelicula"],
        CatTermicos => ["Térmico", "Termicos", "Térmicos", "Garrafa", "Copo Térmico"],
        _ => [categoriaApp],
    };

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

    private static List<string> MontarBuscasBling(string categoria)
    {
        // Só palavras da categoria — nunca o modelo do aparelho (filtro é local).
        // Capinhas: prioriza "Capa" (cadastros corretos como CAP-IP-COURO).
        return categoria switch
        {
            CatCapinhas => ["Capa", "Capinha", "capinha", "Couro", "Case Couro"],
            CatPeliculas => ["pelicula", "película"],
            _ => ["termico", "térmico", "garrafa"],
        };
    }

    private static bool EhProdutoConsultaValido(BlingProdutoListaItem p, string categoria)
    {
        // SKU (código) obrigatório em todas as categorias da consulta.
        if (string.IsNullOrWhiteSpace(p.Codigo)) return false;

        if (categoria == CatCapinhas)
        {
            var nome = (p.Nome ?? "").Trim();
            // Cadastros corretos: "Capa …" / "Capinha …" (ex.: Capa Iphone Case Couro · CAP-IP-COURO).
            return nome.StartsWith("capa", StringComparison.OrdinalIgnoreCase);
        }

        return true;
    }

    /// <summary>
    /// Resolve e persiste o id do campo «Permite Personalização».
    /// Prioridade: config → cache em disco → produto CAP-IP-COURO → lista de campos.
    /// </summary>
    private async Task<long?> ObterIdCampoPersonalizacaoAsync(
        HttpClient http,
        string accessToken,
        bool permitirRede = true)
    {
        if (_bling.IdCampoPermitePersonalizacao is > 0)
            return _bling.IdCampoPermitePersonalizacao;
        if (_idCampoPersoMemoria is > 0)
            return _idCampoPersoMemoria;

        var doArquivo = LerIdCampoPersoDoDisco();
        if (doArquivo is > 0)
        {
            _idCampoPersoMemoria = doArquivo;
            return doArquivo;
        }

        if (!permitirRede)
            return null;

        // 1) Produto conhecido (print do Bling).
        foreach (var idConhecido in new long[] { 16531104605 })
        {
            var id = await ExtrairIdCampoDeProdutoComRetryAsync(http, accessToken, idConhecido);
            if (id is > 0)
            {
                SalvarIdCampoPerso(id.Value);
                return id;
            }
        }

        // 2) Busca direta por SKU (1 request leve).
        try
        {
            var lote = await BuscarPaginaProdutosComRetryAsync(
                http, accessToken, "produtos?pagina=1&limite=5&codigo=CAP-IP-COURO");
            foreach (var p in lote)
            {
                var id = await ExtrairIdCampoDeProdutoComRetryAsync(http, accessToken, p.Id);
                if (id is > 0)
                {
                    SalvarIdCampoPerso(id.Value);
                    return id;
                }
            }
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Falha ao buscar CAP-IP-COURO para campo personalização");
        }

        // 3) Lista de campos customizados.
        var viaLista = await ResolverIdCampoPermitePersonalizacaoAsync(http, accessToken);
        if (viaLista is > 0)
        {
            SalvarIdCampoPerso(viaLista.Value);
            return viaLista;
        }

        return null;
    }

    private long? LerIdCampoPersoDoDisco()
    {
        try
        {
            if (!File.Exists(_campoPersoPath)) return null;
            var json = File.ReadAllText(_campoPersoPath);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("idCampo", out var el) && el.TryGetInt64(out var id) && id > 0)
                return id;
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "Falha ao ler {Path}", _campoPersoPath);
        }
        return null;
    }

    private void SalvarIdCampoPerso(long id)
    {
        _idCampoPersoMemoria = id;
        try
        {
            File.WriteAllText(_campoPersoPath, JsonSerializer.Serialize(new { idCampo = id, em = DateTime.UtcNow }));
            _log.LogInformation("Campo personalização persistido id={Id}", id);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Não foi possível gravar {Path}", _campoPersoPath);
        }
    }

    private async Task<long?> ExtrairIdCampoDeProdutoComRetryAsync(HttpClient http, string accessToken, long produtoId)
    {
        for (var tentativa = 1; tentativa <= 4; tentativa++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"produtos/{produtoId}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var resp = await http.SendAsync(req);
            if (resp.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                var wait = TimeSpan.FromSeconds(5 * tentativa);
                _log.LogWarning("429 ao ler produto {Id} (tentativa {T}) — aguardando {S}s", produtoId, tentativa, wait.TotalSeconds);
                await Task.Delay(wait);
                continue;
            }
            if (!resp.IsSuccessStatusCode) return null;

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (!TryGetPropertyCI(doc.RootElement, "data", out var data)) return null;
            if (!TryGetPropertyCI(data, "camposCustomizados", out var arr) || arr.ValueKind != JsonValueKind.Array)
            {
                _log.LogWarning("Produto {Id} sem camposCustomizados", produtoId);
                return null;
            }

            var ativos = new List<long>();
            foreach (var campo in arr.EnumerateArray())
            {
                var id = LerIdCampoCustomizado(campo);
                if (id <= 0) continue;
                var ok = (TryGetPropertyCI(campo, "valor", out var v) && ValorIndicaSim(v))
                         || (TryGetPropertyCI(campo, "item", out var i) && ValorIndicaSim(i));
                if (ok) ativos.Add(id);
            }

            _log.LogInformation("Produto {Id}: campos personalização ativos={N} ids={Ids}",
                produtoId, ativos.Count, string.Join(",", ativos));
            return ativos.Count >= 1 ? ativos[0] : null;
        }

        return null;
    }

    private async Task<List<BlingProdutoListaItem>> BuscarPaginaProdutosComRetryAsync(
        HttpClient http, string accessToken, string url)
    {
        for (var tentativa = 1; tentativa <= 3; tentativa++)
        {
            var (itens, status) = await BuscarPaginaProdutosComStatusAsync(http, accessToken, url);
            if (status != System.Net.HttpStatusCode.TooManyRequests)
                return itens;
            await Task.Delay(TimeSpan.FromSeconds(5 * tentativa));
        }
        return [];
    }

    private static bool CandidatoPersonalizacao(string? nome, string? codigo) =>
        Contem(nome, "couro")
        || Contem(nome, "personaliz")
        || Contem(nome, "case")
        || Contem(codigo, "COURO")
        || Contem(codigo, "CAP-IP");

    private static bool NomeSugerePersonalizacao(string? nome) =>
        Contem(nome, "personaliz") || Contem(nome, "couro");

    /// <summary>Resolve o id do campo customizado «Permite Personalização» (módulo Produtos).</summary>
    private async Task<long?> ResolverIdCampoPermitePersonalizacaoAsync(HttpClient http, string accessToken)
    {
        if (_bling.IdCampoPermitePersonalizacao is > 0)
            return _bling.IdCampoPermitePersonalizacao;

        try
        {
            var urls = new List<string>
            {
                "campos-customizados?pagina=1&limite=100",
                "campos-customizados/modulos/1?pagina=1&limite=100",
            };

            try
            {
                using var reqMod = new HttpRequestMessage(HttpMethod.Get, "campos-customizados/modulos");
                reqMod.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var respMod = await http.SendAsync(reqMod);
                if (respMod.IsSuccessStatusCode)
                {
                    var jsonMod = await respMod.Content.ReadAsStringAsync();
                    using var docMod = JsonDocument.Parse(jsonMod);
                    if (docMod.RootElement.TryGetProperty("data", out var dataMod)
                        && dataMod.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var m in dataMod.EnumerateArray())
                        {
                            var nomeMod = m.TryGetProperty("nome", out var nm) ? nm.GetString() : null;
                            if (string.IsNullOrWhiteSpace(nomeMod)) continue;
                            if (!NormalizarBusca(nomeMod).Contains("produto")) continue;
                            if (m.TryGetProperty("id", out var idM) && idM.TryGetInt64(out var mid) && mid > 0)
                                urls.Insert(0, $"campos-customizados/modulos/{mid}?pagina=1&limite=100");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Falha ao listar módulos de campos customizados");
            }

            foreach (var url in urls.Distinct())
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, url);
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var resp = await http.SendAsync(req);
                if (!resp.IsSuccessStatusCode) continue;

                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("data", out var data)) continue;

                var arr = data.ValueKind == JsonValueKind.Array
                    ? data
                    : data.TryGetProperty("campos", out var c) ? c : default;
                if (arr.ValueKind != JsonValueKind.Array) continue;

                foreach (var item in arr.EnumerateArray())
                {
                    var nome = item.TryGetProperty("nome", out var n) ? n.GetString()
                        : item.TryGetProperty("nomeCampo", out var n2) ? n2.GetString()
                        : null;
                    if (string.IsNullOrWhiteSpace(nome)) continue;
                    if (!NormalizarBusca(nome).Contains("personaliz")) continue;
                    if (item.TryGetProperty("id", out var idEl) && idEl.TryGetInt64(out var id) && id > 0)
                    {
                        _log.LogInformation("Campo customizado personalização id={Id} nome={Nome}", id, nome);
                        return id;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Não foi possível listar campos customizados Bling");
        }

        return null;
    }

    private async Task<long?> DescobrirIdCampoViaProdutoSementeAsync(
        HttpClient http,
        string accessToken,
        List<BlingProdutoListaItem> folhas)
    {
        // Mantido por compatibilidade — fluxo principal usa ObterIdCampoPersonalizacaoAsync.
        var semente = folhas.FirstOrDefault(p =>
            string.Equals((p.Codigo ?? "").Trim(), "CAP-IP-COURO", StringComparison.OrdinalIgnoreCase));
        semente ??= folhas.FirstOrDefault(p => Contem(p.Nome, "couro"));
        if (semente is null) return null;
        return await ExtrairIdCampoDeProdutoComRetryAsync(http, accessToken, semente.Id);
    }

    private async Task<bool> ObterPermitePersonalizacaoAsync(
        HttpClient http,
        string accessToken,
        long produtoId,
        long? idCampoPersonalizacao,
        Dictionary<long, bool> cache,
        string? nomeProduto)
    {
        if (produtoId <= 0) return NomeSugerePersonalizacao(nomeProduto);
        if (cache.TryGetValue(produtoId, out var cached)) return cached;

        for (var tentativa = 1; tentativa <= 3; tentativa++)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"produtos/{produtoId}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var resp = await http.SendAsync(req);
                if (resp.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    await Task.Delay(TimeSpan.FromSeconds(5 * tentativa));
                    continue;
                }
                if (resp.StatusCode is System.Net.HttpStatusCode.Forbidden or System.Net.HttpStatusCode.NotFound
                    || !resp.IsSuccessStatusCode)
                {
                    var fallback = NomeSugerePersonalizacao(nomeProduto);
                    cache[produtoId] = fallback;
                    return fallback;
                }

                var json = await resp.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (!TryGetPropertyCI(doc.RootElement, "data", out var data))
                {
                    cache[produtoId] = NomeSugerePersonalizacao(nomeProduto);
                    return cache[produtoId];
                }

                var permite = LerPermitePersonalizacaoDeProduto(data, idCampoPersonalizacao);
                if (!permite)
                    permite = NomeSugerePersonalizacao(nomeProduto);

                // Nome do próprio produto no detalhe (mais confiável que o da lista).
                if (!permite && TryGetPropertyCI(data, "nome", out var nomeEl))
                    permite = NomeSugerePersonalizacao(nomeEl.GetString());

                cache[produtoId] = permite;
                return permite;
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "Falha ao ler personalização do produto {Id}", produtoId);
                break;
            }
        }

        var fb = NomeSugerePersonalizacao(nomeProduto);
        cache[produtoId] = fb;
        return fb;
    }

    private static bool TryGetPropertyCI(JsonElement el, string name, out JsonElement value)
    {
        if (el.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in el.EnumerateObject())
            {
                if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
                {
                    value = prop.Value;
                    return true;
                }
            }
        }

        value = default;
        return false;
    }

    private static bool LerPermitePersonalizacaoDeProduto(JsonElement data, long? idCampo)
    {
        if (!TryGetPropertyCI(data, "camposCustomizados", out var arr) || arr.ValueKind != JsonValueKind.Array)
            return false;

        var campos = arr.EnumerateArray().ToList();
        foreach (var campo in campos)
        {
            var idCampoItem = LerIdCampoCustomizado(campo);
            var nome = LerNomeCampoCustomizado(campo);

            var idOk = idCampo is > 0 && idCampoItem == idCampo.Value;
            var nomeOk = !string.IsNullOrWhiteSpace(nome) && NormalizarBusca(nome).Contains("personaliz");
            var unicoOk = idCampo is null && campos.Count == 1;

            if (!idOk && !nomeOk && !unicoOk) continue;

            if (TryGetPropertyCI(campo, "valor", out var valorEl) && ValorIndicaSim(valorEl))
                return true;
            if (TryGetPropertyCI(campo, "item", out var itemEl) && ValorIndicaSim(itemEl))
                return true;
        }

        return false;
    }

    private static long LerIdCampoCustomizado(JsonElement campo)
    {
        if (TryGetPropertyCI(campo, "idCampoCustomizado", out var a) && a.TryGetInt64(out var idA)) return idA;
        if (TryGetPropertyCI(campo, "id", out var b) && b.TryGetInt64(out var idB)) return idB;
        if (TryGetPropertyCI(campo, "campoCustomizado", out var obj) && obj.ValueKind == JsonValueKind.Object
            && TryGetPropertyCI(obj, "id", out var c) && c.TryGetInt64(out var idC))
            return idC;
        return 0;
    }

    private static string? LerNomeCampoCustomizado(JsonElement campo)
    {
        foreach (var key in new[] { "nome", "nomeCampoCustomizado", "alias", "label" })
        {
            if (TryGetPropertyCI(campo, key, out var n) && n.ValueKind == JsonValueKind.String)
            {
                var s = n.GetString();
                if (!string.IsNullOrWhiteSpace(s)) return s;
            }
        }

        if (TryGetPropertyCI(campo, "campoCustomizado", out var obj) && obj.ValueKind == JsonValueKind.Object
            && TryGetPropertyCI(obj, "nome", out var n2) && n2.ValueKind == JsonValueKind.String)
            return n2.GetString();

        return null;
    }

    private static bool ValorIndicaSim(JsonElement el)
    {
        switch (el.ValueKind)
        {
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
            case JsonValueKind.Null:
                return false;
            case JsonValueKind.Number:
                return el.TryGetDecimal(out var d) && d != 0;
            case JsonValueKind.String:
                var s = (el.GetString() ?? "").Trim().ToLowerInvariant();
                return s is "1" or "true" or "sim" or "s" or "yes" or "ativado" or "ativo" or "on";
            default:
                return false;
        }
    }

    private static bool EhDaCategoria(string? nome, string categoria)
    {
        if (!PalavrasCategoria.TryGetValue(categoria, out var palavras)) return false;
        var n = (nome ?? "").ToLowerInvariant();
        return palavras.Any(p => n.Contains(p, StringComparison.OrdinalIgnoreCase));
    }

    private async Task<Dictionary<long, decimal>> ObterSaldosAsync(
        HttpClient http, string accessToken, List<long> ids)
    {
        var saldos = new Dictionary<long, decimal>();
        if (ids.Count == 0) return saldos;

        foreach (var lote in ids.Chunk(40))
        {
            var listaIds = lote.ToList();
            // Formato preferido da doc: idsProdutos=1,2,3
            var qsCsv = "idsProdutos=" + string.Join(",", listaIds);
            var qsArr = string.Join("&", listaIds.Select(id => $"idsProdutos[]={id}"));

            foreach (var (path, qs) in new[]
                     {
                         ("estoques/saldos", qsCsv),
                         ("estoques/saldos", qsArr),
                         ("estoques", qsCsv),
                         ("estoques", qsArr),
                     })
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"{path}?{qs}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
                using var resp = await http.SendAsync(req);
                if (!resp.IsSuccessStatusCode)
                {
                    if (path == "estoques" && qs == qsArr)
                    {
                        var body = await resp.Content.ReadAsStringAsync();
                        _log.LogWarning("Bling estoques falhou {Status}: {Body}",
                            (int)resp.StatusCode, body[..Math.Min(200, body.Length)]);
                    }
                    continue;
                }

                var parcial = await LerSaldosFlexAsync(resp);
                foreach (var kv in parcial)
                    saldos[kv.Key] = kv.Value;

                if (parcial.Count > 0) break;
            }
        }

        _log.LogInformation("Bling saldos obtidos para {N}/{Total} produtos", saldos.Count, ids.Count);
        return saldos;
    }

    private async Task<Dictionary<long, decimal>> LerSaldosFlexAsync(HttpResponseMessage resp)
    {
        var saldos = new Dictionary<long, decimal>();
        var json = await resp.Content.ReadAsStringAsync();
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                return saldos;

            foreach (var e in data.EnumerateArray())
            {
                long id = 0;
                if (e.TryGetProperty("produto", out var prod) && prod.ValueKind == JsonValueKind.Object
                    && prod.TryGetProperty("id", out var idEl))
                {
                    idEl.TryGetInt64(out id);
                }
                if (id <= 0 && e.TryGetProperty("idProduto", out var idProd))
                    idProd.TryGetInt64(out id);
                if (id <= 0) continue;

                decimal saldo = 0;
                if (e.TryGetProperty("saldoVirtualTotal", out var sv) && sv.TryGetDecimal(out var v1))
                    saldo = v1;
                if (saldo == 0 && e.TryGetProperty("saldoFisicoTotal", out var sf) && sf.TryGetDecimal(out var v2))
                    saldo = v2;

                // Soma depósitos se totais vierem zerados.
                if (saldo == 0 && e.TryGetProperty("depositos", out var deps) && deps.ValueKind == JsonValueKind.Array)
                {
                    foreach (var d in deps.EnumerateArray())
                    {
                        if (d.TryGetProperty("saldoVirtual", out var dv) && dv.TryGetDecimal(out var x))
                            saldo += x;
                        else if (d.TryGetProperty("saldoVirtualTotal", out var dvt) && dvt.TryGetDecimal(out var y))
                            saldo += y;
                        else if (d.TryGetProperty("saldoFisico", out var df) && df.TryGetDecimal(out var z))
                            saldo += z;
                    }
                }

                saldos[id] = saldo;
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao ler JSON de saldos Bling");
        }

        return saldos;
    }

    private readonly record struct AttrsVariacao(string? NomeBase, string? Cor, string? Modelo, string? Tipo);

    private readonly record struct CamposProduto(string? Marca, string? Aparelho, string Tipo, string Cor);

    private static string? PrimeiroNaoVazio(params string?[] valores)
    {
        foreach (var v in valores)
        {
            if (!string.IsNullOrWhiteSpace(v)) return v.Trim();
        }
        return null;
    }

    /// <summary>
    /// Normaliza nome sujo do Bling (ex.: "CAPINHA IPHONE - SPACE COR:GLITTER;MODELOS:11")
    /// em marca / aparelho / tipo / cor legíveis.
    /// </summary>
    private static CamposProduto ExtrairCamposProduto(string? nome, string? variacaoNome)
    {
        var attrs = ExtrairAtributosVariacao(nome, variacaoNome);
        var limpo = LimparNomeBling(nome);
        var (baseNome, corDoNome) = SepararNomeCor(limpo);

        var cor = NormalizarRotuloCor(PrimeiroNaoVazio(
            attrs.Cor,
            ExtrairCorDeAtributosSoltos(variacaoNome),
            ExtrairCorDeAtributosSoltos(nome),
            corDoNome == "Única" ? null : corDoNome) ?? "Única");

        var aparelho = NormalizarAparelho(PrimeiroNaoVazio(
            attrs.Modelo,
            ExtrairModeloDoNome(variacaoNome),
            ExtrairModeloDoNome(limpo),
            ExtrairModeloDoNome(nome)));

        var tipoBruto = PrimeiroNaoVazio(
            attrs.Tipo,
            ExtrairEstiloDoNome(limpo),
            ExtrairTipoCapinha(limpo, variacaoNome, baseNome),
            LimparTipoCapinha(RemoverModeloDoNome(RemoverCorDoNome(baseNome, cor), aparelho)));

        var tipo = NormalizarTipoCapinha(tipoBruto);
        var marca = ExtrairMarca(aparelho, limpo, tipo) ?? ExtrairMarca(aparelho, nome, tipo);

        return new CamposProduto(marca, aparelho, tipo, cor);
    }

    private static bool PareceNomeSujo(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return true;
        var t = s.Trim();
        if (t.Length > 42) return true;
        if (t.Contains(':') || t.Contains(';')) return true;
        if (Regex.Matches(t, @"capinha", RegexOptions.IgnoreCase).Count >= 2) return true;
        if (Regex.IsMatch(t, @"\b(cor|modelos?)\s*:", RegexOptions.IgnoreCase)) return true;
        return false;
    }

    private static string LimparNomeBling(string? nome)
    {
        var s = (nome ?? "").Trim();
        if (string.IsNullOrEmpty(s)) return "";

        // Remove blocos "COR:xxx" / "MODELOS:xxx" do título (ficam nos atributos).
        s = Regex.Replace(s, @"\b(cor|color|cores|modelos?|modelo)\s*:\s*[^;|\-]*", " ", RegexOptions.IgnoreCase);
        s = s.Replace(';', ' ').Replace('|', ' ');
        s = Regex.Replace(s, @"\s*-\s*", " - ");
        s = Regex.Replace(s, @"\s{2,}", " ").Trim(' ', '-', '–');

        // Colapsa "CAPINHA IPHONE - CAPINHA IPHONE - SPACE" → "CAPINHA IPHONE - SPACE"
        var partes = s.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .ToList();
        var unicas = new List<string>();
        foreach (var p in partes)
        {
            if (unicas.Any(u => string.Equals(u, p, StringComparison.OrdinalIgnoreCase))) continue;
            unicas.Add(p);
        }
        return string.Join(" - ", unicas);
    }

    private static string? ExtrairCorDeAtributosSoltos(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        var m = Regex.Match(texto, @"\bcor\s*:\s*([^;|\n]+)", RegexOptions.IgnoreCase);
        if (!m.Success) return null;
        var val = m.Groups[1].Value.Trim().Trim('-', ' ');
        return string.IsNullOrWhiteSpace(val) ? null : val;
    }

    private static string? ExtrairEstiloDoNome(string? limpo)
    {
        if (string.IsNullOrWhiteSpace(limpo)) return null;
        var partes = limpo.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var p in partes)
        {
            var n = NormalizarBusca(p);
            if (string.IsNullOrEmpty(n)) continue;
            if (n is "capinha" or "capa" or "case") continue;
            if (n.StartsWith("iphone") || n.StartsWith("moto") || n.StartsWith("galaxy") || n.StartsWith("samsung"))
                continue;
            if (CoresConhecidas.Any(c => n == NormalizarBusca(c))) continue;

            foreach (var (chave, label) in TiposCapinhaConhecidos.OrderByDescending(x => x.Chave.Length))
            {
                if (n.Contains(NormalizarBusca(chave), StringComparison.Ordinal))
                    return label;
            }

            // Estilo curto do cadastro (Space, Soft…).
            if (p.Length is >= 3 and <= 24 && !p.Contains(':'))
                return $"Capinha {char.ToUpper(p[0]) + p[1..].ToLowerInvariant()}";
        }
        return null;
    }

    private static string NormalizarTipoCapinha(string? tipo)
    {
        if (PareceNomeSujo(tipo)) return "Capinha";
        var t = LimparTipoCapinha(tipo);
        if (PareceNomeSujo(t)) return "Capinha";
        // Evita "Capinha Capinha Space"
        t = Regex.Replace(t, @"(?i)^(capinha|capa)\s+\1\s+", "Capinha ");
        return t;
    }

    private static string NormalizarRotuloCor(string cor)
    {
        var c = (cor ?? "").Trim();
        if (string.IsNullOrEmpty(c)) return "Única";
        // Remove restos " · Capinha…" de agrupamentos antigos / nomes sujos.
        var corte = c.IndexOf(" · ", StringComparison.Ordinal);
        if (corte > 0) c = c[..corte].Trim();
        c = Regex.Replace(c, @"\b(cor|modelos?)\s*:.*$", "", RegexOptions.IgnoreCase).Trim(' ', '-', ';');
        if (string.IsNullOrWhiteSpace(c) || PareceNomeSujo(c) || c.Length > 28) return "Única";
        if (c.Equals("unica", StringComparison.OrdinalIgnoreCase)) return "Única";
        return char.ToUpper(c[0]) + c[1..];
    }

    private static string? NormalizarAparelho(string? aparelho)
    {
        if (string.IsNullOrWhiteSpace(aparelho)) return null;
        var a = Regex.Replace(aparelho.Trim(), @"\s{2,}", " ");
        // "iphone" / "samsung" sozinhos não ajudam na consulta.
        if (Regex.IsMatch(a, @"^(iphone|samsung|galaxy|motorola|moto|xiaomi|apple)$", RegexOptions.IgnoreCase))
            return null;
        if (PareceNomeSujo(a)) return null;
        return a;
    }

    private static AttrsVariacao ExtrairAtributosVariacao(string? nome, string? variacaoNome)
    {
        string? cor = null, modelo = null, tipo = null;
        var raw = $"{variacaoNome};{nome}";

        // Ex.: "Cor:Preto;Modelo:Moto G84" | "Material:Couro" | "MODELOS:11"
        foreach (var parte in raw.Split([';', '|', ',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var kv = parte.Split(':', 2, StringSplitOptions.TrimEntries);
            if (kv.Length != 2) continue;
            var key = RemoverAcentos(kv[0].ToLowerInvariant());
            // Chave pode vir poluída: "CAPINHA IPHONE - SPACE COR"
            if (key.Contains(" cor") || key.EndsWith("cor")) key = "cor";
            if (key.Contains("modelo")) key = key.Contains("aparelho") ? "modelo" : "modelos";

            var val = kv[1].Trim().Trim('-', ' ');
            if (string.IsNullOrWhiteSpace(val)) continue;

            if (key is "cor" or "color" or "cores")
                cor ??= val;
            else if (key is "modelo" or "modelos" or "model" || key.Contains("aparelho") || key.Contains("celular"))
            {
                // "Modelos:11" no Bling = número do iPhone.
                if (Regex.IsMatch(val, @"^\d{1,2}(\s*(pro|max|plus|mini))?$", RegexOptions.IgnoreCase)
                    && (Contem(nome, "iphone") || Contem(variacaoNome, "iphone") || Contem(raw, "iphone")))
                {
                    modelo ??= $"iPhone {val}".Trim();
                }
                else if (!Regex.IsMatch(val, @"^\d+$"))
                {
                    modelo ??= val;
                }
            }
            else if (key.Contains("material") || key is "tipo" or "linha" or "estilo" || key.Contains("tipo de"))
            {
                if (!PareceNomeSujo(val))
                    tipo ??= val;
            }
        }

        if (modelo is null && !string.IsNullOrWhiteSpace(variacaoNome) && !variacaoNome.Contains(':'))
        {
            modelo = ExtrairModeloDoNome(variacaoNome);
            if (cor is null)
            {
                var (_, c) = SepararNomeCor(variacaoNome);
                if (c != "Única") cor = c;
            }
        }

        return new AttrsVariacao(null, cor, modelo, tipo);
    }

    private static AttrsVariacao ExtrairAtributosVariacao(BlingProdutoListaItem p)
        => ExtrairAtributosVariacao(p.Nome, p.VariacaoNome);

    private static string RemoverAcentos(string s)
    {
        var norm = s.Normalize(NormalizationForm.FormD);
        var sb = new System.Text.StringBuilder(norm.Length);
        foreach (var ch in norm)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch)
                != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    private static string RemoverCorDoNome(string nome, string? cor)
    {
        if (string.IsNullOrWhiteSpace(cor) || string.Equals(cor, "Única", StringComparison.OrdinalIgnoreCase))
            return nome;
        var idx = nome.LastIndexOf(cor, StringComparison.OrdinalIgnoreCase);
        if (idx <= 0) return nome;
        return nome[..idx].Trim(' ', '-', '–', '—', '/', '|');
    }

    private static string RemoverModeloDoNome(string nome, string? modelo)
    {
        if (string.IsNullOrWhiteSpace(modelo)) return nome;
        var idx = nome.IndexOf(modelo, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return nome;
        var sem = (nome[..idx] + nome[(idx + modelo.Length)..]).Trim(' ', '-', '–', '—', '/', '|');
        return string.IsNullOrWhiteSpace(sem) ? nome : Regex.Replace(sem, @"\s{2,}", " ").Trim();
    }

    private static string LimparTipoCapinha(string? tipo)
    {
        var t = (tipo ?? "").Trim();
        if (string.IsNullOrEmpty(t)) return "Capinha";
        t = Regex.Replace(t, @"\s{2,}", " ").Trim(' ', '-', '–');
        return string.IsNullOrWhiteSpace(t) ? "Capinha" : t;
    }

    /// <summary>Tipos/materiais comuns de capinha no cadastro Bling.</summary>
    private static readonly (string Chave, string Label)[] TiposCapinhaConhecidos =
    [
        ("couro sintetico", "Capinha Couro Sintético"),
        ("couro sintético", "Capinha Couro Sintético"),
        ("couro legitimo", "Capinha Couro"),
        ("couro legítimo", "Capinha Couro"),
        ("couro", "Capinha Couro"),
        ("leather", "Capinha Couro"),
        ("silicone liquido", "Capinha Silicone"),
        ("silicone líquido", "Capinha Silicone"),
        ("silicone", "Capinha Silicone"),
        ("anti shock", "Capinha Antishock"),
        ("antishock", "Capinha Antishock"),
        ("anti-shock", "Capinha Antishock"),
        ("armor", "Capinha Armor"),
        ("militar", "Capinha Militar"),
        ("military", "Capinha Militar"),
        ("magnetica", "Capinha Magnética"),
        ("magnética", "Capinha Magnética"),
        ("magnetic", "Capinha Magnética"),
        ("com cordao", "Capinha com Cordão"),
        ("com cordão", "Capinha com Cordão"),
        ("transparente", "Capinha Transparente"),
        ("crystal", "Capinha Crystal"),
        ("clear", "Capinha Clear"),
        ("soft", "Capinha Soft"),
        ("hard", "Capinha Hard"),
        ("gel", "Capinha Gel"),
        ("tpu", "Capinha TPU"),
        ("hibrida", "Capinha Híbrida"),
        ("híbrida", "Capinha Híbrida"),
        ("360", "Capinha 360"),
        ("personalizada", "Capinha Personalizada"),
        ("permite personalizacao", "Capinha Personalizada"),
        ("permite personalização", "Capinha Personalizada"),
        ("space", "Capinha Space"),
        ("glitter", "Capinha Glitter"),
        ("fosca", "Capinha Fosca"),
        ("fosco", "Capinha Fosca"),
        ("matte", "Capinha Fosca"),
    ];

    private static string? ExtrairTipoCapinha(params string?[] textos)
    {
        var limpos = textos
            .Where(t => !string.IsNullOrWhiteSpace(t) && !PareceNomeSujo(t))
            .Select(t => t!.Trim())
            .ToArray();
        var junto = NormalizarBusca(string.Join(" ", textos.Where(t => !string.IsNullOrWhiteSpace(t)).Select(LimparNomeBling)));
        if (string.IsNullOrEmpty(junto)) return null;

        foreach (var (chave, label) in TiposCapinhaConhecidos.OrderByDescending(x => x.Chave.Length))
        {
            if (junto.Contains(NormalizarBusca(chave), StringComparison.Ordinal))
                return label;
        }

        // Mantém "Capinha X" só se o nome já for curto e limpo.
        foreach (var n in limpos)
        {
            if (n.StartsWith("capinha", StringComparison.OrdinalIgnoreCase)
                || n.StartsWith("capa ", StringComparison.OrdinalIgnoreCase))
            {
                var (_, cor) = SepararNomeCor(n);
                var semCor = RemoverCorDoNome(n, cor == "Única" ? null : cor);
                var semModelo = RemoverModeloDoNome(semCor, ExtrairModeloDoNome(n));
                if (!PareceNomeSujo(semModelo) && !string.IsNullOrWhiteSpace(semModelo) && semModelo.Length is > 4 and <= 40)
                    return LimparTipoCapinha(semModelo);
            }
        }

        return null;
    }

    private static readonly (string Chave, string Marca)[] MarcasConhecidas =
    [
        ("iphone", "Apple"),
        ("apple", "Apple"),
        ("galaxy", "Samsung"),
        ("samsung", "Samsung"),
        ("motorola", "Motorola"),
        ("moto ", "Motorola"),
        ("moto g", "Motorola"),
        ("moto e", "Motorola"),
        ("moto edge", "Motorola"),
        ("edge ", "Motorola"),
        ("razr", "Motorola"),
        ("xiaomi", "Xiaomi"),
        ("redmi", "Xiaomi"),
        ("poco", "Xiaomi"),
        ("realme", "Realme"),
        ("asus", "Asus"),
        ("zenfone", "Asus"),
        ("lg", "LG"),
        ("huawei", "Huawei"),
        ("honor", "Honor"),
        ("nokia", "Nokia"),
        ("infinix", "Infinix"),
        ("tecno", "Tecno"),
    ];

    private static string? ExtrairMarca(string? aparelho, string? nome, string? tipo)
    {
        var texto = NormalizarBusca($"{aparelho} {nome} {tipo}");
        if (string.IsNullOrEmpty(texto)) return null;

        // "moto" isolado / prefixo de modelo Motorola (g84, e13…).
        if (Regex.IsMatch(texto, @"\b(moto|motorola|edge|razr)\b")
            || Regex.IsMatch(texto, @"\bg\d{2,3}\b") && !texto.Contains("galaxy") && !texto.Contains("samsung"))
            return "Motorola";

        foreach (var (chave, marca) in MarcasConhecidas)
        {
            if (texto.Contains(NormalizarBusca(chave), StringComparison.Ordinal))
                return marca;
        }
        return null;
    }

    // Ordem: mais específico primeiro (Motorola Edge, iPhone Pro Max, Galaxy Fold…).
    private static readonly Regex[] ModeloRegexes =
    [
        new(@"\biphone\s*\d{1,2}(?:\s*(?:pro\s*max|pro|plus|mini|max))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:moto(?:rola)?\s+)?edge\s*[\w\.\+\-]*(?:\s*(?:neo|ultra|fusion|plus))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:moto(?:rola)?\s+)?razr\s*[\w\.\+\-]*\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:moto(?:rola)?\s+)?(?:g|e)\s*\d{1,3}(?:\s*(?:power|plus|play|5g|4g|stylus|fusion|premium|xt\d+))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\bmotorola\s+[\w\.\+\-]+(?:\s+[\w\.\+\-]+)?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\bgalaxy\s*(?:z\s*)?(?:fold|flip)\s*\d*\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:samsung\s+)?galaxy\s*[a-z]?\s*\d{1,3}(?:\s*(?:fe|plus|\+|ultra|5g|4g|lite))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:sm-)?[as]\d{2,3}[a-z]?(?:\s*(?:fe|plus|5g))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\bg\d{2,3}(?:\s*(?:power|plus|5g|play))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:redmi|poco|realme)\s*[\w\.\+\-]+(?:\s*(?:pro|plus|5g|nfc|note))?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\bxiaomi\s*[\w\.\+\-]+(?:\s*[\w\.\+\-]+)?\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:asus|zenfone|infinix|tecno)\s*[\w\.\+\-]+\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
    ];

    private static string? ExtrairModeloDoNome(string? nome)
    {
        if (string.IsNullOrWhiteSpace(nome)) return null;
        foreach (var rx in ModeloRegexes)
        {
            var m = rx.Match(nome);
            if (!m.Success) continue;
            var valor = Regex.Replace(m.Value.Trim(), @"\s{2,}", " ");
            // Normaliza "MotoG84" / "g 84" → leitura limpa.
            valor = Regex.Replace(valor, @"(?i)^(moto|motorola)\s*", "Moto ");
            valor = Regex.Replace(valor, @"(?i)^g\s*(\d)", "G$1");
            return valor;
        }
        return null;
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
        if (partes.Length >= 2
            && partes[^1].Length <= 18
            && !partes[^1].Contains(':')
            && !partes[^1].Contains(';'))
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
        // Reinterpreta nomes sujos já gravados no cache (sem precisar re-sincronizar).
        var normalizados = itens.Select(NormalizarItemCache).ToList();

        // Hierarquia: marca → tipo de capinha → aparelho → cores.
        return normalizados
            .GroupBy(x =>
            {
                var marca = string.IsNullOrWhiteSpace(x.Marca) ? "Outras" : x.Marca.Trim();
                var tipo = string.IsNullOrWhiteSpace(x.NomeBase) ? "Capinha" : x.NomeBase.Trim();
                var aparelho = string.IsNullOrWhiteSpace(x.Modelo) ? "Sem aparelho" : x.Modelo.Trim();
                return $"{marca.ToLowerInvariant()}|{tipo.ToLowerInvariant()}|{aparelho.ToLowerInvariant()}";
            })
            .Select(g =>
            {
                var amostra = g.First();
                var marca = string.IsNullOrWhiteSpace(amostra.Marca) ? "Outras" : amostra.Marca.Trim();
                var tipo = string.IsNullOrWhiteSpace(amostra.NomeBase) ? "Capinha" : amostra.NomeBase.Trim();
                var aparelho = string.IsNullOrWhiteSpace(amostra.Modelo) ? "Sem aparelho" : amostra.Modelo.Trim();

                var cores = g
                    .GroupBy(
                        x => NormalizarRotuloCor(string.IsNullOrWhiteSpace(x.Cor) ? "Única" : x.Cor),
                        StringComparer.OrdinalIgnoreCase)
                    .Select(cg => new ConsultaProdutoCor
                    {
                        Cor = cg.Key,
                        Saldo = cg.Sum(x => x.Saldo),
                        Codigo = cg.Select(x => x.Codigo).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
                        Preco = cg.Select(x => x.Preco).FirstOrDefault(p => p is > 0),
                    })
                    .OrderByDescending(c => c.Saldo)
                    .ThenBy(c => c.Cor, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return new ConsultaProdutoGrupo
                {
                    Nome = tipo,
                    Modelo = aparelho,
                    Marca = marca,
                    SaldoTotal = cores.Sum(c => c.Saldo),
                    PermitePersonalizacao = g.Any(x =>
                        x.PermitePersonalizacao || NomeSugerePersonalizacao(x.Nome) || NomeSugerePersonalizacao(x.NomeBase)),
                    Cores = cores,
                };
            })
            .OrderBy(g => g.Marca, StringComparer.OrdinalIgnoreCase)
            .ThenBy(g => g.Nome, StringComparer.OrdinalIgnoreCase)
            .ThenBy(g => g.Modelo, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    /// <summary>Corrige itens antigos do Mongo com NomeBase/Cor/Modelo poluídos pelo Bling.</summary>
    private static BlingProdutoAcessorioCache NormalizarItemCache(BlingProdutoAcessorioCache x)
    {
        var precisa =
            PareceNomeSujo(x.NomeBase)
            || PareceNomeSujo(x.Cor)
            || PareceNomeSujo(x.Modelo)
            || string.IsNullOrWhiteSpace(x.Modelo)
            || Regex.IsMatch(x.Modelo ?? "", @"^(iphone|samsung|galaxy|motorola|moto)$", RegexOptions.IgnoreCase)
            || (x.Cor ?? "").Contains(" · ", StringComparison.Ordinal);

        if (!precisa) return x;

        var campos = ExtrairCamposProduto(x.Nome, null);
        return new BlingProdutoAcessorioCache
        {
            Id = x.Id,
            BlingId = x.BlingId,
            Categoria = x.Categoria,
            Nome = x.Nome,
            NomeBase = campos.Tipo,
            Modelo = campos.Aparelho ?? NormalizarAparelho(x.Modelo),
            Marca = campos.Marca ?? x.Marca,
            Cor = campos.Cor != "Única" ? campos.Cor : NormalizarRotuloCor(x.Cor ?? "Única"),
            Codigo = x.Codigo,
            Saldo = x.Saldo,
            Preco = x.Preco,
            ImagemUrl = x.ImagemUrl,
            PermitePersonalizacao = x.PermitePersonalizacao || NomeSugerePersonalizacao(x.Nome),
            AtualizadoEm = x.AtualizadoEm,
        };
    }

    private static bool EhCacheConsultaValido(BlingProdutoAcessorioCache x, string categoria)
    {
        if (string.IsNullOrWhiteSpace(x.Codigo)) return false;
        if (categoria == CatCapinhas)
        {
            var nome = (x.Nome ?? "").Trim();
            return nome.StartsWith("capa", StringComparison.OrdinalIgnoreCase);
        }
        return true;
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
        /// <summary>Texto de atributos da variação (ex.: Cor:Preto;Modelo:A54).</summary>
        public string? VariacaoNome { get; set; }
        /// <summary>Produto pai (quando este item é uma variação).</summary>
        public long? IdProdutoPai { get; set; }
    }

    private sealed class BlingProdutoEstoque
    {
        public decimal SaldoVirtualTotal { get; set; }
        public decimal SaldoFisicoTotal { get; set; }
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
