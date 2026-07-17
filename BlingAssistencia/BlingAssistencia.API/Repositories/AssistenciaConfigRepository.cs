using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IAssistenciaConfigRepository
{
    Task<AssistenciaConfigData> ObterAsync(CancellationToken cancellationToken = default);
    Task SalvarAsync(AssistenciaConfigData dados, CancellationToken cancellationToken = default);
}

public class AssistenciaConfigRepository : IAssistenciaConfigRepository
{
    private const string DocumentoId = "assistencia";
    private readonly IMongoCollection<AssistenciaConfigData> _collection;

    public AssistenciaConfigRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<AssistenciaConfigData>("assistencia_config");
    }

    public async Task<AssistenciaConfigData> ObterAsync(CancellationToken cancellationToken = default)
    {
        var doc = await _collection
            .Find(x => x.Id == DocumentoId)
            .FirstOrDefaultAsync(cancellationToken);

        return doc ?? new AssistenciaConfigData { Id = DocumentoId };
    }

    public async Task SalvarAsync(AssistenciaConfigData dados, CancellationToken cancellationToken = default)
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
