using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Data;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IPaymobiVendaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<int> AplicarNomesComerciaisAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PaymobiVendaData>> ListarAsync(string? status, string? termo, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> ObterAsync(string id, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData> CriarAsync(PaymobiVendaData item, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> AtualizarAsync(string id, PaymobiVendaData item, CancellationToken cancellationToken = default);
    Task ExcluirAsync(string id, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> AdicionarCobrancaAsync(string id, PaymobiCobrancaData cobranca, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> RemoverCobrancaAsync(string vendaId, string cobrancaId, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> ConfirmarParcelaPagaAsync(string id, PaymobiConfirmarParcelaRequest pedido, CancellationToken cancellationToken = default);
    Task<PaymobiVendaData?> RemoverParcelaManualAsync(string vendaId, string boletoId, CancellationToken cancellationToken = default);
    Task UpsertDaPaymobiAsync(PaymobiVendaData item, CancellationToken cancellationToken = default);
    Task<int> AplicarCustoAparelhoAsync(decimal custo, bool somenteSemCusto, CancellationToken cancellationToken = default);
    Task<int> AplicarStatusCobrancaPadraoAsync(CancellationToken cancellationToken = default);
}

public class PaymobiVendaRepository : IPaymobiVendaRepository
{
    private readonly IMongoCollection<PaymobiVendaData> _col;

    public PaymobiVendaRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<PaymobiVendaData>("paymobi_vendas");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<PaymobiVendaData>(
                Builders<PaymobiVendaData>.IndexKeys.Descending(x => x.DataVenda)),
            cancellationToken: cancellationToken);
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<PaymobiVendaData>(
                Builders<PaymobiVendaData>.IndexKeys.Ascending(x => x.Status)),
            cancellationToken: cancellationToken);
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<PaymobiVendaData>(
                Builders<PaymobiVendaData>.IndexKeys.Ascending(x => x.AparelhoImei)),
            cancellationToken: cancellationToken);
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<PaymobiVendaData>(
                Builders<PaymobiVendaData>.IndexKeys.Ascending(x => x.PaymobiSellId),
                new CreateIndexOptions { Sparse = true }),
            cancellationToken: cancellationToken);
    }

    public async Task<int> AplicarNomesComerciaisAsync(CancellationToken cancellationToken = default)
    {
        var lista = await _col.Find(FilterDefinition<PaymobiVendaData>.Empty)
            .ToListAsync(cancellationToken);
        var n = 0;
        foreach (var item in lista)
        {
            if (!AparelhoCodigoComercial.PareceCodigoFabrica(item.AparelhoModelo))
                continue;
            var novo = AparelhoCodigoComercial.Nome(item.AparelhoModelo);
            if (string.Equals(novo, item.AparelhoModelo, StringComparison.Ordinal))
                continue;

            var result = await _col.UpdateOneAsync(
                Builders<PaymobiVendaData>.Filter.Eq(x => x.Id, item.Id),
                Builders<PaymobiVendaData>.Update.Set(x => x.AparelhoModelo, novo),
                cancellationToken: cancellationToken);
            if (result.ModifiedCount > 0)
                n++;
            item.AparelhoModelo = novo;
        }

        var estranhos = lista.Count(x => AparelhoCodigoComercial.PareceCodigoFabrica(x.AparelhoModelo));
        if (estranhos > 0)
            Console.WriteLine($"[MundoSmart API] PayMobi: {estranhos} aparelhos ainda com código de fábrica.");

        return n;
    }

    public async Task<IReadOnlyList<PaymobiVendaData>> ListarAsync(
        string? status,
        string? termo,
        CancellationToken cancellationToken = default)
    {
        var filtros = new List<FilterDefinition<PaymobiVendaData>>();
        if (!string.IsNullOrWhiteSpace(status) && status != "todos")
        {
            filtros.Add(Builders<PaymobiVendaData>.Filter.Eq(x => x.Status, PaymobiStatus.Normalizar(status)));
        }

        var t = (termo ?? "").Trim();
        if (t.Length >= 2)
        {
            var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(t), "i");
            filtros.Add(Builders<PaymobiVendaData>.Filter.Or(
                Builders<PaymobiVendaData>.Filter.Regex(x => x.ClienteNome, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.ClienteCpf, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.ClienteTelefone, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.AparelhoMarca, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.AparelhoModelo, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.AparelhoImei, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.ContratoNumero, rx),
                Builders<PaymobiVendaData>.Filter.Regex(x => x.PaymobiSellId, rx)));
        }

        var filtro = filtros.Count == 0
            ? FilterDefinition<PaymobiVendaData>.Empty
            : Builders<PaymobiVendaData>.Filter.And(filtros);

        return await _col.Find(filtro)
            .SortByDescending(x => x.DataVenda)
            .ToListAsync(cancellationToken);
    }

    public async Task<PaymobiVendaData?> ObterAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id) || !ObjectId.TryParse(id, out _)) return null;
        return await _col.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<PaymobiVendaData> CriarAsync(PaymobiVendaData item, CancellationToken cancellationToken = default)
    {
        item = Normalizar(item);
        item.Id = null;
        item.CriadoEm = DateTime.UtcNow;
        item.AtualizadoEm = null;
        item.Cobrancas ??= [];
        item.Status = RecalcularStatus(item);
        item.StatusCobranca = PaymobiStatusCobranca.Normalizar(
            item.StatusCobranca, item.ParcelasAtraso, item.Status);
        if (item.ValorInvestido > 0)
        {
            item.Concretizada = true;
            item.ConcretizadaEm ??= DateTime.UtcNow;
        }
        await _col.InsertOneAsync(item, cancellationToken: cancellationToken);
        return item;
    }

    public async Task<PaymobiVendaData?> AtualizarAsync(
        string id,
        PaymobiVendaData item,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(id, cancellationToken);
        if (existente is null) return null;

        item = Normalizar(item);
        existente.ClienteNome = item.ClienteNome;
        existente.ClienteCpf = item.ClienteCpf;
        existente.ClienteTelefone = item.ClienteTelefone;
        existente.AparelhoMarca = item.AparelhoMarca;
        existente.AparelhoModelo = item.AparelhoModelo;
        existente.AparelhoCor = item.AparelhoCor;
        existente.AparelhoImei = item.AparelhoImei;
        existente.ValorInvestido = item.ValorInvestido;
        existente.CustoPlataforma = item.CustoPlataforma;
        existente.ValorVenda = item.ValorVenda;
        existente.Parcelas = item.Parcelas;
        existente.ValorParcela = item.ValorParcela;
        existente.DataVenda = item.DataVenda;
        existente.Observacoes = item.Observacoes;
        existente.LojaNome = item.LojaNome;
        existente.VendedorNome = item.VendedorNome;
        existente.ClienteEmail = item.ClienteEmail;
        existente.ContratoNumero = item.ContratoNumero;
        existente.ContratoTipo = item.ContratoTipo;
        existente.ContratoAssinado = item.ContratoAssinado;
        existente.EncerradoEm = item.EncerradoEm;
        existente.CanceladoEm = item.CanceladoEm;
        existente.ValorOriginal = item.ValorOriginal;
        existente.ValorEntrada = item.ValorEntrada;
        existente.ValorBaseAparelho = item.ValorBaseAparelho;
        if (item.Boletos is { Count: > 0 })
            existente.Boletos = item.Boletos;
        existente.Concretizada = item.Concretizada;
        if (existente.Concretizada)
        {
            existente.ConcretizadaEm ??= item.ConcretizadaEm ?? DateTime.UtcNow;
        }
        else
        {
            existente.ConcretizadaEm = null;
        }
        existente.ValorRevenda = item.ValorRevenda;
        existente.CustoManutencao = item.CustoManutencao;
        existente.ValorBoletosPagos = item.ValorBoletosPagos;
        existente.Status = PaymobiStatus.Normalizar(item.Status);
        existente.Status = RecalcularStatus(existente);
        existente.StatusCobranca = PaymobiStatusCobranca.Normalizar(
            item.StatusCobranca, existente.ParcelasAtraso, existente.Status);
        existente.AtualizadoEm = DateTime.UtcNow;

        await _col.ReplaceOneAsync(x => x.Id == id, existente, cancellationToken: cancellationToken);
        return existente;
    }

    public async Task ExcluirAsync(string id, CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(id, cancellationToken);
        if (existente is null) throw new KeyNotFoundException();
        await _col.DeleteOneAsync(x => x.Id == id, cancellationToken);
    }

    public async Task<PaymobiVendaData?> AdicionarCobrancaAsync(
        string id,
        PaymobiCobrancaData cobranca,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(id, cancellationToken);
        if (existente is null) return null;
        if (cobranca.Valor <= 0)
            throw new ArgumentException("Informe o valor da cobrança.");

        existente.Cobrancas.Add(new PaymobiCobrancaData
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Data = cobranca.Data == default ? DateTime.UtcNow : cobranca.Data,
            Valor = decimal.Round(cobranca.Valor, 2),
            Observacao = (cobranca.Observacao ?? "").Trim(),
        });
        existente.Status = RecalcularStatus(existente);
        existente.AtualizadoEm = DateTime.UtcNow;
        await _col.ReplaceOneAsync(x => x.Id == id, existente, cancellationToken: cancellationToken);
        return existente;
    }

    public async Task<PaymobiVendaData?> RemoverCobrancaAsync(
        string vendaId,
        string cobrancaId,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(vendaId, cancellationToken);
        if (existente is null) return null;
        existente.Cobrancas = existente.Cobrancas.Where(c => c.Id != cobrancaId).ToList();
        existente.Status = RecalcularStatus(existente);
        existente.AtualizadoEm = DateTime.UtcNow;
        await _col.ReplaceOneAsync(x => x.Id == vendaId, existente, cancellationToken: cancellationToken);
        return existente;
    }

    public async Task<PaymobiVendaData?> ConfirmarParcelaPagaAsync(
        string id,
        PaymobiConfirmarParcelaRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(id, cancellationToken);
        if (existente is null) return null;
        var numero = pedido.Numero;
        if (numero <= 0)
            throw new ArgumentException("Informe o número da parcela.");
        var valor = decimal.Round(pedido.Valor, 2);
        if (valor <= 0)
            valor = existente.ValorParcela;
        if (valor <= 0)
            throw new ArgumentException("Informe o valor pago nesta parcela.");

        existente.Boletos ??= [];
        var jaPagaPaymobi = existente.Boletos.FirstOrDefault(b =>
            b.Numero == numero && !b.Manual && (b.Status is "paid" or "pago"));
        if (jaPagaPaymobi is not null)
            return existente;

        var manual = existente.Boletos.FirstOrDefault(b => b.Numero == numero && b.Manual);
        if (manual is null)
        {
            manual = new PaymobiBoletoData
            {
                Id = ObjectId.GenerateNewId().ToString(),
                Numero = numero,
                Imei = string.IsNullOrWhiteSpace(pedido.Imei) ? existente.AparelhoImei : pedido.Imei.Trim(),
            };
            existente.Boletos.Add(manual);
        }
        manual.Valor = valor;
        manual.Status = "paid";
        manual.Manual = true;
        manual.PagoEm = DateTime.UtcNow;
        manual.Vencimento = pedido.Vencimento?.Date
            ?? manual.Vencimento
            ?? existente.DataVenda.AddMonths(numero);
        existente.Status = RecalcularStatus(existente);
        existente.AtualizadoEm = DateTime.UtcNow;
        await _col.ReplaceOneAsync(x => x.Id == id, existente, cancellationToken: cancellationToken);
        return existente;
    }

    public async Task<PaymobiVendaData?> RemoverParcelaManualAsync(
        string vendaId,
        string boletoId,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterAsync(vendaId, cancellationToken);
        if (existente is null) return null;
        existente.Boletos = existente.Boletos
            .Where(b => !(b.Manual && b.Id == boletoId))
            .ToList();
        existente.Status = RecalcularStatus(existente);
        existente.AtualizadoEm = DateTime.UtcNow;
        await _col.ReplaceOneAsync(x => x.Id == vendaId, existente, cancellationToken: cancellationToken);
        return existente;
    }

    private static PaymobiVendaData Normalizar(PaymobiVendaData item)
    {
        var nome = (item.ClienteNome ?? "").Trim();
        if (string.IsNullOrWhiteSpace(nome))
            throw new ArgumentException("Informe o nome do cliente.");
        if (item.ValorInvestido < 0)
            throw new ArgumentException("O valor de compra não pode ser negativo.");
        if (item.CustoPlataforma < 0)
            throw new ArgumentException("O custo da plataforma não pode ser negativo.");
        if (item.ValorVenda < 0)
            throw new ArgumentException("O valor da venda não pode ser negativo.");
        if (item.ValorRevenda < 0)
            throw new ArgumentException("O valor de revenda não pode ser negativo.");
        if (item.CustoManutencao < 0)
            throw new ArgumentException("O custo de manutenção não pode ser negativo.");
        if (item.ValorBoletosPagos < 0)
            throw new ArgumentException("O valor dos boletos pagos não pode ser negativo.");

        item.ClienteNome = nome;
        item.ClienteCpf = (item.ClienteCpf ?? "").Trim();
        item.ClienteTelefone = (item.ClienteTelefone ?? "").Trim();
        item.AparelhoMarca = (item.AparelhoMarca ?? "").Trim();
        item.AparelhoModelo = (item.AparelhoModelo ?? "").Trim();
        item.AparelhoCor = (item.AparelhoCor ?? "").Trim();
        item.AparelhoImei = (item.AparelhoImei ?? "").Trim();
        item.ValorInvestido = decimal.Round(item.ValorInvestido, 2);
        item.CustoPlataforma = decimal.Round(item.CustoPlataforma, 2);
        item.ValorVenda = decimal.Round(item.ValorVenda, 2);
        item.Parcelas = Math.Clamp(item.Parcelas, 0, 36);
        item.ValorParcela = decimal.Round(item.ValorParcela, 2);
        item.ValorRevenda = decimal.Round(item.ValorRevenda, 2);
        item.CustoManutencao = decimal.Round(item.CustoManutencao, 2);
        item.ValorBoletosPagos = decimal.Round(item.ValorBoletosPagos, 2);
        item.Observacoes = (item.Observacoes ?? "").Trim();
        item.Status = PaymobiStatus.Normalizar(item.Status);
        if (item.DataVenda == default) item.DataVenda = DateTime.UtcNow;
        item.Cobrancas ??= [];
        item.Boletos ??= [];
        return item;
    }

    private static string RecalcularStatus(PaymobiVendaData item)
    {
        var atual = PaymobiStatus.Normalizar(item.Status);
        if (atual is PaymobiStatus.Cancelada) return atual;
        if (!string.IsNullOrWhiteSpace(item.PaymobiSellId) && item.CanceladoEm is not null)
            return PaymobiStatus.Cancelada;
        if (!string.IsNullOrWhiteSpace(item.PaymobiSellId) && item.EncerradoEm is not null)
            return PaymobiStatus.Quitada;
        if (item.ParcelasAtraso > 0)
            return PaymobiStatus.Atrasada;
        var recebido = (item.Cobrancas?.Sum(c => c.Valor) ?? 0) + item.ValorEntrada;
        if (item.ValorVenda > 0 && recebido >= item.ValorVenda && item.ValorDevido <= 0)
            return PaymobiStatus.Quitada;
        if (atual is PaymobiStatus.Quitada && (item.ValorDevido > 0 || recebido < item.ValorVenda))
            return PaymobiStatus.Aberta;
        return atual is PaymobiStatus.Atrasada ? PaymobiStatus.Aberta : atual;
    }

    public async Task UpsertDaPaymobiAsync(PaymobiVendaData item, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(item.PaymobiSellId))
            throw new ArgumentException("Venda da PayMobi sem identificador.");

        var existente = await _col.Find(x => x.PaymobiSellId == item.PaymobiSellId)
            .FirstOrDefaultAsync(cancellationToken);

        if (existente is null)
        {
            item.Id = null;
            item.CriadoEm = DateTime.UtcNow;
            item.Origem = "paymobi";
            item.SincronizadoEm = DateTime.UtcNow;
            item.Status = RecalcularStatus(item);
            item.StatusCobranca = PaymobiStatusCobranca.Padrao(item.ParcelasAtraso, item.Status);
            item.Cobrancas ??= [];
            await _col.InsertOneAsync(item, cancellationToken: cancellationToken);
            return;
        }

        existente.ClienteNome = item.ClienteNome;
        existente.ClienteCpf = item.ClienteCpf;
        if (!string.IsNullOrWhiteSpace(item.ClienteTelefone))
            existente.ClienteTelefone = item.ClienteTelefone;
        if (!string.IsNullOrWhiteSpace(item.ClienteEmail))
            existente.ClienteEmail = item.ClienteEmail;
        existente.AparelhoMarca = item.AparelhoMarca;
        existente.AparelhoModelo = ModeloAposImportacao(existente.AparelhoModelo, item.AparelhoModelo);
        existente.AparelhoCor = item.AparelhoCor;
        existente.AparelhoImei = item.AparelhoImei;
        existente.ValorVenda = item.ValorVenda;
        existente.Parcelas = item.Parcelas;
        existente.ValorParcela = item.ValorParcela;
        existente.DataVenda = item.DataVenda;
        existente.LojaNome = item.LojaNome;
        existente.VendedorNome = item.VendedorNome;
        existente.ContratoNumero = item.ContratoNumero;
        existente.ContratoTipo = item.ContratoTipo;
        existente.ContratoAssinado = item.ContratoAssinado;
        existente.EncerradoEm = item.EncerradoEm;
        existente.CanceladoEm = item.CanceladoEm;
        existente.ValorOriginal = item.ValorOriginal;
        existente.ValorEntrada = item.ValorEntrada;
        existente.ValorBaseAparelho = item.ValorBaseAparelho;
        existente.AparelhoBloqueado = item.AparelhoBloqueado;
        var atrasoAntes = existente.ParcelasAtraso;
        var pagosAntes = SomaBoletosPagos(existente.Boletos);
        var idsAntes = (existente.Boletos ?? [])
            .Select(b => b.Id)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .ToHashSet(StringComparer.Ordinal);
        existente.Boletos = MesclarBoletos(existente.Boletos, item.Boletos);
        if (item.Boletos is { Count: > 0 })
        {
            var resumo = ResumoBoletos(existente.Boletos);
            existente.ParcelasAtraso = resumo.Atraso;
            existente.ValorDevido = resumo.Devido;
        }
        else if (item.EncerradoEm is not null || item.Status is PaymobiStatus.Quitada)
        {
            existente.ParcelasAtraso = 0;
            existente.ValorDevido = 0;
        }
        existente.Status = item.Status;
        existente.Origem = "paymobi";
        existente.SincronizadoEm = DateTime.UtcNow;
        existente.AtualizadoEm = DateTime.UtcNow;
        if (existente.ValorInvestido <= 0 && item.ValorInvestido > 0)
            existente.ValorInvestido = item.ValorInvestido;
        existente.Status = RecalcularStatus(existente);
        var pagosDepois = SomaBoletosPagos(existente.Boletos);
        var renegociou = (item.Boletos ?? []).Any(b =>
            !string.IsNullOrWhiteSpace(b.Id)
            && !idsAntes.Contains(b.Id)
            && !string.IsNullOrWhiteSpace(b.Link));
        var cobrancaAntes = existente.StatusCobranca;
        existente.StatusCobranca = PaymobiStatusCobranca.AposPagamentoOuRenegociacao(
            existente.StatusCobranca,
            atrasoAntes,
            pagosAntes,
            existente.ParcelasAtraso,
            pagosDepois,
            renegociou,
            existente.Status);
        if (cobrancaAntes == PaymobiStatusCobranca.Perdido
            && existente.StatusCobranca != PaymobiStatusCobranca.Perdido)
        {
            Console.WriteLine(
                $"[MundoSmart API] PayMobi: {existente.ClienteNome} saiu de Perdido → {existente.StatusCobranca} (atraso {atrasoAntes}→{existente.ParcelasAtraso}).");
        }
        await _col.ReplaceOneAsync(x => x.Id == existente.Id, existente, cancellationToken: cancellationToken);
    }

    public async Task<int> AplicarCustoAparelhoAsync(
        decimal custo,
        bool somenteSemCusto,
        CancellationToken cancellationToken = default)
    {
        custo = decimal.Round(Math.Max(0, custo), 2);
        var filtro = somenteSemCusto
            ? Builders<PaymobiVendaData>.Filter.And(
                Builders<PaymobiVendaData>.Filter.Ne(x => x.Status, PaymobiStatus.Cancelada),
                Builders<PaymobiVendaData>.Filter.Lte(x => x.ValorInvestido, 0))
            : Builders<PaymobiVendaData>.Filter.Ne(x => x.Status, PaymobiStatus.Cancelada);

        var res = await _col.UpdateManyAsync(
            filtro,
            Builders<PaymobiVendaData>.Update
                .Set(x => x.ValorInvestido, custo)
                .Set(x => x.AtualizadoEm, DateTime.UtcNow),
            cancellationToken: cancellationToken);
        return (int)res.ModifiedCount;
    }

    public async Task<int> AplicarStatusCobrancaPadraoAsync(CancellationToken cancellationToken = default)
    {
        var lista = await _col.Find(FilterDefinition<PaymobiVendaData>.Empty)
            .ToListAsync(cancellationToken);
        var n = 0;
        foreach (var item in lista)
        {
            if (PaymobiStatusCobranca.Manual(item.StatusCobranca)) continue;
            var novo = PaymobiStatusCobranca.Padrao(item.ParcelasAtraso, item.Status);
            if (string.Equals(item.StatusCobranca, novo, StringComparison.Ordinal)) continue;
            var result = await _col.UpdateOneAsync(
                Builders<PaymobiVendaData>.Filter.Eq(x => x.Id, item.Id),
                Builders<PaymobiVendaData>.Update
                    .Set(x => x.StatusCobranca, novo)
                    .Set(x => x.AtualizadoEm, DateTime.UtcNow),
                cancellationToken: cancellationToken);
            if (result.ModifiedCount > 0) n++;
        }
        return n;
    }

    /// <summary>
    /// Nome editado na loja permanece. Só troca se ainda for código de fábrica.
    /// </summary>
    private static string ModeloAposImportacao(string? guardado, string? importado)
    {
        var atual = (guardado ?? "").Trim();
        var novo = (importado ?? "").Trim();
        if (atual.Length == 0) return novo;
        if (!AparelhoCodigoComercial.PareceCodigoFabrica(atual)) return atual;
        return novo;
    }

    private static List<PaymobiBoletoData> MesclarBoletos(
        List<PaymobiBoletoData>? atuais,
        List<PaymobiBoletoData>? novos)
    {
        atuais ??= [];
        novos ??= [];
        if (novos.Count == 0) return atuais;

        var ids = novos.Select(b => b.Id).Where(id => !string.IsNullOrWhiteSpace(id)).ToHashSet();
        var pagosPaymobi = novos
            .Where(b => b.Status is "paid" or "pago" && b.Numero > 0)
            .Select(b => b.Numero)
            .ToHashSet();
        var extras = atuais.Where(b =>
        {
            if (b.Status is not ("paid" or "pago")) return false;
            if (b.Manual && b.Numero > 0 && pagosPaymobi.Contains(b.Numero)) return false;
            if (!string.IsNullOrWhiteSpace(b.Id) && ids.Contains(b.Id)) return false;
            return b.Manual || !string.IsNullOrWhiteSpace(b.Id);
        });
        return [.. novos, .. extras];
    }

    private static decimal SomaBoletosPagos(IEnumerable<PaymobiBoletoData>? boletos)
        => (boletos ?? []).Where(b => b.Status is "paid" or "pago").Sum(b => b.Valor);

    private static (int Atraso, decimal Devido) ResumoBoletos(IEnumerable<PaymobiBoletoData> boletos)
    {
        var tzId = OperatingSystem.IsWindows() ? "E. South America Standard Time" : "America/Sao_Paulo";
        var hoje = TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow, tzId).Date;
        var atraso = 0;
        decimal devido = 0;
        foreach (var b in boletos)
        {
            if (b.Status is "paid" or "pago") continue;
            if (string.IsNullOrWhiteSpace(b.Link)) continue;
            devido += b.Valor;
            var atrasado = b.Status is "overdue" or "late" or "delayed" or "atrasado" or "atrasada"
                || (b.Vencimento is not null && b.Vencimento.Value.Date < hoje);
            if (atrasado) atraso++;
        }
        return (atraso, decimal.Round(devido, 2));
    }
}
