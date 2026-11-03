using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IAparelhoLojaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task InserirAparelhoAsync(AparelhoLojaData item, CancellationToken cancellationToken = default);
    Task SalvarAparelhoAsync(AparelhoLojaData item, CancellationToken cancellationToken = default);
    Task RemoverAparelhoAsync(string id, CancellationToken cancellationToken = default);
    Task<AparelhoLojaData?> ObterAparelhoAsync(string id, CancellationToken cancellationToken = default);
    Task<AparelhoLojaData?> ObterEmEstoquePorImeiAsync(string imei, CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarEstoqueAsync(CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarNaoEstornadosAsync(CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarTodosAsync(CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarComCustoOsAsync(CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarPorImeiAsync(string imei, CancellationToken cancellationToken = default);
    Task<AparelhoLojaData?> ObterPorOsEntradaAsync(long osId, CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarPorIdsAsync(IEnumerable<string> ids, CancellationToken cancellationToken = default);
    Task<List<AparelhoLojaData>> ListarDescontoVigenteAsync(long? clienteId, string? cpf, string? imei, CancellationToken cancellationToken = default);
    Task InserirOperacaoAsync(AparelhoOperacaoData item, CancellationToken cancellationToken = default);
    Task SalvarOperacaoAsync(AparelhoOperacaoData item, CancellationToken cancellationToken = default);
    Task RemoverOperacaoAsync(string id, CancellationToken cancellationToken = default);
    Task<AparelhoOperacaoData?> ObterOperacaoAsync(string id, CancellationToken cancellationToken = default);
    Task<List<AparelhoOperacaoData>> ListarOperacoesAsync(int limite, CancellationToken cancellationToken = default);
    Task<List<AparelhoOperacaoData>> ListarOperacoesAtivasAsync(CancellationToken cancellationToken = default);
    Task<List<AparelhoListaPrecoData>> ListarListaAsync(CancellationToken cancellationToken = default);
    Task<AparelhoListaPrecoData?> ObterListaPorChaveAsync(string modeloId, string condicao, string configuracaoChave, CancellationToken cancellationToken = default);
    Task InserirListaAsync(AparelhoListaPrecoData item, CancellationToken cancellationToken = default);
    Task SalvarListaAsync(AparelhoListaPrecoData item, CancellationToken cancellationToken = default);
    Task RemoverListaAsync(string id, CancellationToken cancellationToken = default);
    Task InserirSessaoFotosAsync(AparelhoFotoSessaoData item, CancellationToken cancellationToken = default);
    Task SalvarSessaoFotosAsync(AparelhoFotoSessaoData item, CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoData?> ObterSessaoFotosAsync(string token, CancellationToken cancellationToken = default);
}

public class AparelhoLojaRepository : IAparelhoLojaRepository
{
    private readonly IMongoCollection<AparelhoLojaData> _aparelhos;
    private readonly IMongoCollection<AparelhoOperacaoData> _operacoes;
    private readonly IMongoCollection<AparelhoListaPrecoData> _lista;
    private readonly IMongoCollection<AparelhoFotoSessaoData> _sessoes;

    public AparelhoLojaRepository(MongoDbService mongo)
    {
        _aparelhos = mongo.GetCollection<AparelhoLojaData>("aparelhos_loja");
        _operacoes = mongo.GetCollection<AparelhoOperacaoData>("aparelho_operacoes");
        _lista = mongo.GetCollection<AparelhoListaPrecoData>("aparelho_lista_precos");
        _sessoes = mongo.GetCollection<AparelhoFotoSessaoData>("aparelho_foto_sessoes");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _aparelhos.Indexes.CreateOneAsync(
            new CreateIndexModel<AparelhoLojaData>(
                Builders<AparelhoLojaData>.IndexKeys.Ascending(x => x.Imei).Ascending(x => x.Status),
                new CreateIndexOptions { Name = "imei_status" }),
            cancellationToken: cancellationToken);

        await _aparelhos.Indexes.CreateOneAsync(
            new CreateIndexModel<AparelhoLojaData>(
                Builders<AparelhoLojaData>.IndexKeys.Ascending(x => x.DescontoVigente).Ascending(x => x.ClienteVendaCpf),
                new CreateIndexOptions { Name = "desconto_cpf" }),
            cancellationToken: cancellationToken);

        await _operacoes.Indexes.CreateOneAsync(
            new CreateIndexModel<AparelhoOperacaoData>(
                Builders<AparelhoOperacaoData>.IndexKeys.Descending(x => x.Data),
                new CreateIndexOptions { Name = "data" }),
            cancellationToken: cancellationToken);

        await _lista.Indexes.CreateOneAsync(
            new CreateIndexModel<AparelhoListaPrecoData>(
                Builders<AparelhoListaPrecoData>.IndexKeys
                    .Ascending(x => x.ModeloId)
                    .Ascending(x => x.Condicao)
                    .Ascending(x => x.ConfiguracaoChave),
                new CreateIndexOptions { Unique = true, Name = "modelo_condicao_config" }),
            cancellationToken: cancellationToken);
    }

    public Task InserirAparelhoAsync(AparelhoLojaData item, CancellationToken cancellationToken = default) =>
        _aparelhos.InsertOneAsync(item, cancellationToken: cancellationToken);

    public Task SalvarAparelhoAsync(AparelhoLojaData item, CancellationToken cancellationToken = default) =>
        _aparelhos.ReplaceOneAsync(x => x.Id == item.Id, item, cancellationToken: cancellationToken);

    public Task RemoverAparelhoAsync(string id, CancellationToken cancellationToken = default) =>
        _aparelhos.DeleteOneAsync(x => x.Id == id, cancellationToken);

    public Task<AparelhoLojaData?> ObterAparelhoAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id) || !ObjectId.TryParse(id, out _))
            return Task.FromResult<AparelhoLojaData?>(null);
        return _aparelhos.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)!;
    }

    public Task<AparelhoLojaData?> ObterEmEstoquePorImeiAsync(string imei, CancellationToken cancellationToken = default) =>
        _aparelhos.Find(x => x.Imei == imei && (x.Status == AparelhoLojaStatus.EmEstoque || x.Status == AparelhoLojaStatus.EmAssistencia))
            .FirstOrDefaultAsync(cancellationToken)!;

    public Task<List<AparelhoLojaData>> ListarEstoqueAsync(CancellationToken cancellationToken = default) =>
        _aparelhos.Find(x => x.Status == AparelhoLojaStatus.EmEstoque || x.Status == AparelhoLojaStatus.EmAssistencia)
            .SortByDescending(x => x.DataEntrada)
            .ToListAsync(cancellationToken);

    public Task<List<AparelhoLojaData>> ListarNaoEstornadosAsync(CancellationToken cancellationToken = default) =>
        _aparelhos.Find(x => x.Status != AparelhoLojaStatus.Estornado).ToListAsync(cancellationToken);

    public Task<List<AparelhoLojaData>> ListarTodosAsync(CancellationToken cancellationToken = default) =>
        _aparelhos.Find(FilterDefinition<AparelhoLojaData>.Empty).ToListAsync(cancellationToken);

    public Task<List<AparelhoLojaData>> ListarComCustoOsAsync(CancellationToken cancellationToken = default)
    {
        var filtro = Builders<AparelhoLojaData>.Filter.And(
            Builders<AparelhoLojaData>.Filter.Ne(x => x.Status, AparelhoLojaStatus.Estornado),
            Builders<AparelhoLojaData>.Filter.Exists("custosOs.0"));
        return _aparelhos.Find(filtro)
            .SortByDescending(x => x.DataEntrada)
            .Limit(200)
            .ToListAsync(cancellationToken);
    }

    public Task<List<AparelhoLojaData>> ListarPorImeiAsync(string imei, CancellationToken cancellationToken = default) =>
        _aparelhos.Find(x => x.Imei == imei && x.Status != AparelhoLojaStatus.Estornado)
            .SortByDescending(x => x.DataEntrada)
            .ToListAsync(cancellationToken);

    public async Task<AparelhoLojaData?> ObterPorOsEntradaAsync(long osId, CancellationToken cancellationToken = default) =>
        await _aparelhos.Find(x => x.OsEntradaId == osId && x.Status != AparelhoLojaStatus.Estornado)
            .SortByDescending(x => x.DataEntrada)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<List<AparelhoLojaData>> ListarPorIdsAsync(
        IEnumerable<string> ids,
        CancellationToken cancellationToken = default)
    {
        var lista = ids.Where(id => !string.IsNullOrWhiteSpace(id) && ObjectId.TryParse(id, out _)).Distinct().ToList();
        if (lista.Count == 0) return [];
        var filtro = Builders<AparelhoLojaData>.Filter.In(x => x.Id, lista);
        return await _aparelhos.Find(filtro).ToListAsync(cancellationToken);
    }

    public async Task<List<AparelhoLojaData>> ListarDescontoVigenteAsync(
        long? clienteId,
        string? cpf,
        string? imei,
        CancellationToken cancellationToken = default)
    {
        var filtro = Builders<AparelhoLojaData>.Filter.Eq(x => x.DescontoVigente, true);
        if (!string.IsNullOrWhiteSpace(imei))
            filtro &= Builders<AparelhoLojaData>.Filter.Eq(x => x.Imei, imei);

        var porCliente = new List<FilterDefinition<AparelhoLojaData>>();
        if (clienteId is > 0)
            porCliente.Add(Builders<AparelhoLojaData>.Filter.Eq(x => x.ClienteVendaId, clienteId));
        if (!string.IsNullOrWhiteSpace(cpf))
            porCliente.Add(Builders<AparelhoLojaData>.Filter.Eq(x => x.ClienteVendaCpf, cpf));
        if (porCliente.Count == 0)
            return [];

        filtro &= porCliente.Count == 1
            ? porCliente[0]
            : Builders<AparelhoLojaData>.Filter.Or(porCliente);

        return await _aparelhos.Find(filtro)
            .SortByDescending(x => x.DataSaida)
            .Limit(50)
            .ToListAsync(cancellationToken);
    }

    public Task InserirOperacaoAsync(AparelhoOperacaoData item, CancellationToken cancellationToken = default) =>
        _operacoes.InsertOneAsync(item, cancellationToken: cancellationToken);

    public Task SalvarOperacaoAsync(AparelhoOperacaoData item, CancellationToken cancellationToken = default) =>
        _operacoes.ReplaceOneAsync(x => x.Id == item.Id, item, cancellationToken: cancellationToken);

    public Task RemoverOperacaoAsync(string id, CancellationToken cancellationToken = default) =>
        _operacoes.DeleteOneAsync(x => x.Id == id, cancellationToken);

    public Task<AparelhoOperacaoData?> ObterOperacaoAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id) || !ObjectId.TryParse(id, out _))
            return Task.FromResult<AparelhoOperacaoData?>(null);
        return _operacoes.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)!;
    }

    public Task<List<AparelhoOperacaoData>> ListarOperacoesAsync(int limite, CancellationToken cancellationToken = default)
    {
        var lim = Math.Clamp(limite, 1, 2000);
        return _operacoes.Find(FilterDefinition<AparelhoOperacaoData>.Empty)
            .SortByDescending(x => x.Data)
            .Limit(lim)
            .ToListAsync(cancellationToken);
    }

    public Task<List<AparelhoOperacaoData>> ListarOperacoesAtivasAsync(CancellationToken cancellationToken = default) =>
        _operacoes.Find(x => x.Status == AparelhoOperacaoStatus.Ativa).ToListAsync(cancellationToken);

    public Task<List<AparelhoListaPrecoData>> ListarListaAsync(CancellationToken cancellationToken = default) =>
        _lista.Find(FilterDefinition<AparelhoListaPrecoData>.Empty)
            .SortBy(x => x.Marca)
            .ThenBy(x => x.Modelo)
            .ToListAsync(cancellationToken);

    public Task<AparelhoListaPrecoData?> ObterListaPorChaveAsync(
        string modeloId,
        string condicao,
        string configuracaoChave,
        CancellationToken cancellationToken = default) =>
        _lista.Find(x => x.ModeloId == modeloId && x.Condicao == condicao && x.ConfiguracaoChave == configuracaoChave)
            .FirstOrDefaultAsync(cancellationToken)!;

    public Task InserirListaAsync(AparelhoListaPrecoData item, CancellationToken cancellationToken = default) =>
        _lista.InsertOneAsync(item, cancellationToken: cancellationToken);

    public Task SalvarListaAsync(AparelhoListaPrecoData item, CancellationToken cancellationToken = default) =>
        _lista.ReplaceOneAsync(x => x.Id == item.Id, item, cancellationToken: cancellationToken);

    public Task RemoverListaAsync(string id, CancellationToken cancellationToken = default) =>
        _lista.DeleteOneAsync(x => x.Id == id, cancellationToken);

    public Task InserirSessaoFotosAsync(AparelhoFotoSessaoData item, CancellationToken cancellationToken = default) =>
        _sessoes.InsertOneAsync(item, cancellationToken: cancellationToken);

    public Task SalvarSessaoFotosAsync(AparelhoFotoSessaoData item, CancellationToken cancellationToken = default) =>
        _sessoes.ReplaceOneAsync(x => x.Token == item.Token, item, cancellationToken: cancellationToken);

    public Task<AparelhoFotoSessaoData?> ObterSessaoFotosAsync(string token, CancellationToken cancellationToken = default) =>
        _sessoes.Find(x => x.Token == token).FirstOrDefaultAsync(cancellationToken)!;
}
