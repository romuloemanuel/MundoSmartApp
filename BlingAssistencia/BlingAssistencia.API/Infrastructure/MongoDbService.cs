using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Infrastructure;

/// <summary>Cliente e database Mongo compartilhados (uma conexão por processo).</summary>
public sealed class MongoDbService
{
    private readonly IMongoClient _client;

    public IMongoDatabase Database { get; }

    public MongoDbService(IOptions<MongoSettings> settings)
    {
        _client = new MongoClient(settings.Value.ConnectionString);
        Database = _client.GetDatabase(settings.Value.DatabaseName);
    }

    public IMongoCollection<T> GetCollection<T>(string name) =>
        Database.GetCollection<T>(name);

    public async Task WarmupAsync(CancellationToken cancellationToken = default)
    {
        await Database.RunCommandAsync<BsonDocument>(
            new BsonDocument("ping", 1),
            cancellationToken: cancellationToken);
    }
}
