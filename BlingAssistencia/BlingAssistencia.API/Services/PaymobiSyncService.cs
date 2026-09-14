using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Data;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public class PaymobiSincronizarRequest
{
    public string? Email { get; set; }
    public string? Senha { get; set; }
    public bool SalvarCredenciais { get; set; } = true;
    public DateTime? De { get; set; }
    public DateTime? Ate { get; set; }
}

public class PaymobiConfigPublicaDto
{
    public string Email { get; set; } = string.Empty;
    public bool SenhaConfigurada { get; set; }
    public DateTime? UltimaSincronizacao { get; set; }
    public int UltimoTotalImportado { get; set; }
    public decimal CustoFixoAparelho { get; set; } = 80;
    public decimal CustoPlataformaTotal { get; set; } = 200;
    public decimal CustoPlataformaMensal { get; set; } = 200;
}

public class PaymobiCustosRequest
{
    public decimal CustoFixoAparelho { get; set; } = 80;
    public decimal CustoPlataformaTotal { get; set; } = 200;
    public decimal? CustoPlataformaMensal { get; set; }
    public string? Email { get; set; }
    public string? Senha { get; set; }
}

public class PaymobiSincronizarResultado
{
    public int TotalNaPaymobi { get; set; }
    public int Importadas { get; set; }
    public DateTime SincronizadoEm { get; set; }
}

public interface IPaymobiSyncService
{
    Task<PaymobiConfigPublicaDto> ObterConfigAsync(CancellationToken cancellationToken = default);
    Task<PaymobiConfigPublicaDto> SalvarCustosAsync(
        PaymobiCustosRequest request,
        CancellationToken cancellationToken = default);
    Task<PaymobiSincronizarResultado> SincronizarAsync(
        PaymobiSincronizarRequest request,
        CancellationToken cancellationToken = default);
}

public class PaymobiSyncService : IPaymobiSyncService
{
    private readonly IHttpClientFactory _http;
    private readonly IPaymobiConfigRepository _config;
    private readonly IPaymobiVendaRepository _vendas;
    private readonly SemaphoreSlim _syncLock = new(1, 1);

    public PaymobiSyncService(
        IHttpClientFactory http,
        IPaymobiConfigRepository config,
        IPaymobiVendaRepository vendas)
    {
        _http = http;
        _config = config;
        _vendas = vendas;
    }

    public async Task<PaymobiConfigPublicaDto> ObterConfigAsync(CancellationToken cancellationToken = default)
    {
        var cfg = await _config.ObterAsync(cancellationToken);
        return MapearConfig(cfg);
    }

    public async Task<PaymobiConfigPublicaDto> SalvarCustosAsync(
        PaymobiCustosRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.CustoFixoAparelho < 0)
            throw new ArgumentException("O custo do aparelho não pode ser negativo.");

        var mensal = request.CustoPlataformaMensal ?? request.CustoPlataformaTotal;
        if (mensal < 0)
            throw new ArgumentException("O custo mensal da plataforma não pode ser negativo.");

