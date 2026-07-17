using System.Security.Cryptography;
using System.Text;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IRefreshTokenRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task CriarAsync(RefreshTokenData token, CancellationToken cancellationToken = default);
    Task<RefreshTokenData?> ObterPorHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task RevogarAsync(string id, CancellationToken cancellationToken = default);
    Task RevogarTodosDoUsuarioAsync(string usuarioId, CancellationToken cancellationToken = default);
}

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly IMongoCollection<RefreshTokenData> _collection;

    public RefreshTokenRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<RefreshTokenData>("refresh_tokens");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<RefreshTokenData>(
                Builders<RefreshTokenData>.IndexKeys.Ascending(x => x.TokenHash),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);

        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<RefreshTokenData>(
                Builders<RefreshTokenData>.IndexKeys.Ascending(x => x.UsuarioId)),
            cancellationToken: cancellationToken);

        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<RefreshTokenData>(
                Builders<RefreshTokenData>.IndexKeys.Ascending(x => x.ExpiraEm),
                new CreateIndexOptions { ExpireAfter = TimeSpan.Zero }),
            cancellationToken: cancellationToken);
    }

    public Task CriarAsync(RefreshTokenData token, CancellationToken cancellationToken = default)
        => _collection.InsertOneAsync(token, cancellationToken: cancellationToken);

    public async Task<RefreshTokenData?> ObterPorHashAsync(string tokenHash, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tokenHash)) return null;
        return await _collection.Find(x => x.TokenHash == tokenHash).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task RevogarAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id)) return;
        await _collection.UpdateOneAsync(
            x => x.Id == id,
            Builders<RefreshTokenData>.Update.Set(x => x.RevogadoEm, DateTime.UtcNow),
            cancellationToken: cancellationToken);
    }

    public async Task RevogarTodosDoUsuarioAsync(string usuarioId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(usuarioId)) return;
        await _collection.UpdateManyAsync(
            x => x.UsuarioId == usuarioId && x.RevogadoEm == null,
            Builders<RefreshTokenData>.Update.Set(x => x.RevogadoEm, DateTime.UtcNow),
            cancellationToken: cancellationToken);
    }

    public static string GerarTokenOpaco()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string HashToken(string token)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
