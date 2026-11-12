using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IFollowUpCelularRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<FollowUpCelularData>> ListarAsync(CancellationToken cancellationToken = default);
    Task<FollowUpCelularData?> ObterAsync(string id, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> InserirAsync(FollowUpCelularData doc, CancellationToken cancellationToken = default);
    Task SalvarAsync(FollowUpCelularData doc, CancellationToken cancellationToken = default);
}

public class FollowUpCelularRepository : IFollowUpCelularRepository
{
    private readonly IMongoCollection<FollowUpCelularData> _collection;

    public FollowUpCelularRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<FollowUpCelularData>("followups_celulares");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<FollowUpCelularData>(
                Builders<FollowUpCelularData>.IndexKeys.Ascending(x => x.Numero),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<FollowUpCelularData>(
                Builders<FollowUpCelularData>.IndexKeys
                    .Ascending(x => x.Situacao)
                    .Ascending(x => x.DataFollowUp)),
            cancellationToken: cancellationToken);
    }

    public Task<List<FollowUpCelularData>> ListarAsync(CancellationToken cancellationToken = default) =>
        _collection.Find(FilterDefinition<FollowUpCelularData>.Empty)
            .SortByDescending(x => x.Numero)
            .ToListAsync(cancellationToken);

    public async Task<FollowUpCelularData?> ObterAsync(string id, CancellationToken cancellationToken = default)
    {
        if (!ObjectId.TryParse(id, out _))
            return null;

        return await _collection.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<FollowUpCelularData> InserirAsync(FollowUpCelularData doc, CancellationToken cancellationToken = default)
    {
        await _collection.InsertOneAsync(doc, cancellationToken: cancellationToken);
        return doc;
    }

    public async Task SalvarAsync(FollowUpCelularData doc, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(doc.Id))
            throw new ArgumentException("Follow-up sem identificador.");

        await _collection.ReplaceOneAsync(x => x.Id == doc.Id, doc, cancellationToken: cancellationToken);
    }
}
