using System.Collections.Concurrent;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IPecaEstoqueRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<PecaEstoque>> BuscarAsync(string? termo = null);
    Task<PecaEstoque?> ObterPorIdAsync(string id);
    Task<PecaEstoque> SalvarAsync(PecaEstoque peca);
    Task<List<DisponibilidadePecaResponse>> ConsultarDisponibilidadeAsync(string modeloId, string? pecaId = null);
    Task<ModeloServicosValoresResponse> ConsultarServicosValoresAsync(string modeloId);
    Task<ModeloOperacaoResponse> ConsultarOperacaoAsync(string modeloId, long? excluirBlingId = null);
    Task<ModeloReferenciaResponse> ConsultarReferenciaModeloAsync(string modeloId, long? excluirBlingId = null);
    void InvalidarCacheReferencia();
    Task InvalidarCacheReferenciaAsync();
    Task GarantirCatalogoDemonstracaoAsync();
}

public class PecaEstoqueRepository : IPecaEstoqueRepository
{
    private const int MaxPecasReferencia = 10;
    private const int MaxOsReferencia = 30;
    private static readonly string[] SituacoesFinais = OsSituacaoHelper.SituacoesFinalizadasAliases;
    private static readonly TimeSpan ReferenciaCacheTtl = TimeSpan.FromSeconds(4);

    private readonly IMongoCollection<PecaEstoque> _pecas;
    private readonly IMongoCollection<OsLocalData> _osLocal;
    private readonly IMongoCollection<ModeloAparelho> _modelos;
    private readonly IEstoqueNivelService _estoqueNivel;
    private readonly IAparelhoRepository _aparelhos;

    private readonly ConcurrentDictionary<string, (DateTime Ts, ModeloReferenciaResponse Data)> _referenciaCache = new();
    private readonly ConcurrentDictionary<string, (DateTime Ts, ModeloServicosValoresResponse Data)> _valoresCache = new();
    private readonly ConcurrentDictionary<string, (DateTime Ts, ModeloOperacaoResponse Data)> _operacaoCache = new();
    private ConcurrentDictionary<string, List<PecaEstoque>> _pecasPorModelo = new();
    private (DateTime Ts, int OsAbertasHoje)? _osHojeCache;

