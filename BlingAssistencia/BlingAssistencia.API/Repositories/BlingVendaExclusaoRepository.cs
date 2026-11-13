using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingVendaExclusaoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task MarcarAsync(long pedidoId, CancellationToken cancellationToken = default);
    Task<HashSet<long>> PedidoIdsAsync(CancellationToken cancellationToken = default);
}

public sealed class BlingVendaExclusaoRepository : IBlingVendaExclusaoRepository
{
    private readonly IMongoCollection<BlingVendaExclusaoData> _col;

    public BlingVendaExclusaoRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<BlingVendaExclusaoData>("bling_venda_exclusoes");
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaExclusaoData>(
                Builders<BlingVendaExclusaoData>.IndexKeys.Ascending(x => x.PedidoId),
                new CreateIndexOptions { Unique = true, Name = "pedidoId" }),
            cancellationToken: cancellationToken);

    public async Task MarcarAsync(long pedidoId, CancellationToken cancellationToken = default)
    {
        if (pedidoId <= 0) return;
        await _col.UpdateOneAsync(
            x => x.PedidoId == pedidoId,
            Builders<BlingVendaExclusaoData>.Update
                .SetOnInsert(x => x.PedidoId, pedidoId)
                .SetOnInsert(x => x.ExcluidaEm, DateTime.UtcNow),
            new UpdateOptions { IsUpsert = true },
            cancellationToken);
    }

    public async Task<HashSet<long>> PedidoIdsAsync(CancellationToken cancellationToken = default)
    {
        var ids = await _col.Find(FilterDefinition<BlingVendaExclusaoData>.Empty)
            .Project(x => x.PedidoId)
            .ToListAsync(cancellationToken);
        return ids.ToHashSet();
    }
}
