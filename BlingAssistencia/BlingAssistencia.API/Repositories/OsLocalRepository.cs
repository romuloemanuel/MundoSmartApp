using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;
using System.Text.RegularExpressions;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IOsLocalRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<OsLocalData?> ObterPorBlingIdAsync(long blingId);
    Task<List<OsLocalData>> ObterPorBlingIdsAsync(IEnumerable<long> blingIds);
    Task<List<OsLocalData>> ListarAsync();
    /// <summary>Lista enxuta para tela — projeção sem senha, fotos, itens, etc.</summary>
    Task<OsListaPaginada<OsLocalData>> ListarParaListaAsync(OsListarFiltros? filtros = null);
    /// <summary>OS concluídas com itens — relatório de comissão (sem paginação).</summary>
    Task<List<OsLocalData>> ListarParaComissaoAsync(
        DateTime? dataConclusaoInicio,
        DateTime? dataConclusaoFim,
        IReadOnlyList<string>? tecnicos = null,
        bool incluirSemTecnico = true,
        string? lojaOrigem = null);
    Task<List<OsLocalData>> ListarEmAndamentoPorModeloAsync(string modeloId, long? excluirBlingId = null);
    Task<OsLocalData?> ObterPorIntakeTokenAsync(string token);
    Task SalvarAsync(OsLocalData dados);
    /// <summary>Append atômico de foto — evita last-write-wins apagar uploads do celular.</summary>
    Task AdicionarFotoAtomicoAsync(long blingId, OsFotoAparelho foto);
    Task<bool> RemoverFotoAtomicoAsync(long blingId, string fotoId);
    Task<OsFotoAparelho?> AtualizarCategoriaFotoAtomicoAsync(long blingId, string fotoId, string categoria, string? descricaoFoco);
    Task AtualizarIntakeTokenAsync(long blingId, string token, DateTime? expiraEm);
    Task AtualizarSenhaDispositivoAsync(long blingId, string? tipo, string? valor);
    Task<bool> ExcluirPorBlingIdAsync(long blingId);
    /// <summary>Converte IDs/números legados (900000xxx, L900...) para sequência 1, 2, 3...</summary>
    Task NormalizarNumeracaoSeNecessarioAsync(IDevSequenceRepository sequences, string? uploadsRoot = null);
}

public class OsLocalRepository : IOsLocalRepository
{
    private readonly IMongoCollection<OsLocalData> _collection;
    private readonly IPecaEstoqueRepository _pecasRepo;

