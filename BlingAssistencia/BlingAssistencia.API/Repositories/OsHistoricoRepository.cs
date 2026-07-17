using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public class OsHistoricoConsultaFiltros
{
    public long? OsBlingId { get; set; }
    public string? OsNumero { get; set; }
    public string? Acao { get; set; }
    public string? Usuario { get; set; }
    /// <summary>Filtra pela assistência da OS (campo denormalizado + snapshot legado).</summary>
    public string? LojaOrigem { get; set; }
    public DateTime? DataInicio { get; set; }
    public DateTime? DataFim { get; set; }
    public int Pagina { get; set; } = 1;
    public int TamanhoPagina { get; set; } = 30;
}

public class OsHistoricoConsultaResultado
{
    public List<OsHistoricoVersao> Itens { get; set; } = [];
    public long Total { get; set; }
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
}

public interface IOsHistoricoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<int> ProximaVersaoAsync(long osBlingId);
    Task InserirAsync(OsHistoricoVersao versao);
    Task<List<OsHistoricoVersao>> ListarResumoAsync(long osBlingId);
    Task<OsHistoricoConsultaResultado> ConsultarAsync(OsHistoricoConsultaFiltros filtros);
    Task<OsHistoricoVersao?> ObterAsync(long osBlingId, int versao);
    Task<OsHistoricoVersao?> ObterPorIdAsync(string id);
}

public class OsHistoricoRepository : IOsHistoricoRepository
{
    private readonly IMongoCollection<OsHistoricoVersao> _collection;

    public OsHistoricoRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<OsHistoricoVersao>("os_historico");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsHistoricoVersao>(
                Builders<OsHistoricoVersao>.IndexKeys
                    .Ascending(x => x.OsBlingId)
                    .Descending(x => x.Versao),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);

        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsHistoricoVersao>(
                Builders<OsHistoricoVersao>.IndexKeys.Descending(x => x.CriadoEm)),
            cancellationToken: cancellationToken);
    }

    public async Task<int> ProximaVersaoAsync(long osBlingId)
    {
        var ultima = await _collection
            .Find(x => x.OsBlingId == osBlingId)
            .SortByDescending(x => x.Versao)
            .Limit(1)
            .FirstOrDefaultAsync();
        return (ultima?.Versao ?? 0) + 1;
    }

    public Task InserirAsync(OsHistoricoVersao versao) =>
        _collection.InsertOneAsync(versao);

    public async Task<List<OsHistoricoVersao>> ListarResumoAsync(long osBlingId)
    {
        var projection = Builders<OsHistoricoVersao>.Projection
            .Exclude(x => x.Snapshot);

        return await _collection
            .Find(x => x.OsBlingId == osBlingId)
            .Project<OsHistoricoVersao>(projection)
            .SortByDescending(x => x.Versao)
            .ToListAsync();
    }

    public async Task<OsHistoricoConsultaResultado> ConsultarAsync(OsHistoricoConsultaFiltros filtros)
    {
        var pagina = Math.Max(1, filtros.Pagina);
        var tamanho = Math.Clamp(filtros.TamanhoPagina, 1, 100);
        var filtro = Builders<OsHistoricoVersao>.Filter.Empty;

        if (filtros.OsBlingId is > 0)
            filtro &= Builders<OsHistoricoVersao>.Filter.Eq(x => x.OsBlingId, filtros.OsBlingId.Value);

        if (!string.IsNullOrWhiteSpace(filtros.OsNumero))
        {
            var n = filtros.OsNumero.Trim();
            filtro &= Builders<OsHistoricoVersao>.Filter.Or(
                Builders<OsHistoricoVersao>.Filter.Eq(x => x.OsNumero, n),
                Builders<OsHistoricoVersao>.Filter.Regex(x => x.OsNumero, new MongoDB.Bson.BsonRegularExpression(n, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filtros.Acao))
            filtro &= Builders<OsHistoricoVersao>.Filter.Eq(x => x.Acao, filtros.Acao.Trim().ToLowerInvariant());

        if (!string.IsNullOrWhiteSpace(filtros.Usuario))
        {
            var u = filtros.Usuario.Trim();
            filtro &= Builders<OsHistoricoVersao>.Filter.Or(
                Builders<OsHistoricoVersao>.Filter.Regex(x => x.UsuarioNome, new MongoDB.Bson.BsonRegularExpression(u, "i")),
                Builders<OsHistoricoVersao>.Filter.Regex(x => x.UsuarioId, new MongoDB.Bson.BsonRegularExpression(u, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filtros.LojaOrigem))
        {
            var loja = OsLojaHelper.Normalizar(filtros.LojaOrigem);
            // Campo denormalizado (novos) + snapshot legado (OsLocalData.lojaOrigem).
            var porCampo = Builders<OsHistoricoVersao>.Filter.Eq(x => x.LojaOrigem, loja);
            var porSnapshot = Builders<OsHistoricoVersao>.Filter.Eq("snapshot.lojaOrigem", loja);
            if (loja == OsLojaHelper.Padrao)
            {
                filtro &= Builders<OsHistoricoVersao>.Filter.Or(
                    porCampo,
                    porSnapshot,
                    Builders<OsHistoricoVersao>.Filter.Eq(x => x.LojaOrigem, null),
                    Builders<OsHistoricoVersao>.Filter.Eq(x => x.LojaOrigem, ""),
                    Builders<OsHistoricoVersao>.Filter.Exists(x => x.LojaOrigem, false),
                    Builders<OsHistoricoVersao>.Filter.Eq("snapshot.lojaOrigem", BsonNull.Value),
                    Builders<OsHistoricoVersao>.Filter.Exists("snapshot.lojaOrigem", false));
            }
            else
            {
                filtro &= Builders<OsHistoricoVersao>.Filter.Or(porCampo, porSnapshot);
            }
        }

        if (filtros.DataInicio.HasValue)
            filtro &= Builders<OsHistoricoVersao>.Filter.Gte(x => x.CriadoEm, filtros.DataInicio.Value.ToUniversalTime());

        if (filtros.DataFim.HasValue)
        {
            var fim = filtros.DataFim.Value.Date.AddDays(1).ToUniversalTime();
            filtro &= Builders<OsHistoricoVersao>.Filter.Lt(x => x.CriadoEm, fim);
        }

        var projection = Builders<OsHistoricoVersao>.Projection.Exclude(x => x.Snapshot);
        var total = await _collection.CountDocumentsAsync(filtro);
        var itens = await _collection
            .Find(filtro)
            .Project<OsHistoricoVersao>(projection)
            .SortByDescending(x => x.CriadoEm)
            .Skip((pagina - 1) * tamanho)
            .Limit(tamanho)
            .ToListAsync();

        return new OsHistoricoConsultaResultado
        {
            Itens = itens,
            Total = total,
            Pagina = pagina,
            TamanhoPagina = tamanho,
        };
    }

    public async Task<OsHistoricoVersao?> ObterAsync(long osBlingId, int versao) =>
        await _collection.Find(x => x.OsBlingId == osBlingId && x.Versao == versao)
            .FirstOrDefaultAsync();

    public async Task<OsHistoricoVersao?> ObterPorIdAsync(string id) =>
        await _collection.Find(x => x.Id == id).FirstOrDefaultAsync();
}
