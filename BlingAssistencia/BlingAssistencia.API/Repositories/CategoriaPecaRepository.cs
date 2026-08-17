using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface ICategoriaPecaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task GarantirSeedAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CategoriaPecaData>> ListarAsync(CancellationToken cancellationToken = default);
    Task<CategoriaPecaData?> ObterAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> UsaCoresPorModeloAsync(string? nome, CancellationToken cancellationToken = default);
    Task<CategoriaPecaData> CriarAsync(string nome, bool usaCoresPorModelo, int? ordem = null, CancellationToken cancellationToken = default);
    Task<CategoriaPecaData?> AtualizarAsync(string id, string nome, bool usaCoresPorModelo, int ordem, CancellationToken cancellationToken = default);
    Task ExcluirAsync(string id, CancellationToken cancellationToken = default);
}

public class CategoriaPecaRepository : ICategoriaPecaRepository
{
    public static readonly (string Nome, bool UsaCoresPorModelo)[] Seed =
    [
        ("Bateria", false),
        ("Tela Incell com Aro", false),
        ("Tela Incell", false),
        ("Tela OLED com Aro", false),
        ("Tela OLED", false),
        ("Tampa traseira", true),
        ("Vidro Traseiro", true),
        ("Vidro para Display", false),
        ("Conector de carga", false),
        ("Placa conectora", false),
        ("Lentes", false),
        ("Câmeras", false),
        ("Flex", false),
        ("Tags", false),
        ("Outros", false),
    ];

    private readonly IMongoCollection<CategoriaPecaData> _collection;
    private readonly IPecaEstoqueRepository _pecas;
    private volatile HashSet<string>? _nomesComCores;

    public CategoriaPecaRepository(MongoDbService mongo, IPecaEstoqueRepository pecas)
    {
        _collection = mongo.GetCollection<CategoriaPecaData>("categorias_peca");
        _pecas = pecas;
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<CategoriaPecaData>(
                Builders<CategoriaPecaData>.IndexKeys.Ascending(x => x.Nome),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<CategoriaPecaData>(
                Builders<CategoriaPecaData>.IndexKeys.Ascending(x => x.Ordem)),
            cancellationToken: cancellationToken);
    }

    public async Task GarantirSeedAsync(CancellationToken cancellationToken = default)
    {
        var existentes = await _collection.Find(FilterDefinition<CategoriaPecaData>.Empty)
            .ToListAsync(cancellationToken);
        var ordem = existentes.Count == 0 ? 0 : existentes.Max(x => x.Ordem) + 1;
        foreach (var (nome, usaCores) in Seed)
        {
            if (existentes.Any(x => string.Equals(x.Nome, nome, StringComparison.OrdinalIgnoreCase)))
                continue;

            await _collection.InsertOneAsync(new CategoriaPecaData
            {
                Nome = nome,
                Ordem = ordem++,
                UsaCoresPorModelo = usaCores,
                CriadoEm = DateTime.UtcNow,
            }, cancellationToken: cancellationToken);
        }
        InvalidarCacheCores();
    }

    public async Task<IReadOnlyList<CategoriaPecaData>> ListarAsync(CancellationToken cancellationToken = default)
    {
        var lista = await _collection.Find(FilterDefinition<CategoriaPecaData>.Empty)
            .SortBy(x => x.Ordem)
            .ThenBy(x => x.Nome)
            .ToListAsync(cancellationToken);

        if (lista.Count == 0)
        {
            await GarantirSeedAsync(cancellationToken);
            lista = await _collection.Find(FilterDefinition<CategoriaPecaData>.Empty)
                .SortBy(x => x.Ordem)
                .ThenBy(x => x.Nome)
                .ToListAsync(cancellationToken);
        }

        return lista;
    }

    public async Task<CategoriaPecaData?> ObterAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _collection.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<bool> UsaCoresPorModeloAsync(string? nome, CancellationToken cancellationToken = default)
    {
        var n = nome?.Trim();
        if (string.IsNullOrEmpty(n)) return false;

        var cache = _nomesComCores;
        if (cache is null)
        {
            var lista = await ListarAsync(cancellationToken);
            cache = lista
                .Where(c => c.UsaCoresPorModelo)
                .Select(c => c.Nome)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            _nomesComCores = cache;
        }

        return cache.Contains(n);
    }

    public async Task<CategoriaPecaData> CriarAsync(
        string nome,
        bool usaCoresPorModelo,
        int? ordem = null,
        CancellationToken cancellationToken = default)
    {
        var n = NormalizarNome(nome);
        var existentes = await ListarAsync(cancellationToken);
        if (existentes.Any(x => string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Já existe uma categoria com este nome.");

        var doc = new CategoriaPecaData
        {
            Nome = n,
            Ordem = ordem ?? (existentes.Count == 0 ? 0 : existentes.Max(x => x.Ordem) + 1),
            UsaCoresPorModelo = usaCoresPorModelo,
            CriadoEm = DateTime.UtcNow,
        };
        await _collection.InsertOneAsync(doc, cancellationToken: cancellationToken);
        InvalidarCacheCores();
        return doc;
    }

    public async Task<CategoriaPecaData?> AtualizarAsync(
        string id,
        string nome,
        bool usaCoresPorModelo,
        int ordem,
        CancellationToken cancellationToken = default)
    {
        var doc = await ObterAsync(id, cancellationToken);
        if (doc is null) return null;

        var n = NormalizarNome(nome);
        var existentes = await ListarAsync(cancellationToken);
        if (existentes.Any(x =>
                x.Id != id && string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase)))
            throw new InvalidOperationException("Já existe uma categoria com este nome.");

        var nomeAnterior = doc.Nome;
        doc.Nome = n;
        doc.UsaCoresPorModelo = usaCoresPorModelo;
        doc.Ordem = ordem;
        doc.AtualizadoEm = DateTime.UtcNow;
        await _collection.ReplaceOneAsync(x => x.Id == id, doc, cancellationToken: cancellationToken);

        if (!string.Equals(nomeAnterior, n, StringComparison.OrdinalIgnoreCase))
            await _pecas.RenomearCategoriaAsync(nomeAnterior, n);

        InvalidarCacheCores();
        return doc;
    }

    public async Task ExcluirAsync(string id, CancellationToken cancellationToken = default)
    {
        var doc = await ObterAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Categoria não encontrada.");

        var emUso = await _pecas.ContarPorCategoriaAsync(doc.Nome);
        if (emUso > 0)
            throw new InvalidOperationException(
                $"Não é possível excluir: {emUso} peça(s) usam a categoria \"{doc.Nome}\".");

        await _collection.DeleteOneAsync(x => x.Id == id, cancellationToken);
        InvalidarCacheCores();
    }

    private void InvalidarCacheCores() => _nomesComCores = null;

    private static string NormalizarNome(string nome)
    {
        var n = nome.Trim();
        if (string.IsNullOrEmpty(n))
            throw new ArgumentException("Informe o nome da categoria.");
        return n;
    }
}
