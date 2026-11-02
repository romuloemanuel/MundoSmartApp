using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IComissaoOrigemService
{
    Task<ComissaoOrigemDto> SmartphonesAsync(string? inicio, string? fim, CancellationToken cancellationToken = default);
    Task<ComissaoOrigemDto> LojaAsync(string? inicio, string? fim, CancellationToken cancellationToken = default);
    Task AtualizarLojaAsync(CancellationToken cancellationToken = default);
}

public sealed class ComissaoOrigemService : IComissaoOrigemService
{
    private readonly IAparelhoLojaRepository _loja;
    private readonly IBlingComissaoLojaRepository _cache;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ComissaoOrigemService> _log;
    private readonly SemaphoreSlim _syncLoja = new(1, 1);

    public ComissaoOrigemService(
        IAparelhoLojaRepository loja,
        IBlingComissaoLojaRepository cache,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        ILogger<ComissaoOrigemService> log)
    {
        _loja = loja;
        _cache = cache;
        _auth = auth;
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<ComissaoOrigemDto> SmartphonesAsync(string? inicio, string? fim, CancellationToken cancellationToken = default)
    {
        var (de, ate) = Periodo(inicio, fim);
        var ops = await _loja.ListarOperacoesAtivasAsync(cancellationToken);
        var lancamentos = new List<ComissaoLancamentoDto>();

        foreach (var op in ops)
        {
            if (op.Tipo is not (AparelhoOperacaoTipo.Venda or AparelhoOperacaoTipo.Troca)) continue;
            var dia = op.Data.Date;
            if (dia < de || dia > ate) continue;

            var custo = op.Saida?.Custo ?? 0;
            var entrou = op.DinheiroRecebido;
            lancamentos.Add(new ComissaoLancamentoDto
            {
                Data = dia.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Tipo = op.Tipo,
                Vendedor = Nome(op.VendedorNome),
                Descricao = Descrever(op),
                Produto = TextoAparelho(op.Saida),
                Cliente = op.ClienteNome ?? "",
                Valor = entrou,
                DinheiroPago = op.DinheiroPago,
                Custo = custo,
                Liquido = entrou - custo,
            });
        }

        return Montar(lancamentos, null);
    }

    public async Task<ComissaoOrigemDto> LojaAsync(string? inicio, string? fim, CancellationToken cancellationToken = default)
    {
        var (de, ate) = Periodo(inicio, fim);
        var deTxt = de.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var ateTxt = ate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var salvas = await _cache.ListarAsync(deTxt, ateTxt, cancellationToken);
        var ultima = await _cache.UltimaAtualizacaoAsync(cancellationToken);
        var (janelaDe, _) = JanelaAutomatica();
        var aviso = ultima is null
            ? "A comissão da loja está sendo lida do Bling agora. Abra de novo em alguns minutos."
            : "Pedidos do Bling atualizados em " + FormatarBrasil(ultima.Value) + ". A próxima leitura é automática.";
        if (de < janelaDe)
            aviso += " A atualização automática começa em " + janelaDe.ToString("dd/MM/yyyy", CultureInfo.GetCultureInfo("pt-BR")) + ".";

        var lancamentos = salvas.Select(x => new ComissaoLancamentoDto
        {
            Data = x.Data,
            Tipo = "venda",
            Vendedor = x.Vendedor,
            Descricao = x.Pedido,
            Produto = x.Produto,
            Cliente = x.Cliente,
            Valor = x.Valor,
            Custo = x.Custo,
            Liquido = x.Valor - (x.Custo ?? 0),
        }).ToList();
        return Montar(lancamentos, aviso);
    }

    public async Task AtualizarLojaAsync(CancellationToken cancellationToken = default)
    {
        if (!await _syncLoja.WaitAsync(0, cancellationToken))
            return;

        try
        {
            await AtualizarLojaDentroAsync(cancellationToken);
        }
        finally
        {
            _syncLoja.Release();
        }
    }

    private async Task AtualizarLojaDentroAsync(CancellationToken cancellationToken)
    {
        var (de, ate) = JanelaAutomatica();
        var token = await TokenAsync();
        if (token is null)
        {
            _log.LogWarning("Comissão da loja não atualizada: Bling não está conectado.");
            return;
        }

        var http = _httpFactory.CreateClient("BlingProdutos");
        var dataInicial = de.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var dataFinal = ate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var gravar = new List<BlingComissaoLojaData>();
        var produtos = new Dictionary<long, (string Nome, decimal? Custo)>();
        var agora = DateTime.UtcNow;
        var leu = false;
        var incompleto = false;
        string? aviso = null;

        for (var pagina = 1; pagina <= 30; pagina++)
        {
            var url = $"pedidos/vendas?pagina={pagina}&limite=100&dataInicial={dataInicial}&dataFinal={dataFinal}";
            var json = await GetJsonAsync(http, token, url, cancellationToken);
            if (json is null)
            {
                incompleto = true;
                if (pagina == 1)
                    aviso = "Não foi possível ler os pedidos de venda do Bling. Confira a permissão de Pedidos de venda.";
                break;
            }

            leu = true;

            using var doc = JsonDocument.Parse(json);
            if (!TryGet(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Array)
                break;

            var lidos = 0;
            foreach (var item in data.EnumerateArray())
            {
                lidos++;
                if (Cancelado(item)) continue;
                var total = LerTotal(item);
                var dataPedido = LerData(item);
                if (dataPedido is null || dataPedido.Value < de || dataPedido.Value > ate) continue;
                var numero = LerTexto(item, "numero");
                var (vendedor, _) = LerVendedor(item);
                var pedidoId = LerLong(item, "id");
                var cliente = LerCliente(item);
                var dia = dataPedido.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                var descricao = string.IsNullOrWhiteSpace(numero) ? "Pedido de venda" : $"Pedido {numero}";
                var itens = await ItensDoPedidoAsync(http, token, pedidoId, produtos, cancellationToken);
                if (itens.Count == 0)
                {
                    gravar.Add(LinhaCache(pedidoId, 0, dia, vendedor, descricao, "", cliente, total, null, agora));
                    continue;
                }

                foreach (var linha in itens)
                    gravar.Add(LinhaCache(pedidoId, linha.ItemId, dia, vendedor, descricao, linha.Produto, cliente, linha.Valor, linha.Custo, agora));
            }

            if (lidos < 100) break;
            if (pagina == 30)
                aviso = "O recorte passou de 3.000 pedidos. Os mais antigos desta consulta podem ter ficado de fora.";
        }

        if (!leu || incompleto)
        {
            _log.LogWarning("Comissão da loja mantida como estava. {Aviso}", aviso ?? "Leitura incompleta.");
            return;
        }

        await _cache.SubstituirJanelaAsync(dataInicial, dataFinal, gravar, cancellationToken);
        _log.LogInformation("Comissão da loja gravada: {N} itens de {De} a {Ate}.", gravar.Count, dataInicial, dataFinal);
    }

    private static (DateTime De, DateTime Ate) JanelaAutomatica()
    {
        var hoje = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, HorarioBrasil.TimeZone).Date;
        var inicio = new DateTime(hoje.Year, hoje.Month, 1).AddMonths(-1);
        return (inicio, hoje);
    }

    private static string FormatarBrasil(DateTime utc)
    {
        var instante = utc.Kind == DateTimeKind.Utc ? utc : DateTime.SpecifyKind(utc, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(instante, HorarioBrasil.TimeZone);
        return local.ToString("dd/MM/yyyy HH:mm", CultureInfo.GetCultureInfo("pt-BR"));
    }

    private static BlingComissaoLojaData LinhaCache(
        long pedidoId,
        long itemId,
        string dia,
        string vendedor,
        string pedido,
        string produto,
        string cliente,
        decimal valor,
        decimal? custo,
        DateTime agora) =>
        new()
        {
            BlingPedidoId = pedidoId,
            BlingItemId = itemId,
            Data = dia,
            Pedido = pedido,
            Vendedor = vendedor,
            Produto = produto,
            Cliente = cliente,
            Valor = valor,
            Custo = custo,
            AtualizadoEm = agora,
        };

    private static ComissaoOrigemDto Montar(List<ComissaoLancamentoDto> lancamentos, string? aviso)
    {
        var porVendedor = lancamentos
            .GroupBy(l => l.Vendedor, StringComparer.OrdinalIgnoreCase)
            .Select(g => new ComissaoVendedorDto
            {
                Nome = g.First().Vendedor,
                Quantidade = g.Count(),
                Vendas = g.Count(x => x.Tipo == AparelhoOperacaoTipo.Venda || x.Tipo == "venda"),
                Trocas = g.Count(x => x.Tipo == AparelhoOperacaoTipo.Troca),
                Total = g.Sum(x => x.Valor),
                DinheiroPago = g.Sum(x => x.DinheiroPago),
                Custo = g.Sum(x => x.Custo ?? 0),
                Liquido = g.Sum(x => x.Liquido),
            })
            .OrderByDescending(v => v.Total)
            .ThenBy(v => v.Nome, StringComparer.OrdinalIgnoreCase)
            .ToList();

        lancamentos.Sort((a, b) =>
        {
            var data = string.Compare(b.Data, a.Data, StringComparison.Ordinal);
            return data != 0 ? data : string.Compare(a.Vendedor, b.Vendedor, StringComparison.OrdinalIgnoreCase);
        });

        return new ComissaoOrigemDto
        {
            Aviso = aviso,
            Total = lancamentos.Sum(x => x.Valor),
            DinheiroPago = lancamentos.Sum(x => x.DinheiroPago),
            Custo = lancamentos.Sum(x => x.Custo ?? 0),
            Liquido = lancamentos.Sum(x => x.Liquido),
            Quantidade = lancamentos.Count,
            Vendas = lancamentos.Count(x => x.Tipo is AparelhoOperacaoTipo.Venda or "venda"),
            Trocas = lancamentos.Count(x => x.Tipo == AparelhoOperacaoTipo.Troca),
            Vendedores = porVendedor,
            Lancamentos = lancamentos,
        };
    }

    private static string Descrever(AparelhoOperacaoData op)
    {
        var saiu = TextoAparelho(op.Saida);
        var entrou = string.Join(" + ", EntradasDe(op).Select(TextoAparelho).Where(s => s.Length > 0));
        if (op.Tipo == AparelhoOperacaoTipo.Troca && entrou.Length > 0 && saiu.Length > 0)
            return $"{entrou} entrou · {saiu} saiu";
        if (saiu.Length > 0) return saiu;
        return entrou;
    }

    private static IEnumerable<AparelhoMovimentoData> EntradasDe(AparelhoOperacaoData op) =>
        op.Entradas is { Count: > 0 }
            ? op.Entradas
            : op.Entrada is null ? [] : [op.Entrada];

    private static string TextoAparelho(AparelhoMovimentoData? item)
    {
        if (item is null) return "";
        var nome = $"{item.Marca} {item.Modelo}".Trim();
        if (item.Cor.Length > 0) nome = $"{nome} {item.Cor}".Trim();
        return nome;
    }

    private static string Nome(string? vendedor) =>
        string.IsNullOrWhiteSpace(vendedor) ? "Sem vendedor" : vendedor.Trim();

    private static (DateTime De, DateTime Ate) Periodo(string? inicio, string? fim)
    {
        var hoje = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, HorarioBrasil.TimeZone).Date;
        var de = ParseDia(inicio) ?? new DateTime(hoje.Year, hoje.Month, 1);
        var ate = ParseDia(fim) ?? hoje;
        if (ate < de) (de, ate) = (ate, de);
        return (de, ate);
    }

    private static DateTime? ParseDia(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return null;
        return DateTime.TryParseExact(texto.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dia)
            ? dia.Date
            : null;
    }

    private static (string Nome, string Id) LerVendedor(JsonElement item)
    {
        if (!item.TryGetProperty("vendedor", out var vendedor) || vendedor.ValueKind != JsonValueKind.Object)
            return ("Sem vendedor", "");
        var id = vendedor.TryGetProperty("id", out var idEl) ? idEl.ToString() : "";
        var nome = LerTexto(vendedor, "nome");
        if (string.IsNullOrWhiteSpace(nome))
            nome = string.IsNullOrWhiteSpace(id) ? "Sem vendedor" : $"Vendedor {id}";
        return (nome, id ?? "");
    }

    private static string LerCliente(JsonElement item)
    {
        if (!item.TryGetProperty("contato", out var contato) || contato.ValueKind != JsonValueKind.Object)
            return "";
        return LerTexto(contato, "nome");
    }

    private static bool Cancelado(JsonElement item)
    {
        if (!item.TryGetProperty("situacao", out var sit)) return false;
        if (sit.ValueKind == JsonValueKind.Object)
        {
            if (sit.TryGetProperty("id", out var id) && id.TryGetInt64(out var n) && n == 12) return true;
            var nome = LerTexto(sit, "nome");
            return nome.Contains("cancel", StringComparison.OrdinalIgnoreCase);
        }
        return sit.ValueKind == JsonValueKind.String
            && (sit.GetString()?.Contains("cancel", StringComparison.OrdinalIgnoreCase) == true);
    }

    private static decimal LerTotal(JsonElement item)
    {
        if (!item.TryGetProperty("total", out var total)) return 0;
        if (total.ValueKind == JsonValueKind.Number && total.TryGetDecimal(out var n)) return n;
        if (total.ValueKind == JsonValueKind.Object
            && total.TryGetProperty("valor", out var valor)
            && valor.TryGetDecimal(out var v))
            return v;
        return 0;
    }

    private static DateTime? LerData(JsonElement item)
    {
        var texto = LerTexto(item, "data");
        if (texto.Length == 0) return null;
        if (texto.Length >= 10
            && DateTime.TryParseExact(texto[..10], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dia))
            return dia.Date;
        return null;
    }

    private static string LerTexto(JsonElement item, string nome)
    {
        if (!TryGet(item, nome, out var valor)) return "";
        return valor.ValueKind == JsonValueKind.String ? valor.GetString() ?? "" : valor.ToString();
    }

    private async Task<List<(long ItemId, string Produto, decimal Valor, decimal? Custo)>> ItensDoPedidoAsync(
        HttpClient http,
        string accessToken,
        long pedidoId,
        Dictionary<long, (string Nome, decimal? Custo)> produtos,
        CancellationToken cancellationToken)
    {
        var linhas = new List<(long ItemId, string Produto, decimal Valor, decimal? Custo)>();
        if (pedidoId <= 0) return linhas;
        var json = await GetJsonAsync(http, accessToken, $"pedidos/vendas/{pedidoId}", cancellationToken);
        if (json is null) return linhas;
        using var doc = JsonDocument.Parse(json);
        if (!TryGet(doc.RootElement, "data", out var data) || data.ValueKind != JsonValueKind.Object)
            return linhas;
        if (!TryGet(data, "itens", out var itens) || itens.ValueKind != JsonValueKind.Array)
            return linhas;

        foreach (var linha in itens.EnumerateArray())
        {
            var itemId = LerLong(linha, "id");
            var qtd = LerDecimal(linha, "quantidade");
            if (qtd <= 0) qtd = 1;
            var produtoId = IdDoProduto(linha);
            var nomeLinha = First(
                LerTexto(linha, "descricao"),
                LerTexto(linha, "descricaoDetalhada"),
                NomeProduto(linha),
                LerTexto(linha, "codigo"));
            var temCusto = TentarCusto(linha, out var custoUnit);
            if (!temCusto && TryGet(linha, "produto", out var produto) && produto.ValueKind == JsonValueKind.Object)
                temCusto = TentarCusto(produto, out custoUnit);
            var nomeCadastro = "";
            if (produtoId > 0)
            {
                var cadastro = await ProdutoAsync(http, accessToken, produtoId, produtos, cancellationToken);
                nomeCadastro = cadastro.Nome;
                if (!temCusto && cadastro.Custo is not null)
                {
                    temCusto = true;
                    custoUnit = cadastro.Custo.Value;
                }
            }

            var nome = First(nomeCadastro, nomeLinha);

            if (nome.Length == 0) nome = produtoId > 0 ? $"Produto {produtoId}" : "Item do pedido";
            if (qtd > 1)
                nome += " × " + qtd.ToString("0.##", CultureInfo.GetCultureInfo("pt-BR"));
            var valor = ValorDaLinha(linha, qtd);
            decimal? custo = temCusto ? Round(custoUnit * qtd) : null;
            linhas.Add((itemId, nome, valor, custo));
        }

        return linhas;
    }

    private async Task<(string Nome, decimal? Custo)> ProdutoAsync(
        HttpClient http,
        string accessToken,
        long produtoId,
        Dictionary<long, (string Nome, decimal? Custo)> cache,
        CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(produtoId, out var salvo)) return salvo;
        var json = await GetJsonAsync(http, accessToken, $"produtos/{produtoId}", cancellationToken);
        var lido = ("", (decimal?)null);
        if (json is not null)
        {
            using var doc = JsonDocument.Parse(json);
            if (TryGet(doc.RootElement, "data", out var data) && data.ValueKind == JsonValueKind.Object)
            {
                var nome = First(LerTexto(data, "nome"), LerTexto(data, "descricao"), LerTexto(data, "codigo"));
                decimal? custo = TentarCusto(data, out var n) ? n : null;
                if (custo is null)
                    custo = CustoDeFornecedor(data);
                lido = (nome, custo);
            }
        }

        cache[produtoId] = lido;
        return lido;
    }

