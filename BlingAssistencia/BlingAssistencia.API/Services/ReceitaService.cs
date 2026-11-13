using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IReceitaService
{
    Task<ReceitaPainelDto> MontarAsync(string? agrupamento, int periodos, CancellationToken cancellationToken = default);
    Task<ReceitaBlingVendasResponse> ListarBlingAsync(DateTime inicio, DateTime fim, CancellationToken cancellationToken = default);
    Task<ReceitaBlingVendaDto> AtualizarBlingAsync(long pedidoId, ReceitaBlingVendaAtualizarRequest request, CancellationToken cancellationToken = default);
}

public sealed class ReceitaService : IReceitaService
{
    private static readonly CultureInfo Pt = CultureInfo.GetCultureInfo("pt-BR");
    private readonly IAparelhoLojaRepository _loja;
    private readonly IOsLocalRepository _os;
    private readonly IEstoqueLoteService _estoque;
    private readonly IReceitaBlingVendaRepository _blingVendas;
    private readonly IBlingVendaExclusaoRepository _exclusoes;
    private readonly IBlingComissaoLojaRepository _comissaoLoja;
    private readonly IBlingAuthService _auth;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ReceitaService> _log;

    public ReceitaService(
        IAparelhoLojaRepository loja,
        IOsLocalRepository os,
        IEstoqueLoteService estoque,
        IReceitaBlingVendaRepository blingVendas,
        IBlingVendaExclusaoRepository exclusoes,
        IBlingComissaoLojaRepository comissaoLoja,
        IBlingAuthService auth,
        IHttpClientFactory httpFactory,
        ILogger<ReceitaService> log)
    {
        _loja = loja;
        _os = os;
        _estoque = estoque;
        _blingVendas = blingVendas;
        _exclusoes = exclusoes;
        _comissaoLoja = comissaoLoja;
        _auth = auth;
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<ReceitaPainelDto> MontarAsync(string? agrupamento, int periodos, CancellationToken cancellationToken = default)
    {
        var modo = Normalizar(agrupamento);
        var qtd = Math.Clamp(periodos, 2, 24);
        var hoje = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, HorarioBrasil.TimeZone).Date;
        var janelas = MontarJanelas(modo, qtd, hoje);
        var inicio = janelas[0].Inicio;
        var fim = janelas[^1].Fim;

        var painel = new ReceitaPainelDto { Agrupamento = modo };
        foreach (var j in janelas)
        {
            painel.Periodos.Add(new ReceitaPeriodoDto
            {
                Chave = j.Chave,
                Rotulo = j.Rotulo,
                Inicio = j.Inicio.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                Fim = j.Fim.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            });
        }

        var osDaAssistencia = await SomarAssistenciaAsync(painel.Periodos, janelas, inicio, fim, cancellationToken);
        await SomarCelularesAsync(painel.Periodos, janelas, osDaAssistencia, cancellationToken);
        painel.AvisoBling = await SomarBlingAsync(painel, janelas, inicio, fim, cancellationToken);
        foreach (var periodo in painel.Periodos)
            Arredondar(periodo);
        return painel;
    }

    public async Task<ReceitaBlingVendasResponse> ListarBlingAsync(
        DateTime inicio,
        DateTime fim,
        CancellationToken cancellationToken = default)
    {
        var aviso = await SincronizarBlingAsync(inicio.Date, fim.Date, cancellationToken);
        var lista = await _blingVendas.ListarNoPeriodoAsync(inicio.Date, fim.Date, cancellationToken);
        var excluidos = await _exclusoes.PedidoIdsAsync(cancellationToken);
        return new ReceitaBlingVendasResponse
        {
            Aviso = aviso,
            Vendas = lista
                .Where(v => !v.Excluida && !excluidos.Contains(v.PedidoId))
                .Select(ParaDto)
                .ToList(),
        };
    }

