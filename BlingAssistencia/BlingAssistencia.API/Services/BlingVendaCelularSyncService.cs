using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingVendaCelularSyncService
{
    Task<BlingVendaCelularSyncResult> SincronizarAsync(
        BlingVendaCelularSincronizarRequest? pedido,
        CancellationToken cancellationToken = default);
    BlingVendaCelularDescontoResponse ConsultarDesconto(string? cpf, string? imei, IReadOnlyList<BlingVendaCelularData> vendas);
}

public sealed class BlingVendaCelularSyncService : IBlingVendaCelularSyncService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };
    private static readonly Regex ImeiRx = new(@"\b(\d{15})\b", RegexOptions.Compiled);
    private static readonly TimeSpan Throttle = TimeSpan.FromMilliseconds(350);
    private readonly SemaphoreSlim _lock = new(1, 1);

    private readonly IBlingVendaCelularRepository _repo;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IBlingEffectiveSettings _blingEff;
    private readonly IClienteAparelhoCompradoService _vinculo;
    private readonly ILogger<BlingVendaCelularSyncService> _log;

    public BlingVendaCelularSyncService(
        IBlingVendaCelularRepository repo,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        IBlingEffectiveSettings blingEff,
        IClienteAparelhoCompradoService vinculo,
        ILogger<BlingVendaCelularSyncService> log)
    {
        _repo = repo;
        _auth = auth;
        _httpFactory = httpFactory;
        _blingEff = blingEff;
        _vinculo = vinculo;
        _log = log;
    }

    public async Task<BlingVendaCelularSyncResult> SincronizarAsync(
        BlingVendaCelularSincronizarRequest? pedido,
        CancellationToken cancellationToken = default)
    {
        if (!await _lock.WaitAsync(0, cancellationToken))
            throw new InvalidOperationException("Já existe uma sincronização de vendas Bling em andamento.");

        try
        {
            await _blingEff.EnsureLoadedAsync(cancellationToken);
            var settings = _blingEff.Current;
            if (!settings.VendasCelularesHabilitada)
            {
                return Falha("Importação de vendas de celular está desligada nas configurações Bling.");
            }

            var token = await ObterTokenValidoAsync();
            if (token is null)
            {
                return Falha("Bling não está conectado. Vá em Configurações → Bling e conecte o OAuth.");
            }

            var dias = ResolverDias(pedido, settings);
            var hoje = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, HorarioBrasil.TimeZone).Date;
            var inicio = hoje.AddDays(1 - dias);
            var dataInicial = inicio.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            var dataFinal = hoje.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            var http = _httpFactory.CreateClient("BlingProdutos");
            var categorias = await ResolverCategoriasAsync(http, token.AccessToken, settings, cancellationToken);
            if (categorias.Ids.Count == 0 && categorias.Descricoes.Count == 0)
            {
                return Falha("Nenhuma categoria de celular configurada (informe o id ou a descrição em Configurações → Bling).");
            }

            var result = new BlingVendaCelularSyncResult { ExecutadoEm = DateTime.UtcNow };
            var cacheProduto = new Dictionary<long, ProdutoCache>();
            var cacheContato = new Dictionary<long, string>();
            var cacheNfe = new Dictionary<long, string>();

            for (var pagina = 1; pagina <= 50; pagina++)
            {
                var url = $"pedidos/vendas?pagina={pagina}&limite=100&dataInicial={dataInicial}&dataFinal={dataFinal}";
                var json = await GetJsonAsync(http, token.AccessToken, url, cancellationToken);
                if (json is null)
                {
                    result.Aviso = pagina == 1
                        ? "Não foi possível listar pedidos de venda no Bling. Confira se o aplicativo tem permissão de Pedidos de venda."
                        : result.Aviso;
                    break;
                }

                using var doc = JsonDocument.Parse(json);
                if (!TryGetPropertyCI(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Array)
                    break;

                var ids = new List<long>();
                foreach (var item in data.EnumerateArray())
                {
                    var id = LerLong(item, "id");
                    if (id > 0) ids.Add(id);
                }

                result.PedidosLidos += ids.Count;
                if (ids.Count == 0) break;

                foreach (var pedidoId in ids)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await ProcessarPedidoAsync(
                        http, token.AccessToken, pedidoId, categorias, settings,
                        cacheProduto, cacheContato, cacheNfe, result, cancellationToken);
                }

                if (ids.Count < 100) break;
            }

            result.Ok = string.IsNullOrWhiteSpace(result.Aviso) || result.Importadas + result.Atualizadas > 0;
            if (result.PedidosLidos == 0 && string.IsNullOrWhiteSpace(result.Aviso))
                result.Aviso = $"Nenhum pedido de venda no Bling entre {dataInicial} e {dataFinal}.";

            await _blingEff.RegistrarSyncVendasCelularesAsync(
                result.Aviso ?? $"OK: {result.Importadas} novas, {result.Atualizadas} atualizadas.",
                cancellationToken);

            _log.LogInformation(
                "Sync vendas celular Bling: pedidos={P} novas={N} atualizadas={A} ignoradas={I} semImei={Si} semCpf={Sc} aviso={Av}",
                result.PedidosLidos, result.Importadas, result.Atualizadas, result.Ignoradas,
                result.SemImei, result.SemCpf, result.Aviso);
            return result;
        }
        finally
        {
            _lock.Release();
        }
    }

    public BlingVendaCelularDescontoResponse ConsultarDesconto(
        string? cpf,
        string? imei,
        IReadOnlyList<BlingVendaCelularData> vendas)
    {
        var percentual = Math.Max(0, _blingEff.Current.VendasCelularesDescontoPercentual);
        var cpfN = ApenasDigitos(cpf);
        var imeiN = ApenasDigitos(imei);
        if (imeiN.Length > 15) imeiN = imeiN[..15];

        var dtos = vendas.Select(BlingVendaCelularMapper.ParaDto).ToList();
        if (cpfN.Length == 0 && imeiN.Length == 0)
        {
            return new BlingVendaCelularDescontoResponse
            {
                Elegivel = false,
                Motivo = "Informe o CPF e o IMEI para consultar o desconto.",
                DescontoPercentual = percentual,
            };
        }

        if (cpfN.Length > 0 && imeiN.Length > 0)
        {
            var match = dtos.FirstOrDefault(v => v.Imei == imeiN && v.ClienteCpf == cpfN);
            if (match is not null)
            {
                return new BlingVendaCelularDescontoResponse
                {
                    Elegivel = true,
                    Motivo = $"Aparelho vendido pela loja em {match.DataVenda:dd/MM/yyyy}. Desconto de {percentual:0.##}% na manutenção.",
                    DescontoPercentual = percentual,
                    Vendas = [match],
                };
            }

            return new BlingVendaCelularDescontoResponse
            {
                Elegivel = false,
                Motivo = dtos.Count == 0
                    ? "Não há venda de celular (novo ou iPhone usado) com este CPF e IMEI."
                    : "Este IMEI não está vinculado a este CPF nas vendas importadas do Bling.",
                DescontoPercentual = percentual,
                Vendas = dtos,
            };
        }

        if (imeiN.Length > 0)
        {
            return new BlingVendaCelularDescontoResponse
            {
                Elegivel = false,
                Motivo = dtos.Count == 0
                    ? "IMEI não encontrado nas vendas importadas do Bling."
                    : "IMEI encontrado. Informe o CPF do cliente para confirmar o desconto.",
                DescontoPercentual = percentual,
                Vendas = dtos,
            };
        }

        return new BlingVendaCelularDescontoResponse
        {
            Elegivel = false,
            Motivo = dtos.Count == 0
                ? "Nenhuma venda de celular encontrada para este CPF."
                : "Vendas encontradas. Informe o IMEI do aparelho para confirmar o desconto.",
            DescontoPercentual = percentual,
            Vendas = dtos,
        };
    }

    private async Task ProcessarPedidoAsync(
        HttpClient http,
        string accessToken,
        long pedidoId,
        CategoriasResolvidas categorias,
        BlingSettings settings,
        Dictionary<long, ProdutoCache> cacheProduto,
        Dictionary<long, string> cacheContato,
        Dictionary<long, string> cacheNfe,
        BlingVendaCelularSyncResult result,
        CancellationToken cancellationToken)
    {
        var json = await GetJsonAsync(http, accessToken, $"pedidos/vendas/{pedidoId}", cancellationToken);
        if (json is null) return;

        using var doc = JsonDocument.Parse(json);
        if (!TryGetPropertyCI(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Object)
            return;

        if (PedidoCancelado(data))
        {
            result.Ignoradas++;
            return;
        }

        var numero = LerString(data, "numero") ?? pedidoId.ToString(CultureInfo.InvariantCulture);
        var dataVenda = LerData(data, "data") ?? DateTime.UtcNow.Date;
        var contatoId = 0L;
        string? cpf = null;
        var clienteNome = "";
        if (TryGetPropertyCI(data, "contato", out var contato) && contato.ValueKind == JsonValueKind.Object)
        {
            contatoId = LerLong(contato, "id");
            clienteNome = LerString(contato, "nome") ?? "";
            cpf = NormalizarDocumento(
                LerString(contato, "numeroDocumento")
                ?? LerString(contato, "cpfCnpj")
                ?? LerString(contato, "documento"));
        }

        if (string.IsNullOrEmpty(cpf) && contatoId > 0)
        {
            if (!cacheContato.TryGetValue(contatoId, out cpf))
            {
                cpf = await BuscarCpfContatoAsync(http, accessToken, contatoId, cancellationToken) ?? "";
                cacheContato[contatoId] = cpf;
            }
        }

        var imeiPedido = ExtrairImeiDeJson(data);
        var nfeTexto = await TextoNfeAsync(http, accessToken, data, cacheNfe, cancellationToken);
        if (string.IsNullOrEmpty(imeiPedido))
            imeiPedido = ExtrairImei(nfeTexto);

        if (!TryGetPropertyCI(data, "itens", out var itensEl) || itensEl.ValueKind != JsonValueKind.Array)
        {
            result.Ignoradas++;
            return;
        }

        var indice = 0;
        var salvouAlgum = false;
        foreach (var item in itensEl.EnumerateArray())
        {
            indice++;
            var itemId = LerLong(item, "id");
            if (itemId <= 0) itemId = indice;

            var produtoId = 0L;
            if (TryGetPropertyCI(item, "produto", out var prodRef) && prodRef.ValueKind == JsonValueKind.Object)
                produtoId = LerLong(prodRef, "id");
            if (produtoId <= 0) produtoId = LerLong(item, "idProduto");

            ProdutoCache? produto = null;
            if (produtoId > 0)
            {
                if (!cacheProduto.TryGetValue(produtoId, out var cached))
                {
                    cached = await BuscarProdutoAsync(http, accessToken, produtoId, cancellationToken)
                             ?? new ProdutoCache { Id = produtoId };
                    cacheProduto[produtoId] = cached;
                }
                produto = cached;
            }

            var nomeItem = FirstNonEmpty(
                LerString(item, "descricao"),
                LerString(item, "descricaoDetalhada"),
                produto?.Nome);
            var codigo = FirstNonEmpty(LerString(item, "codigo"), produto?.Codigo) ?? "";

            var catId = produto?.CategoriaId;
            var catNome = produto?.CategoriaNome ?? "";
            if (!CategoriaBate(catId, catNome, categorias))
            {
                result.Ignoradas++;
                continue;
            }

            var tipo = ClassificarTipo(nomeItem, codigo, settings);
            if (tipo is null)
            {
                result.Ignoradas++;
                continue;
            }

            var imei = FirstNonEmpty(
                ExtrairImeiDeJson(item),
                ExtrairImei(
                    LerString(item, "descricaoDetalhada"),
                    LerString(item, "descricao"),
                    LerString(item, "observacoes"),
                    nfeTexto),
                imeiPedido);

            if (string.IsNullOrEmpty(imei))
            {
                result.SemImei++;
                continue;
            }

            if (string.IsNullOrEmpty(cpf))
            {
                result.SemCpf++;
                continue;
            }

            var valor = LerDecimal(item, "valor") * Math.Max(1, LerDecimal(item, "quantidade", 1));
            var existente = await _repo.ObterPorPedidoItemAsync(pedidoId, itemId, cancellationToken);
            var venda = new BlingVendaCelularData
            {
                BlingPedidoId = pedidoId,
                BlingItemId = itemId,
                PedidoNumero = numero,
                DataVenda = DateTime.SpecifyKind(dataVenda.Date, DateTimeKind.Utc),
                ClienteNome = clienteNome,
                ClienteCpf = cpf,
                ClienteBlingId = contatoId > 0 ? contatoId : null,
                ProdutoId = produtoId > 0 ? produtoId : null,
                ProdutoCodigo = codigo,
                ProdutoNome = nomeItem ?? "",
                CategoriaId = catId,
                CategoriaNome = catNome,
                Tipo = tipo,
                Imei = imei,
                Valor = valor,
                Observacoes = FirstNonEmpty(
                    LerString(data, "observacoes"),
                    LerString(data, "observacao")) ?? "",
            };

            if (existente is not null)
            {
                venda.ClienteLocalId = existente.ClienteLocalId;
                venda.CadastroPendente = existente.CadastroPendente;
                venda.Marca = existente.Marca;
                venda.Modelo = existente.Modelo;
                venda.Cor = existente.Cor;
                venda.Configuracao = existente.Configuracao;
                venda.MarcaId = existente.MarcaId;
                venda.ModeloId = existente.ModeloId;
            }

            await _repo.UpsertAsync(venda, cancellationToken);
            await _vinculo.AplicarVinculoAsync(venda, cancellationToken);
            if (existente is null) result.Importadas++;
            else result.Atualizadas++;
            salvouAlgum = true;
        }

        if (!salvouAlgum && itensEl.GetArrayLength() == 0)
            result.Ignoradas++;
    }

    private async Task<ProdutoCache?> BuscarProdutoAsync(
        HttpClient http,
        string accessToken,
        long produtoId,
        CancellationToken cancellationToken)
    {
        var json = await GetJsonAsync(http, accessToken, $"produtos/{produtoId}", cancellationToken);
        if (json is null) return null;
        using var doc = JsonDocument.Parse(json);
        if (!TryGetPropertyCI(doc.RootElement, "data", out var data)) return null;

        long? catId = null;
        var catNome = "";
        if (TryGetPropertyCI(data, "categoria", out var cat) && cat.ValueKind == JsonValueKind.Object)
        {
            catId = LerLong(cat, "id");
            catNome = LerString(cat, "descricao") ?? LerString(cat, "nome") ?? "";
        }

        if (catId is > 0 && string.IsNullOrWhiteSpace(catNome))
        {
            var catJson = await GetJsonAsync(http, accessToken, $"categorias/produtos/{catId}", cancellationToken);
            if (catJson is not null)
            {
                using var catDoc = JsonDocument.Parse(catJson);
                if (TryGetPropertyCI(catDoc.RootElement, "data", out var catData))
                    catNome = LerString(catData, "descricao") ?? LerString(catData, "nome") ?? "";
            }
        }

        return new ProdutoCache
        {
            Id = produtoId,
            Nome = LerString(data, "nome") ?? "",
            Codigo = LerString(data, "codigo") ?? "",
            CategoriaId = catId is > 0 ? catId : null,
            CategoriaNome = catNome,
        };
    }

    private async Task<string?> BuscarCpfContatoAsync(
        HttpClient http,
        string accessToken,
        long contatoId,
        CancellationToken cancellationToken)
    {
        var json = await GetJsonAsync(http, accessToken, $"contatos/{contatoId}", cancellationToken);
        if (json is null) return null;
        using var doc = JsonDocument.Parse(json);
        if (!TryGetPropertyCI(doc.RootElement, "data", out var data)) return null;
        return NormalizarDocumento(
            LerString(data, "numeroDocumento")
            ?? LerString(data, "cpfCnpj")
            ?? LerString(data, "documento"));
    }

    private async Task<string?> TextoNfeAsync(
        HttpClient http,
        string accessToken,
        JsonElement pedido,
        Dictionary<long, string> cache,
        CancellationToken cancellationToken)
    {
        var nfeId = 0L;
        if (TryGetPropertyCI(pedido, "notaFiscal", out var nf) && nf.ValueKind == JsonValueKind.Object)
            nfeId = LerLong(nf, "id");
        if (nfeId <= 0 && TryGetPropertyCI(pedido, "notasFiscais", out var nfs) && nfs.ValueKind == JsonValueKind.Array)
        {
            foreach (var n in nfs.EnumerateArray())
            {
                nfeId = LerLong(n, "id");
                if (nfeId > 0) break;
            }
        }

        if (nfeId <= 0) return null;
        if (cache.TryGetValue(nfeId, out var cached)) return cached;

        var json = await GetJsonAsync(http, accessToken, $"nfe/{nfeId}", cancellationToken)
                   ?? await GetJsonAsync(http, accessToken, $"nfce/{nfeId}", cancellationToken);
        var texto = json ?? "";
        cache[nfeId] = texto;
        return texto;
    }

    private async Task<CategoriasResolvidas> ResolverCategoriasAsync(
        HttpClient http,
        string accessToken,
        BlingSettings settings,
        CancellationToken cancellationToken)
    {
        var ids = ParseIds(settings.VendasCelularesCategoriaIds);
        var descricoes = ParseTextos(settings.VendasCelularesCategoriaDescricoes);
        if (ids.Count == 0 && descricoes.Count == 0)
            descricoes = ["celular", "celulares", "smartphone", "smartphones"];

        if (descricoes.Count == 0)
            return new CategoriasResolvidas(ids, descricoes);

        for (var pagina = 1; pagina <= 10; pagina++)
        {
            var json = await GetJsonAsync(http, accessToken, $"categorias/produtos?pagina={pagina}&limite=100", cancellationToken);
            if (json is null) break;
            using var doc = JsonDocument.Parse(json);
            if (!TryGetPropertyCI(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Array)
                break;

            var n = 0;
            foreach (var c in data.EnumerateArray())
            {
                n++;
                var id = LerLong(c, "id");
                var nome = LerString(c, "descricao") ?? LerString(c, "nome") ?? "";
                if (id <= 0 || string.IsNullOrWhiteSpace(nome)) continue;
                    if (CategoriaBate(id, nome, new CategoriasResolvidas([], descricoes)))
                    ids.Add(id);
            }

            if (n < 100) break;
        }

        return new CategoriasResolvidas(ids, descricoes);
    }

    private static bool CategoriaBate(
        long? catId,
        string? catNome,
        CategoriasResolvidas cats)
    {
        if (catId is > 0 && cats.Ids.Contains(catId.Value))
            return true;

        var nomeCat = NormalizarBusca(catNome);
        foreach (var d in cats.Descricoes)
        {
            var dn = NormalizarBusca(d);
            if (dn.Length == 0 || nomeCat.Length == 0) continue;
            if (nomeCat == dn || nomeCat.StartsWith(dn, StringComparison.Ordinal) || dn.StartsWith(nomeCat, StringComparison.Ordinal))
                return true;
        }

        return false;
    }

    private static string? ClassificarTipo(string? nome, string? codigo, BlingSettings settings)
    {
        var texto = NormalizarBusca($"{nome} {codigo}");
        var usados = ParseTextos(settings.VendasCelularesPalavrasUsado);
        if (usados.Count == 0)
            usados = ["usado", "seminovo", "semi-novo", "semi novo"];
        var iphones = ParseTextos(settings.VendasCelularesPalavrasIphone);
        if (iphones.Count == 0)
            iphones = ["iphone"];

        var ehUsado = usados.Any(p => texto.Contains(NormalizarBusca(p)));
        var ehIphone = iphones.Any(p => texto.Contains(NormalizarBusca(p)));
        if (ehUsado && ehIphone) return BlingVendaCelularTipo.IphoneUsado;
        if (ehUsado) return null;
        return BlingVendaCelularTipo.Novo;
    }

    private static bool PedidoCancelado(JsonElement data)
    {
        if (!TryGetPropertyCI(data, "situacao", out var sit)) return false;
        if (sit.ValueKind == JsonValueKind.Object)
        {
            var id = LerLong(sit, "id");
            if (id is 12) return true;
            var nome = NormalizarBusca(LerString(sit, "nome") ?? LerString(sit, "valor"));
            if (nome.Contains("cancel")) return true;
        }
        else if (sit.ValueKind == JsonValueKind.String)
        {
            var nome = NormalizarBusca(sit.GetString());
            if (nome.Contains("cancel")) return true;
        }

        return false;
    }

    private static int ResolverDias(BlingVendaCelularSincronizarRequest? pedido, BlingSettings settings)
    {
        if (pedido?.Dias is > 0) return Math.Clamp(pedido.Dias.Value, 1, 730);
        if (pedido?.HistoricoCompleto == true || settings.VendasCelularesUltimaSyncEm is null)
            return Math.Clamp(settings.VendasCelularesDiasHistoricoInicial, 1, 730);
        return Math.Clamp(settings.VendasCelularesDiasLookback, 1, 30);
    }

    private async Task<string?> GetJsonAsync(
        HttpClient http,
        string accessToken,
        string url,
        CancellationToken cancellationToken)
    {
        for (var tentativa = 1; tentativa <= 4; tentativa++)
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var resp = await http.SendAsync(req, cancellationToken);
            if (resp.StatusCode == HttpStatusCode.TooManyRequests)
            {
                await Task.Delay(TimeSpan.FromSeconds(5 * tentativa), cancellationToken);
                continue;
            }

            if (resp.StatusCode == HttpStatusCode.NotFound)
                return null;

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(cancellationToken);
                _log.LogWarning("Bling GET {Url} HTTP {Status}: {Body}",
                    url, (int)resp.StatusCode, body[..Math.Min(180, body.Length)]);
                if (resp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                    return null;
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync(cancellationToken);
            await Task.Delay(Throttle, cancellationToken);
            return json;
        }

        return null;
    }

    private async Task<Models.Bling.BlingTokenResponse?> ObterTokenValidoAsync()
    {
        var token = _auth.GetCurrentToken();
        if (token is null
            || string.IsNullOrWhiteSpace(token.AccessToken)
            || token.AccessToken.StartsWith("local-bypass", StringComparison.OrdinalIgnoreCase))
            return null;

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
            _log.LogWarning(ex, "Falha ao renovar token Bling na importação de vendas");
            return null;
        }
    }

    private static BlingVendaCelularSyncResult Falha(string aviso) => new()
    {
        Ok = false,
        Aviso = aviso,
        ExecutadoEm = DateTime.UtcNow,
    };

    private static string? ExtrairImeiDeJson(JsonElement el)
    {
        var textos = new List<string>();
        ColetarTextos(el, textos, 0);
        return ExtrairImei(textos.ToArray());
    }

    private static void ColetarTextos(JsonElement el, List<string> dest, int depth)
    {
        if (depth > 10 || dest.Count > 80) return;
        switch (el.ValueKind)
        {
            case JsonValueKind.String:
                var s = el.GetString();
                if (!string.IsNullOrWhiteSpace(s)) dest.Add(s);
                break;
            case JsonValueKind.Number:
                if (el.TryGetInt64(out var n) && n is >= 100000000000000 and <= 999999999999999)
                    dest.Add(n.ToString(CultureInfo.InvariantCulture));
                break;
            case JsonValueKind.Object:
                foreach (var p in el.EnumerateObject())
                    ColetarTextos(p.Value, dest, depth + 1);
                break;
            case JsonValueKind.Array:
                foreach (var c in el.EnumerateArray())
                    ColetarTextos(c, dest, depth + 1);
                break;
        }
    }

    private static string? ExtrairImei(params string?[] textos)
    {
        foreach (var t in textos)
        {
            if (string.IsNullOrWhiteSpace(t)) continue;
            foreach (Match m in ImeiRx.Matches(t))
            {
                var d = m.Groups[1].Value;
                if (d.Distinct().Count() <= 1) continue;
                return d;
            }
        }

        return null;
    }

    private static string? NormalizarDocumento(string? valor)
    {
        var d = ApenasDigitos(valor);
        if (d.Length is 11 or 14) return d;
        return d.Length >= 11 ? d : null;
    }

    private static string ApenasDigitos(string? valor) =>
        new((valor ?? "").Where(char.IsDigit).ToArray());

    private static HashSet<long> ParseIds(string? raw)
    {
        var set = new HashSet<long>();
        foreach (var parte in (raw ?? "").Split([',', ';', ' ', '|', '\n', '\r', '\t'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (long.TryParse(parte.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var id) && id > 0)
                set.Add(id);
        }
        return set;
    }

    private static List<string> ParseTextos(string? raw) =>
        (raw ?? "")
            .Split([',', ';', '|', '\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .Select(x => x.Trim())
            .Where(x => x.Length > 0)
            .ToList();

    private static string NormalizarBusca(string? valor)
    {
        var t = (valor ?? "").Trim().ToLowerInvariant();
        t = t.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(t.Length);
        foreach (var ch in t)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(ch);
        }
        return sb.ToString();
    }

    private static bool TryGetPropertyCI(JsonElement el, string nome, out JsonElement valor)
    {
        if (el.ValueKind == JsonValueKind.Object)
        {
            foreach (var p in el.EnumerateObject())
            {
                if (string.Equals(p.Name, nome, StringComparison.OrdinalIgnoreCase))
                {
                    valor = p.Value;
                    return true;
                }
            }
        }

        valor = default;
        return false;
    }

    private static long LerLong(JsonElement el, string nome)
    {
        if (!TryGetPropertyCI(el, nome, out var v)) return 0;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String
            && long.TryParse(v.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var p))
            return p;
        return 0;
    }

    private static decimal LerDecimal(JsonElement el, string nome, decimal padrao = 0)
    {
        if (!TryGetPropertyCI(el, nome, out var v)) return padrao;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String
            && decimal.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var p))
            return p;
        return padrao;
    }

    private static string? LerString(JsonElement el, string nome)
    {
        if (!TryGetPropertyCI(el, nome, out var v)) return null;
        return v.ValueKind switch
        {
            JsonValueKind.String => v.GetString(),
            JsonValueKind.Number => v.ToString(),
            _ => null,
        };
    }

    private static DateTime? LerData(JsonElement el, string nome)
    {
        var s = LerString(el, nome);
        if (string.IsNullOrWhiteSpace(s)) return null;
        if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var d))
            return d;
        if (DateTime.TryParse(s, new CultureInfo("pt-BR"), DateTimeStyles.AssumeLocal, out d))
            return d;
        return null;
    }

    private static string? FirstNonEmpty(params string?[] valores)
    {
        foreach (var v in valores)
        {
            if (!string.IsNullOrWhiteSpace(v)) return v.Trim();
        }
        return null;
    }

    private sealed record CategoriasResolvidas(HashSet<long> Ids, List<string> Descricoes);

    private sealed class ProdutoCache
    {
        public long Id { get; set; }
        public string Nome { get; set; } = "";
        public string Codigo { get; set; } = "";
        public long? CategoriaId { get; set; }
        public string CategoriaNome { get; set; } = "";
    }
}