    public PecaEstoqueRepository(
        MongoDbService mongo,
        IEstoqueNivelService estoqueNivel,
        IAparelhoRepository aparelhos)
    {
        _estoqueNivel = estoqueNivel;
        _aparelhos = aparelhos;
        _pecas = mongo.GetCollection<PecaEstoque>("pecas_estoque");
        _osLocal = mongo.GetCollection<OsLocalData>("os_local_data");
        _modelos = mongo.GetCollection<ModeloAparelho>("modelos_aparelho");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _pecas.Indexes.CreateOneAsync(
            new CreateIndexModel<PecaEstoque>(Builders<PecaEstoque>.IndexKeys.Ascending(x => x.Nome)),
            cancellationToken: cancellationToken);
        await _pecas.Indexes.CreateOneAsync(
            new CreateIndexModel<PecaEstoque>(
                Builders<PecaEstoque>.IndexKeys.Ascending("modelosCompativeis.modeloId")),
            cancellationToken: cancellationToken);
        await _osLocal.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys
                    .Ascending(x => x.ModeloId)
                    .Ascending(x => x.Situacao)),
            cancellationToken: cancellationToken);
        await _osLocal.Indexes.CreateOneAsync(
            new CreateIndexModel<OsLocalData>(
                Builders<OsLocalData>.IndexKeys
                    .Ascending(x => x.Situacao)
                    .Ascending(x => x.DataPrevistaTermino)
                    .Ascending(x => x.DataEntrada)),
            cancellationToken: cancellationToken);

        await RecarregarPecasEmMemoriaAsync(cancellationToken);
    }

    private async Task RecarregarPecasEmMemoriaAsync(CancellationToken cancellationToken = default)
    {
        var todas = await _pecas.Find(Builders<PecaEstoque>.Filter.Empty)
            .Sort(Builders<PecaEstoque>.Sort.Ascending(x => x.Nome))
            .Limit(500)
            .ToListAsync(cancellationToken);

        var mapa = new ConcurrentDictionary<string, List<PecaEstoque>>();
        foreach (var peca in todas)
        {
            foreach (var mc in peca.ModelosCompativeis)
            {
                if (string.IsNullOrWhiteSpace(mc.ModeloId)) continue;
                mapa.AddOrUpdate(
                    mc.ModeloId,
                    _ => [peca],
                    (_, lista) =>
                    {
                        if (lista.All(p => p.Id != peca.Id)) lista.Add(peca);
                        return lista;
                    });
            }
        }

        _pecasPorModelo = mapa;
        _valoresCache.Clear();
    }

    public void InvalidarCacheReferencia()
    {
        _referenciaCache.Clear();
        _valoresCache.Clear();
        _operacaoCache.Clear();
        _osHojeCache = null;
    }

    public async Task InvalidarCacheReferenciaAsync()
    {
        InvalidarCacheReferencia();
        await RecarregarPecasEmMemoriaAsync();
    }

    public async Task<List<PecaEstoque>> BuscarAsync(string? termo = null)
    {
        var filtro = string.IsNullOrWhiteSpace(termo)
            ? Builders<PecaEstoque>.Filter.Empty
            : MontarFiltroBuscaPecas(termo.Trim());

        var limite = string.IsNullOrWhiteSpace(termo) ? 500 : 30;

        return await _pecas.Find(filtro)
            .Sort(Builders<PecaEstoque>.Sort.Ascending(x => x.Nome))
            .Limit(limite)
            .ToListAsync();
    }

    private static FilterDefinition<PecaEstoque> MontarFiltroBuscaPecas(string termo)
    {
        var regex = new MongoDB.Bson.BsonRegularExpression(termo, "i");

        return Builders<PecaEstoque>.Filter.Or(
            Builders<PecaEstoque>.Filter.Regex(x => x.Nome, regex),
            Builders<PecaEstoque>.Filter.Regex(x => x.Descricao, regex),
            Builders<PecaEstoque>.Filter.Regex(x => x.MarcaPeca, regex),
            Builders<PecaEstoque>.Filter.ElemMatch(
                x => x.ModelosCompativeis,
                Builders<ModeloCompativel>.Filter.Or(
                    Builders<ModeloCompativel>.Filter.Regex(mc => mc.ModeloNome, regex),
                    Builders<ModeloCompativel>.Filter.Regex(mc => mc.MarcaNome, regex))));
    }

    public async Task<PecaEstoque?> ObterPorIdAsync(string id)
        => await _pecas.Find(x => x.Id == id).FirstOrDefaultAsync();

    public async Task<PecaEstoque> SalvarAsync(PecaEstoque peca)
    {
        if (string.IsNullOrWhiteSpace(peca.Categoria))
            peca.Categoria = InferirCategoria(peca);

        peca.AtualizadoEm = DateTime.UtcNow;
        if (string.IsNullOrWhiteSpace(peca.Id))
            await _pecas.InsertOneAsync(peca);
        else
            await _pecas.ReplaceOneAsync(
                Builders<PecaEstoque>.Filter.Eq(x => x.Id, peca.Id),
                peca,
                new ReplaceOptions { IsUpsert = true });

        await InvalidarCacheReferenciaAsync();
        return peca;
    }

    public async Task<List<DisponibilidadePecaResponse>> ConsultarDisponibilidadeAsync(
        string modeloId, string? pecaId = null)
    {
        var filtroCompat = Builders<PecaEstoque>.Filter.ElemMatch(
            x => x.ModelosCompativeis,
            mc => mc.ModeloId == modeloId);

        if (!string.IsNullOrWhiteSpace(pecaId))
            filtroCompat &= Builders<PecaEstoque>.Filter.Eq(x => x.Id, pecaId);

        var pecas = await _pecas.Find(filtroCompat).Limit(MaxPecasReferencia).ToListAsync();
        if (pecas.Count == 0) return [];

        var todosModeloIds = pecas
            .SelectMany(p => p.ModelosCompativeis.Select(mc => mc.ModeloId))
            .Distinct()
            .ToList();

        var filtroOs = Builders<OsLocalData>.Filter.In(x => x.ModeloId, todosModeloIds)
            & Builders<OsLocalData>.Filter.Nin(x => x.Situacao, SituacoesFinais)
            & Builders<OsLocalData>.Filter.Ne(x => x.TipoPecaProblemaId, null);

        var osEmExecucao = (await _osLocal.Find(filtroOs).Limit(MaxOsReferencia).ToListAsync())
            .Where(os => !OsSituacaoHelper.EhFinalizada(os.Situacao))
            .ToList();

        var resultado = new List<DisponibilidadePecaResponse>();

        foreach (var peca in pecas)
        {
            var modelosIdsDestaPeca = peca.ModelosCompativeis.Select(mc => mc.ModeloId).ToHashSet();
            var osDestaPeca = osEmExecucao
                .Where(os => modelosIdsDestaPeca.Contains(os.ModeloId ?? "")
                          && os.TipoPecaProblemaId == peca.Id)
                .ToList();

            var emExecucao = osDestaPeca.Count;
            var (troca, minimo) = PecaPrecoResolver.Resolver(peca, modeloId);

            resultado.Add(new DisponibilidadePecaResponse
            {
                PecaId = peca.Id!,
                PecaNome = peca.Nome,
                Descricao = peca.Descricao,
                QuantidadeEstoque = peca.QuantidadeEstoque,
                EmExecucao = emExecucao,
                Disponiveis = peca.QuantidadeEstoque,
                ValorSugeridoTroca = troca,
                ValorSugeridoMinimo = minimo,
                Parcelamento = peca.Parcelamento,
                Alerta = DeveAlertarEstoque(peca, peca.QuantidadeEstoque),
                NivelEstoque = _estoqueNivel.CalcularNivel(peca.QuantidadeEstoque),
                NivelDisponivel = _estoqueNivel.CalcularNivel(peca.QuantidadeEstoque),
                ModelosCompativeis = peca.ModelosCompativeis
                    .Select(mc => $"{mc.MarcaNome} {mc.ModeloNome}".Trim())
                    .ToList(),
                OsEmExecucao = osDestaPeca.Select(os => new OsExecucaoInfo
                {
                    BlingId = os.BlingId,
                    OsNumero = os.OsNumero,
                    ModeloNome = os.ModeloNome,
                    MarcaNome = os.MarcaNome
                }).ToList()
            });
        }

        return resultado;
    }

    public Task<ModeloServicosValoresResponse> ConsultarServicosValoresAsync(string modeloId)
    {
        var cacheKey = $"v|{modeloId}";
        if (_valoresCache.TryGetValue(cacheKey, out var hit)
            && DateTime.UtcNow - hit.Ts < ReferenciaCacheTtl)
            return Task.FromResult(hit.Data);

        var response = MontarServicosValores(ObterPecasModelo(modeloId), modeloId);
        _valoresCache[cacheKey] = (DateTime.UtcNow, response);
        return Task.FromResult(response);
    }

    private static readonly string[] OrdemCategoriasPeca =
    [
        "Bateria",
        "Tela Incell com Aro",
        "Tela Incell",
        "Tela OLED com Aro",
        "Tela OLED",
        "Tampa traseira",
        "Vidro Traseiro",
        "Vidro para Display",
        "Conector de carga",
        "Placa conectora",
        "Lentes",
        "Câmeras",
        "Flex",
        "Tags",
        "Outros"
    ];

    private ModeloServicosValoresResponse MontarServicosValores(
        IReadOnlyList<PecaEstoque> pecas, string modeloId) =>
        new()
        {
            Pecas = pecas
                .Select(p => MapearPecaValor(p, modeloId))
                .OrderBy(p => IndiceCategoriaPeca(p.Categoria))
                .ThenBy(p => p.Nome, StringComparer.OrdinalIgnoreCase)
                .ToList()
        };

    private static int IndiceCategoriaPeca(string? categoria)
    {
        var cat = categoria?.Trim();
        if (string.IsNullOrEmpty(cat)) return 999;
        var idx = Array.IndexOf(OrdemCategoriasPeca, cat);
        return idx >= 0 ? idx : 998;
    }

    private static string InferirCategoria(PecaEstoque p)
    {
        if (!string.IsNullOrWhiteSpace(p.Categoria))
            return p.Categoria.Trim();

        var n = NormalizarTextoPeca(p.Nome);

        if (n.Contains("oled") && (n.Contains("com aro") || n.Contains("c/ aro") || n.Contains("c aro")))
            return "Tela OLED com Aro";
        if (n.Contains("oled"))
            return "Tela OLED";

        if ((n.Contains("incell") || n.Contains("in cell")) &&
            (n.Contains("com aro") || n.Contains("c/ aro") || n.Contains("c aro")))
            return "Tela Incell com Aro";
        if (n.Contains("incell") || n.Contains("in cell"))
            return "Tela Incell";

        if (n.Contains("placa conectora") || n.Contains("placa do conector"))
            return "Placa conectora";
        if (n.Contains("conector") && (n.Contains("carga") || n.Contains("carreg")))
            return "Conector de carga";
        if (n.Contains("dock") || n.Contains("entrada de carga"))
            return "Conector de carga";

        if (n.Contains("vidro") && (n.Contains("display") || n.Contains("tela") || n.Contains("frontal")))
            return "Vidro para Display";
        if (n.Contains("vidro traseiro") || n.Contains("back glass"))
            return "Vidro Traseiro";
        if (n.Contains("tampa") || n.Contains("back cover"))
            return "Tampa traseira";
        if (n.Contains("lente"))
            return "Lentes";
        if (n.Contains("camera") || n.Contains("cam "))
            return "Câmeras";
        if (n.Contains("flex"))
            return "Flex";
        if (n.Contains("tag"))
            return "Tags";
        if (n.Contains("bateria"))
            return "Bateria";

        if (n.Contains("tela") || n.Contains("display") || n.Contains("lcd"))
            return "Tela Incell";

        return "Outros";
    }

    private static string NormalizarTextoPeca(string texto) =>
        texto.ToLowerInvariant()
            .Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
                != System.Globalization.UnicodeCategory.NonSpacingMark)
            .Aggregate("", (a, c) => a + c);

    private PecaValorInfo MapearPecaValor(PecaEstoque p, string? modeloId = null)
    {
        var (troca, minimo) = PecaPrecoResolver.Resolver(p, modeloId);
        var variacoes = p.Variacoes
            .OrderBy(v => v.Ordem)
            .ThenBy(v => v.Rotulo)
            .Select(v => new VariacaoServicoInfo
            {
                Rotulo = v.Rotulo,
                Detalhe = v.Detalhe,
                ValorSugeridoTroca = v.ValorSugeridoTroca,
                ValorSugeridoMinimo = v.ValorSugeridoMinimo,
                Garantia = v.Garantia,
                Ordem = v.Ordem
            })
            .ToList();

        var cores = string.IsNullOrWhiteSpace(modeloId)
            ? []
            : p.ModelosCompativeis
                .Where(mc => mc.ModeloId == modeloId)
                .SelectMany(mc => mc.Cores ?? [])
                .Where(c => !string.IsNullOrWhiteSpace(c.Cor))
                .Select(c => new CorEstoqueModelo
                {
                    Cor = c.Cor.Trim(),
                    Quantidade = Math.Max(0, c.Quantidade)
                })
                .ToList();

        var qtdExibir = cores.Count > 0
            ? cores.Sum(c => c.Quantidade)
            : p.QuantidadeEstoque;

        return new PecaValorInfo
        {
            PecaId = p.Id!,
            Nome = p.Nome,
            Categoria = InferirCategoria(p),
            MarcaPeca = p.MarcaPeca,
            ValorSugeridoTroca = troca,
            ValorSugeridoMinimo = minimo,
            Parcelamento = p.Parcelamento,
            Garantia = p.Garantia,
            QuantidadeEstoque = qtdExibir,
            NivelEstoque = _estoqueNivel.CalcularNivel(qtdExibir),
            Variacoes = variacoes,
            Cores = cores
        };
    }

    private List<PecaEstoque> ObterPecasModelo(string modeloId)
    {
        if (_pecasPorModelo.TryGetValue(modeloId, out var lista))
            return lista.Take(MaxPecasReferencia).ToList();
        return [];
    }

    public async Task<ModeloOperacaoResponse> ConsultarOperacaoAsync(
        string modeloId, long? excluirBlingId = null)
    {
        var cacheKey = $"o|{modeloId}|{excluirBlingId}";
        if (_operacaoCache.TryGetValue(cacheKey, out var hit)
            && DateTime.UtcNow - hit.Ts < ReferenciaCacheTtl)
            return hit.Data;

        var filtroOs = FiltroOsAbertas(modeloId, excluirBlingId);

        var modeloTask = _modelos.Find(x => x.Id == modeloId).FirstOrDefaultAsync();
        var pecas = ObterPecasModelo(modeloId);
        var osTask = _osLocal.Find(filtroOs)
            .Sort(Builders<OsLocalData>.Sort.Descending(x => x.DataEntrada))
            .Limit(MaxOsReferencia)
            .ToListAsync();
        var osHojeTask = ContarOsAbertasHojeAsync();

        await Task.WhenAll(modeloTask, osTask, osHojeTask);

        var modelo = modeloTask.Result;
        var osEmAndamento = osTask.Result
            .Where(os => !OsSituacaoHelper.EhFinalizada(os.Situacao))
            .ToList();
        var osAbertasHoje = osHojeTask.Result;

        var pecasResumo = pecas.Select(p =>
        {
            var emExecucao = osEmAndamento.Count(os => os.TipoPecaProblemaId == p.Id);
            return new PecaEstoqueOperacaoInfo
            {
                PecaId = p.Id!,
                Nome = p.Nome,
                QuantidadeEstoque = p.QuantidadeEstoque,
                EmExecucao = emExecucao,
                Disponiveis = p.QuantidadeEstoque,
                Alerta = DeveAlertarEstoque(p, p.QuantidadeEstoque),
                IgnorarAlertaEstoque = p.IgnorarAlertaEstoque,
                NivelDisponivel = _estoqueNivel.CalcularNivel(p.QuantidadeEstoque)
            };
        }).ToList();

        var alertas = MontarAlertas(
            modelo?.Nome ?? osEmAndamento.FirstOrDefault()?.ModeloNome,
            pecasResumo);

        var response = new ModeloOperacaoResponse
        {
            MarcaNome = modelo?.MarcaNome ?? osEmAndamento.FirstOrDefault()?.MarcaNome,
            ModeloNome = modelo?.Nome ?? osEmAndamento.FirstOrDefault()?.ModeloNome,
            OsAbertasHoje = osAbertasHoje,
            OsModeloEmAssistencia = osEmAndamento.Count,
            OsEmAndamento = osEmAndamento.Select(MapOsEmAndamento).ToList(),
            PecasResumo = pecasResumo,
            Alertas = alertas
        };

        _operacaoCache[cacheKey] = (DateTime.UtcNow, response);
        return response;
    }

    public async Task<ModeloReferenciaResponse> ConsultarReferenciaModeloAsync(
        string modeloId, long? excluirBlingId = null)
    {
        var cacheKey = $"{modeloId}|{excluirBlingId}";
        if (_referenciaCache.TryGetValue(cacheKey, out var hit)
            && DateTime.UtcNow - hit.Ts < ReferenciaCacheTtl)
            return hit.Data;

        var valoresTask = ConsultarServicosValoresAsync(modeloId);
        var operacaoTask = ConsultarOperacaoAsync(modeloId, excluirBlingId);
        await Task.WhenAll(valoresTask, operacaoTask);

        var valores = valoresTask.Result;
        var operacao = operacaoTask.Result;
        var pecasResumo = operacao.PecasResumo.ToDictionary(p => p.PecaId);

        var response = new ModeloReferenciaResponse
        {
            MarcaNome = operacao.MarcaNome,
            ModeloNome = operacao.ModeloNome,
            OsEmAndamento = operacao.OsEmAndamento,
            Alertas = operacao.Alertas,
            Pecas = valores.Pecas.Select(p =>
            {
                pecasResumo.TryGetValue(p.PecaId, out var resumo);
                return new PecaReferenciaInfo
                {
                    PecaId = p.PecaId,
                    Nome = p.Nome,
                    MarcaPeca = p.MarcaPeca,
                    ValorSugeridoTroca = p.ValorSugeridoTroca,
                    ValorSugeridoMinimo = p.ValorSugeridoMinimo,
                    Parcelamento = p.Parcelamento,
                    Garantia = p.Garantia,
                    QuantidadeEstoque = p.QuantidadeEstoque,
                    EmExecucao = resumo?.EmExecucao ?? 0,
                    Disponiveis = p.QuantidadeEstoque,
                    TemEstoque = p.QuantidadeEstoque > 0,
                    Alerta = resumo?.Alerta ?? false,
                    NivelEstoque = p.NivelEstoque,
                    NivelDisponivel = p.NivelEstoque
                };
            }).ToList()
        };

        _referenciaCache[cacheKey] = (DateTime.UtcNow, response);
        return response;
    }

    private static OsEmAndamentoInfo MapOsEmAndamento(OsLocalData os) => new()
    {
        BlingId = os.BlingId,
        OsNumero = os.OsNumero,
        Situacao = os.Situacao,
        TipoPecaProblemaNome = os.TipoPecaProblemaNome,
        Defeito = os.Defeito,
        EstadoTela = os.EstadoTela,
        DataEntrada = os.DataEntrada,
        DataPrevistaTermino = os.DataPrevistaTermino
    };

    private static FilterDefinition<OsLocalData> FiltroOsAbertas(string modeloId, long? excluirBlingId)
    {
        var filtro = Builders<OsLocalData>.Filter.Eq(x => x.ModeloId, modeloId)
            & Builders<OsLocalData>.Filter.Nin(x => x.Situacao, SituacoesFinais);

        if (excluirBlingId.HasValue)
            filtro &= Builders<OsLocalData>.Filter.Ne(x => x.BlingId, excluirBlingId.Value);

        return filtro;
    }

    private async Task<int> ContarOsAbertasHojeAsync()
    {
        if (_osHojeCache is { } hit && DateTime.UtcNow - hit.Ts < ReferenciaCacheTtl)
            return hit.OsAbertasHoje;

        var hoje = DateTime.Today;
        var amanha = hoje.AddDays(1);
        var baseFiltro = Builders<OsLocalData>.Filter.Nin(x => x.Situacao, SituacoesFinais);

        var comPrevista = baseFiltro
            & Builders<OsLocalData>.Filter.Ne(x => x.DataPrevistaTermino, null)
            & Builders<OsLocalData>.Filter.Lt(x => x.DataPrevistaTermino, amanha);

        var semPrevista = baseFiltro
            & Builders<OsLocalData>.Filter.Or(
                Builders<OsLocalData>.Filter.Eq(x => x.DataPrevistaTermino, null),
                Builders<OsLocalData>.Filter.Exists(x => x.DataPrevistaTermino, false))
            & Builders<OsLocalData>.Filter.Lt(x => x.DataEntrada, amanha);

        var total = (int)await _osLocal.CountDocumentsAsync(comPrevista | semPrevista);
        _osHojeCache = (DateTime.UtcNow, total);
        return total;
    }

    private bool DeveAlertarEstoque(PecaEstoque peca, int quantidade) =>
        !peca.IgnorarAlertaEstoque && _estoqueNivel.EhAlerta(quantidade);

    private List<AlertaOperacionalInfo> MontarAlertas(
        string? modeloNome,
        List<PecaEstoqueOperacaoInfo> pecas)
    {
        var alertas = new List<AlertaOperacionalInfo>();
        var limites = _estoqueNivel.ObterLimites();

        foreach (var peca in pecas.Where(p => !p.IgnorarAlertaEstoque && (p.Alerta || p.QuantidadeEstoque <= 0)))
        {
            var ehTela = EhServicoTela(peca.Nome);
            var nivel = peca.NivelDisponivel ?? _estoqueNivel.CalcularNivel(peca.QuantidadeEstoque);
            var semEstoque = peca.QuantidadeEstoque <= 0;

            if (!semEstoque && !peca.Alerta) continue;

            var severidade = nivel switch
            {
                "vermelho" => "critico",
                "laranja" => "atencao",
                "amarelo" => "aviso",
                _ => "aviso"
            };
            if (semEstoque) severidade = "critico";

            var titulo = semEstoque
                ? $"{peca.Nome}: sem estoque"
                : nivel switch
                {
                    "laranja" => $"Estoque baixo (< {limites.LimiteLaranja}): {peca.Nome}",
                    "amarelo" => $"Estoque em atenção (< {limites.LimiteAmarelo}): {peca.Nome}",
                    _ => $"Estoque: {peca.Nome}"
                };

            var mensagem = semEstoque
                ? $"Não há {peca.Nome.ToLower()} em estoque. Use fornecedor externo na OS ou repor antes de confirmar."
                : $"Restam apenas {peca.QuantidadeEstoque} {peca.Nome.ToLower()} em estoque " +
                  $"(abaixo do limite de {limites.LimiteAmarelo} unidades).";

            if (ehTela)
                mensagem += " Se o defeito for na tela, combine um prazo maior com o cliente.";

            alertas.Add(new AlertaOperacionalInfo
            {
                Tipo = "estoque",
                Severidade = severidade,
                Titulo = titulo,
                Mensagem = mensagem,
                PecaNome = peca.Nome,
                RelacionadoTela = ehTela
            });
        }

        return alertas;
    }

    private static bool EhServicoTela(string nome) =>
        nome.Contains("tela", StringComparison.OrdinalIgnoreCase);

    public async Task GarantirCatalogoDemonstracaoAsync()
    {
        var todas = await _pecas.Find(Builders<PecaEstoque>.Filter.Empty).ToListAsync();

        foreach (var peca in todas.Where(p => EhServicoTela(p.Nome)))
        {
            if (peca.Variacoes.Count == 0) continue;
            peca.Variacoes = [];
            await SalvarAsync(peca);
        }

        foreach (var peca in todas.Where(p => EhBateriaPadrao(p.Nome) && !TemCompatibilidadeIphone(p)))
        {
            var sug = peca.ValorSugeridoTroca ?? 180m;
            var min = peca.ValorSugeridoMinimo ?? sug;
            var temApple = peca.ModelosCompativeis.Any(EhModeloApple);
            peca.Variacoes = temApple
                ? CriarVariacoesServicoBateria(sug, min, incluirTrocaCi: true)
                : [];
            await SalvarAsync(peca);

            if (!temApple) continue;

            var appleCompativeis = peca.ModelosCompativeis.Where(EhModeloApple).ToList();
            if (appleCompativeis.Count == 0) continue;

            var calibrada = todas.FirstOrDefault(p =>
                p.Nome.Contains("calibrad", StringComparison.OrdinalIgnoreCase)
                && p.Nome.Contains("bateria", StringComparison.OrdinalIgnoreCase)
                && p.ModelosCompativeis.Any(mc => appleCompativeis.Any(a => a.ModeloId == mc.ModeloId)));

            if (calibrada is null)
            {
                calibrada = new PecaEstoque
                {
                    Nome = "Bateria calibrada",
                    Descricao = "Peça calibrada com estoque próprio",
                    MarcaPeca = peca.MarcaPeca,
                    QuantidadeEstoque = Math.Max(0, peca.QuantidadeEstoque / 2),
                    ValorSugeridoTroca = sug + 60,
                    ValorSugeridoMinimo = min + 50,
                    Garantia = peca.Garantia ?? "6 meses",
                    ModelosCompativeis = appleCompativeis
                        .Select(mc => new ModeloCompativel
                        {
                            ModeloId = mc.ModeloId,
                            ModeloNome = mc.ModeloNome,
                            MarcaNome = mc.MarcaNome
                        })
                        .ToList()
                };
            }

            var sugCal = calibrada.ValorSugeridoTroca ?? sug + 60;
            var minCal = calibrada.ValorSugeridoMinimo ?? min + 50;
            calibrada.Variacoes = CriarVariacoesServicoBateria(sugCal, minCal, incluirTrocaCi: true);
            await SalvarAsync(calibrada);
        }

        foreach (var peca in todas.Where(p =>
                     p.Nome.Contains("bateria", StringComparison.OrdinalIgnoreCase)
                     && p.Nome.Contains("calibrad", StringComparison.OrdinalIgnoreCase)
                     && !TemCompatibilidadeIphone(p)))
        {
            var sugCal = peca.ValorSugeridoTroca ?? 240m;
            var minCal = peca.ValorSugeridoMinimo ?? sugCal;
            peca.Variacoes = CriarVariacoesServicoBateria(sugCal, minCal, incluirTrocaCi: true);
            await SalvarAsync(peca);
        }

        await GarantirCatalogoIphone13Async();
    }

    private async Task GarantirCatalogoIphone13Async()
    {
        var modelo = await _aparelhos.SalvarModeloAsync("13", null, "iPhone", "Celular");
        if (string.IsNullOrWhiteSpace(modelo.Id)) return;

        var compat = new ModeloCompativel
        {
            ModeloId = modelo.Id,
            ModeloNome = modelo.Nome,
            MarcaNome = modelo.MarcaNome
        };

        var pecasModelo = await _pecas
            .Find(Builders<PecaEstoque>.Filter.ElemMatch(
                x => x.ModelosCompativeis,
                mc => mc.ModeloId == modelo.Id))
            .ToListAsync();

        var bateria = pecasModelo.FirstOrDefault(p =>
            EhBateriaPadrao(p.Nome) && !p.Nome.Contains("calibrad", StringComparison.OrdinalIgnoreCase));

        if (bateria is null)
        {
            await SalvarAsync(new PecaEstoque
            {
                Nome = "Bateria",
                QuantidadeEstoque = 5,
                Garantia = "6 meses",
                ModelosCompativeis = [compat],
                Variacoes = CriarVariacoesBateriaIphone13()
            });
        }
        else
        {
            bateria.Variacoes = CriarVariacoesBateriaIphone13();
            await SalvarAsync(bateria);
        }

        var calibrada = pecasModelo.FirstOrDefault(p =>
            p.Nome.Contains("bateria", StringComparison.OrdinalIgnoreCase)
            && p.Nome.Contains("calibrad", StringComparison.OrdinalIgnoreCase));

        if (calibrada is null)
        {
            await SalvarAsync(new PecaEstoque
            {
                Nome = "Bateria Calibrada",
                QuantidadeEstoque = 3,
                Garantia = "6 meses",
                ModelosCompativeis = [compat],
                Variacoes = CriarVariacoesBateriaCalibradaIphone13()
            });
        }
        else
        {
            calibrada.Variacoes = CriarVariacoesBateriaCalibradaIphone13();
            await SalvarAsync(calibrada);
        }
    }

    private static List<VariacaoServico> CriarVariacoesBateriaIphone13() =>
    [
        new VariacaoServico
        {
            Rotulo = "Padrão",
            Detalhe = null,
            ValorSugeridoTroca = 380,
            ValorSugeridoMinimo = 350,
            Ordem = 1
        },
        new VariacaoServico
        {
            Rotulo = "Troca Premium",
            Detalhe = "Só funciona quando o aparelho ainda possui bateria original instalada.",
            ValorSugeridoTroca = 450,
            ValorSugeridoMinimo = 420,
            Ordem = 2
        }
    ];

    private static List<VariacaoServico> CriarVariacoesBateriaCalibradaIphone13() =>
    [
        new VariacaoServico
        {
            Rotulo = "Padrão",
            Detalhe = "O aparelho não apresentará mensagem de bateria desconhecida. No sistema constará aviso de peça genuína usada (informativo, não é erro).",
            ValorSugeridoTroca = 320,
            ValorSugeridoMinimo = 290,
            Ordem = 1
        },
        new VariacaoServico
        {
            Rotulo = "Troca Premium",
            Detalhe = "Só funciona quando o aparelho ainda possui bateria original instalada.",
            ValorSugeridoTroca = 520,
            ValorSugeridoMinimo = 480,
            Ordem = 2
        }
    ];

    private static bool EhBateriaPadrao(string nome) =>
        nome.Equals("Bateria", StringComparison.OrdinalIgnoreCase);

    private static bool EhModeloApple(ModeloCompativel mc) =>
        mc.MarcaNome?.Contains("iphone", StringComparison.OrdinalIgnoreCase) == true
        || mc.MarcaNome?.Contains("apple", StringComparison.OrdinalIgnoreCase) == true;

    private static bool TemCompatibilidadeIphone(PecaEstoque peca) =>
        peca.ModelosCompativeis.Any(mc =>
            mc.MarcaNome?.Contains("iphone", StringComparison.OrdinalIgnoreCase) == true);

    private static List<VariacaoServico> CriarVariacoesServicoBateria(
        decimal valorSugerido, decimal valorMinimo, bool incluirTrocaCi)
    {
        var lista = new List<VariacaoServico>
        {
            new()
            {
                Rotulo = "Sem programação",
                Detalhe = "Substituição direta da peça",
                ValorSugeridoTroca = valorSugerido,
                ValorSugeridoMinimo = valorMinimo,
                Ordem = 1
            },
            new()
            {
                Rotulo = "Com programação",
                Detalhe = "Sem mensagem de peça não original",
                ValorSugeridoTroca = valorSugerido + 50,
                ValorSugeridoMinimo = valorMinimo + 40,
                Ordem = 2
            }
        };

        if (incluirTrocaCi)
        {
            lista.Add(new VariacaoServico
            {
                Rotulo = "Troca de CI",
                Detalhe = "Troca/reprogramação do chip de bateria",
                ValorSugeridoTroca = valorSugerido + 90,
                ValorSugeridoMinimo = valorMinimo + 70,
                Ordem = 3
            });
        }

        return lista;
    }
}