    public async Task<ReceitaBlingVendaDto> AtualizarBlingAsync(
        long pedidoId,
        ReceitaBlingVendaAtualizarRequest request,
        CancellationToken cancellationToken = default)
    {
        var venda = await _blingVendas.ObterPorPedidoIdAsync(pedidoId, cancellationToken)
            ?? throw new InvalidOperationException("Esta venda do Bling ainda não está no relatório.");
        if (request.Excluida == true)
        {
            await _exclusoes.MarcarAsync(pedidoId, cancellationToken);
            await _comissaoLoja.MarcarPedidoExcluidoAsync(pedidoId, cancellationToken);
            venda.Excluida = true;
        }
        if (request.CustoItem is not null)
        {
            venda.CustoItem = Round(Math.Max(0, request.CustoItem.Value));
            venda.CustoItemEditado = true;
        }
        if (request.CustoLoja is not null)
        {
            venda.CustoLoja = Round(Math.Max(0, request.CustoLoja.Value));
            venda.CustoLojaEditado = true;
        }
        await _blingVendas.SalvarAsync(venda, cancellationToken);
        return ParaDto(venda);
    }

    private async Task SomarCelularesAsync(
        List<ReceitaPeriodoDto> dest,
        IReadOnlyList<Janela> janelas,
        HashSet<long> osDaAssistencia,
        CancellationToken cancellationToken)
    {
        var ops = await _loja.ListarOperacoesAtivasAsync(cancellationToken);
        var noRecorte = new List<(AparelhoOperacaoData Op, int Indice)>();
        foreach (var op in ops)
        {
            if (op.Tipo is not (AparelhoOperacaoTipo.Venda or AparelhoOperacaoTipo.Troca)) continue;
            var i = Indice(janelas, op.Data.Date);
            if (i < 0) continue;
            noRecorte.Add((op, i));
        }

        var ids = noRecorte
            .Select(x => x.Op.Saida?.AparelhoId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Cast<string>();
        var aparelhos = await _loja.ListarPorIdsAsync(ids, cancellationToken);
        var porId = aparelhos
            .Where(a => !string.IsNullOrWhiteSpace(a.Id))
            .ToDictionary(a => a.Id!, StringComparer.Ordinal);

        foreach (var (op, i) in noRecorte)
        {
            var faixa = dest[i].Celulares;
            faixa.Bruto += op.DinheiroRecebido;
            AparelhoLojaData? aparelho = null;
            if (!string.IsNullOrWhiteSpace(op.Saida?.AparelhoId))
                porId.TryGetValue(op.Saida.AparelhoId, out aparelho);
            faixa.CustoItem += CustoDeCompraDaSaida(op.Saida, aparelho, op.Data.Date);
            faixa.CustoLoja += op.DinheiroPago;
            if (aparelho is not null)
                faixa.CustoLoja += PecasDaLoja(aparelho, op.Data.Date, osDaAssistencia);

            if (op.Tipo == AparelhoOperacaoTipo.Troca)
                dest[i].CelularesEstoqueEntrou += CustoQueEntrou(op);
            faixa.Quantidade++;
        }
    }

    private static decimal CustoQueEntrou(AparelhoOperacaoData op) =>
        op.Entradas is { Count: > 0 }
            ? op.Entradas.Sum(e => e.Custo)
            : op.Entrada?.Custo ?? 0;

    private async Task<HashSet<long>> SomarAssistenciaAsync(
        List<ReceitaPeriodoDto> dest,
        IReadOnlyList<Janela> janelas,
        DateTime inicio,
        DateTime fim,
        CancellationToken cancellationToken)
    {
        var lista = await _os.ListarParaComissaoAsync(inicio, fim, null, true, null);
        var custosRef = await CustosDePecaAsync(lista);
        var ids = new HashSet<long>();
        foreach (var os in lista)
        {
            if (os.BlingId > 0) ids.Add(os.BlingId);
            if (os.DataConclusao is null) continue;
            var bruto = os.ValorTotalAcordado is > 0 ? os.ValorTotalAcordado.Value : os.ValorTotal ?? 0;
            var custoItem = CustoPecas(os.Itens, custosRef);
            var custoLoja = os.Juros is > 0 ? os.Juros.Value : 0;
            if (bruto <= 0 && custoItem <= 0 && custoLoja <= 0) continue;
            var i = Indice(janelas, os.DataConclusao.Value.Date);
            if (i < 0) continue;
            var faixa = dest[i].Assistencia;
            faixa.Bruto += bruto;
            faixa.CustoItem += custoItem;
            faixa.CustoLoja += custoLoja;
            faixa.Quantidade++;
        }
        return ids;
    }

    private async Task<Dictionary<string, decimal>> CustosDePecaAsync(List<OsLocalData> lista)
    {
        var ids = lista
            .SelectMany(os => os.Itens ?? [])
            .Where(ItemEhPeca)
            .Where(i => i.CustoPeca is not > 0 && !string.IsNullOrWhiteSpace(i.PecaId))
            .Select(i => i.PecaId!);
        return await _estoque.ObterCustosReferenciaPecasAsync(ids);
    }

    private static decimal CustoDeCompraDaSaida(AparelhoMovimentoData? saida, AparelhoLojaData? aparelho, DateTime dia)
    {
        var custo = saida?.Custo ?? 0;
        if (aparelho is null || custo <= aparelho.Custo) return custo;
        var pecas = PecasAte(aparelho, dia);
        if (pecas <= 0) return custo;
        var excesso = custo - aparelho.Custo;
        return custo - Math.Min(excesso, pecas);
    }

    private static decimal PecasAte(AparelhoLojaData aparelho, DateTime dia)
    {
        decimal total = 0;
        foreach (var custo in aparelho.CustosOs ?? [])
        {
            if (custo.Pecas <= 0) continue;
            if (custo.AtualizadoEm != default && custo.AtualizadoEm.Date > dia) continue;
            total += custo.Pecas;
        }
        return total;
    }

    private static decimal PecasDaLoja(AparelhoLojaData aparelho, DateTime dia, HashSet<long> osDaAssistencia)
    {
        decimal total = 0;
        foreach (var custo in aparelho.CustosOs ?? [])
        {
            if (custo.Pecas <= 0) continue;
            if (custo.OsId > 0 && osDaAssistencia.Contains(custo.OsId)) continue;
            if (custo.AtualizadoEm != default && custo.AtualizadoEm.Date > dia) continue;
            total += custo.Pecas;
        }
        return total;
    }

    private static bool ItemEhPeca(BlingOrdemServicoItem item)
    {
        if (string.Equals(item.TipoItem, "servico", StringComparison.OrdinalIgnoreCase))
            return false;
        return string.Equals(item.TipoItem, "peca", StringComparison.OrdinalIgnoreCase)
            || !string.IsNullOrWhiteSpace(item.PecaId);
    }

    private static decimal CustoPecas(
        List<BlingOrdemServicoItem>? itens,
        IReadOnlyDictionary<string, decimal> custosRef)
    {
        if (itens is null || itens.Count == 0) return 0;
        decimal total = 0;
        foreach (var item in itens)
        {
            if (!ItemEhPeca(item)) continue;
            var qtd = item.Quantidade <= 0 ? 1 : item.Quantidade;
            var unit = item.CustoPeca is > 0 ? item.CustoPeca.Value : 0;
            if (unit <= 0
                && !string.IsNullOrWhiteSpace(item.PecaId)
                && custosRef.TryGetValue(item.PecaId.Trim(), out var referencia))
            {
                unit = referencia;
            }
            if (unit <= 0) continue;
            total += unit * qtd;
        }
        return total;
    }

    private async Task<string?> SomarBlingAsync(
        ReceitaPainelDto painel,
        IReadOnlyList<Janela> janelas,
        DateTime inicio,
        DateTime fim,
        CancellationToken cancellationToken)
    {
        var avisoSync = await SincronizarBlingAsync(inicio, fim, cancellationToken);
        var vendas = await _blingVendas.ListarNoPeriodoAsync(inicio, fim, cancellationToken);
        var excluidos = await _exclusoes.PedidoIdsAsync(cancellationToken);
        var dest = painel.Periodos;
        var contouPedido = false;
        var algumCusto = false;
        var excluídas = 0;

        foreach (var venda in vendas)
        {
            if (venda.Excluida || excluidos.Contains(venda.PedidoId))
            {
                excluídas++;
                continue;
            }
            var i = Indice(janelas, venda.Data.Date);
            if (i < 0) continue;
            var faixa = dest[i].Bling;
            faixa.Bruto += venda.Bruto;
            faixa.CustoItem += venda.CustoItem;
            faixa.CustoLoja += venda.CustoLoja;
            faixa.Quantidade++;
            contouPedido = true;
            if (venda.CustoItem > 0 || venda.CustoLoja > 0) algumCusto = true;
        }

        painel.CustoBlingIndisponivel = contouPedido && !algumCusto;
        var avisos = new List<string>();
        if (!string.IsNullOrWhiteSpace(avisoSync))
            avisos.Add(avisoSync);
        if (excluídas > 0)
            avisos.Add(excluídas == 1
                ? "1 venda do Bling ficou de fora do relatório."
                : $"{excluídas} vendas do Bling ficaram de fora do relatório.");
        if (painel.CustoBlingIndisponivel)
            avisos.Add("A lista de pedidos do Bling não traz o custo do item nem o custo da loja. Informe o custo em cada venda, ou o bruto, o depois do item e o resultado ficam iguais.");
        return avisos.Count == 0 ? null : string.Join(" ", avisos);
    }

    private async Task<string?> SincronizarBlingAsync(DateTime inicio, DateTime fim, CancellationToken cancellationToken)
    {
        var token = await TokenAsync();
        if (token is null)
            return "Bling não está conectado. Vendas já gravadas seguem no relatório. Conecte em Configurações → Bling para atualizar.";

        var http = _httpFactory.CreateClient("BlingProdutos");
        var dataInicial = inicio.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var dataFinal = fim.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var truncou = false;
        var leu = false;
        var excluidos = await _exclusoes.PedidoIdsAsync(cancellationToken);

        for (var pagina = 1; pagina <= 30; pagina++)
        {
            var url = $"pedidos/vendas?pagina={pagina}&limite=100&dataInicial={dataInicial}&dataFinal={dataFinal}";
            var json = await GetJsonAsync(http, token, url, cancellationToken);
            if (json is null)
            {
                if (pagina == 1)
                    return "Não foi possível ler os pedidos de venda do Bling. Confira a permissão de Pedidos de venda.";
                break;
            }

            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Array)
                break;

            leu = true;
            var lidos = 0;
            foreach (var item in data.EnumerateArray())
            {
                lidos++;
                if (Cancelado(item)) continue;
                var snapshot = LerPedido(item);
                if (snapshot is null) continue;
                if (excluidos.Contains(snapshot.PedidoId))
                    snapshot.Excluida = true;
                await _blingVendas.UpsertDoBlingAsync(snapshot, cancellationToken);
            }

            if (lidos == 0) break;
            if (lidos < 100) break;
            if (pagina == 30) truncou = true;
        }

        if (truncou)
            return "O recorte do Bling passou de 3.000 pedidos. Os mais antigos desta consulta podem ter ficado de fora.";
        return leu ? null : "Não foi possível ler os pedidos de venda do Bling. Confira a permissão de Pedidos de venda.";
    }

