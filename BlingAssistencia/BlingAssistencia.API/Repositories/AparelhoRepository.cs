using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;
using System.Text.RegularExpressions;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IAparelhoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<MarcaAparelho>> ListarMarcasAsync(string? termo = null, string? tipoDispositivo = null, int limite = 100);
    Task<MarcaAparelho?> ObterMarcaAsync(string id);
    Task<MarcaAparelho> SalvarMarcaAsync(MarcaAparelho marca);
    Task<MarcaAparelho> SalvarMarcaAsync(string nome, string? tipoDispositivo = null);
    Task<MarcaAparelho?> AtualizarMarcaAsync(string id, MarcaAparelho marca);
    Task<bool> ExcluirMarcaAsync(string id);

    Task<List<ModeloAparelho>> ListarModelosAsync(
        string? termo = null,
        string? marcaId = null,
        string? marcaNome = null,
        string? tipoDispositivo = null,
        int limite = 500);
    Task<ModeloAparelho?> ObterModeloAsync(string id);
    Task<ModeloAparelho> SalvarModeloAsync(ModeloAparelho modelo);
    Task<ModeloAparelho> SalvarModeloAsync(string nome, string? marcaId, string? marcaNome, string? tipoDispositivo = null);
    Task<ModeloAparelho?> AtualizarModeloAsync(string id, ModeloAparelho modelo);
    Task<bool> ExcluirModeloAsync(string id);

    /// <summary>Garante marcas/modelos do CSV Data/modelos_catalogo.csv (nome curto, sem prefixo). Idempotente.</summary>
    Task<(int Criados, int JaExistentes, int Renomeados)> GarantirModelosDoCatalogoAsync();

    /// <summary>
    /// Remove modelos da marca que não estão no CSV (ex.: Realme global → só BR).
    /// Preserva se referenciados em peças, OS ou orçamentos.
    /// </summary>
    Task<(int Removidos, int Preservados)> RemoverModelosForaDoCatalogoAsync(string marcaNome);
}

public class AparelhoRepository : IAparelhoRepository
{
    private readonly MongoDbService _mongo;
    private readonly IMongoCollection<MarcaAparelho> _marcas;
    private readonly IMongoCollection<ModeloAparelho> _modelos;
    private IMongoCollection<PecaEstoque>? _pecasRef;
    private int _indexesReady;

    public AparelhoRepository(MongoDbService mongo)
    {
        _mongo = mongo;
        _marcas = mongo.GetCollection<MarcaAparelho>("marcas_aparelho");
        _modelos = mongo.GetCollection<ModeloAparelho>("modelos_aparelho");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        if (Interlocked.CompareExchange(ref _indexesReady, 1, 0) != 0)
            return;

        await _marcas.Indexes.CreateManyAsync([
            new CreateIndexModel<MarcaAparelho>(
                Builders<MarcaAparelho>.IndexKeys.Ascending(x => x.Nome),
                new CreateIndexOptions { Unique = true, Collation = new Collation("pt", strength: CollationStrength.Secondary) }),
        ], cancellationToken: cancellationToken);

        await _modelos.Indexes.CreateManyAsync([
            new CreateIndexModel<ModeloAparelho>(
                Builders<ModeloAparelho>.IndexKeys.Ascending(x => x.Nome)),
            new CreateIndexModel<ModeloAparelho>(
                Builders<ModeloAparelho>.IndexKeys.Ascending(x => x.MarcaNome)),
            new CreateIndexModel<ModeloAparelho>(
                Builders<ModeloAparelho>.IndexKeys
                    .Ascending(x => x.Nome)
                    .Ascending(x => x.MarcaId)),
        ], cancellationToken: cancellationToken);
    }

    public Task<List<MarcaAparelho>> ListarMarcasAsync(string? termo = null, string? tipoDispositivo = null, int limite = 100)
        => BuscarMarcasInternal(termo, tipoDispositivo, limite);

