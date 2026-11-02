using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using MongoDB.Bson;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingEstoqueCelularImportService
{
    Task<BlingEstoqueCelularImportResult> ImportarAsync(CancellationToken cancellationToken = default);
}

public sealed class BlingEstoqueCelularImportService : IBlingEstoqueCelularImportService
{
    private static readonly string[] Buscas = ["iPhone", "Galaxy", "Motorola", "Xiaomi", "Redmi", "Poco", "Realme", "Smartphone", "Celular"];
    private readonly HashSet<long> _categoriaCelular = [];
    private static readonly TimeSpan Throttle = TimeSpan.FromMilliseconds(250);
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly IAparelhoLojaRepository _loja;
    private readonly IAparelhoRepository _catalogo;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<BlingEstoqueCelularImportService> _log;

    public BlingEstoqueCelularImportService(
        IAparelhoLojaRepository loja,
        IAparelhoRepository catalogo,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        ILogger<BlingEstoqueCelularImportService> log)
    {
        _loja = loja;
        _catalogo = catalogo;
        _auth = auth;
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<BlingEstoqueCelularImportResult> ImportarAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken);
        try
        {
            var token = _auth.GetCurrentToken();
            if (token is null || string.IsNullOrWhiteSpace(token.AccessToken) || token.ExpiresAt <= DateTime.UtcNow.AddMinutes(1))
            {
                return Falha("Bling não está conectado. Autorize de novo em Configurações → Bling.");
            }

            var http = _httpFactory.CreateClient("BlingProdutos");
            _categoriaCelular.Clear();
            var produtos = new Dictionary<long, JsonElement>();
            var docs = new List<JsonDocument>();
            try
            {
                foreach (var termo in Buscas)
                {
                    for (var pagina = 1; pagina <= 15; pagina++)
                    {
                        var url = "produtos?pagina=" + pagina + "&limite=100&criterio=2&nome=" + Uri.EscapeDataString(termo);
                        var json = await GetJsonAsync(http, token.AccessToken, url, cancellationToken);
                        if (json is null)
                        {
                            if (produtos.Count == 0 && pagina == 1 && termo == Buscas[0])
                                return Falha("Não foi possível listar produtos no Bling. Confira se o aplicativo tem permissão de Produtos.");
                            break;
                        }

                        var doc = JsonDocument.Parse(json);
                        docs.Add(doc);
                        if (!TryGet(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Array)
                            break;
                        var n = 0;
                        foreach (var item in data.EnumerateArray())
                        {
                            n++;
                            var id = LerLong(item, "id");
                            if (id > 0 && !produtos.ContainsKey(id))
                                produtos[id] = item.Clone();
                        }
                        if (n < 100) break;
                    }
                }

                var result = new BlingEstoqueCelularImportResult
                {
                    ProdutosLidos = produtos.Count,
                    Ok = true,
                };
                await IncluirCategoriaCelularesAsync(http, token.AccessToken, produtos, docs, cancellationToken);

                var estoque = await _loja.ListarEstoqueAsync(cancellationToken);
                var imeis = new HashSet<string>(
                    estoque.Select(a => a.Imei).Where(i => i.Length == 15),
                    StringComparer.Ordinal);
                var jaPorProduto = estoque
                    .Where(a => a.BlingProdutoId is > 0)
                    .GroupBy(a => a.BlingProdutoId!.Value)
                    .ToDictionary(g => g.Key, g => g.Count());
                var modelos = await _catalogo.ListarModelosAsync(null, null, null, "Celular", 500);
                var daCategoria = _categoriaCelular;

                foreach (var (id, lista) in produtos)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    var nomeLista = LerString(lista, "nome") ?? "";
                    var previo = BlingCelularEstoqueLeitura.Ler(nomeLista, LerString(lista, "codigo"), null, null, null, 0, 0, 1);
                    var daListaDeCelular = daCategoria.Contains(id);
                    if (!previo.PareceCelular && !daListaDeCelular)
                        continue;

                    var detalheJson = await GetJsonAsync(http, token.AccessToken, "produtos/" + id.ToString(CultureInfo.InvariantCulture), cancellationToken);
                    if (detalheJson is null)
                        continue;
                    using var detalheDoc = JsonDocument.Parse(detalheJson);
                    if (!TryGet(detalheDoc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Object)
                        continue;

                    var leitura = LerDetalhe(data);
                    var saldo = Math.Max(leitura.Saldo, SaldoDe(lista));
                    var unidades = (int)Math.Floor(saldo);
                    if (unidades <= 0)
                    {
                        result.SemSaldo++;
                        continue;
                    }

                    jaPorProduto.TryGetValue(id, out var ja);
                    var criar = unidades - ja;
                    if (criar <= 0)
                    {
                        result.JaNoEstoque++;
                        continue;
                    }

                    var comImei = leitura.Imeis.Where(i => imeis.Add(i)).Take(criar).ToList();
                    var semImei = criar - comImei.Count;
                    result.SemImei += semImei;
                    var fila = comImei.Concat(Enumerable.Repeat("", semImei)).ToList();
                    var (marca, modelo, marcaId, modeloId) = CasarCatalogo(leitura, modelos);
                    if (string.IsNullOrWhiteSpace(marca)) marca = "Celular";

                    foreach (var imei in fila)
                    {
                        var agora = HorarioBrasil.Agora;
                        var aparelhoId = ObjectId.GenerateNewId().ToString();
                        var operacaoId = ObjectId.GenerateNewId().ToString();
                        var venda = leitura.ValorVenda;
                        var minimo = venda > 1 ? 1m : 0m;
                        var aparelho = new AparelhoLojaData
                        {
                            Id = aparelhoId,
                            Imei = imei,
                            Marca = marca,
                            Modelo = modelo,
                            MarcaId = marcaId,
                            ModeloId = modeloId,
                            Cor = leitura.Cor,
                            Configuracao = leitura.Configuracao,
                            Condicao = leitura.Condicao,
                            Custo = leitura.Custo,
                            ValorVenda = venda,
                            ValorMinimoVenda = minimo,
                            Status = AparelhoLojaStatus.EmEstoque,
                            Origem = AparelhoOperacaoTipo.Compra,
                            OperacaoEntradaId = operacaoId,
                            DataEntrada = agora,
                            Observacoes = imei.Length == 15
                                ? "Importado do estoque do Bling. Produto " + id.ToString(CultureInfo.InvariantCulture) + "."
                                : "Importado do estoque do Bling sem IMEI. Informe o IMEI antes de vender. Produto " + id.ToString(CultureInfo.InvariantCulture) + ".",
                            BlingProdutoId = id,
                            DescontoVigente = false,
                        };
                        var movimento = new AparelhoMovimentoData
                        {
                            AparelhoId = aparelhoId,
                            Imei = imei,
                            Marca = marca,
                            Modelo = modelo,
                            Cor = leitura.Cor,
                            Configuracao = leitura.Configuracao,
                            Condicao = leitura.Condicao,
                            Custo = leitura.Custo,
                        };
                        var operacao = new AparelhoOperacaoData
                        {
                            Id = operacaoId,
                            Tipo = AparelhoOperacaoTipo.Compra,
                            Status = AparelhoOperacaoStatus.Ativa,
                            Data = agora,
                            FornecedorNome = "Bling",
                            Entrada = movimento,
                            Entradas = [movimento],
                            DinheiroPago = 0,
                            DinheiroRecebido = 0,
                            Observacoes = "Estoque já existente no Bling. Sem movimento de caixa.",
                            VendedorNome = "Importação Bling",
                        };
                        await _loja.InserirAparelhoAsync(aparelho, cancellationToken);
                        await _loja.InserirOperacaoAsync(operacao, cancellationToken);
                        jaPorProduto[id] = jaPorProduto.GetValueOrDefault(id) + 1;
                        result.Importados++;
                        if (leitura.Custo <= 0) result.SemCusto++;
                    }
                }

                if (result.Importados == 0 && result.ProdutosLidos == 0)
                    result.Aviso = "Nenhum produto de celular encontrado no Bling.";
                else if (result.SemImei > 0)
                    result.Aviso = result.SemImei + " aparelhos entraram sem IMEI no Bling. Informe o IMEI antes de vender."
                        + (result.SemCusto > 0 ? " O preço de venda não foi usado como custo." : "");
                else if (result.SemCusto > 0)
                    result.Aviso = result.SemCusto + " aparelhos entraram sem preço de custo no Bling. O preço de venda não foi usado como custo.";

                result.Ok = string.IsNullOrWhiteSpace(result.Aviso) || result.Importados > 0;
                _log.LogInformation(
                    "Importação estoque celular: lidos={L} importados={I} semImei={S} semSaldo={Z} ja={J}",
                    result.ProdutosLidos, result.Importados, result.SemImei, result.SemSaldo, result.JaNoEstoque);
                return result;
            }
            finally
            {
                foreach (var doc in docs) doc.Dispose();
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task IncluirCategoriaCelularesAsync(
        HttpClient http,
        string accessToken,
        Dictionary<long, JsonElement> produtos,
        List<JsonDocument> docs,
        CancellationToken cancellationToken)
    {
        for (var pagina = 1; pagina <= 10; pagina++)
        {
            var json = await GetJsonAsync(http, accessToken, $"categorias/produtos?pagina={pagina}&limite=100", cancellationToken);
            if (json is null) return;
            using var doc = JsonDocument.Parse(json);
            if (!TryGet(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Array)
                return;
            var n = 0;
            var ids = new List<long>();
            foreach (var cat in data.EnumerateArray())
            {
                n++;
                var nome = LerString(cat, "descricao") ?? LerString(cat, "nome") ?? "";
                if (!CategoriaDeCelular(nome)) continue;
                var id = LerLong(cat, "id");
                if (id > 0) ids.Add(id);
            }

            foreach (var idCategoria in ids)
            {
                for (var p = 1; p <= 15; p++)
                {
                    var url = $"produtos?pagina={p}&limite=100&criterio=2&idCategoria={idCategoria.ToString(CultureInfo.InvariantCulture)}";
                    var listaJson = await GetJsonAsync(http, accessToken, url, cancellationToken);
                    if (listaJson is null) break;
                    var listaDoc = JsonDocument.Parse(listaJson);
                    docs.Add(listaDoc);
                    if (!TryGet(listaDoc.RootElement, "data", out var itens) || itens.ValueKind != JsonValueKind.Array)
                        break;
                    var qtd = 0;
                    foreach (var item in itens.EnumerateArray())
                    {
                        qtd++;
                        var id = LerLong(item, "id");
                        if (id <= 0) continue;
                        _categoriaCelular.Add(id);
                        produtos.TryAdd(id, item.Clone());
                    }
                    if (qtd < 100) break;
                }
            }

            if (n < 100) return;
        }
    }

    private static bool CategoriaDeCelular(string nome)
    {
        var n = BlingCelularEstoqueLeitura.Normalizar(nome);
        if (n.Contains("capinha", StringComparison.Ordinal) || n.Contains("pelicula", StringComparison.Ordinal))
            return false;
        return n is "celular" or "celulares" or "smartphone" or "smartphones";
    }

    private static decimal SaldoDe(JsonElement item)
    {
        if (!TryGet(item, "estoque", out var est) || est.ValueKind != JsonValueKind.Object)
            return 0;
        return Math.Max(LerDecimal(est, "saldoVirtualTotal"), LerDecimal(est, "saldoFisicoTotal"));
    }

    private static BlingCelularEstoqueLeitura LerDetalhe(JsonElement data)
    {
        var extras = new List<string>();
        ColetarTextos(data, extras, 0);
        var saldo = 0m;
        if (TryGet(data, "estoque", out var est) && est.ValueKind == JsonValueKind.Object)
        {
            saldo = PrimeiroPositivo(est, "saldoVirtualTotal", "saldoFisicoTotal");
            if (saldo <= 0)
            {
                var virtualSaldo = LerDecimal(est, "saldoVirtualTotal");
                var fisico = LerDecimal(est, "saldoFisicoTotal");
                saldo = Math.Max(virtualSaldo, fisico);
            }
        }
        return BlingCelularEstoqueLeitura.Ler(
            LerString(data, "nome"),
            LerString(data, "codigo"),
            First(LerString(data, "descricaoCurta"), LerString(data, "descricaoComplementar"), LerString(data, "observacoes")),
            First(LerString(data, "gtin"), LerString(data, "gtinEmbalagem")),
            extras,
            PrimeiroPositivo(data, "preco"),
            PrimeiroPositivo(data, "precoCusto", "custo", "valorCusto"),
            saldo);
    }

    private static (string Marca, string Modelo, string? MarcaId, string? ModeloId) CasarCatalogo(
        BlingCelularEstoqueLeitura leitura,
        IReadOnlyList<ModeloAparelho> modelos)
    {
        var texto = BlingCelularEstoqueLeitura.Normalizar(leitura.Marca + " " + leitura.Modelo);
        ModeloAparelho? melhor = null;
        var tamanho = 0;
        foreach (var modelo in modelos)
        {
            var nome = BlingCelularEstoqueLeitura.Normalizar(modelo.Nome);
            if (nome.Length < 3 || !texto.Contains(nome, StringComparison.Ordinal)) continue;
            if (nome.Length <= tamanho) continue;
            melhor = modelo;
            tamanho = nome.Length;
        }

        if (melhor is null)
            return (leitura.Marca, leitura.Modelo, null, null);
        var marca = string.IsNullOrWhiteSpace(melhor.MarcaNome) ? leitura.Marca : melhor.MarcaNome.Trim();
        return (marca, melhor.Nome.Trim(), melhor.MarcaId, melhor.Id);
    }

    private static void ColetarTextos(JsonElement el, List<string> dest, int depth)
    {
        if (depth > 6 || dest.Count > 40) return;
        switch (el.ValueKind)
        {
            case JsonValueKind.String:
                var s = el.GetString();
                if (!string.IsNullOrWhiteSpace(s) && s.Length <= 400) dest.Add(s);
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

    private async Task<string?> GetJsonAsync(HttpClient http, string accessToken, string url, CancellationToken cancellationToken)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req, cancellationToken);
        if (resp.StatusCode == HttpStatusCode.TooManyRequests)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            using var retry = new HttpRequestMessage(HttpMethod.Get, url);
            retry.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            using var resp2 = await http.SendAsync(retry, cancellationToken);
            if (!resp2.IsSuccessStatusCode) return null;
            var body2 = await resp2.Content.ReadAsStringAsync(cancellationToken);
            await Task.Delay(Throttle, cancellationToken);
            return body2;
        }
        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("Bling GET {Url} HTTP {Status}", url, (int)resp.StatusCode);
            return null;
        }
        var body = await resp.Content.ReadAsStringAsync(cancellationToken);
        await Task.Delay(Throttle, cancellationToken);
        return body;
    }

    private static BlingEstoqueCelularImportResult Falha(string aviso) => new() { Ok = false, Aviso = aviso };

    private static decimal PrimeiroPositivo(JsonElement el, params string[] nomes)
    {
        foreach (var nome in nomes)
        {
            var valor = LerDecimal(el, nome);
            if (valor > 0) return valor;
        }
        return 0;
    }

    private static bool TryGet(JsonElement el, string nome, out JsonElement valor)
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
        if (!TryGet(el, nome, out var v)) return 0;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out var n)) return n;
        return 0;
    }

    private static decimal LerDecimal(JsonElement el, string nome)
    {
        if (!TryGet(el, nome, out var v)) return 0;
        if (v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n)) return n;
        if (v.ValueKind == JsonValueKind.String && decimal.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var p))
            return p;
        return 0;
    }

    private static string? LerString(JsonElement el, string nome)
    {
        if (!TryGet(el, nome, out var v)) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : null;
    }

    private static string? First(params string?[] valores)
    {
        foreach (var v in valores)
        {
            if (!string.IsNullOrWhiteSpace(v)) return v.Trim();
        }
        return null;
    }
}
