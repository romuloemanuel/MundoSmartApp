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
}

public sealed class ComissaoOrigemService : IComissaoOrigemService
{
    private readonly IAparelhoLojaRepository _loja;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ComissaoOrigemService> _log;

    public ComissaoOrigemService(
        IAparelhoLojaRepository loja,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        ILogger<ComissaoOrigemService> log)
    {
        _loja = loja;
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

            lancamentos.Add(new ComissaoLancamentoDto
            {
                Data = dia.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Tipo = op.Tipo,
                Vendedor = Nome(op.VendedorNome),
                Descricao = Descrever(op),
                Cliente = op.ClienteNome ?? "",
                Valor = op.DinheiroRecebido,
                DinheiroPago = op.DinheiroPago,
            });
        }

        return Montar(lancamentos, null);
    }

    public async Task<ComissaoOrigemDto> LojaAsync(string? inicio, string? fim, CancellationToken cancellationToken = default)
    {
        var (de, ate) = Periodo(inicio, fim);
        var token = await TokenAsync();
        if (token is null)
        {
            return new ComissaoOrigemDto
            {
                Aviso = "Bling não está conectado. As vendas da loja aparecem depois da conexão em Configurações → Bling.",
            };
        }

        var http = _httpFactory.CreateClient("BlingProdutos");
        var dataInicial = de.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var dataFinal = ate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var lancamentos = new List<ComissaoLancamentoDto>();
        string? aviso = null;

        for (var pagina = 1; pagina <= 30; pagina++)
        {
            var url = $"pedidos/vendas?pagina={pagina}&limite=100&dataInicial={dataInicial}&dataFinal={dataFinal}";
            var json = await GetJsonAsync(http, token, url, cancellationToken);
            if (json is null)
            {
                if (pagina == 1)
                    aviso = "Não foi possível ler os pedidos de venda do Bling. Confira a permissão de Pedidos de venda.";
                break;
            }

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
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
                lancamentos.Add(new ComissaoLancamentoDto
                {
                    Data = dataPedido.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    Tipo = "venda",
                    Vendedor = vendedor,
                    Descricao = string.IsNullOrWhiteSpace(numero) ? "Pedido de venda" : $"Pedido {numero}",
                    Cliente = LerCliente(item),
                    Valor = total,
                });
            }

            if (lidos < 100) break;
            if (pagina == 30)
                aviso = "O recorte passou de 3.000 pedidos. Os mais antigos desta consulta podem ter ficado de fora.";
        }

        return Montar(lancamentos, aviso);
    }

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
        if (!item.TryGetProperty(nome, out var valor)) return "";
        return valor.ValueKind == JsonValueKind.String ? valor.GetString() ?? "" : valor.ToString();
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

    private static async Task<string?> GetJsonAsync(HttpClient http, string accessToken, string url, CancellationToken cancellationToken)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req, cancellationToken);
        if (resp.StatusCode == HttpStatusCode.TooManyRequests)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
            return null;
        }
        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadAsStringAsync(cancellationToken);
    }
}
