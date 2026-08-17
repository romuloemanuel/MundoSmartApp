using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingProdutoAcessorioRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task GarantirSeedAsync();
    Task<List<BlingProdutoAcessorioCache>> BuscarAsync(string categoria, string termo, bool incluirZerados);
    Task UpsertMuitosAsync(IEnumerable<BlingProdutoAcessorioCache> itens);
}

public class BlingProdutoAcessorioRepository : IBlingProdutoAcessorioRepository
{
    private readonly IMongoCollection<BlingProdutoAcessorioCache> _col;

    public BlingProdutoAcessorioRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<BlingProdutoAcessorioCache>("bling_produtos_acessorios");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        var indexes = new[]
        {
            new CreateIndexModel<BlingProdutoAcessorioCache>(
                Builders<BlingProdutoAcessorioCache>.IndexKeys.Ascending(x => x.BlingId),
                new CreateIndexOptions { Unique = true, Sparse = true }),
            new CreateIndexModel<BlingProdutoAcessorioCache>(
                Builders<BlingProdutoAcessorioCache>.IndexKeys
                    .Ascending(x => x.Categoria)
                    .Ascending(x => x.Nome)
                    .Ascending(x => x.Modelo)),
        };
        await _col.Indexes.CreateManyAsync(indexes, cancellationToken);
    }

    public async Task<List<BlingProdutoAcessorioCache>> BuscarAsync(string categoria, string termo, bool incluirZerados)
    {
        var filtro = Builders<BlingProdutoAcessorioCache>.Filter.Eq(x => x.Categoria, categoria);
        if (!incluirZerados)
            filtro &= Builders<BlingProdutoAcessorioCache>.Filter.Gt(x => x.Saldo, 0);

        var t = (termo ?? "").Trim();
        if (t.Length >= 2)
        {
            var rx = new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(t), "i");
            filtro &= Builders<BlingProdutoAcessorioCache>.Filter.Or(
                Builders<BlingProdutoAcessorioCache>.Filter.Regex(x => x.Nome, rx),
                Builders<BlingProdutoAcessorioCache>.Filter.Regex(x => x.NomeBase, rx),
                Builders<BlingProdutoAcessorioCache>.Filter.Regex(x => x.Modelo, rx),
                Builders<BlingProdutoAcessorioCache>.Filter.Regex(x => x.Codigo, rx));
        }

        return await _col.Find(filtro)
            .SortBy(x => x.NomeBase)
            .ThenBy(x => x.Cor)
            .Limit(200)
            .ToListAsync();
    }

    public async Task UpsertMuitosAsync(IEnumerable<BlingProdutoAcessorioCache> itens)
    {
        foreach (var item in itens)
        {
            if (item.BlingId <= 0) continue;
            item.AtualizadoEm = DateTime.UtcNow;
            await _col.ReplaceOneAsync(
                x => x.BlingId == item.BlingId,
                item,
                new ReplaceOptions { IsUpsert = true });
        }
    }

    public async Task GarantirSeedAsync()
    {
        var count = await _col.CountDocumentsAsync(_ => true);
        if (count > 0) return;

        var agora = DateTime.UtcNow;
        long id = -900_001;
        var seed = new List<BlingProdutoAcessorioCache>();

        void Add(string cat, string nomeBase, string modelo, string cor, int saldo, decimal preco)
        {
            var titulo = cat == "termicos" ? nomeBase : $"{nomeBase} {modelo}".Trim();
            seed.Add(new BlingProdutoAcessorioCache
            {
                BlingId = id--,
                Categoria = cat,
                Nome = $"{titulo} {cor}".Trim(),
                NomeBase = titulo,
                Modelo = modelo,
                Cor = cor,
                Saldo = saldo,
                Preco = preco,
                Codigo = $"{cat[..3].ToUpperInvariant()}-{modelo.Replace(" ", "")}-{cor[..2].ToUpperInvariant()}",
                AtualizadoEm = agora,
            });
        }

        foreach (var modelo in new[] { "iPhone 13", "iPhone 15", "Galaxy A54", "Galaxy A15" })
        {
            Add("capinhas", "Capinha Silicone", modelo, "Preto", 8, 29.9m);
            Add("capinhas", "Capinha Silicone", modelo, "Azul", 4, 29.9m);
            Add("capinhas", "Capinha Silicone", modelo, "Transparente", 6, 24.9m);
            Add("capinhas", "Capinha Antishock", modelo, "Preto", 3, 39.9m);
            Add("capinhas", "Capinha Antishock", modelo, "Rosa", 2, 39.9m);
            Add("peliculas", "Película 3D", modelo, "Transparente", 12, 19.9m);
            Add("peliculas", "Película Privacidade", modelo, "Preto", 5, 34.9m);
        }

        Add("termicos", "Garrafa Térmica 500ml", "500ml", "Preto", 7, 89.9m);
        Add("termicos", "Garrafa Térmica 500ml", "500ml", "Branco", 4, 89.9m);
        Add("termicos", "Garrafa Térmica 500ml", "500ml", "Azul", 2, 89.9m);
        Add("termicos", "Garrafa Térmica 887ml", "887ml", "Preto", 3, 129.9m);
        Add("termicos", "Garrafa Térmica 887ml", "887ml", "Verde", 1, 129.9m);
        Add("termicos", "Copo Térmico 473ml", "473ml", "Preto", 6, 79.9m);
        Add("termicos", "Copo Térmico 473ml", "473ml", "Rosa", 3, 79.9m);
        Add("termicos", "Copo Térmico Stanley", "Stanley", "Preto", 4, 199.9m);
        Add("termicos", "Copo Térmico Stanley", "Stanley", "Verde", 2, 199.9m);

        await _col.InsertManyAsync(seed);
    }
}
