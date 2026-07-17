using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IUsuarioRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<UsuarioData?> ObterPorUsuarioAsync(string usuario, CancellationToken cancellationToken = default);
    Task<UsuarioData?> ObterPorIdAsync(string id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<UsuarioData>> ListarAsync(CancellationToken cancellationToken = default);
    Task<UsuarioData> CriarAsync(UsuarioData usuario, CancellationToken cancellationToken = default);
    Task<UsuarioData?> AtualizarAsync(UsuarioData usuario, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(string id, CancellationToken cancellationToken = default);
    Task<long> ContarAsync(CancellationToken cancellationToken = default);
}

public class UsuarioRepository : IUsuarioRepository
{
    private readonly IMongoCollection<UsuarioData> _collection;

    public UsuarioRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<UsuarioData>("usuarios");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        var idx = new CreateIndexModel<UsuarioData>(
            Builders<UsuarioData>.IndexKeys.Ascending(x => x.Usuario),
            new CreateIndexOptions { Unique = true });
        await _collection.Indexes.CreateOneAsync(idx, cancellationToken: cancellationToken);
    }

    public async Task<UsuarioData?> ObterPorUsuarioAsync(string usuario, CancellationToken cancellationToken = default)
    {
        var chave = NormalizarUsuario(usuario);
        if (chave.Length == 0) return null;
        return await _collection.Find(x => x.Usuario == chave).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<UsuarioData?> ObterPorIdAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _collection.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UsuarioData>> ListarAsync(CancellationToken cancellationToken = default)
    {
        return await _collection.Find(_ => true)
            .SortBy(x => x.Nome)
            .ToListAsync(cancellationToken);
    }

    public async Task<UsuarioData> CriarAsync(UsuarioData usuario, CancellationToken cancellationToken = default)
    {
        usuario.Usuario = NormalizarUsuario(usuario.Usuario);
        usuario.CriadoEm = DateTime.UtcNow;
        await _collection.InsertOneAsync(usuario, cancellationToken: cancellationToken);
        return usuario;
    }

    public async Task<UsuarioData?> AtualizarAsync(UsuarioData usuario, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(usuario.Id)) return null;
        usuario.Usuario = NormalizarUsuario(usuario.Usuario);
        usuario.AtualizadoEm = DateTime.UtcNow;
        var result = await _collection.ReplaceOneAsync(
            x => x.Id == usuario.Id, usuario, cancellationToken: cancellationToken);
        return result.MatchedCount > 0 ? usuario : null;
    }

    public async Task<bool> ExcluirAsync(string id, CancellationToken cancellationToken = default)
    {
        var result = await _collection.DeleteOneAsync(x => x.Id == id, cancellationToken);
        return result.DeletedCount > 0;
    }

    public Task<long> ContarAsync(CancellationToken cancellationToken = default)
        => _collection.CountDocumentsAsync(_ => true, cancellationToken: cancellationToken);

    public static string NormalizarUsuario(string? usuario)
        => (usuario ?? string.Empty).Trim().ToLowerInvariant();
}
