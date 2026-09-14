using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IDocumentoModeloRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task GarantirSeedAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DocumentoVariavelTipoInfo>> ListarTiposVariavel();
    Task<IReadOnlyList<DocumentoVariavelCatalogoData>> ListarCatalogoAsync(CancellationToken cancellationToken = default);
    Task<DocumentoVariavelCatalogoData> CriarCatalogoAsync(DocumentoVariavelCatalogoData item, CancellationToken cancellationToken = default);
    Task<DocumentoVariavelCatalogoData?> AtualizarCatalogoAsync(string id, DocumentoVariavelCatalogoData item, CancellationToken cancellationToken = default);
    Task ExcluirCatalogoAsync(string id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<DocumentoModeloData>> ListarModelosAsync(bool somenteAtivos, CancellationToken cancellationToken = default);
    Task<DocumentoModeloData?> ObterModeloAsync(string id, CancellationToken cancellationToken = default);
    Task<DocumentoModeloData> CriarModeloAsync(DocumentoModeloData item, CancellationToken cancellationToken = default);
    Task<DocumentoModeloData?> AtualizarModeloAsync(string id, DocumentoModeloData item, CancellationToken cancellationToken = default);
    Task ExcluirModeloAsync(string id, CancellationToken cancellationToken = default);
}

public class DocumentoModeloRepository : IDocumentoModeloRepository
{
    private readonly IMongoCollection<DocumentoVariavelCatalogoData> _catalogo;
    private readonly IMongoCollection<DocumentoModeloData> _modelos;