    private static decimal? CustoDeFornecedor(JsonElement produto)
    {
        if (TryGet(produto, "fornecedor", out var um) && um.ValueKind == JsonValueKind.Object && TentarCusto(um, out var unico))
            return unico;
        if (!TryGet(produto, "fornecedores", out var lista) || lista.ValueKind != JsonValueKind.Array)
            return null;
        foreach (var fornecedor in lista.EnumerateArray())
        {
            if (fornecedor.ValueKind == JsonValueKind.Object && TentarCusto(fornecedor, out var custo))
                return custo;
        }
        return null;
    }

    private static long IdDoProduto(JsonElement linha)
    {
        if (TryGet(linha, "produto", out var produto) && produto.ValueKind == JsonValueKind.Object)
        {
            var id = LerLong(produto, "id");
            if (id > 0) return id;
        }
        var direto = LerLong(linha, "idProduto");
        return direto > 0 ? direto : LerLong(linha, "produtoId");
    }

    private static string NomeProduto(JsonElement linha)
    {
        if (!TryGet(linha, "produto", out var produto) || produto.ValueKind != JsonValueKind.Object)
            return "";
        return First(LerTexto(produto, "nome"), LerTexto(produto, "descricao"));
    }

    private static decimal ValorDaLinha(JsonElement linha, decimal quantidade)
    {
        var unitario = LerDecimal(linha, "valor");
        if (unitario <= 0) unitario = LerDecimal(linha, "valorUnitario");
        var bruto = unitario * quantidade;
        var desconto = LerDecimal(linha, "desconto");
        if (desconto > 0 && desconto < bruto) bruto -= desconto;
        if (bruto > 0) return Round(bruto);
        var total = LerDecimal(linha, "valorTotal");
        return total > 0 ? Round(total) : 0;
    }

