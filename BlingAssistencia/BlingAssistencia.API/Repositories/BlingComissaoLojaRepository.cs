using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingComissaoLojaRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<BlingComissaoLojaData>> ListarAsync(string de, string ate, CancellationToken cancellationToken = default);
    Task<BlingComissaoLojaData?> ObterAsync(long pedidoId, long itemId, CancellationToken cancellationToken = default);
    Task<BlingComissaoLojaData> SalvarAsync(BlingComissaoLojaData doc, CancellationToken cancellationToken = default);
    Task MarcarPedidoExcluidoAsync(long pedidoId, CancellationToken cancellationToken = default);
    Task SubstituirJanelaAsync(string de, string ate, IReadOnlyList<BlingComissaoLojaData> linhas, CancellationToken cancellationToken = default);
    Task<DateTime?> UltimaAtualizacaoAsync(CancellationToken cancellationToken = default);
}

public sealed class BlingComissaoLojaRepository : IBlingComissaoLojaRepository
{
    private readonly IMongoCollection<BlingComissaoLojaData> _col;

    public BlingComissaoLojaRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<BlingComissaoLojaData>("bling_comissao_loja");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingComissaoLojaData>(
                Builders<BlingComissaoLojaData>.IndexKeys.Ascending(x => x.Data),
                new CreateIndexOptions { Name = "data" }),
            cancellationToken: cancellationToken);
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingComissaoLojaData>(
                Builders<BlingComissaoLojaData>.IndexKeys
                    .Ascending(x => x.BlingPedidoId)
                    .Ascending(x => x.BlingItemId),
                new CreateIndexOptions { Name = "pedido_item" }),
            cancellationToken: cancellationToken);
    }

    public Task<List<BlingComissaoLojaData>> ListarAsync(string de, string ate, CancellationToken cancellationToken = default)
    {
        var filtro = Builders<BlingComissaoLojaData>.Filter.Gte(x => x.Data, de)
            & Builders<BlingComissaoLojaData>.Filter.Lte(x => x.Data, ate);
        return _col.Find(filtro).ToListAsync(cancellationToken);
    }

    public async Task<BlingComissaoLojaData?> ObterAsync(long pedidoId, long itemId, CancellationToken cancellationToken = default) =>
        await _col.Find(x => x.BlingPedidoId == pedidoId && x.BlingItemId == itemId)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<BlingComissaoLojaData> SalvarAsync(BlingComissaoLojaData doc, CancellationToken cancellationToken = default)
    {
        doc.AtualizadoEm = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(doc.Id))
        {
            await _col.InsertOneAsync(doc, cancellationToken: cancellationToken);
            return doc;
        }

        await _col.ReplaceOneAsync(x => x.Id == doc.Id, doc, cancellationToken: cancellationToken);
        return doc;
    }

    public Task MarcarPedidoExcluidoAsync(long pedidoId, CancellationToken cancellationToken = default) =>
        _col.UpdateManyAsync(
            x => x.BlingPedidoId == pedidoId,
            Builders<BlingComissaoLojaData>.Update
                .Set(x => x.Excluida, true)
                .Set(x => x.AtualizadoEm, DateTime.UtcNow),
            cancellationToken: cancellationToken);

    public async Task SubstituirJanelaAsync(
        string de,
        string ate,
        IReadOnlyList<BlingComissaoLojaData> linhas,
        CancellationToken cancellationToken = default)
    {
        var atuais = await ListarAsync(de, ate, cancellationToken);
        var mapa = atuais.ToDictionary(x => (x.BlingPedidoId, x.BlingItemId));
        foreach (var linha in linhas)
        {
            linha.CustoOrigem = linha.Custo;
            if (!mapa.TryGetValue((linha.BlingPedidoId, linha.BlingItemId), out var anterior))
                continue;
            linha.Excluida = linha.Excluida || anterior.Excluida;
            linha.CustoEditado = anterior.CustoEditado;
            if (anterior.CustoEditado)
                linha.Custo = anterior.Custo;
        }

        var filtro = Builders<BlingComissaoLojaData>.Filter.Gte(x => x.Data, de)
            & Builders<BlingComissaoLojaData>.Filter.Lte(x => x.Data, ate);
        await _col.DeleteManyAsync(filtro, cancellationToken);
        if (linhas.Count > 0)
            await _col.InsertManyAsync(linhas, cancellationToken: cancellationToken);
    }

    public async Task<DateTime?> UltimaAtualizacaoAsync(CancellationToken cancellationToken = default)
    {
        var ultimo = await _col.Find(FilterDefinition<BlingComissaoLojaData>.Empty)
            .SortByDescending(x => x.AtualizadoEm)
            .Limit(1)
            .FirstOrDefaultAsync(cancellationToken);
        return ultimo?.AtualizadoEm;
    }
}
