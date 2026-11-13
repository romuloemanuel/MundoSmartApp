using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IReceitaBlingVendaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<ReceitaBlingVendaData?> ObterPorPedidoIdAsync(long pedidoId, CancellationToken cancellationToken = default);
    Task<List<ReceitaBlingVendaData>> ListarNoPeriodoAsync(DateTime inicio, DateTime fim, CancellationToken cancellationToken = default);
    Task UpsertDoBlingAsync(ReceitaBlingVendaData lido, CancellationToken cancellationToken = default);
    Task<ReceitaBlingVendaData> SalvarAsync(ReceitaBlingVendaData doc, CancellationToken cancellationToken = default);
}

public sealed class ReceitaBlingVendaRepository : IReceitaBlingVendaRepository
{
    private readonly IMongoCollection<ReceitaBlingVendaData> _col;

    public ReceitaBlingVendaRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<ReceitaBlingVendaData>("receita_bling_vendas");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<ReceitaBlingVendaData>(
                Builders<ReceitaBlingVendaData>.IndexKeys.Ascending(x => x.PedidoId),
                new CreateIndexOptions { Unique = true, Name = "pedidoId" }),
            cancellationToken: cancellationToken);
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<ReceitaBlingVendaData>(
                Builders<ReceitaBlingVendaData>.IndexKeys.Ascending(x => x.Data),
                new CreateIndexOptions { Name = "data" }),
            cancellationToken: cancellationToken);
    }

    public async Task<ReceitaBlingVendaData?> ObterPorPedidoIdAsync(long pedidoId, CancellationToken cancellationToken = default) =>
        await _col.Find(x => x.PedidoId == pedidoId).FirstOrDefaultAsync(cancellationToken);

    public Task<List<ReceitaBlingVendaData>> ListarNoPeriodoAsync(
        DateTime inicio,
        DateTime fim,
        CancellationToken cancellationToken = default)
    {
        var filtro = Builders<ReceitaBlingVendaData>.Filter.Gte(x => x.Data, inicio.Date)
            & Builders<ReceitaBlingVendaData>.Filter.Lt(x => x.Data, fim.Date.AddDays(1));
        return _col.Find(filtro)
            .SortByDescending(x => x.Data)
            .ThenByDescending(x => x.PedidoId)
            .ToListAsync(cancellationToken);
    }

    public async Task UpsertDoBlingAsync(ReceitaBlingVendaData lido, CancellationToken cancellationToken = default)
    {
        var atual = await ObterPorPedidoIdAsync(lido.PedidoId, cancellationToken);
        if (atual is null)
        {
            lido.CustoItem = lido.CustoItemOrigem;
            lido.CustoLoja = lido.CustoLojaOrigem;
            lido.AtualizadoEm = DateTime.UtcNow;
            await _col.InsertOneAsync(lido, cancellationToken: cancellationToken);
            return;
        }

        atual.Numero = lido.Numero;
        atual.Data = lido.Data;
        atual.ClienteNome = lido.ClienteNome;
        atual.Bruto = lido.Bruto;
        atual.CustoItemOrigem = lido.CustoItemOrigem;
        atual.CustoLojaOrigem = lido.CustoLojaOrigem;
        if (!atual.CustoItemEditado) atual.CustoItem = lido.CustoItemOrigem;
        if (!atual.CustoLojaEditado) atual.CustoLoja = lido.CustoLojaOrigem;
        atual.AtualizadoEm = DateTime.UtcNow;
        await _col.ReplaceOneAsync(x => x.Id == atual.Id, atual, cancellationToken: cancellationToken);
    }

    public async Task<ReceitaBlingVendaData> SalvarAsync(ReceitaBlingVendaData doc, CancellationToken cancellationToken = default)
    {
        doc.AtualizadoEm = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(doc.Id))
        {
            await _col.InsertOneAsync(doc, cancellationToken: cancellationToken);
            return doc;
        }

        await _col.ReplaceOneAsync(x => x.Id == doc.Id, doc, cancellationToken: cancellationToken);
        return doc;
    }
}
