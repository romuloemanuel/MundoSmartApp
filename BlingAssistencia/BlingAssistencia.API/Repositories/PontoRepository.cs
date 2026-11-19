using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IPontoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PontoAparelhoData>> ListarAparelhosAsync(CancellationToken cancellationToken = default);
    Task<int> ContarAtivosAsync(CancellationToken cancellationToken = default);
    Task<PontoAparelhoData?> ObterAparelhoPorIdAsync(string id, CancellationToken cancellationToken = default);
    Task<PontoAparelhoData?> ObterAtivoPorTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);
    Task InserirAparelhoAsync(PontoAparelhoData aparelho, CancellationToken cancellationToken = default);
    Task RevogarAparelhoAsync(string id, string revogadoPorNome, DateTime quando, CancellationToken cancellationToken = default);
    Task<PontoSenhaDiaData?> ObterSenhaDoDiaAsync(DateTime dia, CancellationToken cancellationToken = default);
    Task SubstituirSenhaDoDiaAsync(PontoSenhaDiaData senha, CancellationToken cancellationToken = default);
    Task InserirBatidaAsync(PontoBatidaData batida, CancellationToken cancellationToken = default);
    Task AtualizarBatidaAsync(PontoBatidaData batida, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PontoBatidaData>> ListarBatidasDoDiaAsync(DateTime dia, CancellationToken cancellationToken = default);
}

public class PontoRepository : IPontoRepository
{
    private readonly IMongoCollection<PontoAparelhoData> _aparelhos;
    private readonly IMongoCollection<PontoSenhaDiaData> _senhas;
    private readonly IMongoCollection<PontoBatidaData> _batidas;

    public PontoRepository(MongoDbService mongo)
    {
        _aparelhos = mongo.GetCollection<PontoAparelhoData>("ponto_aparelhos");
        _senhas = mongo.GetCollection<PontoSenhaDiaData>("ponto_senhas_dia");
        _batidas = mongo.GetCollection<PontoBatidaData>("ponto_batidas");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _aparelhos.Indexes.CreateOneAsync(
            new CreateIndexModel<PontoAparelhoData>(
                Builders<PontoAparelhoData>.IndexKeys.Ascending(x => x.TokenHash)),
            cancellationToken: cancellationToken);
        await _senhas.Indexes.CreateOneAsync(
            new CreateIndexModel<PontoSenhaDiaData>(
                Builders<PontoSenhaDiaData>.IndexKeys.Ascending(x => x.Dia),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _batidas.Indexes.CreateOneAsync(
            new CreateIndexModel<PontoBatidaData>(
                Builders<PontoBatidaData>.IndexKeys
                    .Ascending(x => x.Dia)
                    .Ascending(x => x.UsuarioId)
                    .Ascending(x => x.Horario)),
            cancellationToken: cancellationToken);
    }

    public async Task<IReadOnlyList<PontoAparelhoData>> ListarAparelhosAsync(CancellationToken cancellationToken = default) =>
        await _aparelhos.Find(_ => true).SortByDescending(x => x.LiberadoEm).ToListAsync(cancellationToken);

    public async Task<int> ContarAtivosAsync(CancellationToken cancellationToken = default)
    {
        var n = await _aparelhos.CountDocumentsAsync(x => x.RevogadoEm == null, cancellationToken: cancellationToken);
        return (int)n;
    }

    public async Task<PontoAparelhoData?> ObterAparelhoPorIdAsync(string id, CancellationToken cancellationToken = default) =>
        await _aparelhos.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);

    public async Task<PontoAparelhoData?> ObterAtivoPorTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default) =>
        await _aparelhos.Find(x => x.TokenHash == tokenHash && x.RevogadoEm == null).FirstOrDefaultAsync(cancellationToken);

    public Task InserirAparelhoAsync(PontoAparelhoData aparelho, CancellationToken cancellationToken = default) =>
        _aparelhos.InsertOneAsync(aparelho, cancellationToken: cancellationToken);

    public async Task RevogarAparelhoAsync(string id, string revogadoPorNome, DateTime quando, CancellationToken cancellationToken = default)
    {
        var upd = Builders<PontoAparelhoData>.Update
            .Set(x => x.RevogadoEm, quando)
            .Set(x => x.RevogadoPorNome, revogadoPorNome);
        await _aparelhos.UpdateOneAsync(x => x.Id == id && x.RevogadoEm == null, upd, cancellationToken: cancellationToken);
    }

    public async Task<PontoSenhaDiaData?> ObterSenhaDoDiaAsync(DateTime dia, CancellationToken cancellationToken = default) =>
        await _senhas.Find(x => x.Dia == dia).FirstOrDefaultAsync(cancellationToken);

    public async Task SubstituirSenhaDoDiaAsync(PontoSenhaDiaData senha, CancellationToken cancellationToken = default)
    {
        await _senhas.ReplaceOneAsync(
            x => x.Dia == senha.Dia,
            senha,
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);
    }

    public Task InserirBatidaAsync(PontoBatidaData batida, CancellationToken cancellationToken = default) =>
        _batidas.InsertOneAsync(batida, cancellationToken: cancellationToken);

    public Task AtualizarBatidaAsync(PontoBatidaData batida, CancellationToken cancellationToken = default) =>
        _batidas.ReplaceOneAsync(x => x.Id == batida.Id, batida, cancellationToken: cancellationToken);

    public async Task<IReadOnlyList<PontoBatidaData>> ListarBatidasDoDiaAsync(DateTime dia, CancellationToken cancellationToken = default) =>
        await _batidas.Find(x => x.Dia == dia).SortByDescending(x => x.Horario).ToListAsync(cancellationToken);
}
