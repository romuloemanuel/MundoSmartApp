using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingConfigRepository
{
    Task<BlingConfigData?> ObterAsync(CancellationToken cancellationToken = default);
    Task SalvarAsync(BlingConfigData dados, CancellationToken cancellationToken = default);
}

public class BlingConfigRepository : IBlingConfigRepository
{
    private const string DocumentoId = "bling";
    private readonly IMongoCollection<BlingConfigData> _collection;

    public BlingConfigRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<BlingConfigData>("bling_config");
    }

    public async Task<BlingConfigData?> ObterAsync(CancellationToken cancellationToken = default)
        => await _collection.Find(x => x.Id == DocumentoId).FirstOrDefaultAsync(cancellationToken);

    public async Task SalvarAsync(BlingConfigData dados, CancellationToken cancellationToken = default)
    {
        dados.Id = DocumentoId;
        dados.AtualizadoEm = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(
            x => x.Id == DocumentoId,
            dados,
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);
    }
}
