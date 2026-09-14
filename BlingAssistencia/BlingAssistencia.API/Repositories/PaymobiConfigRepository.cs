using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IPaymobiConfigRepository
{
    Task<PaymobiConfigData?> ObterAsync(CancellationToken cancellationToken = default);
    Task SalvarAsync(PaymobiConfigData dados, CancellationToken cancellationToken = default);
}

public class PaymobiConfigRepository : IPaymobiConfigRepository
{
    private const string DocumentoId = "paymobi";
    private readonly IMongoCollection<PaymobiConfigData> _collection;

    public PaymobiConfigRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<PaymobiConfigData>("paymobi_config");
    }

    public async Task<PaymobiConfigData?> ObterAsync(CancellationToken cancellationToken = default)
        => await _collection.Find(x => x.Id == DocumentoId).FirstOrDefaultAsync(cancellationToken);

    public async Task SalvarAsync(PaymobiConfigData dados, CancellationToken cancellationToken = default)
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