    public async Task<MarcaAparelho?> ObterMarcaAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _marcas.Find(x => x.Id == id).FirstOrDefaultAsync();
    }

    public async Task<MarcaAparelho> SalvarMarcaAsync(MarcaAparelho marca)
    {
        if (string.IsNullOrWhiteSpace(marca.Nome))
            throw new ArgumentException("Nome da marca é obrigatório.");

        var existente = await BuscarMarcaPorNomeAsync(marca.Nome);
        if (existente is not null && existente.Id != marca.Id)
            return existente;

        marca.Nome = marca.Nome.Trim();
        marca.TipoDispositivo = NormalizarTipoDispositivo(marca.TipoDispositivo);
        marca.AtualizadoEm = DateTime.UtcNow;

        if (string.IsNullOrWhiteSpace(marca.Id))
        {
            marca.CriadoEm = DateTime.UtcNow;
            await _marcas.InsertOneAsync(marca);
            return marca;
        }

        await _marcas.ReplaceOneAsync(x => x.Id == marca.Id, marca);
        return marca;
    }

    public Task<MarcaAparelho> SalvarMarcaAsync(string nome, string? tipoDispositivo = null)
        => SalvarMarcaAsync(new MarcaAparelho { Nome = nome, TipoDispositivo = tipoDispositivo ?? "Celular" });

    public async Task<MarcaAparelho?> AtualizarMarcaAsync(string id, MarcaAparelho marca)
    {
        var existente = await ObterMarcaAsync(id);
        if (existente is null) return null;

        marca.Id = id;
        marca.CriadoEm = existente.CriadoEm;
        return await SalvarMarcaAsync(marca);
    }

    public async Task<bool> ExcluirMarcaAsync(string id)
    {
        var emUso = await _modelos.Find(x => x.MarcaId == id).AnyAsync();
        if (emUso) throw new InvalidOperationException("Marca possui modelos vinculados e não pode ser excluída.");

        var result = await _marcas.DeleteOneAsync(x => x.Id == id);
        return result.DeletedCount > 0;
    }

    public Task<List<ModeloAparelho>> ListarModelosAsync(
        string? termo = null,
        string? marcaId = null,
        string? marcaNome = null,
        string? tipoDispositivo = null,
        int limite = 500)
        => BuscarModelosInternal(termo, marcaId, marcaNome, tipoDispositivo, limite);

    public async Task<ModeloAparelho?> ObterModeloAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _modelos.Find(x => x.Id == id).FirstOrDefaultAsync();
    }

    public async Task<ModeloAparelho> SalvarModeloAsync(ModeloAparelho modelo)
    {
        if (string.IsNullOrWhiteSpace(modelo.Nome))
            throw new ArgumentException("Nome do modelo é obrigatório.");

        if (string.IsNullOrWhiteSpace(modelo.MarcaNome) && string.IsNullOrWhiteSpace(modelo.MarcaId))
            throw new ArgumentException("Marca do modelo é obrigatória.");

        if (!string.IsNullOrWhiteSpace(modelo.MarcaNome))
        {
            var marca = await SalvarMarcaAsync(modelo.MarcaNome.Trim(), modelo.TipoDispositivo);
            modelo.MarcaId = marca.Id;
            modelo.MarcaNome = marca.Nome;
        }
        else
        {
            await PreencherMarcaAsync(modelo);
        }

        NormalizarModelo(modelo);

        var existente = await BuscarModeloPorNomeAsync(modelo.Nome, modelo.MarcaId);
        if (existente is not null && existente.Id != modelo.Id && string.IsNullOrWhiteSpace(modelo.Id))
            return existente;

        modelo.AtualizadoEm = DateTime.UtcNow;
        await EnriquecerCompativeisAsync(modelo);

        if (string.IsNullOrWhiteSpace(modelo.Id))
        {
            if (modelo.CriadoEm == default)
                modelo.CriadoEm = DateTime.UtcNow;
            await _modelos.InsertOneAsync(modelo);
            return modelo;
        }

        await _modelos.ReplaceOneAsync(x => x.Id == modelo.Id, modelo);
        return modelo;
    }

    public Task<ModeloAparelho> SalvarModeloAsync(string nome, string? marcaId, string? marcaNome, string? tipoDispositivo = null)
        => SalvarModeloAsync(new ModeloAparelho
        {
            Nome = nome,
            MarcaId = marcaId,
            MarcaNome = marcaNome,
            TipoDispositivo = tipoDispositivo ?? "Celular"
        });

    public async Task<ModeloAparelho?> AtualizarModeloAsync(string id, ModeloAparelho modelo)
    {
        var existente = await ObterModeloAsync(id);
        if (existente is null) return null;

        modelo.Id = id;
        modelo.CriadoEm = existente.CriadoEm;
        return await SalvarModeloAsync(modelo);
    }

    public async Task<bool> ExcluirModeloAsync(string id)
    {
        var referenciado = await _modelos
            .Find(x => x.AparelhosCompativeis.Any(c => c.ModeloId == id))
            .AnyAsync();
        if (referenciado)
            throw new InvalidOperationException("Modelo referenciado como compatível em outro cadastro.");

        var result = await _modelos.DeleteOneAsync(x => x.Id == id);
        return result.DeletedCount > 0;
    }


    private async Task<List<MarcaAparelho>> BuscarMarcasInternal(string? termo, string? tipoDispositivo, int limite)
    {
        var filtros = new List<FilterDefinition<MarcaAparelho>>();

        if (!string.IsNullOrWhiteSpace(termo))
            filtros.Add(Builders<MarcaAparelho>.Filter.Regex(x => x.Nome,
                new MongoDB.Bson.BsonRegularExpression(termo.Trim(), "i")));

        if (!string.IsNullOrWhiteSpace(tipoDispositivo))
            filtros.Add(Builders<MarcaAparelho>.Filter.Eq(x => x.TipoDispositivo, tipoDispositivo));

        var filtro = filtros.Count > 0
            ? Builders<MarcaAparelho>.Filter.And(filtros)
            : Builders<MarcaAparelho>.Filter.Empty;

        return await _marcas.Find(filtro)
            .Sort(Builders<MarcaAparelho>.Sort.Ascending(x => x.Nome))
            .Limit(limite)
            .ToListAsync();
    }

    private const int LimiteModelosMax = 500;

    private async Task<List<ModeloAparelho>> BuscarModelosInternal(
        string? termo,
        string? marcaId,
        string? marcaNome,
        string? tipoDispositivo,
        int limite)
    {
        limite = Math.Clamp(limite, 1, LimiteModelosMax);
        var filtrosBase = MontarFiltrosBase(marcaId, marcaNome, tipoDispositivo);

        if (string.IsNullOrWhiteSpace(termo))
        {
            // Sem termo: agrupa por marca (A→Z) para todas as marcas aparecerem na lista.
            var lista = await _modelos.Find(filtrosBase)
                .Sort(Builders<ModeloAparelho>.Sort.Ascending(x => x.MarcaNome)
                    .Ascending(x => x.Nome))
                .Limit(limite)
                .ToListAsync();
            return lista;
        }

        var limiteBusca = Math.Min(Math.Max(limite * 4, limite), LimiteModelosMax * 4);
        var t = termo.Trim();
        var partes = t.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (partes.Length >= 2)
        {
            var porMarcaModelo = await BuscarPorMarcaEModeloAsync(
                partes[0], string.Join(' ', partes.Skip(1)), filtrosBase, limiteBusca);
            if (porMarcaModelo.Count > 0)
                return ModeloRelevanciaOrdenacao.Ordenar(porMarcaModelo, t, limite);
        }

        var prefixo = new MongoDB.Bson.BsonRegularExpression($"^{Regex.Escape(t)}", "i");

        var porNome = await _modelos.Find(
                Builders<ModeloAparelho>.Filter.And(filtrosBase,
                    Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, prefixo)))
            .Limit(limiteBusca)
            .ToListAsync();
        if (porNome.Count > 0)
            return ModeloRelevanciaOrdenacao.Ordenar(porNome, t, limite);

        if (string.IsNullOrWhiteSpace(marcaNome))
        {
            var porMarca = await _modelos.Find(
                    Builders<ModeloAparelho>.Filter.And(filtrosBase,
                        Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, prefixo)))
                .Limit(limiteBusca)
                .ToListAsync();
            if (porMarca.Count > 0)
                return ModeloRelevanciaOrdenacao.Ordenar(porMarca, t, limite);
        }

        var regexTexto = new MongoDB.Bson.BsonRegularExpression(Regex.Escape(t), "i");
        var fallback = Builders<ModeloAparelho>.Filter.Or(
            Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, regexTexto),
            Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, regexTexto));

        var resultados = await _modelos.Find(Builders<ModeloAparelho>.Filter.And(filtrosBase, fallback))
            .Limit(limiteBusca)
            .ToListAsync();

        return ModeloRelevanciaOrdenacao.Ordenar(resultados, t, limite);
    }

    private static FilterDefinition<ModeloAparelho> MontarFiltrosBase(
        string? marcaId,
        string? marcaNome,
        string? tipoDispositivo)
    {
        var filtros = new List<FilterDefinition<ModeloAparelho>>();

        if (!string.IsNullOrWhiteSpace(marcaId))
            filtros.Add(Builders<ModeloAparelho>.Filter.Eq(x => x.MarcaId, marcaId));

        if (!string.IsNullOrWhiteSpace(marcaNome))
        {
            var prefixoMarca = new MongoDB.Bson.BsonRegularExpression(
                $"^{Regex.Escape(marcaNome.Trim())}", "i");
            filtros.Add(Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, prefixoMarca));
        }

        if (!string.IsNullOrWhiteSpace(tipoDispositivo))
            filtros.Add(Builders<ModeloAparelho>.Filter.Eq(x => x.TipoDispositivo, tipoDispositivo));

        return filtros.Count > 0
            ? Builders<ModeloAparelho>.Filter.And(filtros)
            : Builders<ModeloAparelho>.Filter.Empty;
    }

    private async Task<List<ModeloAparelho>> BuscarPorMarcaEModeloAsync(
        string marca,
        string modelo,
        FilterDefinition<ModeloAparelho> filtrosBase,
        int limite)
    {
        var prefixoMarca = new MongoDB.Bson.BsonRegularExpression($"^{Regex.Escape(marca)}", "i");
        var prefixoModelo = new MongoDB.Bson.BsonRegularExpression($"^{Regex.Escape(modelo)}", "i");

        return await _modelos.Find(
                Builders<ModeloAparelho>.Filter.And(
                    filtrosBase,
                    Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, prefixoMarca),
                    Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, prefixoModelo)))
            .Limit(limite)
            .ToListAsync();
    }

    private async Task<MarcaAparelho?> BuscarMarcaPorNomeAsync(string nome)
    {
        var nomeTrimmed = nome.Trim();
        return await _marcas.Find(
            Builders<MarcaAparelho>.Filter.Regex(x => x.Nome,
                new MongoDB.Bson.BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(nomeTrimmed)}$", "i")))
            .FirstOrDefaultAsync();
    }

    private async Task<ModeloAparelho?> BuscarModeloPorNomeAsync(string nome, string? marcaId)
    {
        var nomeTrimmed = nome.Trim();
        var filtros = new List<FilterDefinition<ModeloAparelho>>
        {
            Builders<ModeloAparelho>.Filter.Regex(x => x.Nome,
                new MongoDB.Bson.BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(nomeTrimmed)}$", "i"))
        };
        if (!string.IsNullOrWhiteSpace(marcaId))
            filtros.Add(Builders<ModeloAparelho>.Filter.Eq(x => x.MarcaId, marcaId));

        return await _modelos.Find(Builders<ModeloAparelho>.Filter.And(filtros)).FirstOrDefaultAsync();
    }

    private async Task PreencherMarcaAsync(ModeloAparelho modelo)
    {
        if (string.IsNullOrWhiteSpace(modelo.MarcaId)) return;

        var marca = await ObterMarcaAsync(modelo.MarcaId);
        if (marca is not null)
        {
            modelo.MarcaNome = marca.Nome;
            if (string.IsNullOrWhiteSpace(modelo.TipoDispositivo) || modelo.TipoDispositivo == "Celular")
                modelo.TipoDispositivo = marca.TipoDispositivo;
        }
    }

    private async Task EnriquecerCompativeisAsync(ModeloAparelho modelo)
    {
        foreach (var compat in modelo.AparelhosCompativeis)
        {
            if (string.IsNullOrWhiteSpace(compat.ModeloId)) continue;

            var refModelo = await ObterModeloAsync(compat.ModeloId);
            if (refModelo is null) continue;

            compat.ModeloNome = refModelo.Nome;
            compat.MarcaNome = refModelo.MarcaNome;
            compat.TipoDispositivo = refModelo.TipoDispositivo;
            compat.TipoCompatibilidade = NormalizarTipoCompatibilidade(compat.TipoCompatibilidade);
        }

        modelo.AparelhosCompativeis = modelo.AparelhosCompativeis
            .Where(c => !string.IsNullOrWhiteSpace(c.ModeloId) && c.ModeloId != modelo.Id)
            .GroupBy(c => c.ModeloId)
            .Select(g => g.First())
            .ToList();
    }

    private static void NormalizarModelo(ModeloAparelho modelo)
    {
        modelo.Nome = Data.ModelosCatalogo.NormalizarNomeModelo(modelo.Nome);
        modelo.TipoDispositivo = NormalizarTipoDispositivo(modelo.TipoDispositivo);
        modelo.TipoTela = NormalizarTipoTela(modelo.TipoTela);
        modelo.Observacoes = string.IsNullOrWhiteSpace(modelo.Observacoes) ? null : modelo.Observacoes.Trim();
    }

    private static string NormalizarTipoDispositivo(string? tipo)
    {
        if (string.IsNullOrWhiteSpace(tipo)) return "Celular";
        return AparelhoConstantes.TiposDispositivo
            .FirstOrDefault(t => t.Equals(tipo.Trim(), StringComparison.OrdinalIgnoreCase)) ?? tipo.Trim();
    }

    private static string NormalizarTipoCompatibilidade(string? tipo)
    {
        if (string.IsNullOrWhiteSpace(tipo)) return "Exato";
        return AparelhoConstantes.TiposCompatibilidade
            .FirstOrDefault(t => t.Equals(tipo.Trim(), StringComparison.OrdinalIgnoreCase)) ?? tipo.Trim();
    }

    private static string? NormalizarTipoTela(string? tipoTela)
    {
        if (string.IsNullOrWhiteSpace(tipoTela)) return null;
        var valor = tipoTela.Trim();
        if (valor.Equals("AMOLED", StringComparison.OrdinalIgnoreCase)
            || valor.Equals("OLED", StringComparison.OrdinalIgnoreCase))
            return "OLED";
        if (valor.Equals("IPS", StringComparison.OrdinalIgnoreCase)
            || valor.Equals("LCD", StringComparison.OrdinalIgnoreCase))
            return "LCD";
        return AparelhoConstantes.TiposTelaBase
            .FirstOrDefault(t => t.Equals(valor, StringComparison.OrdinalIgnoreCase)) ?? valor;
    }


    public async Task<(int Criados, int JaExistentes, int Renomeados)> GarantirModelosDoCatalogoAsync()
    {
        var criados = 0;
        var existentes = 0;
        var renomeados = 0;

        // Evita marca "Apple" + marca "iPhone" misturadas (legado).
        renomeados += await MigrarMarcaAsync("Apple", "iPhone");

        foreach (var grupo in Data.ModelosCatalogo.PorMarca())
        {
            var marcaNome = grupo.Key;
            var marca = await SalvarMarcaAsync(marcaNome, "Celular");
            renomeados += await RenomearModelosSemPrefixoAsync(marca.Id!);

            foreach (var linha in grupo)
            {
                var nomeCurto = Data.ModelosCatalogo.NormalizarNomeModelo(linha.NomeModelo);
                var ano = linha.Ano ?? DateTime.UtcNow.Year;
                var obsPartes = new List<string>();
                if (!string.IsNullOrWhiteSpace(linha.Linha))
                    obsPartes.Add($"Linha {linha.Linha}");
                if (!string.IsNullOrWhiteSpace(linha.PrefixoMarca))
                    obsPartes.Add($"prefixo {linha.PrefixoMarca}");
                if (linha.Ano is int a)
                    obsPartes.Add($"lançamento ~{a}");

                var modelo = new ModeloAparelho
                {
                    Nome = nomeCurto,
                    MarcaId = marca.Id,
                    MarcaNome = marca.Nome,
                    TipoDispositivo = "Celular",
                    Observacoes = obsPartes.Count > 0 ? string.Join(" · ", obsPartes) : null,
                    CriadoEm = new DateTime(ano, 6, 15, 0, 0, 0, DateTimeKind.Utc),
                };

                var antes = await BuscarModeloPorNomeAsync(modelo.Nome, marca.Id);
                var salvo = await SalvarModeloAsync(modelo);
                if (antes is null && salvo.Id != null)
                    criados++;
                else
                    existentes++;
            }
        }

        return (criados, existentes, renomeados);
    }

    public async Task<(int Removidos, int Preservados)> RemoverModelosForaDoCatalogoAsync(string marcaNome)
    {
        if (string.IsNullOrWhiteSpace(marcaNome))
            return (0, 0);

        var marca = await BuscarMarcaPorNomeAsync(marcaNome.Trim());
        if (marca?.Id is null)
            return (0, 0);

        var permitidos = Data.ModelosCatalogo.Todos
            .Where(l => l.Marca.Equals(marca.Nome, StringComparison.OrdinalIgnoreCase))
            .Select(l => Data.ModelosCatalogo.NormalizarNomeModelo(l.NomeModelo))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (permitidos.Count == 0)
            return (0, 0);

        var modelos = await _modelos.Find(x => x.MarcaId == marca.Id).ToListAsync();
        var removidos = 0;
        var preservados = 0;
        var pecas = mongoPecas();
        var osLocal = _mongo.GetCollection<OsLocalData>("os_local_data");
        var orcamentos = _mongo.GetCollection<OrcamentoLocalData>("orcamento_local_data");

        foreach (var modelo in modelos)
        {
            if (modelo.Id is null) continue;
            var nomeNorm = Data.ModelosCatalogo.NormalizarNomeModelo(modelo.Nome);
            if (permitidos.Contains(nomeNorm) || permitidos.Contains(modelo.Nome))
                continue;

            var emCompat = await _modelos
                .Find(x => x.AparelhosCompativeis.Any(c => c.ModeloId == modelo.Id))
                .AnyAsync();
            var emPecas = pecas is not null && await pecas
                .Find(Builders<PecaEstoque>.Filter.ElemMatch(
                    x => x.ModelosCompativeis,
                    c => c.ModeloId == modelo.Id))
                .AnyAsync();
            var emOs = await osLocal.Find(x => x.ModeloId == modelo.Id).AnyAsync();
            var emOrc = await orcamentos.Find(x => x.ModeloId == modelo.Id).AnyAsync();

            if (emCompat || emPecas || emOs || emOrc)
            {
                preservados++;
                continue;
            }

            await _modelos.DeleteOneAsync(x => x.Id == modelo.Id);
            removidos++;
        }

        return (removidos, preservados);
    }

    /// <summary>Move todos os modelos de uma marca legada para a marca canônica.</summary>
    private async Task<int> MigrarMarcaAsync(string marcaAntiga, string marcaNova)
    {
        if (string.Equals(marcaAntiga, marcaNova, StringComparison.OrdinalIgnoreCase))
            return 0;

        var antiga = await BuscarMarcaPorNomeAsync(marcaAntiga);
        if (antiga?.Id is null) return 0;

        var nova = await SalvarMarcaAsync(marcaNova, "Celular");
        var modelos = await _modelos.Find(x => x.MarcaId == antiga.Id).ToListAsync();
        var movidos = 0;

        foreach (var modelo in modelos)
        {
            var conflito = await BuscarModeloPorNomeAsync(modelo.Nome, nova.Id);
            if (conflito is not null && conflito.Id != modelo.Id)
            {
                await _modelos.DeleteOneAsync(x => x.Id == modelo.Id);
                await AtualizarNomeModeloNasPecasAsync(modelo.Id!, conflito.Id!, conflito.Nome);
                movidos++;
                continue;
            }

            modelo.MarcaId = nova.Id;
            modelo.MarcaNome = nova.Nome;
            modelo.AtualizadoEm = DateTime.UtcNow;
            await _modelos.ReplaceOneAsync(x => x.Id == modelo.Id, modelo);
            await AtualizarMarcaModeloNasPecasAsync(modelo.Id!, nova.Nome);
            movidos++;
        }

        // Remove marca legada se ficou vazia.
        var aindaTem = await _modelos.Find(x => x.MarcaId == antiga.Id).AnyAsync();
        if (!aindaTem)
            await _marcas.DeleteOneAsync(x => x.Id == antiga.Id);

        return movidos;
    }

    /// <summary>Renomeia "Moto G24" → "G24" (e equivalentes de outras marcas) e atualiza peças.</summary>
    private async Task<int> RenomearModelosSemPrefixoAsync(string marcaId)
    {
        var modelos = await _modelos.Find(x => x.MarcaId == marcaId).ToListAsync();
        var renomeados = 0;

        foreach (var modelo in modelos)
        {
            var novo = Data.ModelosCatalogo.NormalizarNomeModelo(modelo.Nome);
            if (string.IsNullOrWhiteSpace(novo) || string.Equals(novo, modelo.Nome, StringComparison.Ordinal))
                continue;

            var conflito = await BuscarModeloPorNomeAsync(novo, marcaId);
            if (conflito is not null && conflito.Id != modelo.Id)
            {
                await _modelos.DeleteOneAsync(x => x.Id == modelo.Id);
                await AtualizarNomeModeloNasPecasAsync(modelo.Id!, conflito.Id!, novo);
                renomeados++;
                continue;
            }

            var antigoNome = modelo.Nome;
            modelo.Nome = novo;
            modelo.AtualizadoEm = DateTime.UtcNow;
            await _modelos.ReplaceOneAsync(x => x.Id == modelo.Id, modelo);
            await AtualizarNomeModeloNasPecasAsync(modelo.Id!, modelo.Id!, novo, antigoNome);
            renomeados++;
        }

        return renomeados;
    }

    private async Task AtualizarMarcaModeloNasPecasAsync(string modeloId, string marcaNome)
    {
        var pecas = mongoPecas();
        if (pecas is null) return;

        var filtro = Builders<PecaEstoque>.Filter.ElemMatch(
            x => x.ModelosCompativeis,
            c => c.ModeloId == modeloId);

        var lista = await pecas.Find(filtro).ToListAsync();
        foreach (var peca in lista)
        {
            var mudou = false;
            foreach (var c in peca.ModelosCompativeis)
            {
                if (!string.Equals(c.ModeloId, modeloId, StringComparison.Ordinal)) continue;
                if (string.Equals(c.MarcaNome, marcaNome, StringComparison.Ordinal)) continue;
                c.MarcaNome = marcaNome;
                mudou = true;
            }
            if (mudou)
                await pecas.ReplaceOneAsync(x => x.Id == peca.Id, peca);
        }
    }

    private async Task AtualizarNomeModeloNasPecasAsync(
        string modeloIdAntigo,
        string modeloIdNovo,
        string nomeNovo,
        string? nomeAntigo = null)
    {
        var pecas = mongoPecas();
        if (pecas is null) return;

        var filtro = Builders<PecaEstoque>.Filter.ElemMatch(
            x => x.ModelosCompativeis,
            c => c.ModeloId == modeloIdAntigo
                || (nomeAntigo != null && c.ModeloNome == nomeAntigo));

        var lista = await pecas.Find(filtro).ToListAsync();
        foreach (var peca in lista)
        {
            var mudou = false;
            foreach (var c in peca.ModelosCompativeis)
            {
                var mesmoId = string.Equals(c.ModeloId, modeloIdAntigo, StringComparison.Ordinal);
                var mesmoNome = nomeAntigo != null
                    && string.Equals(c.ModeloNome, nomeAntigo, StringComparison.OrdinalIgnoreCase);
                if (!mesmoId && !mesmoNome) continue;

                c.ModeloId = modeloIdNovo;
                c.ModeloNome = nomeNovo;
                mudou = true;
            }
            if (mudou)
                await pecas.ReplaceOneAsync(x => x.Id == peca.Id, peca);
        }
    }

    private IMongoCollection<PecaEstoque>? mongoPecas()
    {
        try
        {
            return _pecasRef ??= _mongo.GetCollection<PecaEstoque>("pecas_estoque");
        }
        catch
        {
            return null;
        }
    }
}
