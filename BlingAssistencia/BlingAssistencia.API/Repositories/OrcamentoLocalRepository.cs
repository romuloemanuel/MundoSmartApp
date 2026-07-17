using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IOrcamentoLocalRepository
{
    Task<OrcamentoLocalData?> ObterPorBlingIdAsync(long blingId);
    Task<List<OrcamentoLocalData>> ListarAsync(string? situacao = null);
    Task SalvarAsync(OrcamentoLocalData dados);
}

public class OrcamentoLocalRepository : IOrcamentoLocalRepository
{
    private readonly IMongoCollection<OrcamentoLocalData> _collection;

    public OrcamentoLocalRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<OrcamentoLocalData>("orcamento_local_data");

        _collection.Indexes.CreateOne(new CreateIndexModel<OrcamentoLocalData>(
            Builders<OrcamentoLocalData>.IndexKeys.Ascending(x => x.BlingId),
            new CreateIndexOptions { Unique = true }));
    }

    public async Task<OrcamentoLocalData?> ObterPorBlingIdAsync(long blingId) =>
        await _collection.Find(x => x.BlingId == blingId).FirstOrDefaultAsync();

    public async Task<List<OrcamentoLocalData>> ListarAsync(string? situacao = null)
    {
        var filtro = string.IsNullOrWhiteSpace(situacao)
            ? Builders<OrcamentoLocalData>.Filter.Empty
            : Builders<OrcamentoLocalData>.Filter.Eq(x => x.Situacao, situacao);

        return await _collection.Find(filtro)
            .SortByDescending(x => x.Data)
            .ToListAsync();
    }

    public async Task SalvarAsync(OrcamentoLocalData dados)
    {
        dados.AtualizadoEm = DateTime.UtcNow;

        if (string.IsNullOrWhiteSpace(dados.MongoId))
        {
            var existente = await ObterPorBlingIdAsync(dados.BlingId);
            if (!string.IsNullOrWhiteSpace(existente?.MongoId))
                dados.MongoId = existente.MongoId;
            else if (existente is not null)
                dados.CriadoEm = existente.CriadoEm == default ? DateTime.UtcNow : existente.CriadoEm;
        }

        if (string.IsNullOrWhiteSpace(dados.MongoId))
        {
            dados.MongoId = ObjectId.GenerateNewId().ToString();
            if (dados.CriadoEm == default)
                dados.CriadoEm = DateTime.UtcNow;
            await _collection.InsertOneAsync(dados);
            return;
        }

        var filtro = Builders<OrcamentoLocalData>.Filter.Eq(x => x.MongoId, dados.MongoId);
        await _collection.ReplaceOneAsync(filtro, dados, new ReplaceOptions { IsUpsert = true });
    }
}
