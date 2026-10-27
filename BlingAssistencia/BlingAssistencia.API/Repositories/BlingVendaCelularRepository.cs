using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IBlingVendaCelularRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task UpsertAsync(BlingVendaCelularData item, CancellationToken cancellationToken = default);
    Task<BlingVendaCelularData?> ObterPorPedidoItemAsync(long pedidoId, long itemId, CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ConsultarAsync(string? cpf, string? imei, CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ListarRecentesAsync(string? termo, int limite, CancellationToken cancellationToken = default);
    Task<BlingVendaCelularData?> ObterPorIdAsync(string id, CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ListarPendentesAsync(CancellationToken cancellationToken = default);
    Task<int> ContarPendentesAsync(CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ListarPorCpfAsync(string cpf, CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ListarPorClienteLocalIdAsync(long clienteLocalId, CancellationToken cancellationToken = default);
    Task<List<BlingVendaCelularData>> ListarSemVinculoAsync(CancellationToken cancellationToken = default);
}

public class BlingVendaCelularRepository : IBlingVendaCelularRepository
{
    private readonly IMongoCollection<BlingVendaCelularData> _col;

    public BlingVendaCelularRepository(MongoDbService mongo)
    {
        _col = mongo.GetCollection<BlingVendaCelularData>("bling_vendas_celulares");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys
                    .Ascending(x => x.BlingPedidoId)
                    .Ascending(x => x.BlingItemId),
                new CreateIndexOptions { Unique = true, Name = "pedido_item_unico" }),
            cancellationToken: cancellationToken);

        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys.Ascending(x => x.Imei),
                new CreateIndexOptions { Name = "imei" }),
            cancellationToken: cancellationToken);

        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys.Ascending(x => x.ClienteCpf),
                new CreateIndexOptions { Name = "cpf" }),
            cancellationToken: cancellationToken);

        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys.Descending(x => x.DataVenda),
                new CreateIndexOptions { Name = "data_venda" }),
            cancellationToken: cancellationToken);

        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys.Ascending(x => x.CadastroPendente),
                new CreateIndexOptions { Name = "cadastro_pendente" }),
            cancellationToken: cancellationToken);

        await _col.Indexes.CreateOneAsync(
            new CreateIndexModel<BlingVendaCelularData>(
                Builders<BlingVendaCelularData>.IndexKeys.Ascending(x => x.ClienteLocalId),
                new CreateIndexOptions { Name = "cliente_local" }),
            cancellationToken: cancellationToken);
    }

    public async Task UpsertAsync(BlingVendaCelularData item, CancellationToken cancellationToken = default)
    {
        item.AtualizadoEm = DateTime.UtcNow;
        var existente = await ObterPorPedidoItemAsync(item.BlingPedidoId, item.BlingItemId, cancellationToken);
        if (existente is null)
        {
            item.ImportadoEm = DateTime.UtcNow;
            await _col.InsertOneAsync(item, cancellationToken: cancellationToken);
            return;
        }

        item.Id = existente.Id;
        item.ImportadoEm = existente.ImportadoEm;
        await _col.ReplaceOneAsync(x => x.Id == existente.Id, item, cancellationToken: cancellationToken);
    }

    public async Task<BlingVendaCelularData?> ObterPorPedidoItemAsync(
        long pedidoId,
        long itemId,
        CancellationToken cancellationToken = default)
    {
        return await _col.Find(x => x.BlingPedidoId == pedidoId && x.BlingItemId == itemId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<List<BlingVendaCelularData>> ConsultarAsync(
        string? cpf,
        string? imei,
        CancellationToken cancellationToken = default)
    {
        var cpfN = NormalizarDoc(cpf);
        var imeiN = NormalizarImei(imei);
        var filtro = Builders<BlingVendaCelularData>.Filter.Empty;

        if (cpfN.Length > 0)
            filtro &= Builders<BlingVendaCelularData>.Filter.Eq(x => x.ClienteCpf, cpfN);
        if (imeiN.Length > 0)
            filtro &= Builders<BlingVendaCelularData>.Filter.Eq(x => x.Imei, imeiN);

        if (cpfN.Length == 0 && imeiN.Length == 0)
            return [];

        return await _col.Find(filtro)
            .SortByDescending(x => x.DataVenda)
            .Limit(50)
            .ToListAsync(cancellationToken);
    }

    public async Task<List<BlingVendaCelularData>> ListarRecentesAsync(
        string? termo,
        int limite,
        CancellationToken cancellationToken = default)
    {
        var lim = Math.Clamp(limite, 1, 200);
        var t = (termo ?? "").Trim();
        var filtro = Builders<BlingVendaCelularData>.Filter.Empty;
        if (t.Length > 0)
        {
            var digitos = new string(t.Where(char.IsDigit).ToArray());
            var rx = new MongoDB.Bson.BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(t), "i");
            var or = new List<FilterDefinition<BlingVendaCelularData>>
            {
                Builders<BlingVendaCelularData>.Filter.Regex(x => x.ClienteNome, rx),
                Builders<BlingVendaCelularData>.Filter.Regex(x => x.ProdutoNome, rx),
                Builders<BlingVendaCelularData>.Filter.Regex(x => x.PedidoNumero, rx),
            };
            if (digitos.Length >= 4)
            {
                or.Add(Builders<BlingVendaCelularData>.Filter.Regex(x => x.Imei, digitos));
                or.Add(Builders<BlingVendaCelularData>.Filter.Regex(x => x.ClienteCpf, digitos));
            }
            filtro = Builders<BlingVendaCelularData>.Filter.Or(or);
        }

        return await _col.Find(filtro)
            .SortByDescending(x => x.DataVenda)
            .Limit(lim)
            .ToListAsync(cancellationToken);
    }

    public async Task<BlingVendaCelularData?> ObterPorIdAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _col.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);
    }

    public Task<List<BlingVendaCelularData>> ListarPendentesAsync(CancellationToken cancellationToken = default) =>
        _col.Find(x => x.CadastroPendente)
            .SortByDescending(x => x.DataVenda)
            .Limit(300)
            .ToListAsync(cancellationToken);

    public async Task<int> ContarPendentesAsync(CancellationToken cancellationToken = default)
    {
        var n = await _col.CountDocumentsAsync(x => x.CadastroPendente, cancellationToken: cancellationToken);
        return (int)n;
    }

    public Task<List<BlingVendaCelularData>> ListarPorCpfAsync(string cpf, CancellationToken cancellationToken = default)
    {
        var cpfN = NormalizarDoc(cpf);
        if (cpfN.Length == 0)
            return Task.FromResult(new List<BlingVendaCelularData>());
        return _col.Find(x => x.ClienteCpf == cpfN)
            .SortByDescending(x => x.DataVenda)
            .ToListAsync(cancellationToken);
    }

    public Task<List<BlingVendaCelularData>> ListarPorClienteLocalIdAsync(
        long clienteLocalId,
        CancellationToken cancellationToken = default) =>
        _col.Find(x => x.ClienteLocalId == clienteLocalId)
            .SortByDescending(x => x.DataVenda)
            .ToListAsync(cancellationToken);

    public Task<List<BlingVendaCelularData>> ListarSemVinculoAsync(CancellationToken cancellationToken = default) =>
        _col.Find(x => x.ClienteLocalId == null)
            .ToListAsync(cancellationToken);

    private static string NormalizarDoc(string? valor) =>
        new string((valor ?? "").Where(char.IsDigit).ToArray());

    private static string NormalizarImei(string? valor)
    {
        var d = new string((valor ?? "").Where(char.IsDigit).ToArray());
        return d.Length > 15 ? d[..15] : d;
    }
}