    private static bool TentarCusto(JsonElement item, out decimal custo)
    {
        foreach (var nome in new[] { "precoCusto", "custo", "valorCusto", "precoCompra" })
        {
            if (!TryGet(item, nome, out var valor)) continue;
            if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var n) && n >= 0)
            {
                custo = n;
                return true;
            }
        }
        custo = 0;
        return false;
    }

    private static decimal Round(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);

    private static string First(params string[] valores)
    {
        foreach (var valor in valores)
        {
            if (!string.IsNullOrWhiteSpace(valor)) return valor.Trim();
        }
        return "";
    }

    private static long LerLong(JsonElement item, string nome)
    {
        if (!TryGet(item, nome, out var valor)) return 0;
        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetInt64(out var n)) return n;
        return long.TryParse(valor.ToString(), out var p) ? p : 0;
    }

    private static decimal LerDecimal(JsonElement item, string nome)
    {
        if (!TryGet(item, nome, out var valor)) return 0;
        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var n)) return n;
        return 0;
    }

    private static bool TryGet(JsonElement item, string nome, out JsonElement valor)
    {
        if (item.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in item.EnumerateObject())
            {
                if (string.Equals(prop.Name, nome, StringComparison.OrdinalIgnoreCase))
                {
                    valor = prop.Value;
                    return true;
                }
            }
        }
        valor = default;
        return false;
    }

    private async Task<string?> TokenAsync()
    {
        var token = _auth.GetCurrentToken();
        if (token is null
            || string.IsNullOrWhiteSpace(token.AccessToken)
            || token.AccessToken.StartsWith("local-bypass", StringComparison.OrdinalIgnoreCase))
            return null;

        if (token.ExpiresAt > DateTime.UtcNow.AddMinutes(1))
            return token.AccessToken;
        if (string.IsNullOrWhiteSpace(token.RefreshToken))
            return null;

        try
        {
            var renovado = await _auth.RefreshTokenAsync(token.RefreshToken);
            return string.IsNullOrWhiteSpace(renovado.AccessToken) ? null : renovado.AccessToken;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao renovar token Bling na comissão da loja");
            return null;
        }
    }

    private static async Task<string?> GetJsonAsync(
        HttpClient http,
        string accessToken,
        string url,
        CancellationToken cancellationToken,
        int tentativa = 0)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req, cancellationToken);
        if (resp.StatusCode == HttpStatusCode.TooManyRequests && tentativa < 3)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            return await GetJsonAsync(http, accessToken, url, cancellationToken, tentativa + 1);
        }
        if (!resp.IsSuccessStatusCode) return null;
        var body = await resp.Content.ReadAsStringAsync(cancellationToken);
        await Task.Delay(TimeSpan.FromMilliseconds(350), cancellationToken);
        return body;
    }
}