    private static ReceitaBlingVendaData? LerPedido(JsonElement item)
    {
        var total = LerTotal(item);
        if (total <= 0) return null;
        var dataPedido = LerData(item);
        if (dataPedido is null) return null;
        var pedidoId = LerLong(item, "id");
        if (pedidoId <= 0) return null;
        var custos = ReceitaBlingCusto.Ler(item);
        return new ReceitaBlingVendaData
        {
            PedidoId = pedidoId,
            Numero = LerTexto(item, "numero"),
            Data = dataPedido.Value.Date,
            ClienteNome = LerCliente(item),
            Bruto = Round(total),
            CustoItemOrigem = custos.Item,
            CustoLojaOrigem = custos.Loja,
        };
    }

    private static ReceitaBlingVendaDto ParaDto(ReceitaBlingVendaData v) => new()
    {
        PedidoId = v.PedidoId,
        Numero = v.Numero,
        Data = v.Data.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        ClienteNome = v.ClienteNome,
        Bruto = v.Bruto,
        CustoItem = v.CustoItem,
        CustoLoja = v.CustoLoja,
        CustoItemEditado = v.CustoItemEditado,
        CustoLojaEditado = v.CustoLojaEditado,
        Excluida = v.Excluida,
    };

    private static long LerLong(JsonElement item, string nome)
    {
        if (!item.TryGetProperty(nome, out var valor)) return 0;
        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetInt64(out var n)) return n;
        return long.TryParse(valor.ToString(), out var p) ? p : 0;
    }

    private static string LerTexto(JsonElement item, string nome)
    {
        if (!item.TryGetProperty(nome, out var valor) || valor.ValueKind != JsonValueKind.String)
            return "";
        return valor.GetString()?.Trim() ?? "";
    }

    private static string LerCliente(JsonElement item)
    {
        if (item.TryGetProperty("contato", out var contato) && contato.ValueKind == JsonValueKind.Object)
            return LerTexto(contato, "nome");
        return LerTexto(item, "cliente");
    }

    private static void Arredondar(ReceitaPeriodoDto periodo)
    {
        Arredondar(periodo.Bling);
        Arredondar(periodo.Celulares);
        Arredondar(periodo.Assistencia);
        periodo.CelularesEstoqueEntrou = Round(periodo.CelularesEstoqueEntrou);
    }

    private static void Arredondar(ReceitaFaixaDto faixa)
    {
        faixa.Bruto = Round(faixa.Bruto);
        faixa.CustoItem = Round(faixa.CustoItem);
        faixa.CustoLoja = Round(faixa.CustoLoja);
    }

    private static decimal Round(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);

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
            _log.LogWarning(ex, "Falha ao renovar token Bling na leitura de receitas");
            return null;
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
            return null;
        }

        if (!resp.IsSuccessStatusCode) return null;
        return await resp.Content.ReadAsStringAsync(cancellationToken);
    }

    private static int Indice(IReadOnlyList<Janela> janelas, DateTime dia)
    {
        for (var i = 0; i < janelas.Count; i++)
        {
            if (dia >= janelas[i].Inicio && dia <= janelas[i].Fim) return i;
        }
        return -1;
    }

    private static string Normalizar(string? agrupamento) => agrupamento?.Trim().ToLowerInvariant() switch
    {
        "semanal" or "semana" => "semanal",
        "quinzenal" or "quinzena" => "quinzenal",
        _ => "mensal",
    };

    private static List<Janela> MontarJanelas(string modo, int quantidade, DateTime hoje)
    {
        if (modo == "semanal") return Semanas(quantidade, hoje);
        if (modo == "quinzenal") return Quinzenas(quantidade, hoje);
        return Meses(quantidade, hoje);
    }

    private static List<Janela> Meses(int quantidade, DateTime hoje)
    {
        var atual = new DateTime(hoje.Year, hoje.Month, 1);
        var lista = new List<Janela>();
        for (var i = quantidade - 1; i >= 0; i--)
        {
            var ini = atual.AddMonths(-i);
            var fim = ini.AddMonths(1).AddDays(-1);
            var mes = ini.ToString("MMM", Pt).TrimEnd('.').Trim();
            var rotulo = char.ToUpper(mes[0], Pt) + mes[1..] + "/" + ini.ToString("yyyy", Pt);
            lista.Add(new Janela(ini, fim, ini.ToString("yyyy-MM", CultureInfo.InvariantCulture), rotulo));
        }
        return lista;
    }

    private static List<Janela> Semanas(int quantidade, DateTime hoje)
    {
        var segunda = hoje.AddDays(-(((int)hoje.DayOfWeek + 6) % 7));
        var lista = new List<Janela>();
        for (var i = quantidade - 1; i >= 0; i--)
        {
            var ini = segunda.AddDays(-7 * i);
            var fim = ini.AddDays(6);
            lista.Add(new Janela(
                ini,
                fim,
                ini.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                $"{ini:dd/MM}–{fim:dd/MM}"));
        }
        return lista;
    }

    private static List<Janela> Quinzenas(int quantidade, DateTime hoje)
    {
        var cursor = hoje.Day <= 15
            ? new DateTime(hoje.Year, hoje.Month, 1)
            : new DateTime(hoje.Year, hoje.Month, 16);
        var lista = new List<Janela>();
        for (var i = 0; i < quantidade; i++)
        {
            DateTime ini;
            DateTime fim;
            if (cursor.Day <= 15)
            {
                ini = new DateTime(cursor.Year, cursor.Month, 1);
                fim = new DateTime(cursor.Year, cursor.Month, 15);
                cursor = new DateTime(cursor.Year, cursor.Month, 1).AddMonths(-1);
                cursor = new DateTime(cursor.Year, cursor.Month, 16);
            }
            else
            {
                ini = new DateTime(cursor.Year, cursor.Month, 16);
                fim = new DateTime(cursor.Year, cursor.Month, DateTime.DaysInMonth(cursor.Year, cursor.Month));
                cursor = new DateTime(cursor.Year, cursor.Month, 1);
            }

            var mes = ini.ToString("MMM", Pt).TrimEnd('.').Trim();
            lista.Add(new Janela(
                ini,
                fim,
                ini.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                $"{ini.Day}–{fim.Day} {mes}"));
        }

        lista.Reverse();
        return lista;
    }

    private static bool Cancelado(JsonElement item)
    {
        if (!item.TryGetProperty("situacao", out var sit)) return false;
        if (sit.ValueKind == JsonValueKind.Object)
        {
            if (sit.TryGetProperty("id", out var id) && id.TryGetInt64(out var n) && n == 12) return true;
            var nome = sit.TryGetProperty("nome", out var nomeEl) ? nomeEl.GetString() : null;
            return nome?.Contains("cancel", StringComparison.OrdinalIgnoreCase) == true;
        }
        return sit.ValueKind == JsonValueKind.String
            && (sit.GetString()?.Contains("cancel", StringComparison.OrdinalIgnoreCase) == true);
    }

    private static decimal LerTotal(JsonElement item)
    {
        if (!item.TryGetProperty("total", out var total)) return 0;
        if (total.ValueKind == JsonValueKind.Number && total.TryGetDecimal(out var n)) return n;
        if (total.ValueKind == JsonValueKind.Object && total.TryGetProperty("valor", out var valor)
            && valor.TryGetDecimal(out var v))
            return v;
        return 0;
    }

    private static DateTime? LerData(JsonElement item)
    {
        if (!item.TryGetProperty("data", out var data)) return null;
        var texto = data.ValueKind == JsonValueKind.String ? data.GetString() : null;
        if (string.IsNullOrWhiteSpace(texto)) return null;
        if (DateTime.TryParse(texto, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var dt))
            return dt.Date;
        return null;
    }

    private sealed record Janela(DateTime Inicio, DateTime Fim, string Chave, string Rotulo);
}