        var salvo = await _config.ObterAsync(cancellationToken) ?? new PaymobiConfigData();
        salvo.CustoFixoAparelho = decimal.Round(request.CustoFixoAparelho, 2);
        salvo.CustoPlataformaTotal = decimal.Round(mensal, 2);
        var email = (request.Email ?? "").Trim();
        if (!string.IsNullOrWhiteSpace(email))
            salvo.Email = email;
        if (!string.IsNullOrWhiteSpace(request.Senha))
            salvo.Senha = request.Senha;
        await _config.SalvarAsync(salvo, cancellationToken);
        return MapearConfig(salvo);
    }

    private static PaymobiConfigPublicaDto MapearConfig(PaymobiConfigData? cfg)
    {
        var mensal = cfg is null || cfg.CustoPlataformaTotal < 0 ? 200 : cfg.CustoPlataformaTotal;
        return new PaymobiConfigPublicaDto
        {
            Email = cfg?.Email ?? "",
            SenhaConfigurada = !string.IsNullOrWhiteSpace(cfg?.Senha),
            UltimaSincronizacao = cfg?.UltimaSincronizacao,
            UltimoTotalImportado = cfg?.UltimoTotalImportado ?? 0,
            CustoFixoAparelho = cfg is null || cfg.CustoFixoAparelho <= 0 ? 80 : cfg.CustoFixoAparelho,
            CustoPlataformaTotal = mensal,
            CustoPlataformaMensal = mensal,
        };
    }

    public async Task<PaymobiSincronizarResultado> SincronizarAsync(
        PaymobiSincronizarRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!await _syncLock.WaitAsync(TimeSpan.Zero, cancellationToken))
            throw new InvalidOperationException("Já existe uma busca da PayMobi em andamento.");

        try
        {
            return await SincronizarInternoAsync(request, cancellationToken);
        }
        finally
        {
            _syncLock.Release();
        }
    }

    private async Task<PaymobiSincronizarResultado> SincronizarInternoAsync(
        PaymobiSincronizarRequest request,
        CancellationToken cancellationToken)
    {
        var salvo = await _config.ObterAsync(cancellationToken) ?? new PaymobiConfigData();
        var email = (request.Email ?? salvo.Email ?? "").Trim();
        var senha = string.IsNullOrWhiteSpace(request.Senha) ? salvo.Senha : request.Senha;
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(senha))
            throw new ArgumentException("Informe o e-mail e a senha da conta PayMobi.");

        var client = _http.CreateClient("PaymobiFin");
        var sessao = await AutenticarAsync(client, email, senha, cancellationToken);
        var lojas = await ListarLojasAsync(client, sessao.Token, cancellationToken);

        var de = (request.De ?? new DateTime(2019, 1, 1)).Date;
        var ate = (request.Ate ?? DateTime.Today).Date;
        var parcelasPorVenda = await ListarParcelasAsync(client, sessao.Token, de, ate, cancellationToken);
        var vendas = await ListarVendasAsync(
            client,
            sessao.Token,
            sessao.VarejoId,
            lojas,
            de,
            ate,
            parcelasPorVenda,
            cancellationToken);

        var importadas = 0;
        foreach (var venda in vendas)
        {
            await _vendas.UpsertDaPaymobiAsync(venda, cancellationToken);
            importadas++;
        }

        if (request.SalvarCredenciais)
        {
            salvo.Email = email;
            salvo.Senha = senha;
        }
        salvo.VarejoId = sessao.VarejoId;
        salvo.UltimaSincronizacao = DateTime.UtcNow;
        salvo.UltimoTotalImportado = importadas;
        await _config.SalvarAsync(salvo, cancellationToken);

        return new PaymobiSincronizarResultado
        {
            TotalNaPaymobi = vendas.Count,
            Importadas = importadas,
            SincronizadoEm = salvo.UltimaSincronizacao.Value,
        };
    }

    private static async Task<SessaoPaymobi> AutenticarAsync(
        HttpClient client,
        string email,
        string senha,
        CancellationToken cancellationToken)
    {
        using var req = new HttpRequestMessage(
            HttpMethod.Get,
            $"users/auth?_={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}");
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{email}:{senha}"));
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        req.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true };

        using var res = await client.SendAsync(req, cancellationToken);
        var json = await LerJsonAsync(res, cancellationToken);
        if (res.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            throw new UnauthorizedAccessException("E-mail ou senha da PayMobi inválidos.");
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException(MensagemErro(json, "Não foi possível entrar na PayMobi."));

        var result = Obj(json, "result") ?? json;
        var token = Texto(result, "token")
            ?? Texto(Obj(result, "user"), "token")
            ?? Texto(json, "token");
        if (string.IsNullOrWhiteSpace(token))
            throw new InvalidOperationException("A PayMobi não devolveu o token de acesso.");

        var user = Obj(result, "user");
        var financeira = Obj(result, "financeira") ?? Obj(user, "financeira");
        var varejoId = Texto(result, "varejoId")
            ?? Texto(user, "varejoId")
            ?? Texto(financeira, "varejoId")
            ?? Texto(financeira, "id")
            ?? "";

        return new SessaoPaymobi(token, varejoId);
    }

    private static async Task<List<string>> ListarLojasAsync(
        HttpClient client,
        string token,
        CancellationToken cancellationToken)
    {
        using var req = new HttpRequestMessage(HttpMethod.Post, "lojas/list");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        req.Content = JsonContent.Create(new
        {
            includeUserStoreAssociated = true,
            includeShopkeeperStores = true,
            pageSize = 9999,
        });

        using var res = await client.SendAsync(req, cancellationToken);
        if (!res.IsSuccessStatusCode) return [];

        var json = await LerJsonAsync(res, cancellationToken);
        var data = ArrayDe(Obj(json, "result") ?? json, "data") ?? ArrayDe(json, "data") ?? ArrayDe(json, "result");
        if (data is null) return [];

        var ids = new List<string>();
        foreach (var loja in data.Value.EnumerateArray())
        {
            var id = Texto(loja, "id");
            if (!string.IsNullOrWhiteSpace(id)) ids.Add(id);
        }
        return ids;
    }

    private static async Task<List<BoletoImportado>> ListarParcelasAsync(
        HttpClient client,
        string token,
        DateTime de,
        DateTime ate,
        CancellationToken cancellationToken)
    {
        var todos = await BuscarParcelasAsync(client, token, de, ate, null, cancellationToken);
        var pagas = todos.Count(x => x.Boleto.Status is "paid" or "pago");
        Console.WriteLine($"[MundoSmart API] PayMobi parcelas: {todos.Count} ({pagas} pagas).");
        return todos;
    }

    private static async Task<List<BoletoImportado>> BuscarParcelasAsync(
        HttpClient client,
        string token,
        DateTime de,
        DateTime ate,
        Dictionary<string, object?>? extra,
        CancellationToken cancellationToken)
    {
        var todos = new List<BoletoImportado>();
        var page = 1;
        const int pageSize = 100;

        while (page <= 80)
        {
            var body = new Dictionary<string, object?>
            {
                ["fromDate"] = de.ToString("yyyy-MM-dd"),
                ["toDate"] = ate.ToString("yyyy-MM-dd"),
                ["page"] = page,
                ["pageSize"] = pageSize,
            };
            if (extra is not null)
            {
                foreach (var (chave, valor) in extra)
                    body[chave] = valor;
            }

            using var req = new HttpRequestMessage(HttpMethod.Post, "installments/search");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            req.Content = JsonContent.Create(body);

            using var res = await client.SendAsync(req, cancellationToken);
            var json = await LerJsonAsync(res, cancellationToken);
            if (!res.IsSuccessStatusCode)
            {
                if (extra is not null) break;
                throw new InvalidOperationException(MensagemErro(json, "Não foi possível listar as parcelas na PayMobi."));
            }

            var result = Obj(json, "result") ?? json;
            var lista = ArrayDe(result, "installments") ?? ArrayDe(result, "data") ?? ArrayDe(json, "installments");
            if (lista is null || lista.Value.GetArrayLength() == 0) break;

            var adicionadosNestaPagina = 0;
            foreach (var row in lista.Value.EnumerateArray())
            {
                var importado = MapearParcela(row);
                if (importado is null) continue;
                if (extra is not null
                    && extra.TryGetValue("sellId", out var filtroSell)
                    && filtroSell is not null
                    && importado.SellId != filtroSell.ToString())
                    continue;
                todos.Add(importado);
                adicionadosNestaPagina++;
            }

            if (extra is not null && extra.ContainsKey("sellId") && adicionadosNestaPagina == 0 && page == 1)
                break;

            if (lista.Value.GetArrayLength() < pageSize) break;
            page++;
        }

        return todos;
    }

    private static BoletoImportado? MapearParcela(JsonElement row)
    {
        var status = (Texto(row, "status") ?? "").Trim().ToLowerInvariant();
        var pago = status is "paid" or "pago";
        if (Bool(row, "deleted") && !pago) return null;

        var sellId = Texto(row, "sellId")
            ?? Texto(row, "sell_id")
            ?? Texto(row, "saleId")
            ?? Texto(Obj(row, "sell"), "id")
            ?? "";
        if (string.IsNullOrWhiteSpace(sellId)) return null;

        var imei = SoDigitos(Texto(row, "imei"));
        var valor = Decimal(row, "value");
        if (valor <= 0) valor = Decimal(row, "paidAmount");
        if (valor <= 0) valor = Decimal(row, "installmentValue");
        return new BoletoImportado(
            sellId,
            imei,
            new PaymobiBoletoData
            {
                Id = Texto(row, "installmentId") ?? Texto(row, "id") ?? "",
                Numero = Inteiro(row, "numberInstallment") ?? 0,
                Vencimento = Data(row, "dueDate") ?? Data(row, "dataVencimento"),
                Valor = decimal.Round(valor, 2),
                Status = pago ? "paid" : status,
                Imei = imei,
                Link = Texto(row, "boletoLink") ?? Texto(row, "paymentLink") ?? "",
                PagoEm = Data(row, "paidAt"),
            });
    }

    private static ParcelasResumo ResumoBoletos(
        string sellId,
        string imei,
        IReadOnlyList<BoletoImportado> todos,
        int qtdParcelas,
        decimal valorParcelaInformado,
        DateTime? primeiraParcela,
        bool completarAgenda)
    {
        var escolhidos = todos.Where(x => x.SellId == sellId).ToList();
        if (!string.IsNullOrEmpty(imei))
        {
            var doImei = escolhidos.Where(x => x.Imei.Length == 0 || x.Imei == imei).ToList();
            if (doImei.Count > 0) escolhidos = doImei;
        }

        var unicos = new List<PaymobiBoletoData>();
        var ids = new HashSet<string>();
        foreach (var item in escolhidos)
        {
            var b = item.Boleto;
            if (!string.IsNullOrWhiteSpace(b.Id) && !ids.Add(b.Id)) continue;
            unicos.Add(b);
        }

        var porNumero = new Dictionary<int, PaymobiBoletoData>();
        var semNumero = new List<PaymobiBoletoData>();
        foreach (var b in unicos)
        {
            if (b.Numero <= 0)
            {
                semNumero.Add(b);
                continue;
            }
            if (!porNumero.TryGetValue(b.Numero, out var atual))
                porNumero[b.Numero] = b;
            else
                porNumero[b.Numero] = EscolherBoleto(atual, b);
        }

        var boletos = porNumero.Values.Concat(semNumero).ToList();
        var valorParcela = valorParcelaInformado;
        if (valorParcela <= 0)
            valorParcela = boletos.FirstOrDefault(b => b.Valor > 0)?.Valor ?? 0;
        var primeira = porNumero.GetValueOrDefault(1)?.Vencimento ?? primeiraParcela;
        if (completarAgenda)
            boletos = CompletarAgenda(boletos, qtdParcelas, valorParcela, primeira, imei);
        else
            boletos = boletos.OrderBy(x => x.Numero).ThenBy(x => x.Vencimento).ToList();

        var hoje = HojeBrasil();
        var atraso = 0;
        decimal devido = 0;
        foreach (var b in boletos)
        {
            if (valorParcela <= 0 && b.Valor > 0) valorParcela = b.Valor;
            if (BoletoPago(b)) continue;
            devido += b.Valor;
            if (BoletoAtrasado(b, hoje)) atraso++;
        }

        return new ParcelasResumo(atraso, decimal.Round(devido, 2), valorParcela, boletos);
    }

    private static List<PaymobiBoletoData> CompletarAgenda(
        List<PaymobiBoletoData> boletos,
        int qtd,
        decimal valor,
        DateTime? primeira,
        string imei)
    {
        if (qtd <= 0 || valor <= 0 || primeira is null) return boletos
            .OrderBy(x => x.Numero)
            .ThenBy(x => x.Vencimento)
            .ToList();

        var porNumeroCompleto = boletos
            .Where(b => b.Numero > 0)
            .GroupBy(b => b.Numero)
            .ToDictionary(g => g.Key, g => g.First());
        var baseDate = (porNumeroCompleto.GetValueOrDefault(1)?.Vencimento ?? primeira).Value.Date;
        bool Paga(int n)
        {
            if (!porNumeroCompleto.TryGetValue(n, out var b)) return false;
            return BoletoPago(b);
        }
        for (var n = 1; n <= qtd; n++)
        {
            if (porNumeroCompleto.ContainsKey(n)) continue;
            if (Paga(n - 1) && Paga(n + 1)) continue;
            boletos.Add(new PaymobiBoletoData
            {
                Numero = n,
                Vencimento = baseDate.AddMonths(n - 1),
                Valor = valor,
                Status = "pending",
                Imei = imei,
            });
        }

        return boletos
            .OrderBy(x => x.Numero)
            .ThenBy(x => x.Vencimento)
            .ToList();
    }

    private static PaymobiBoletoData EscolherBoleto(PaymobiBoletoData a, PaymobiBoletoData b)
    {
        if (BoletoPago(a) && !BoletoPago(b)) return a;
        if (BoletoPago(b) && !BoletoPago(a)) return b;
        if (BoletoGerado(a) && !BoletoGerado(b)) return a;
        if (BoletoGerado(b) && !BoletoGerado(a)) return b;
        if (a.Vencimento is null) return b;
        if (b.Vencimento is null) return a;
        return b.Vencimento >= a.Vencimento ? b : a;
    }

    private static bool BoletoPago(PaymobiBoletoData b) => b.Status is "paid" or "pago";

    private static bool BoletoGerado(PaymobiBoletoData b) => !string.IsNullOrWhiteSpace(b.Link);

    private static bool BoletoAtrasado(PaymobiBoletoData b, DateTime hoje)
    {
        if (b.Status is "overdue" or "late" or "delayed" or "atrasado" or "atrasada") return true;
        return b.Vencimento is not null && b.Vencimento.Value.Date < hoje;
    }

    private static DateTime HojeBrasil()
    {
        var tzId = OperatingSystem.IsWindows() ? "E. South America Standard Time" : "America/Sao_Paulo";
        return TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow, tzId).Date;
    }

    private static async Task<List<PaymobiVendaData>> ListarVendasAsync(
        HttpClient client,
        string token,
        string varejoId,
        IReadOnlyList<string> lojas,
        DateTime de,
        DateTime ate,
        IReadOnlyList<BoletoImportado> parcelas,
        CancellationToken cancellationToken)
    {
        var todas = new List<PaymobiVendaData>();
        var page = 1;
        const int pageSize = 100;
        var total = int.MaxValue;

        while (todas.Count < total && page <= 80)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "sells/search");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            req.Content = JsonContent.Create(new Dictionary<string, object?>
            {
                ["filterId"] = IdJson(varejoId),
                ["storesIds"] = lojas.Select(IdJson).ToArray(),
                ["fromDate"] = de.ToString("yyyy-MM-dd"),
                ["toDate"] = ate.ToString("yyyy-MM-dd"),
                ["page"] = page,
                ["pageSize"] = pageSize,
                ["mustSendByEmail"] = false,
            });

            using var res = await client.SendAsync(req, cancellationToken);
            var json = await LerJsonAsync(res, cancellationToken);
            if (!res.IsSuccessStatusCode)
                throw new InvalidOperationException(MensagemErro(json, "Não foi possível listar as vendas na PayMobi."));

            var result = Obj(json, "result") ?? json;
            var lista = ArrayDe(result, "data") ?? ArrayDe(json, "data");
            total = Inteiro(result, "recordsTotal")
                ?? Inteiro(result, "recordsFiltered")
                ?? lista?.GetArrayLength()
                ?? 0;

            if (lista is null || lista.Value.GetArrayLength() == 0) break;

            foreach (var row in lista.Value.EnumerateArray())
            {
                var venda = MapearVenda(row, parcelas);
                if (venda is not null) todas.Add(venda);
            }

            if (lista.Value.GetArrayLength() < pageSize) break;
            page++;
        }

        return todas;
    }

    private static PaymobiVendaData? MapearVenda(
        JsonElement row,
        IReadOnlyList<BoletoImportado> parcelas)
    {
        var sellId = Texto(row, "id");
        if (string.IsNullOrWhiteSpace(sellId)) return null;

        var cancelada = Bool(row, "canceled");
        var encerrada = Bool(row, "completed");
        var valorParcelado = Decimal(row, "valor");
        var entrada = Decimal(row, "entryValue");
        var total = Decimal(row, "sellTotalAmount");
        if (total <= 0) total = valorParcelado + entrada;
        var baseAparelho = Decimal(row, "deviceBaseValue");
        var original = Decimal(row, "originalValue");
        var qtdParcelas = Inteiro(row, "parcelas") ?? Inteiro(row, "installments") ?? 0;
        var dataVenda = Data(row, "sellDate") ?? Data(row, "dataCadastro") ?? Data(row, "dataEfetivacao") ?? Data(row, "createdAt") ?? DateTime.UtcNow;
        var encerradoEm = Data(row, "completedAt");
        var canceladoEm = Data(row, "canceledAt");
        var imei = SoDigitos(Texto(row, "imei"));
        var valorParcela = Decimal(row, "installmentValue");
        if (valorParcela <= 0) valorParcela = Decimal(row, "sellInstallmentValue");
        if (valorParcela <= 0 && qtdParcelas > 0 && valorParcelado > 0)
            valorParcela = decimal.Round(valorParcelado / qtdParcelas, 2);
        var primeiraParcela = Data(row, "dataPrimeiraParcela") ?? dataVenda.Date.AddMonths(1);
        var resumoParcelas = ResumoBoletos(
            sellId,
            imei,
            parcelas,
            qtdParcelas,
            valorParcela,
            primeiraParcela,
            completarAgenda: !cancelada && encerradoEm is null && !encerrada);
        if (valorParcela <= 0) valorParcela = resumoParcelas.ValorParcela;
        var atraso = resumoParcelas.Atraso;
        var devido = resumoParcelas.Devido;

        string status;
        if (cancelada) status = PaymobiStatus.Cancelada;
        else if (encerrada || encerradoEm is not null) status = PaymobiStatus.Quitada;
        else if (atraso > 0) status = PaymobiStatus.Atrasada;
        else status = PaymobiStatus.Aberta;

        var contratoNumero = Texto(row, "contrato") ?? Texto(row, "contractNumber") ?? "";
        var contratoTipo = Texto(row, "contractType") switch
        {
            "financing" => "Financiamento",
            "rental" => "Aluguel",
            var t when !string.IsNullOrWhiteSpace(t) => t,
            _ => "",
        };

        return new PaymobiVendaData
        {
            PaymobiSellId = sellId,
            ClienteNome = Texto(row, "customerName") ?? Texto(row, "nome") ?? "",
            ClienteCpf = Texto(row, "cpf") ?? Texto(row, "document") ?? "",
            ClienteTelefone = Texto(row, "phone") ?? Texto(row, "telefone") ?? Texto(row, "customerPhone") ?? "",
            ClienteEmail = Texto(row, "email") ?? Texto(row, "customerEmail") ?? "",
            AparelhoMarca = Texto(row, "brand") ?? "",
            AparelhoModelo = AparelhoCodigoComercial.Nome(Texto(row, "model")),
            AparelhoCor = Texto(row, "color") ?? Texto(row, "cor") ?? "",
            AparelhoImei = imei.Length > 0 ? imei : (Texto(row, "imei") ?? ""),
            ValorInvestido = 0,
            ValorBaseAparelho = baseAparelho,
            ValorOriginal = original,
            ValorEntrada = entrada,
            ValorVenda = total,
            Parcelas = Math.Clamp(qtdParcelas, 0, 36),
            ValorParcela = valorParcela,
            AparelhoBloqueado = Bool(row, "blocked"),
            ParcelasAtraso = atraso,
            ValorDevido = devido,
            Boletos = resumoParcelas.Boletos,
            DataVenda = dataVenda,
            Status = status,
            LojaNome = Texto(row, "nickname") ?? Texto(row, "storeName") ?? "",
            VendedorNome = Texto(row, "vendedor") ?? Texto(row, "sellerName") ?? "",
            ContratoNumero = contratoNumero,
            ContratoTipo = contratoTipo,
            ContratoAssinado = !string.IsNullOrWhiteSpace(Texto(row, "contractSignId"))
                || !string.IsNullOrWhiteSpace(Texto(row, "signedContractUrl")),
            EncerradoEm = encerradoEm,
            CanceladoEm = canceladoEm,
            Origem = "paymobi",
            Observacoes = MontarObs(row, contratoNumero, contratoTipo),
        };
    }

    private static string MontarObs(JsonElement row, string contrato, string tipo)
    {
        var partes = new List<string>();
        if (!string.IsNullOrWhiteSpace(contrato)) partes.Add($"Contrato {contrato}");
        if (!string.IsNullOrWhiteSpace(tipo)) partes.Add(tipo);
        if (Bool(row, "isFinancing")) partes.Add("Financiamento PayMobi");
        var cancelReason = Texto(row, "cancelReason");
        if (!string.IsNullOrWhiteSpace(cancelReason)) partes.Add($"Cancelamento: {cancelReason}");
        return string.Join(" · ", partes);
    }

    private static async Task<JsonElement> LerJsonAsync(HttpResponseMessage res, CancellationToken cancellationToken)
    {
        var texto = await res.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(texto)) return default;
        try
        {
            using var doc = JsonDocument.Parse(texto);
            return doc.RootElement.Clone();
        }
        catch (JsonException)
        {
            return default;
        }
    }

    private static object? IdJson(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        if (long.TryParse(valor, out var n)) return n;
        return valor;
    }

    private static string MensagemErro(JsonElement json, string fallback)
    {
        var msg = Texto(json, "erro")
            ?? Texto(json, "message")
            ?? Texto(json, "reason")
            ?? Texto(Obj(json, "result"), "message");
        return string.IsNullOrWhiteSpace(msg) ? fallback : msg;
    }

    private static JsonElement? Obj(JsonElement? el, string nome)
    {
        if (el is not { ValueKind: JsonValueKind.Object }) return null;
        return el.Value.TryGetProperty(nome, out var p) && p.ValueKind is JsonValueKind.Object ? p : null;
    }

    private static JsonElement? ArrayDe(JsonElement? el, string nome)
    {
        if (el is not { ValueKind: JsonValueKind.Object }) return null;
        return el.Value.TryGetProperty(nome, out var p) && p.ValueKind is JsonValueKind.Array ? p : null;
    }

    private static string? Texto(JsonElement? el, string nome)
    {
        if (el is not { ValueKind: JsonValueKind.Object }) return null;
        if (!el.Value.TryGetProperty(nome, out var p)) return null;
        return p.ValueKind switch
        {
            JsonValueKind.String => p.GetString()?.Trim(),
            JsonValueKind.Number => p.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => null,
            _ => p.ToString()?.Trim(),
        };
    }

    private static decimal Decimal(JsonElement row, string nome)
    {
        var t = Texto(row, nome);
        if (string.IsNullOrWhiteSpace(t)) return 0;
        t = t.Replace(",", ".");
        return decimal.TryParse(t, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var n)
            ? n
            : 0;
    }

    private static int? Inteiro(JsonElement? el, string nome)
    {
        var t = Texto(el, nome);
        if (int.TryParse(t, out var n)) return n;
        if (decimal.TryParse(t, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var d))
            return (int)d;
        return null;
    }

    private static bool Bool(JsonElement row, string nome)
    {
        if (!row.TryGetProperty(nome, out var p)) return false;
        return p.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Number => p.TryGetInt32(out var n) && n != 0,
            JsonValueKind.String => p.GetString() is "1" or "true" or "True",
            _ => false,
        };
    }

    private static DateTime? Data(JsonElement row, string nome)
    {
        var t = Texto(row, nome);
        if (string.IsNullOrWhiteSpace(t) || t == "-") return null;
        if (DateTime.TryParse(t, System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
            out var d))
            return d;
        if (DateTime.TryParse(t, new System.Globalization.CultureInfo("pt-BR"),
            System.Globalization.DateTimeStyles.AssumeLocal, out d))
            return d.ToUniversalTime();
        return null;
    }

    private static string SoDigitos(string? valor)
        => string.IsNullOrEmpty(valor) ? "" : new string(valor.Where(char.IsDigit).ToArray());

    private sealed record SessaoPaymobi(string Token, string VarejoId);
    private sealed record BoletoImportado(string SellId, string Imei, PaymobiBoletoData Boleto);
    private sealed record ParcelasResumo(int Atraso, decimal Devido, decimal ValorParcela, List<PaymobiBoletoData> Boletos);
}