    public OsLocalRepository(MongoDbService mongo, IPecaEstoqueRepository pecasRepo)
    {
        _pecasRepo = pecasRepo;
        _collection = mongo.GetCollection<OsLocalData>("os_local_data");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys.Ascending(x => x.BlingId),
                new CreateIndexOptions { Unique = true }),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys.Ascending(x => x.ModeloId)),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys.Ascending(x => x.IntakeToken)),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys
                    .Descending(x => x.DataEntrada)
                    .Descending(x => x.BlingId)),
            cancellationToken: cancellationToken);
        await _collection.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys.Ascending(x => x.Situacao)),
            cancellationToken: cancellationToken);
    }

    public async Task<OsLocalData?> ObterPorBlingIdAsync(long blingId)
    {
        return await _collection
            .Find(x => x.BlingId == blingId)
            .FirstOrDefaultAsync();
    }

    public async Task<List<OsLocalData>> ObterPorBlingIdsAsync(IEnumerable<long> blingIds)
    {
        var ids = blingIds.ToList();
        return await _collection
            .Find(x => ids.Contains(x.BlingId))
            .ToListAsync();
    }

    public async Task<List<OsLocalData>> ListarAsync() =>
        await _collection.Find(_ => true)
            .SortByDescending(x => x.DataEntrada)
            .ThenByDescending(x => x.BlingId)
            .ToListAsync();

    public async Task<OsListaPaginada<OsLocalData>> ListarParaListaAsync(OsListarFiltros? filtros = null)
    {
        var (pagina, tamanho) = OsListarOrdenacao.NormalizarPaginacao(filtros);
        var filtro = MontarFiltroLista(filtros);
        var projection = Builders<OsLocalData>.Projection
            .Include(x => x.BlingId)
            .Include(x => x.OsNumero)
            .Include(x => x.Situacao)
            .Include(x => x.Data)
            .Include(x => x.DataEntrada)
            .Include(x => x.DataInicioAssistencia)
            .Include(x => x.DataPrazoPeca)
            .Include(x => x.DataUltimaAlteracaoSituacao)
            .Include(x => x.JustificativasAtraso)
            .Include(x => x.JustificativaAtrasoLegado)
            .Include(x => x.DataAtualizacao)
            .Include(x => x.DataConclusao)
            .Include(x => x.ContatoId)
            .Include(x => x.ContatoNome)
            .Include(x => x.ContatoTelefone)
            .Include(x => x.ContatoCelular)
            .Include(x => x.ContatoAviso)
            .Include(x => x.Imei)
            .Include(x => x.CpfCnpj)
            .Include(x => x.Equipamento)
            .Include(x => x.MarcaNome)
            .Include(x => x.ModeloNome)
            .Include(x => x.Defeito)
            .Include(x => x.TipoPecaProblemaNome)
            .Include(x => x.ValorTotal)
            .Include(x => x.ValorTotalAcordado)
            .Include(x => x.FormaPagamento)
            .Include(x => x.ParcelasPagamento)
            .Include(x => x.Juros)
            .Include(x => x.TecnicoNome)
            .Include(x => x.Retorno)
            .Include(x => x.PreferenciaContatoSelecionado)
            .Include(x => x.LojaOrigem);

        var sort = OsListarOrdenacao.MontarSortMongo(filtros);
        var skip = (pagina - 1) * tamanho;

        var total = await _collection.CountDocumentsAsync(filtro);
        var itens = await _collection.Find(filtro)
            .Project<OsLocalData>(projection)
            .Sort(sort)
            .Skip(skip)
            .Limit(tamanho)
            .ToListAsync();

        return new OsListaPaginada<OsLocalData>
        {
            Itens = itens,
            Total = total,
            Pagina = pagina,
            TamanhoPagina = tamanho,
        };
    }

    public async Task<List<OsLocalData>> ListarParaComissaoAsync(
        DateTime? dataConclusaoInicio,
        DateTime? dataConclusaoFim,
        IReadOnlyList<string>? tecnicos = null,
        bool incluirSemTecnico = true,
        string? lojaOrigem = null)
    {
        // Aceita Concluído / Concluída (legado) com ou sem acento.
        var filtro = Builders<OsLocalData>.Filter.Regex(
            x => x.Situacao,
            new BsonRegularExpression(@"^conclu[ií]d[oa]$", "i"));

        if (dataConclusaoInicio.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Gte(x => x.DataConclusao, dataConclusaoInicio.Value);

        if (dataConclusaoFim.HasValue)
        {
            var fim = dataConclusaoFim.Value.Date.AddDays(1).AddTicks(-1);
            filtro &= Builders<OsLocalData>.Filter.Lte(x => x.DataConclusao, fim);
        }

        if (!string.IsNullOrWhiteSpace(lojaOrigem))
        {
            var loja = Config.OsLojaHelper.Normalizar(lojaOrigem);
            if (loja == Config.OsLojaHelper.Padrao)
            {
                filtro &= Builders<OsLocalData>.Filter.Or(
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, loja),
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, null),
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, ""),
                    Builders<OsLocalData>.Filter.Exists(x => x.LojaOrigem, false));
            }
            else
            {
                filtro &= Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, loja);
            }
        }

        var nomes = (tecnicos ?? [])
            .Select(t => t?.Trim())
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (nomes.Count > 0)
        {
            var orTecnicos = nomes
                .Select(n => Builders<OsLocalData>.Filter.Regex(
                    x => x.TecnicoNome,
                    new BsonRegularExpression($"^{Regex.Escape(n!)}$", "i")))
                .ToList();

            if (incluirSemTecnico)
            {
                orTecnicos.Add(Builders<OsLocalData>.Filter.Or(
                    Builders<OsLocalData>.Filter.Eq(x => x.TecnicoNome, null),
                    Builders<OsLocalData>.Filter.Eq(x => x.TecnicoNome, ""),
                    Builders<OsLocalData>.Filter.Exists(x => x.TecnicoNome, false)));
            }

            filtro &= Builders<OsLocalData>.Filter.Or(orTecnicos);
        }

        var projection = Builders<OsLocalData>.Projection
            .Include(x => x.BlingId)
            .Include(x => x.OsNumero)
            .Include(x => x.Situacao)
            .Include(x => x.DataConclusao)
            .Include(x => x.ContatoNome)
            .Include(x => x.TecnicoNome)
            .Include(x => x.ValorTotal)
            .Include(x => x.ValorTotalAcordado)
            .Include(x => x.Juros)
            .Include(x => x.Itens)
            .Include(x => x.Equipamento)
            .Include(x => x.ModeloNome)
            .Include(x => x.LojaOrigem);

        return await _collection.Find(filtro)
            .Project<OsLocalData>(projection)
            .Sort(Builders<OsLocalData>.Sort.Descending(x => x.DataConclusao).Descending(x => x.BlingId))
            .Limit(5000)
            .ToListAsync();
    }

    private static FilterDefinition<OsLocalData> MontarFiltroLista(OsListarFiltros? filtros)
    {
        // Lista operacional não inclui OS excluídas (soft-delete).
        var filtro = Builders<OsLocalData>.Filter.Or(
            Builders<OsLocalData>.Filter.Eq(x => x.ExcluidoEm, null),
            Builders<OsLocalData>.Filter.Exists(x => x.ExcluidoEm, false));

        if (filtros is null) return filtro;

        if (!string.IsNullOrWhiteSpace(filtros.Situacao))
        {
            if (OsSituacaoHelper.EhFiltroExcetoConcluido(filtros.Situacao))
            {
                // Whitelist: só situações em andamento (nunca Concluído/Cancelado).
                filtro &= Builders<OsLocalData>.Filter.Regex(
                    x => x.Situacao, OsSituacaoHelper.SituacoesEmAndamentoRegex);
            }
            else
            {
                filtro &= Builders<OsLocalData>.Filter.Eq(x => x.Situacao, filtros.Situacao.Trim());
            }
        }

        if (filtros.Retorno.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Eq(x => x.Retorno, filtros.Retorno.Value);

        if (!string.IsNullOrWhiteSpace(filtros.LojaOrigem))
        {
            var loja = Config.OsLojaHelper.Normalizar(filtros.LojaOrigem);
            // OS antigas sem campo gravado = Mococa (padrão).
            if (loja == Config.OsLojaHelper.Padrao)
            {
                filtro &= Builders<OsLocalData>.Filter.Or(
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, loja),
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, null),
                    Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, ""),
                    Builders<OsLocalData>.Filter.Exists(x => x.LojaOrigem, false));
            }
            else
            {
                filtro &= Builders<OsLocalData>.Filter.Eq(x => x.LojaOrigem, loja);
            }
        }

        if (!string.IsNullOrWhiteSpace(filtros.Imei))
        {
            var imei = Regex.Escape(filtros.Imei.Trim());
            filtro &= Builders<OsLocalData>.Filter.Regex(x => x.Imei, new BsonRegularExpression(imei, "i"));
        }

        if (!string.IsNullOrWhiteSpace(filtros.Numero))
        {
            var numero = new string(filtros.Numero.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(numero))
            {
                var termo = Regex.Escape(numero);
                var filtrosNumero = new List<FilterDefinition<OsLocalData>>
                {
                    Builders<OsLocalData>.Filter.Regex(x => x.OsNumero, new BsonRegularExpression($"^{termo}", "i")),
                };
                if (long.TryParse(numero, out var blingId))
                    filtrosNumero.Add(Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId));
                filtro &= Builders<OsLocalData>.Filter.Or(filtrosNumero);
            }
        }

        if (!string.IsNullOrWhiteSpace(filtros.Nome))
        {
            var termo = Regex.Escape(filtros.Nome.Trim());
            var regex = new BsonRegularExpression(termo, "i");
            filtro &= Builders<OsLocalData>.Filter.Or(
                Builders<OsLocalData>.Filter.Regex(x => x.ContatoNome, regex),
                Builders<OsLocalData>.Filter.Regex("contatoAviso.nome", regex));
        }

        if (!string.IsNullOrWhiteSpace(filtros.Telefone))
        {
            var digitos = new string(filtros.Telefone.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(digitos))
            {
                var regexTel = new BsonRegularExpression(digitos);
                filtro &= Builders<OsLocalData>.Filter.Or(
                    Builders<OsLocalData>.Filter.Regex(x => x.ContatoTelefone, regexTel),
                    Builders<OsLocalData>.Filter.Regex(x => x.ContatoCelular, regexTel),
                    Builders<OsLocalData>.Filter.Regex("contatoAviso.telefone", regexTel),
                    Builders<OsLocalData>.Filter.Regex("contatoAviso.celular", regexTel));
            }
        }

        if (!string.IsNullOrWhiteSpace(filtros.CpfCnpj))
        {
            var digitos = new string(filtros.CpfCnpj.Where(char.IsDigit).ToArray());
            if (!string.IsNullOrEmpty(digitos))
                filtro &= Builders<OsLocalData>.Filter.Regex(x => x.CpfCnpj, new BsonRegularExpression(digitos));
        }

        if (filtros.DataCadastroInicio.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Gte(x => x.Data, filtros.DataCadastroInicio.Value);
        if (filtros.DataCadastroFim.HasValue)
        {
            var fim = filtros.DataCadastroFim.Value.AddDays(1).AddTicks(-1);
            filtro &= Builders<OsLocalData>.Filter.Lte(x => x.Data, fim);
        }

        if (filtros.DataAtualizacaoInicio.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Gte(x => x.DataAtualizacao, filtros.DataAtualizacaoInicio.Value);
        if (filtros.DataAtualizacaoFim.HasValue)
        {
            var fim = filtros.DataAtualizacaoFim.Value.AddDays(1).AddTicks(-1);
            filtro &= Builders<OsLocalData>.Filter.Lte(x => x.DataAtualizacao, fim);
        }

        if (filtros.DataConclusaoInicio.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Gte(x => x.DataConclusao, filtros.DataConclusaoInicio.Value);
        if (filtros.DataConclusaoFim.HasValue)
        {
            var fim = filtros.DataConclusaoFim.Value.AddDays(1).AddTicks(-1);
            filtro &= Builders<OsLocalData>.Filter.Lte(x => x.DataConclusao, fim);
        }

        if (!string.IsNullOrWhiteSpace(filtros.TecnicoNome))
        {
            var nome = Regex.Escape(filtros.TecnicoNome.Trim());
            filtro &= Builders<OsLocalData>.Filter.Regex(
                x => x.TecnicoNome,
                new BsonRegularExpression($"^{nome}$", "i"));
        }

        if (!string.IsNullOrWhiteSpace(filtros.ModeloId) || !string.IsNullOrWhiteSpace(filtros.ModeloNome))
        {
            var filtrosModelo = new List<FilterDefinition<OsLocalData>>();
            if (!string.IsNullOrWhiteSpace(filtros.ModeloId))
                filtrosModelo.Add(Builders<OsLocalData>.Filter.Eq(x => x.ModeloId, filtros.ModeloId.Trim()));
            if (!string.IsNullOrWhiteSpace(filtros.ModeloNome))
            {
                var modelo = Regex.Escape(filtros.ModeloNome.Trim());
                filtrosModelo.Add(Builders<OsLocalData>.Filter.Regex(
                    x => x.ModeloNome, new BsonRegularExpression($"^{modelo}$", "i")));
            }
            filtro &= Builders<OsLocalData>.Filter.Or(filtrosModelo);
        }

        return filtro;
    }

    public async Task<List<OsLocalData>> ListarEmAndamentoPorModeloAsync(
        string modeloId, long? excluirBlingId = null)
    {
        var situacoesFinais = OsSituacaoHelper.SituacoesFinalizadasAliases;
        var filtro = Builders<OsLocalData>.Filter.Eq(x => x.ModeloId, modeloId)
            & Builders<OsLocalData>.Filter.Nin(x => x.Situacao, situacoesFinais);

        if (excluirBlingId.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Ne(x => x.BlingId, excluirBlingId.Value);

        var lista = await _collection.Find(filtro)
            .Sort(Builders<OsLocalData>.Sort.Descending(x => x.DataEntrada))
            .ToListAsync();

        return lista.Where(os => !OsSituacaoHelper.EhFinalizada(os.Situacao)).ToList();
    }

    public async Task<OsLocalData?> ObterPorIntakeTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        return await _collection
            .Find(x => x.IntakeToken == token)
            .FirstOrDefaultAsync();
    }

    public async Task SalvarAsync(OsLocalData dados)
    {
        dados.AtualizadoEm = DateTime.UtcNow;

        var existente = await ObterPorBlingIdAsync(dados.BlingId);

        if (existente is not null)
        {
            if (dados.CriadoEm == default && existente.CriadoEm != default)
                dados.CriadoEm = existente.CriadoEm;

            // Atualiza pelo blingId e preserva o _id do Mongo (evita insert duplicado).
            dados.MongoId = string.IsNullOrWhiteSpace(existente.MongoId) ? null : existente.MongoId;

            await _collection.ReplaceOneAsync(
                Builders<OsLocalData>.Filter.Eq(x => x.BlingId, dados.BlingId),
                dados);

            await _pecasRepo.InvalidarCacheReferenciaAsync();
            return;
        }

        if (string.IsNullOrWhiteSpace(dados.MongoId))
        {
            dados.MongoId = ObjectId.GenerateNewId().ToString();
            if (dados.CriadoEm == default)
                dados.CriadoEm = DateTime.UtcNow;
        }

        await _collection.InsertOneAsync(dados);
        await _pecasRepo.InvalidarCacheReferenciaAsync();
    }

    public async Task AdicionarFotoAtomicoAsync(long blingId, OsFotoAparelho foto)
    {
        var update = Builders<OsLocalData>.Update
            .Push(x => x.FotosAparelho, foto)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);

        var result = await _collection.UpdateOneAsync(
            Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId),
            update);

        if (result.MatchedCount == 0)
            throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");
    }

    public async Task<bool> RemoverFotoAtomicoAsync(long blingId, string fotoId)
    {
        var update = Builders<OsLocalData>.Update
            .PullFilter(x => x.FotosAparelho, f => f.Id == fotoId)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);

        var result = await _collection.UpdateOneAsync(
            Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId),
            update);

        return result.ModifiedCount > 0;
    }

    public async Task<OsFotoAparelho?> AtualizarCategoriaFotoAtomicoAsync(
        long blingId,
        string fotoId,
        string categoria,
        string? descricaoFoco)
    {
        var filtro = Builders<OsLocalData>.Filter.And(
            Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId),
            Builders<OsLocalData>.Filter.ElemMatch(x => x.FotosAparelho, f => f.Id == fotoId));

        var update = Builders<OsLocalData>.Update
            .Set("fotosAparelho.$.categoria", categoria)
            .Set("fotosAparelho.$.descricaoFoco", descricaoFoco)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);

        var result = await _collection.UpdateOneAsync(filtro, update);
        if (result.MatchedCount == 0) return null;

        var os = await ObterPorBlingIdAsync(blingId);
        return os?.FotosAparelho.FirstOrDefault(f => f.Id == fotoId);
    }

    public async Task AtualizarIntakeTokenAsync(long blingId, string token, DateTime? expiraEm)
    {
        var update = Builders<OsLocalData>.Update
            .Set(x => x.IntakeToken, token)
            .Set(x => x.IntakeTokenExpiraEm, expiraEm)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);

        var result = await _collection.UpdateOneAsync(
            Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId),
            update);

        if (result.MatchedCount == 0)
            throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");
    }

    public async Task AtualizarSenhaDispositivoAsync(long blingId, string? tipo, string? valor)
    {
        var update = Builders<OsLocalData>.Update
            .Set(x => x.SenhaDispositivoTipo, tipo)
            .Set(x => x.SenhaDispositivo, valor)
            .Set(x => x.AtualizadoEm, DateTime.UtcNow);

        var result = await _collection.UpdateOneAsync(
            Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingId),
            update);

        if (result.MatchedCount == 0)
            throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");
    }

    public async Task<bool> ExcluirPorBlingIdAsync(long blingId)
    {
        var result = await _collection.DeleteOneAsync(x => x.BlingId == blingId);
        return result.DeletedCount > 0;
    }

    public async Task NormalizarNumeracaoSeNecessarioAsync(
        IDevSequenceRepository sequences,
        string? uploadsRoot = null)
    {
        var todas = await _collection.Find(_ => true).ToListAsync();
        var ordenadas = todas
            .OrderBy(o => o.DataEntrada ?? o.CriadoEm)
            .ThenBy(o => o.CriadoEm)
            .ThenBy(o => o.BlingId)
            .ToList();

        if (ordenadas.Count == 0)
        {
            await sequences.SincronizarAsync("os", 0);
            return;
        }

        var maxId = ordenadas.Max(o => o.BlingId);
        var precisaMigrar = ordenadas.Any(o => o.BlingId >= 900_000_000)
            || ordenadas.Any(o => NumeroLegado(o.OsNumero))
            || ordenadas.Any(o => o.OsNumero != o.BlingId.ToString());

        if (!precisaMigrar)
        {
            foreach (var os in ordenadas.Where(o => string.IsNullOrWhiteSpace(o.OsNumero)))
                os.OsNumero = os.BlingId.ToString();

            await PersistirRenumeracaoAsync(ordenadas);
            await sequences.SincronizarAsync("os", maxId);
            return;
        }

        var mapa = new Dictionary<long, long>();
        long proximo = 1;
        foreach (var os in ordenadas)
            mapa[os.BlingId] = proximo++;

        foreach (var os in ordenadas)
        {
            var antigoId = os.BlingId;
            var novoId = mapa[antigoId];
            os.BlingId = novoId;
            os.OsNumero = novoId.ToString();

            if (os.OsOriginalBlingId is long origem && mapa.TryGetValue(origem, out var novaOrigem))
                os.OsOriginalBlingId = novaOrigem;

            foreach (var foto in os.FotosAparelho)
            {
                if (!string.IsNullOrWhiteSpace(foto.Url))
                    foto.Url = foto.Url.Replace($"/uploads/os/{antigoId}/", $"/uploads/os/{novoId}/", StringComparison.OrdinalIgnoreCase);
            }

            if (antigoId != novoId && !string.IsNullOrWhiteSpace(uploadsRoot))
                MoverPastaUploads(uploadsRoot, antigoId, novoId);

            await SalvarRenumeradoAsync(os, antigoId);
        }

        await sequences.SincronizarAsync("os", ordenadas.Count);
    }

    private async Task SalvarRenumeradoAsync(OsLocalData os, long? blingIdAnterior = null)
    {
        var filtro = !string.IsNullOrWhiteSpace(os.MongoId)
            ? Builders<OsLocalData>.Filter.Eq(x => x.MongoId, os.MongoId)
            : Builders<OsLocalData>.Filter.Eq(x => x.BlingId, blingIdAnterior ?? os.BlingId);

        await _collection.ReplaceOneAsync(filtro, os, new ReplaceOptions { IsUpsert = true });
    }

    private async Task PersistirRenumeracaoAsync(IEnumerable<OsLocalData> ordenadas)
    {
        foreach (var os in ordenadas)
            await SalvarRenumeradoAsync(os);
    }

    private static bool NumeroLegado(string? numero)
    {
        if (string.IsNullOrWhiteSpace(numero)) return false;
        var limpo = numero.Trim();
        if (limpo.StartsWith("L", StringComparison.OrdinalIgnoreCase))
            limpo = limpo[1..];
        return long.TryParse(limpo, out var n) && n >= 900_000_000;
    }

    private static void MoverPastaUploads(string uploadsRoot, long antigoId, long novoId)
    {
        var origem = Path.Combine(uploadsRoot, "os", antigoId.ToString());
        var destino = Path.Combine(uploadsRoot, "os", novoId.ToString());
        if (!Directory.Exists(origem)) return;
        if (Directory.Exists(destino))
        {
            foreach (var arquivo in Directory.GetFiles(origem))
            {
                var alvo = Path.Combine(destino, Path.GetFileName(arquivo));
                if (!File.Exists(alvo))
                    File.Move(arquivo, alvo);
            }
            try { Directory.Delete(origem, recursive: true); } catch { /* best effort */ }
            return;
        }

        Directory.CreateDirectory(Path.Combine(uploadsRoot, "os"));
        Directory.Move(origem, destino);
    }
}