    public DocumentoModeloRepository(MongoDbService mongo)
    {
        _catalogo = mongo.GetCollection<DocumentoVariavelCatalogoData>("documento_variaveis");
        _modelos = mongo.GetCollection<DocumentoModeloData>("documento_modelos");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _catalogo.Indexes.CreateOneAsync(
            new CreateIndexModel<DocumentoVariavelCatalogoData>(
                Builders<DocumentoVariavelCatalogoData>.IndexKeys.Ascending(x => x.Chave),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _catalogo.Indexes.CreateOneAsync(
            new CreateIndexModel<DocumentoVariavelCatalogoData>(
                Builders<DocumentoVariavelCatalogoData>.IndexKeys.Ascending(x => x.Ordem)),
            cancellationToken: cancellationToken);
        await _modelos.Indexes.CreateOneAsync(
            new CreateIndexModel<DocumentoModeloData>(
                Builders<DocumentoModeloData>.IndexKeys.Ascending(x => x.Codigo),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _modelos.Indexes.CreateOneAsync(
            new CreateIndexModel<DocumentoModeloData>(
                Builders<DocumentoModeloData>.IndexKeys.Ascending(x => x.Tipo).Ascending(x => x.Ordem)),
            cancellationToken: cancellationToken);
    }

    public async Task GarantirSeedAsync(CancellationToken cancellationToken = default)
    {
        var varsExistentes = await _catalogo.Find(FilterDefinition<DocumentoVariavelCatalogoData>.Empty)
            .ToListAsync(cancellationToken);
        var ordemVar = varsExistentes.Count == 0 ? 1 : varsExistentes.Max(x => x.Ordem) + 1;
        foreach (var (chave, rotulo, tipo) in DocumentoModeloSeed.Variaveis)
        {
            var existenteVar = varsExistentes.FirstOrDefault(x =>
                string.Equals(x.Chave, chave, StringComparison.OrdinalIgnoreCase));
            if (existenteVar is null)
            {
                await _catalogo.InsertOneAsync(new DocumentoVariavelCatalogoData
                {
                    Chave = chave,
                    Rotulo = rotulo,
                    Tipo = tipo,
                    Ordem = ordemVar++,
                    CriadoEm = DateTime.UtcNow,
                }, cancellationToken: cancellationToken);
                continue;
            }

            if (string.Equals(existenteVar.Tipo, tipo, StringComparison.OrdinalIgnoreCase)
                && string.Equals(existenteVar.Rotulo, rotulo, StringComparison.OrdinalIgnoreCase))
                continue;

            await _catalogo.UpdateOneAsync(
                x => x.Id == existenteVar.Id,
                Builders<DocumentoVariavelCatalogoData>.Update
                    .Set(x => x.Tipo, tipo)
                    .Set(x => x.Rotulo, rotulo)
                    .Set(x => x.AtualizadoEm, DateTime.UtcNow),
                cancellationToken: cancellationToken);
        }

        var modelosExistentes = await _modelos.Find(FilterDefinition<DocumentoModeloData>.Empty)
            .ToListAsync(cancellationToken);
        foreach (var seed in DocumentoModeloSeed.Modelos())
        {
            var seedNorm = DocumentoChave.Normalizar(seed.Codigo);
            var iguais = modelosExistentes
                .Where(x => string.Equals(
                    DocumentoChave.Normalizar(x.Codigo),
                    seedNorm,
                    StringComparison.OrdinalIgnoreCase))
                .ToList();
            var existente = iguais.FirstOrDefault(x =>
                    string.Equals(x.Codigo, seed.Codigo, StringComparison.OrdinalIgnoreCase))
                ?? iguais.FirstOrDefault();

            foreach (var extra in iguais.Where(x => x.Id != existente?.Id))
            {
                await _modelos.DeleteOneAsync(x => x.Id == extra.Id, cancellationToken);
                modelosExistentes.Remove(extra);
            }

            if (existente is null)
            {
                seed.CriadoEm = DateTime.UtcNow;
                await _modelos.InsertOneAsync(seed, cancellationToken: cancellationToken);
                modelosExistentes.Add(seed);
                continue;
            }

            if (!DocumentoModeloSeed.CodigosSincronizar.Contains(seed.Codigo, StringComparer.OrdinalIgnoreCase))
                continue;

            await _modelos.UpdateOneAsync(
                x => x.Id == existente.Id,
                Builders<DocumentoModeloData>.Update
                    .Set(x => x.Codigo, seed.Codigo)
                    .Set(x => x.Tipo, seed.Tipo)
                    .Set(x => x.Titulo, seed.Titulo)
                    .Set(x => x.Corpo, seed.Corpo)
                    .Set(x => x.Ativo, seed.Ativo)
                    .Set(x => x.ImprimirDuasVias, seed.ImprimirDuasVias)
                    .Set(x => x.Ordem, seed.Ordem)
                    .Set(x => x.Variaveis, seed.Variaveis)
                    .Set(x => x.AtualizadoEm, DateTime.UtcNow),
                cancellationToken: cancellationToken);
            existente.Codigo = seed.Codigo;
        }
    }

    public Task<IReadOnlyList<DocumentoVariavelTipoInfo>> ListarTiposVariavel() =>
        Task.FromResult<IReadOnlyList<DocumentoVariavelTipoInfo>>(DocumentoVariavelTipos.Todos);

    public async Task<IReadOnlyList<DocumentoVariavelCatalogoData>> ListarCatalogoAsync(CancellationToken cancellationToken = default)
    {
        var lista = await _catalogo.Find(FilterDefinition<DocumentoVariavelCatalogoData>.Empty)
            .SortBy(x => x.Ordem).ThenBy(x => x.Rotulo)
            .ToListAsync(cancellationToken);
        return lista;
    }

    public async Task<DocumentoVariavelCatalogoData> CriarCatalogoAsync(
        DocumentoVariavelCatalogoData item,
        CancellationToken cancellationToken = default)
    {
        item = NormalizarCatalogo(item);
        await GarantirChaveCatalogoUnica(item.Chave, null, cancellationToken);
        var max = await _catalogo.Find(FilterDefinition<DocumentoVariavelCatalogoData>.Empty)
            .SortByDescending(x => x.Ordem).Limit(1).FirstOrDefaultAsync(cancellationToken);
        if (item.Ordem <= 0)
            item.Ordem = (max?.Ordem ?? 0) + 1;
        item.CriadoEm = DateTime.UtcNow;
        await _catalogo.InsertOneAsync(item, cancellationToken: cancellationToken);
        return item;
    }

    public async Task<DocumentoVariavelCatalogoData?> AtualizarCatalogoAsync(
        string id,
        DocumentoVariavelCatalogoData item,
        CancellationToken cancellationToken = default)
    {
        item = NormalizarCatalogo(item);
        await GarantirChaveCatalogoUnica(item.Chave, id, cancellationToken);
        var update = Builders<DocumentoVariavelCatalogoData>.Update
            .Set(x => x.Chave, item.Chave)
            .Set(x => x.Rotulo, item.Rotulo)
            .Set(x => x.Tipo, item.Tipo)
            .Set(x => x.Ordem, item.Ordem)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);
        var opts = new FindOneAndUpdateOptions<DocumentoVariavelCatalogoData>
        {
            ReturnDocument = ReturnDocument.After,
        };
        return await _catalogo.FindOneAndUpdateAsync(x => x.Id == id, update, opts, cancellationToken);
    }

    public async Task ExcluirCatalogoAsync(string id, CancellationToken cancellationToken = default)
    {
        var res = await _catalogo.DeleteOneAsync(x => x.Id == id, cancellationToken);
        if (res.DeletedCount == 0)
            throw new KeyNotFoundException("Variável não encontrada.");
    }

    public async Task<IReadOnlyList<DocumentoModeloData>> ListarModelosAsync(
        bool somenteAtivos,
        CancellationToken cancellationToken = default)
    {
        var filtro = somenteAtivos
            ? Builders<DocumentoModeloData>.Filter.Eq(x => x.Ativo, true)
            : FilterDefinition<DocumentoModeloData>.Empty;
        var lista = await _modelos.Find(filtro)
            .SortBy(x => x.Ordem).ThenBy(x => x.Titulo)
            .ToListAsync(cancellationToken);
        return lista;
    }

    public async Task<DocumentoModeloData?> ObterModeloAsync(string id, CancellationToken cancellationToken = default) =>
        await _modelos.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken);

    public async Task<DocumentoModeloData> CriarModeloAsync(
        DocumentoModeloData item,
        CancellationToken cancellationToken = default)
    {
        item = NormalizarModelo(item, gerarCodigo: true);
        await GarantirCodigoUnico(item.Codigo, null, cancellationToken);
        var max = await _modelos.Find(FilterDefinition<DocumentoModeloData>.Empty)
            .SortByDescending(x => x.Ordem).Limit(1).FirstOrDefaultAsync(cancellationToken);
        if (item.Ordem <= 0)
            item.Ordem = (max?.Ordem ?? 0) + 1;
        item.CriadoEm = DateTime.UtcNow;
        await _modelos.InsertOneAsync(item, cancellationToken: cancellationToken);
        return item;
    }

    public async Task<DocumentoModeloData?> AtualizarModeloAsync(
        string id,
        DocumentoModeloData item,
        CancellationToken cancellationToken = default)
    {
        var existente = await ObterModeloAsync(id, cancellationToken);
        if (existente is null) return null;

        item = NormalizarModelo(item, gerarCodigo: false);
        if (string.IsNullOrWhiteSpace(item.Codigo))
            item.Codigo = existente.Codigo;
        await GarantirCodigoUnico(item.Codigo, id, cancellationToken);

        var update = Builders<DocumentoModeloData>.Update
            .Set(x => x.Codigo, item.Codigo)
            .Set(x => x.Tipo, item.Tipo)
            .Set(x => x.Titulo, item.Titulo)
            .Set(x => x.Corpo, item.Corpo)
            .Set(x => x.Ativo, item.Ativo)
            .Set(x => x.ImprimirDuasVias, item.ImprimirDuasVias)
            .Set(x => x.Ordem, item.Ordem > 0 ? item.Ordem : existente.Ordem)
            .Set(x => x.Variaveis, item.Variaveis)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);
        var opts = new FindOneAndUpdateOptions<DocumentoModeloData>
        {
            ReturnDocument = ReturnDocument.After,
        };
        return await _modelos.FindOneAndUpdateAsync(x => x.Id == id, update, opts, cancellationToken);
    }

    public async Task ExcluirModeloAsync(string id, CancellationToken cancellationToken = default)
    {
        var res = await _modelos.DeleteOneAsync(x => x.Id == id, cancellationToken);
        if (res.DeletedCount == 0)
            throw new KeyNotFoundException("Modelo não encontrado.");
    }

    private static DocumentoVariavelCatalogoData NormalizarCatalogo(DocumentoVariavelCatalogoData item)
    {
        var chave = DocumentoChave.Normalizar(item.Chave);
        if (!DocumentoChave.EhValida(chave))
            throw new ArgumentException("Informe uma chave válida (letras, números e underline, começando com letra).");
        var rotulo = (item.Rotulo ?? "").Trim();
        if (string.IsNullOrWhiteSpace(rotulo))
            throw new ArgumentException("Informe o rótulo da variável.");
        return new DocumentoVariavelCatalogoData
        {
            Id = item.Id,
            Chave = chave,
            Rotulo = rotulo,
            Tipo = DocumentoVariavelTipos.Normalizar(item.Tipo),
            Ordem = item.Ordem,
        };
    }

    private static DocumentoModeloData NormalizarModelo(DocumentoModeloData item, bool gerarCodigo)
    {
        var titulo = (item.Titulo ?? "").Trim();
        if (string.IsNullOrWhiteSpace(titulo))
            throw new ArgumentException("Informe o título do documento.");
        var corpo = item.Corpo ?? "";
        if (string.IsNullOrWhiteSpace(corpo))
            throw new ArgumentException("Informe o texto do documento.");

        var codigo = DocumentoChave.Normalizar(item.Codigo);
        if (gerarCodigo && string.IsNullOrWhiteSpace(codigo))
            codigo = DocumentoChave.Normalizar(titulo) + "_" + ObjectId.GenerateNewId().ToString()[^6..];
        if (string.IsNullOrWhiteSpace(codigo))
            throw new ArgumentException("Informe um código para o modelo.");

        var vars = (item.Variaveis ?? [])
            .Select(NormalizarVarModelo)
            .GroupBy(v => v.Chave, StringComparer.OrdinalIgnoreCase)
            .Select(g => g.First())
            .OrderBy(v => v.Ordem)
            .ToList();
        for (var i = 0; i < vars.Count; i++)
            vars[i].Ordem = i + 1;

        return new DocumentoModeloData
        {
            Id = item.Id,
            Codigo = codigo,
            Tipo = DocumentoTipos.Normalizar(item.Tipo),
            Titulo = titulo,
            Corpo = corpo.TrimEnd(),
            Ativo = item.Ativo,
            ImprimirDuasVias = item.ImprimirDuasVias,
            Ordem = item.Ordem,
            Variaveis = vars,
        };
    }

    private static DocumentoVariavelDef NormalizarVarModelo(DocumentoVariavelDef item)
    {
        var chave = DocumentoChave.Normalizar(item.Chave);
        if (!DocumentoChave.EhValida(chave))
            throw new ArgumentException("Há variável com chave inválida.");
        var rotulo = (item.Rotulo ?? "").Trim();
        if (string.IsNullOrWhiteSpace(rotulo))
            rotulo = chave;
        return new DocumentoVariavelDef
        {
            Chave = chave,
            Rotulo = rotulo,
            Tipo = DocumentoVariavelTipos.Normalizar(item.Tipo),
            Obrigatoria = item.Obrigatoria,
            Oculta = item.Oculta,
            Ordem = item.Ordem,
        };
    }

    private async Task GarantirChaveCatalogoUnica(string chave, string? idAtual, CancellationToken cancellationToken)
    {
        var filtro = Builders<DocumentoVariavelCatalogoData>.Filter.Regex(
            x => x.Chave,
            new MongoDB.Bson.BsonRegularExpression($"^{RegexEscape(chave)}$", "i"));
        var outro = await _catalogo.Find(filtro).FirstOrDefaultAsync(cancellationToken);
        if (outro is not null && outro.Id != idAtual)
            throw new InvalidOperationException("Já existe uma variável com essa chave.");
    }

    private async Task GarantirCodigoUnico(string codigo, string? idAtual, CancellationToken cancellationToken)
    {
        var filtro = Builders<DocumentoModeloData>.Filter.Regex(
            x => x.Codigo,
            new MongoDB.Bson.BsonRegularExpression($"^{RegexEscape(codigo)}$", "i"));
        var outro = await _modelos.Find(filtro).FirstOrDefaultAsync(cancellationToken);
        if (outro is not null && outro.Id != idAtual)
            throw new InvalidOperationException("Já existe um modelo com esse código.");
    }

    private static string RegexEscape(string valor) =>
        System.Text.RegularExpressions.Regex.Escape(valor);
}
