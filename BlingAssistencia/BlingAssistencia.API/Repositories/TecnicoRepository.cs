using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface ITecnicoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task GarantirSeedAsync(IEnumerable<string> nomes, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TecnicoData>> ListarAsync(bool? apenasAtivos = null, CancellationToken cancellationToken = default);
    Task<TecnicoData?> ObterAsync(string id, CancellationToken cancellationToken = default);
    Task<TecnicoData?> ObterPorNomeAtivoAsync(string nome, CancellationToken cancellationToken = default);
    Task<TecnicoData> CriarAsync(string nome, CancellationToken cancellationToken = default);
    Task<TecnicoData?> AtualizarAsync(string id, string nome, bool ativo, CancellationToken cancellationToken = default);
    Task<bool> ExcluirAsync(string id, CancellationToken cancellationToken = default);
}

public class TecnicoRepository : ITecnicoRepository
{
    private readonly IMongoCollection<TecnicoData> _collection;

    public TecnicoRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<TecnicoData>("tecnicos");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        var nomeIdx = new CreateIndexModel<TecnicoData>(
            Builders<TecnicoData>.IndexKeys.Ascending(x => x.Nome));
        await _collection.Indexes.CreateOneAsync(nomeIdx, cancellationToken: cancellationToken);
    }

    public async Task GarantirSeedAsync(IEnumerable<string> nomes, CancellationToken cancellationToken = default)
    {
        var existentes = await ListarAsync(cancellationToken: cancellationToken);
        foreach (var nome in nomes)
        {
            var n = nome.Trim();
            if (string.IsNullOrEmpty(n)) continue;

            var existente = existentes.FirstOrDefault(x =>
                string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase));

            if (existente is not null)
            {
                if (!existente.Ativo)
                {
                    existente.Ativo = true;
                    existente.AtualizadoEm = DateTime.UtcNow;
                    await _collection.ReplaceOneAsync(
                        x => x.Id == existente.Id, existente, cancellationToken: cancellationToken);
                }
                continue;
            }

            var doc = new TecnicoData
            {
                Nome = n,
                Ativo = true,
                CriadoEm = DateTime.UtcNow,
            };
            await _collection.InsertOneAsync(doc, cancellationToken: cancellationToken);
            existentes = [.. existentes, doc];
        }
    }

    public async Task<IReadOnlyList<TecnicoData>> ListarAsync(
        bool? apenasAtivos = null,
        CancellationToken cancellationToken = default)
    {
        var filtro = apenasAtivos == true
            ? Builders<TecnicoData>.Filter.Eq(x => x.Ativo, true)
            : FilterDefinition<TecnicoData>.Empty;

        return await _collection.Find(filtro)
            .SortBy(x => x.Nome)
            .ToListAsync(cancellationToken);
    }

    public async Task<TecnicoData?> ObterAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _collection.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<TecnicoData?> ObterPorNomeAtivoAsync(string nome, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(nome)) return null;
        var n = nome.Trim();
        var lista = await ListarAsync(apenasAtivos: true, cancellationToken);
        return lista.FirstOrDefault(x => string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<TecnicoData> CriarAsync(string nome, CancellationToken cancellationToken = default)
    {
        var n = nome.Trim();
        if (string.IsNullOrEmpty(n))
            throw new ArgumentException("Informe o nome do técnico.");

        var existentes = await ListarAsync(cancellationToken: cancellationToken);
        if (existentes.Any(x => string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Já existe um técnico com este nome.");

        var doc = new TecnicoData
        {
            Nome = n,
            Ativo = true,
            CriadoEm = DateTime.UtcNow,
        };
        await _collection.InsertOneAsync(doc, cancellationToken: cancellationToken);
        return doc;
    }

    public async Task<TecnicoData?> AtualizarAsync(
        string id,
        string nome,
        bool ativo,
        CancellationToken cancellationToken = default)
    {
        var doc = await ObterAsync(id, cancellationToken);
        if (doc is null) return null;

        var n = nome.Trim();
        if (string.IsNullOrEmpty(n))
            throw new ArgumentException("Informe o nome do técnico.");

        var existentes = await ListarAsync(cancellationToken: cancellationToken);
        if (existentes.Any(x =>
                x.Id != id && string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Já existe um técnico com este nome.");

        doc.Nome = n;
        doc.Ativo = ativo;
        doc.AtualizadoEm = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(x => x.Id == id, doc, cancellationToken: cancellationToken);
        return doc;
    }

    public async Task<bool> ExcluirAsync(string id, CancellationToken cancellationToken = default)
    {
        var result = await _collection.DeleteOneAsync(x => x.Id == id, cancellationToken);
        return result.DeletedCount > 0;
    }
}
