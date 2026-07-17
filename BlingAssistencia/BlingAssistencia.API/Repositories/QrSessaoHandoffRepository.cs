using System.Security.Cryptography;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IQrSessaoHandoffRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task CriarAsync(QrSessaoHandoffData handoff, CancellationToken cancellationToken = default);
    Task<QrSessaoHandoffData?> ConsumirAsync(string codigo, CancellationToken cancellationToken = default);
}

public class QrSessaoHandoffRepository : IQrSessaoHandoffRepository
{
    private readonly IMongoCollection<QrSessaoHandoffData> _collection;

    public QrSessaoHandoffRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<QrSessaoHandoffData>("qr_sessao_handoff");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<QrSessaoHandoffData>(
                Builders<QrSessaoHandoffData>.IndexKeys.Ascending(x => x.Codigo),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);

        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<QrSessaoHandoffData>(
                Builders<QrSessaoHandoffData>.IndexKeys.Ascending(x => x.ExpiraEm),
                new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }),
            cancellationToken: cancellationToken);
    }

    public Task CriarAsync(QrSessaoHandoffData handoff, CancellationToken cancellationToken = default)
        => _collection.InsertOneAsync(handoff, cancellationToken: cancellationToken);

    /// <summary>Marca como usado atomicamente; retorna null se inválido/expirado/já usado.</summary>
    public async Task<QrSessaoHandoffData?> ConsumirAsync(string codigo, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(codigo)) return null;
        var agora = DateTime.UtcNow;
        return await _collection.FindOneAndUpdateAsync(
            x => x.Codigo == codigo.Trim() && x.UsadoEm == null && x.ExpiraEm > agora,
            Builders<QrSessaoHandoffData>.Update.Set(x => x.UsadoEm, agora),
            new FindOneAndUpdateOptions<QrSessaoHandoffData>
            {
                ReturnDocument = ReturnDocument.After,
            },
            cancellationToken);
    }

    public static string GerarCodigo()
    {
        var bytes = RandomNumberGenerator.GetBytes(18);
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
