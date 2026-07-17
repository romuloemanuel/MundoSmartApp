using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Settings;
using Microsoft.Extensions.Options;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IDevSequenceRepository
{
    Task<long> ProximoAsync(string chave, long inicio = 1);
    /// <summary>Define o último valor usado; o próximo <see cref="ProximoAsync"/> retorna valor + 1.</summary>
    Task SincronizarAsync(string chave, long ultimoValorAtribuido);
}

public class DevSequenceRepository : IDevSequenceRepository
{
    private readonly IMongoCollection<BsonDocument> _collection;

    public DevSequenceRepository(IOptions<MongoSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        var db = client.GetDatabase(settings.Value.DatabaseName);
        _collection = db.GetCollection<BsonDocument>("dev_sequences");
    }

    public async Task<long> ProximoAsync(string chave, long inicio = 1)
    {
        var filtro = Builders<BsonDocument>.Filter.Eq("_id", chave);

        var existente = await _collection.Find(filtro).FirstOrDefaultAsync();
        if (existente is null)
        {
            try
            {
                await _collection.InsertOneAsync(new BsonDocument
                {
                    { "_id", chave },
                    { "seq", inicio }
                });
                return inicio;
            }
            catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
            {
                // outra requisição criou a sequência em paralelo
            }
        }

        var atualizado = await _collection.FindOneAndUpdateAsync(
            filtro,
            Builders<BsonDocument>.Update.Inc("seq", 1),
            new FindOneAndUpdateOptions<BsonDocument> { ReturnDocument = ReturnDocument.After });

        return atualizado!["seq"].AsInt64;
    }

    public async Task SincronizarAsync(string chave, long ultimoValorAtribuido)
    {
        var filtro = Builders<BsonDocument>.Filter.Eq("_id", chave);
        await _collection.UpdateOneAsync(
            filtro,
            Builders<BsonDocument>.Update.Set("seq", ultimoValorAtribuido),
            new UpdateOptions { IsUpsert = true });
    }
}
