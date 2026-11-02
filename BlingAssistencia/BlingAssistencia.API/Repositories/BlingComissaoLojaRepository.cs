using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingComissaoLojaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<BlingComissaoLojaData>> ListarAsync(string de, string ate, CancellationToken cancellationToken = default);
    Task SubstituirJanelaAsync(string de, string ate, IReadOnlyList<BlingComissaoLojaData> linhas, CancellationToken cancellationToken = default);
    Task<DateTime?> UltimaAtualizacaoAsync(CancellationToken cancellationToken = default);
}

public sealed class BlingComissaoLojaRepository : IBlingComissaoLojaRepository
{
    private readonly IMongoCollection<BlingComissaoLojaData> _col;

    public BlingComissaoLojaRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<BlingComissaoLojaData>("bling_comissao_loja");
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingComissaoLojaData>(
                Builders<BlingComissaoLojaData>.IndexKeys.Ascending(x => x.Data),
                new CreateIndexOptions { Name = "data" }),
            cancellationToken: cancellationToken);

    public Task<List<BlingComissaoLojaData>> ListarAsync(string de, string ate, CancellationToken cancellationToken = default)
    {
        var filtro = Builders<BlingComissaoLojaData>.Filter.Gte(x => x.Data, de)
            & Builders<BlingComissaoLojaData>.Filter.Lte(x => x.Data, ate);
        return _col.Find(filtro).ToListAsync(cancellationToken);
    }

    public async Task SubstituirJanelaAsync(
        string de,
        string ate,
        IReadOnlyList<BlingComissaoLojaData> linhas,
        CancellationToken cancellationToken = default)
    {
        var filtro = Builders<BlingComissaoLojaData>.Filter.Gte(x => x.Data, de)
            & Builders<BlingComissaoLojaData>.Filter.Lte(x => x.Data, ate);
        await _col.DeleteManyAsync(filtro, cancellationToken);
        if (linhas.Count > 0)
            await _col.InsertManyAsync(linhas, cancellationToken: cancellationToken);
    }

    public async Task<DateTime?> UltimaAtualizacaoAsync(CancellationToken cancellationToken = default)
    {
        var ultimo = await _col.Find(FilterDefinition<BlingComissaoLojaData>.Empty)
            .SortByDescending(x => x.AtualizadoEm)
            .Limit(1)
            .FirstOrDefaultAsync(cancellationToken);
        return ultimo?.AtualizadoEm;
    }
}
