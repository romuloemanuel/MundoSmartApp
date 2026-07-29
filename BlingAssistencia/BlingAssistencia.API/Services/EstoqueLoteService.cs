using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IEstoqueLoteService
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<List<PedidoCompraEstoque>> ListarPedidosAsync(int limite = 100);
    Task<PedidoCompraDetalheResponse?> ObterPedidoAsync(string id);
    Task<PedidoCompraDetalheResponse> RegistrarPedidoAsync(RegistrarPedidoCompraRequest request);
    Task<List<LoteEstoque>> ListarLotesAsync(string? pecaId = null, bool somenteComSaldo = false);
    Task<LoteEstoque> AtualizarLoteAsync(string id, AtualizarLoteEstoqueRequest request);
    /// <summary>Inclui um novo item (lote) em um pedido de compra já existente.</summary>
    Task<LoteEstoque> AdicionarItemPedidoAsync(string pedidoId, ItemPedidoCompraRequest item);
    /// <summary>Remove um lote do pedido — só se ainda não houver saída.</summary>
    Task ExcluirLoteAsync(string id);
    Task<List<MovimentacaoEstoque>> ListarMovimentacoesAsync(
        string? tipo = null, DateTime? inicio = null, DateTime? fim = null, int limite = 200);
    Task<List<MovimentacaoEstoque>> RegistrarSaidaAsync(RegistrarSaidaEstoqueRequest request);
    Task RegistrarEstornoOsAsync(RegistrarEstornoOsRequest request);
    Task<ReposicaoSemanalResponse> RelatorioReposicaoSemanalAsync(DateTime? fim = null);
    Task<ReposicaoSemanalResponse> RelatorioReposicaoAsync(
        DateTime? inicio = null,
        DateTime? fim = null,
        string? periodo = null,
        string? modeloId = null);
    Task<CustoPecaReferenciaResponse?> ObterCustoReferenciaPecaAsync(string pecaId);
    /// <summary>Valor em estoque, investimento mensal e giro (saídas a custo).</summary>
    Task<RelatorioFinanceiroEstoqueResponse> RelatorioFinanceiroAsync(int meses = 12);
    /// <summary>Cria lote a partir do estoque informado no cadastro da peça, se ainda não houver saldo em lotes.</summary>
    Task GarantirLoteCatalogoAsync(string pecaId);

    Task<RelatorioReposicaoHistorico> SalvarRelatorioReposicaoAsync(SalvarRelatorioReposicaoRequest request);
    Task<List<RelatorioReposicaoHistorico>> ListarRelatoriosReposicaoAsync(int limite = 10, string? statusConclusao = null);
    Task<RelatorioReposicaoHistorico?> ObterRelatorioReposicaoAsync(string id);
    Task<RelatorioReposicaoHistorico> AtualizarStatusRelatorioReposicaoAsync(string id, string statusConclusao);

    Task<List<LoteGarantiaItem>> ListarLotesEmGarantiaAsync(
        string? fornecedor = null,
        string? osNumero = null,
        string? lote = null);

    /// <summary>
    /// Peças ainda em estoque na assistência (não aplicadas no aparelho)
    /// cuja garantia do fornecedor vence em até N dias.
    /// </summary>
    Task<List<LoteGarantiaItem>> ListarLotesPrestesAVencerAsync(
        int dias = 30,
        string? fornecedor = null,
        string? pecaOuPedido = null);
    /// <summary>Coloca a peça na caixa de retorno (defeito) — ainda não envia ao fornecedor.</summary>
    Task<CaixaRetornoAdicaoResponse> AdicionarCaixaRetornoGarantiaAsync(RegistrarDevolucaoGarantiaRequest request);
    Task<CaixaRetornoGarantiaResponse> ListarCaixaRetornoGarantiaAsync(string? fornecedor = null);
    Task RemoverCaixaRetornoGarantiaAsync(string itemId);
    Task<LoteDevolucaoGarantiaDocumento> GerarLoteDevolucaoGarantiaAsync(
        GerarLoteDevolucaoGarantiaRequest request);
    /// <summary>Histórico de lotes já baixados.</summary>
    Task<List<LoteRetornoGarantiaHistorico>> ListarLotesRetornoHistoricoAsync(
        string? fornecedor = null,
        DateTime? de = null,
        DateTime? ate = null,
        int limite = 100);
    Task<LoteRetornoGarantiaHistorico?> ObterLoteRetornoHistoricoAsync(string id);
    Task<AnaliseRetornoGarantiaResponse> AnalisarRetornosGarantiaAsync(
        DateTime? de = null,
        DateTime? ate = null,
        string? fornecedor = null);
    Task<List<EstoqueSugestaoItem>> SugerirOsGarantiaAsync(string? termo, int limite = 20);
    Task<List<EstoqueSugestaoItem>> SugerirLoteGarantiaAsync(string? termo, int limite = 20);
    Task<List<EstoqueSugestaoItem>> SugerirFornecedorGarantiaAsync(string? termo, int limite = 20);
}

public class EstoqueLoteService : IEstoqueLoteService
{
    private readonly IMongoCollection<PedidoCompraEstoque> _pedidos;
    private readonly IMongoCollection<LoteEstoque> _lotes;
    private readonly IMongoCollection<MovimentacaoEstoque> _movimentacoes;
    private readonly IMongoCollection<PecaEstoque> _pecas;
    private readonly IMongoCollection<RelatorioReposicaoHistorico> _relatoriosReposicao;
    private readonly IMongoCollection<CaixaRetornoGarantiaItem> _caixaRetorno;
    private readonly IMongoCollection<LoteRetornoGarantiaHistorico> _lotesRetornoHistorico;
    private readonly IPecaEstoqueRepository _pecasRepo;
    private readonly IOsLocalRepository _osRepo;
    private const int DiasAntecedenciaPrazoEnvio = 7;

    public EstoqueLoteService(
        MongoDbService mongo,
        IPecaEstoqueRepository pecasRepo,
        IOsLocalRepository osRepo)
    {
        _pecasRepo = pecasRepo;
        _osRepo = osRepo;
        _pedidos = mongo.GetCollection<PedidoCompraEstoque>("estoque_pedidos_compra");
        _lotes = mongo.GetCollection<LoteEstoque>("estoque_lotes");
        _movimentacoes = mongo.GetCollection<MovimentacaoEstoque>("estoque_movimentacoes");
        _pecas = mongo.GetCollection<PecaEstoque>("pecas_estoque");
        _relatoriosReposicao = mongo.GetCollection<RelatorioReposicaoHistorico>("estoque_relatorios_reposicao");
        _caixaRetorno = mongo.GetCollection<CaixaRetornoGarantiaItem>("estoque_caixa_retorno_garantia");
        _lotesRetornoHistorico = mongo.GetCollection<LoteRetornoGarantiaHistorico>("estoque_lotes_retorno_garantia");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _pedidos.Indexes.CreateOneAsync(
            new CreateIndexModel<PedidoCompraEstoque>(
                Builders<PedidoCompraEstoque>.IndexKeys.Descending(x => x.DataPedido)),
            cancellationToken: cancellationToken);
        await _lotes.Indexes.CreateOneAsync(
            new CreateIndexModel<LoteEstoque>(
                Builders<LoteEstoque>.IndexKeys
                    .Ascending(x => x.PecaId)
                    .Ascending(x => x.DataEntrada)),
            cancellationToken: cancellationToken);
        await _movimentacoes.Indexes.CreateOneAsync(
            new CreateIndexModel<MovimentacaoEstoque>(
                Builders<MovimentacaoEstoque>.IndexKeys.Descending(x => x.Data)),
            cancellationToken: cancellationToken);
        await _relatoriosReposicao.Indexes.CreateOneAsync(
            new CreateIndexModel<RelatorioReposicaoHistorico>(
                Builders<RelatorioReposicaoHistorico>.IndexKeys.Descending(x => x.GeradoEm)),
            cancellationToken: cancellationToken);
        await _lotes.Indexes.CreateOneAsync(
            new CreateIndexModel<LoteEstoque>(
                Builders<LoteEstoque>.IndexKeys.Ascending(x => x.DataVencimentoGarantia)),
            cancellationToken: cancellationToken);
        await _caixaRetorno.Indexes.CreateOneAsync(
            new CreateIndexModel<CaixaRetornoGarantiaItem>(
                Builders<CaixaRetornoGarantiaItem>.IndexKeys
                    .Ascending(x => x.Status)
                    .Ascending(x => x.Fornecedor)
                    .Ascending(x => x.DataVencimentoGarantia)),
            cancellationToken: cancellationToken);
        await _lotesRetornoHistorico.Indexes.CreateOneAsync(
            new CreateIndexModel<LoteRetornoGarantiaHistorico>(
                Builders<LoteRetornoGarantiaHistorico>.IndexKeys
                    .Descending(x => x.GeradoEm)
                    .Ascending(x => x.Fornecedor)),
            cancellationToken: cancellationToken);
    }

    public async Task<List<PedidoCompraEstoque>> ListarPedidosAsync(int limite = 100) =>
        await _pedidos.Find(_ => true)
            .SortByDescending(x => x.DataPedido)
            .ThenByDescending(x => x.CriadoEm)
            .Limit(limite)
            .ToListAsync();

    public async Task<PedidoCompraDetalheResponse?> ObterPedidoAsync(string id)
    {
        var pedido = await _pedidos.Find(x => x.Id == id).FirstOrDefaultAsync();
        if (pedido is null) return null;

        var lotes = await _lotes.Find(x => x.PedidoCompraId == id)
            .SortBy(x => x.PecaNome)
            .ThenBy(x => x.MarcaPeca)
            .ToListAsync();

        return new PedidoCompraDetalheResponse { Pedido = pedido, Lotes = lotes };
    }

    public async Task<PedidoCompraDetalheResponse> RegistrarPedidoAsync(RegistrarPedidoCompraRequest request)
    {
        ValidarPedido(request);

        var dataPedido = request.DataPedido ?? DateTime.UtcNow;
        var numeroPedido = string.IsNullOrWhiteSpace(request.NumeroPedido)
            ? await GerarNumeroPedidoAsync(dataPedido)
            : request.NumeroPedido.Trim();

        var pecaIds = request.Itens
            .Select(i => i.PecaId?.Trim())
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Cast<string>()
            .ToList();
        var pecasLista = pecaIds.Count == 0
            ? new List<PecaEstoque>()
            : await _pecas.Find(Builders<PecaEstoque>.Filter.In(x => x.Id, pecaIds)).ToListAsync();
        var pecasById = pecasLista
            .Where(p => !string.IsNullOrWhiteSpace(p.Id))
            .ToDictionary(p => p.Id!, StringComparer.OrdinalIgnoreCase);

        var pedido = new PedidoCompraEstoque
        {
            NumeroPedido = numeroPedido,
            Fornecedor = request.Fornecedor.Trim(),
            NumeroNf = string.IsNullOrWhiteSpace(request.NumeroNf) ? null : request.NumeroNf.Trim(),
            DataPedido = dataPedido,
            Observacoes = request.Observacoes?.Trim(),
            CriadoEm = DateTime.UtcNow,
        };

        var lotes = new List<LoteEstoque>();
        var movimentacoes = new List<MovimentacaoEstoque>();
        decimal valorTotal = 0;
        var pecasAfetadas = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var incrementosCor = new List<(string PecaId, string ModeloId, string? ModeloNome, string Cor, int Quantidade)>();

        foreach (var item in request.Itens)
        {
            if (!pecasById.TryGetValue(item.PecaId.Trim(), out var peca))
                throw new ArgumentException($"Peça {item.PecaId} não encontrada.");

            var qtd = item.Quantidade;
            if (qtd <= 0) throw new ArgumentException($"Quantidade inválida para {peca.Nome}.");

            var categoria = InferirCategoriaPeca(peca);
            var cor = string.IsNullOrWhiteSpace(item.Cor) ? null : item.Cor.Trim();
            if (categoria == "Tampa traseira" || categoria == "Vidro Traseiro")
            {
                if (string.IsNullOrWhiteSpace(item.ModeloId))
                    throw new ArgumentException($"Informe o modelo da {categoria} ({peca.Nome}).");
                if (string.IsNullOrWhiteSpace(cor))
                    throw new ArgumentException($"Informe a cor da {categoria} para o modelo ({peca.Nome}).");
            }

            var garantiaMeses = item.GarantiaMeses > 0 ? item.GarantiaMeses : 12;
            var vencimento = dataPedido.AddMonths(garantiaMeses);

            var lote = new LoteEstoque
            {
                Id = ObjectId.GenerateNewId().ToString(),
                PedidoCompraId = string.Empty,
                NumeroPedido = pedido.NumeroPedido,
                Fornecedor = string.IsNullOrWhiteSpace(item.Fornecedor)
                    ? pedido.Fornecedor
                    : item.Fornecedor.Trim(),
                PecaId = peca.Id!,
                PecaNome = peca.Nome,
                MarcaPeca = string.IsNullOrWhiteSpace(item.MarcaPeca) ? peca.MarcaPeca : item.MarcaPeca.Trim(),
                ModeloId = string.IsNullOrWhiteSpace(item.ModeloId) ? null : item.ModeloId.Trim(),
                ModeloNome = ResolverModeloNome(peca, item.ModeloId, item.ModeloNome),
                Cor = cor,
                QuantidadeInicial = qtd,
                QuantidadeRestante = qtd,
                CustoUnitario = item.CustoUnitario,
                GarantiaMeses = garantiaMeses,
                DataEntrada = dataPedido,
                DataVencimentoGarantia = vencimento,
                CriadoEm = DateTime.UtcNow,
            };

            lotes.Add(lote);
            valorTotal += item.CustoUnitario * qtd;
            pecasAfetadas.Add(peca.Id!);

            if (!string.IsNullOrWhiteSpace(cor) && !string.IsNullOrWhiteSpace(item.ModeloId))
            {
                incrementosCor.Add((
                    peca.Id!,
                    item.ModeloId.Trim(),
                    item.ModeloNome,
                    cor,
                    qtd));
            }
        }

        pedido.TotalItens = lotes.Count;
        pedido.TotalUnidades = lotes.Sum(l => l.QuantidadeInicial);
        pedido.ValorTotal = valorTotal;

        await _pedidos.InsertOneAsync(pedido);

        foreach (var lote in lotes)
            lote.PedidoCompraId = pedido.Id!;

        if (lotes.Count > 0)
            await _lotes.InsertManyAsync(lotes);

        foreach (var lote in lotes)
        {
            movimentacoes.Add(new MovimentacaoEstoque
            {
                Tipo = "entrada",
                PecaId = lote.PecaId,
                PecaNome = lote.PecaNome,
                MarcaPeca = lote.MarcaPeca,
                ModeloId = lote.ModeloId,
                ModeloNome = lote.ModeloNome,
                Cor = lote.Cor,
                LoteId = lote.Id,
                PedidoCompraId = pedido.Id,
                NumeroPedido = pedido.NumeroPedido,
                Quantidade = lote.QuantidadeInicial,
                CustoUnitario = lote.CustoUnitario,
                Observacao = string.IsNullOrWhiteSpace(lote.Cor)
                    ? $"Entrada pedido {pedido.NumeroPedido}"
                    : $"Entrada pedido {pedido.NumeroPedido} — {lote.Cor}",
                Data = dataPedido,
                CriadoEm = DateTime.UtcNow,
            });
        }

        if (movimentacoes.Count > 0)
            await _movimentacoes.InsertManyAsync(movimentacoes);

        await AplicarIncrementosCorPedidoAsync(incrementosCor);

        foreach (var pecaId in pecasAfetadas)
            await SincronizarQuantidadePecaAsync(pecaId);

        await _pecasRepo.InvalidarCacheReferenciaAsync();

        return new PedidoCompraDetalheResponse { Pedido = pedido, Lotes = lotes };
    }

    public async Task<List<LoteEstoque>> ListarLotesAsync(string? pecaId = null, bool somenteComSaldo = false)
    {
        var filtro = Builders<LoteEstoque>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(pecaId))
            filtro &= Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, pecaId);
        if (somenteComSaldo)
            filtro &= Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0);

        return await _lotes.Find(filtro)
            .SortBy(x => x.DataEntrada)
            .ThenBy(x => x.CriadoEm)
            .Limit(500)
            .ToListAsync();
    }

    public async Task<LoteEstoque> AtualizarLoteAsync(string id, AtualizarLoteEstoqueRequest request)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Id do lote é obrigatório.");
        if (request is null)
            throw new ArgumentException("Dados do lote são obrigatórios.");

        var lote = await _lotes.Find(x => x.Id == id).FirstOrDefaultAsync()
            ?? throw new ArgumentException("Lote não encontrado.");

        var qtdInicialAnterior = lote.QuantidadeInicial;
        var qtdRestanteAnterior = lote.QuantidadeRestante;
        var consumido = Math.Max(0, qtdInicialAnterior - qtdRestanteAnterior);
        var custoAnterior = lote.CustoUnitario;
        var alterouQtd = false;
        var alterouCusto = false;

        if (request.Fornecedor != null)
        {
            var forn = request.Fornecedor.Trim();
            if (string.IsNullOrWhiteSpace(forn))
                throw new ArgumentException("Fornecedor não pode ficar vazio.");
            lote.Fornecedor = forn;
        }

        if (request.MarcaPeca != null)
            lote.MarcaPeca = string.IsNullOrWhiteSpace(request.MarcaPeca) ? null : request.MarcaPeca.Trim();

        if (request.CustoUnitario.HasValue)
        {
            if (request.CustoUnitario.Value < 0)
                throw new ArgumentException("Custo unitário não pode ser negativo.");
            lote.CustoUnitario = request.CustoUnitario.Value;
            alterouCusto = lote.CustoUnitario != custoAnterior;
        }

        if (request.GarantiaMeses.HasValue)
        {
            var meses = request.GarantiaMeses.Value;
            if (meses <= 0)
                throw new ArgumentException("Garantia em meses deve ser maior que zero.");
            lote.GarantiaMeses = meses;
            lote.DataVencimentoGarantia = lote.DataEntrada.AddMonths(meses);
        }

        if (request.QuantidadeInicial.HasValue)
        {
            var novaInicial = request.QuantidadeInicial.Value;
            if (novaInicial <= 0)
                throw new ArgumentException("Quantidade inicial deve ser maior que zero.");
            if (novaInicial < consumido)
                throw new ArgumentException(
                    $"Não é possível reduzir para {novaInicial}: já saíram {consumido} unidade(s) deste lote.");

            var delta = novaInicial - qtdInicialAnterior;
            if (delta != 0)
            {
                lote.QuantidadeInicial = novaInicial;
                lote.QuantidadeRestante = qtdRestanteAnterior + delta;
                alterouQtd = true;

                if (!string.IsNullOrWhiteSpace(lote.Cor) && !string.IsNullOrWhiteSpace(lote.ModeloId))
                {
                    if (delta > 0)
                    {
                        await IncrementarEstoqueCorModeloAsync(
                            lote.PecaId, lote.ModeloId, lote.ModeloNome, lote.Cor, delta);
                    }
                    else
                    {
                        await DecrementarEstoqueCorModeloAsync(
                            lote.PecaId, lote.ModeloId, lote.ModeloNome, lote.Cor, -delta);
                    }
                }
            }
        }

        await _lotes.ReplaceOneAsync(x => x.Id == lote.Id, lote);

        if (alterouQtd || alterouCusto)
        {
            var filtroEntrada = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.LoteId, lote.Id)
                & Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "entrada");
            var entrada = await _movimentacoes.Find(filtroEntrada).SortBy(x => x.CriadoEm).FirstOrDefaultAsync();
            if (entrada is not null)
            {
                entrada.Quantidade = lote.QuantidadeInicial;
                entrada.CustoUnitario = lote.CustoUnitario;
                entrada.MarcaPeca = lote.MarcaPeca;
                await _movimentacoes.ReplaceOneAsync(x => x.Id == entrada.Id, entrada);
            }
            else if (alterouQtd)
            {
                var delta = lote.QuantidadeInicial - qtdInicialAnterior;
                if (delta != 0)
                {
                    await _movimentacoes.InsertOneAsync(new MovimentacaoEstoque
                    {
                        Tipo = "ajuste",
                        PecaId = lote.PecaId,
                        PecaNome = lote.PecaNome,
                        MarcaPeca = lote.MarcaPeca,
                        ModeloId = lote.ModeloId,
                        ModeloNome = lote.ModeloNome,
                        Cor = lote.Cor,
                        LoteId = lote.Id,
                        PedidoCompraId = lote.PedidoCompraId,
                        NumeroPedido = lote.NumeroPedido,
                        Quantidade = Math.Abs(delta),
                        CustoUnitario = lote.CustoUnitario,
                        Observacao = delta > 0
                            ? $"Ajuste (+) lote pedido {lote.NumeroPedido}"
                            : $"Ajuste (−) lote pedido {lote.NumeroPedido}",
                        Data = HorarioBrasil.Agora,
                        CriadoEm = HorarioBrasil.Agora,
                    });
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(lote.PedidoCompraId))
            await RecalcularTotaisPedidoAsync(lote.PedidoCompraId);

        await SincronizarQuantidadePecaAsync(lote.PecaId);
        await _pecasRepo.InvalidarCacheReferenciaAsync();

        return lote;
    }

    public async Task<LoteEstoque> AdicionarItemPedidoAsync(string pedidoId, ItemPedidoCompraRequest item)
    {
        if (string.IsNullOrWhiteSpace(pedidoId))
            throw new ArgumentException("Id do pedido é obrigatório.");
        if (item is null)
            throw new ArgumentException("Item é obrigatório.");

        var pedido = await _pedidos.Find(x => x.Id == pedidoId).FirstOrDefaultAsync()
            ?? throw new ArgumentException("Pedido não encontrado.");

        ValidarItemPedido(item);

        var totalAtual = await _lotes.CountDocumentsAsync(x => x.PedidoCompraId == pedidoId);
        if (totalAtual >= 100)
            throw new ArgumentException("Limite de 100 itens por pedido.");

        var peca = await _pecasRepo.ObterPorIdAsync(item.PecaId)
            ?? throw new ArgumentException($"Peça {item.PecaId} não encontrada.");

        var qtd = item.Quantidade;
        var categoria = InferirCategoriaPeca(peca);
        var cor = string.IsNullOrWhiteSpace(item.Cor) ? null : item.Cor.Trim();
        if (categoria == "Tampa traseira" || categoria == "Vidro Traseiro")
        {
            if (string.IsNullOrWhiteSpace(item.ModeloId))
                throw new ArgumentException($"Informe o modelo da {categoria} ({peca.Nome}).");
            if (string.IsNullOrWhiteSpace(cor))
                throw new ArgumentException($"Informe a cor da {categoria} para o modelo ({peca.Nome}).");
        }

        var garantiaMeses = item.GarantiaMeses > 0 ? item.GarantiaMeses : 12;
        var dataPedido = pedido.DataPedido;
        var vencimento = dataPedido.AddMonths(garantiaMeses);

        var lote = new LoteEstoque
        {
            PedidoCompraId = pedido.Id!,
            NumeroPedido = pedido.NumeroPedido,
            Fornecedor = string.IsNullOrWhiteSpace(item.Fornecedor)
                ? pedido.Fornecedor
                : item.Fornecedor.Trim(),
            PecaId = peca.Id!,
            PecaNome = peca.Nome,
            MarcaPeca = string.IsNullOrWhiteSpace(item.MarcaPeca) ? peca.MarcaPeca : item.MarcaPeca.Trim(),
            ModeloId = string.IsNullOrWhiteSpace(item.ModeloId) ? null : item.ModeloId.Trim(),
            ModeloNome = ResolverModeloNome(peca, item.ModeloId, item.ModeloNome),
            Cor = cor,
            QuantidadeInicial = qtd,
            QuantidadeRestante = qtd,
            CustoUnitario = item.CustoUnitario,
            GarantiaMeses = garantiaMeses,
            DataEntrada = dataPedido,
            DataVencimentoGarantia = vencimento,
            CriadoEm = HorarioBrasil.Agora,
        };

        await _lotes.InsertOneAsync(lote);

        await _movimentacoes.InsertOneAsync(new MovimentacaoEstoque
        {
            Tipo = "entrada",
            PecaId = lote.PecaId,
            PecaNome = lote.PecaNome,
            MarcaPeca = lote.MarcaPeca,
            ModeloId = lote.ModeloId,
            ModeloNome = lote.ModeloNome,
            Cor = lote.Cor,
            LoteId = lote.Id,
            PedidoCompraId = pedido.Id,
            NumeroPedido = pedido.NumeroPedido,
            Quantidade = lote.QuantidadeInicial,
            CustoUnitario = lote.CustoUnitario,
            Observacao = string.IsNullOrWhiteSpace(lote.Cor)
                ? $"Entrada pedido {pedido.NumeroPedido} (item incluído)"
                : $"Entrada pedido {pedido.NumeroPedido} (item incluído) — {lote.Cor}",
            Data = dataPedido,
            CriadoEm = HorarioBrasil.Agora,
        });

        if (!string.IsNullOrWhiteSpace(cor) && !string.IsNullOrWhiteSpace(item.ModeloId))
        {
            await IncrementarEstoqueCorModeloAsync(
                item.PecaId, item.ModeloId, item.ModeloNome, cor, qtd);
        }

        await RecalcularTotaisPedidoAsync(pedido.Id!);
        await SincronizarQuantidadePecaAsync(lote.PecaId);
        await _pecasRepo.InvalidarCacheReferenciaAsync();

        return lote;
    }

    public async Task ExcluirLoteAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Id do lote é obrigatório.");

        var lote = await _lotes.Find(x => x.Id == id).FirstOrDefaultAsync()
            ?? throw new ArgumentException("Lote não encontrado.");

        if (lote.QuantidadeRestante != lote.QuantidadeInicial)
            throw new InvalidOperationException(
                "Não é possível excluir: já houve saída deste lote. Ajuste a quantidade ou estorne as saídas.");

        if (lote.QuantidadeRestante > 0
            && !string.IsNullOrWhiteSpace(lote.Cor)
            && !string.IsNullOrWhiteSpace(lote.ModeloId))
        {
            await DecrementarEstoqueCorModeloAsync(
                lote.PecaId, lote.ModeloId, lote.ModeloNome, lote.Cor, lote.QuantidadeRestante);
        }

        await _movimentacoes.DeleteManyAsync(
            Builders<MovimentacaoEstoque>.Filter.Eq(x => x.LoteId, lote.Id));

        await _lotes.DeleteOneAsync(x => x.Id == lote.Id);

        if (!string.IsNullOrWhiteSpace(lote.PedidoCompraId))
            await RecalcularTotaisPedidoAsync(lote.PedidoCompraId);

        await SincronizarQuantidadePecaAsync(lote.PecaId);
        await _pecasRepo.InvalidarCacheReferenciaAsync();
    }

    private async Task RecalcularTotaisPedidoAsync(string pedidoId)
    {
        var pedido = await _pedidos.Find(x => x.Id == pedidoId).FirstOrDefaultAsync();
        if (pedido is null) return;

        var lotes = await _lotes.Find(x => x.PedidoCompraId == pedidoId).ToListAsync();
        pedido.TotalItens = lotes.Count;
        pedido.TotalUnidades = lotes.Sum(l => l.QuantidadeInicial);
        pedido.ValorTotal = lotes.Sum(l => l.CustoUnitario * l.QuantidadeInicial);
        await _pedidos.ReplaceOneAsync(x => x.Id == pedidoId, pedido);
    }

    public async Task<List<MovimentacaoEstoque>> ListarMovimentacoesAsync(
        string? tipo = null, DateTime? inicio = null, DateTime? fim = null, int limite = 200)
    {
        var filtro = Builders<MovimentacaoEstoque>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(tipo))
            filtro &= Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, tipo.Trim().ToLowerInvariant());
        if (inicio.HasValue)
            filtro &= Builders<MovimentacaoEstoque>.Filter.Gte(x => x.Data, inicio.Value);
        if (fim.HasValue)
        {
            var fimDia = fim.Value.Date.AddDays(1).AddTicks(-1);
            filtro &= Builders<MovimentacaoEstoque>.Filter.Lte(x => x.Data, fimDia);
        }

        return await _movimentacoes.Find(filtro)
            .SortByDescending(x => x.Data)
            .ThenByDescending(x => x.CriadoEm)
            .Limit(limite)
            .ToListAsync();
    }

    public async Task<List<MovimentacaoEstoque>> RegistrarSaidaAsync(RegistrarSaidaEstoqueRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PecaId))
            throw new ArgumentException("Peça é obrigatória.");
        if (request.Quantidade <= 0)
            throw new ArgumentException("Quantidade deve ser maior que zero.");

        var peca = await _pecasRepo.ObterPorIdAsync(request.PecaId)
            ?? throw new ArgumentException("Peça não encontrada.");

        if (!peca.EstoqueNaLoja)
            throw new ArgumentException(
                $"\"{peca.Nome}\" não usa estoque da loja — peça somente via fornecedor externo.");

        await GarantirLoteCatalogoAsync(request.PecaId);

        var filtroLote = Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, request.PecaId)
            & Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0);

        if (!string.IsNullOrWhiteSpace(request.MarcaPeca))
        {
            var marca = request.MarcaPeca.Trim();
            filtroLote &= Builders<LoteEstoque>.Filter.Eq(x => x.MarcaPeca, marca);
        }

        var cor = string.IsNullOrWhiteSpace(request.Cor) ? null : request.Cor.Trim();
        if (!string.IsNullOrWhiteSpace(cor))
            filtroLote &= Builders<LoteEstoque>.Filter.Eq(x => x.Cor, cor);

        var lotes = await _lotes.Find(filtroLote)
            .SortBy(x => x.DataEntrada)
            .ThenBy(x => x.CriadoEm)
            .ToListAsync();

        // Sem fallback para outra cor: a baixa deve ser exatamente da cor escolhida.
        if (lotes.Count == 0 && !string.IsNullOrWhiteSpace(cor))
        {
            throw new InvalidOperationException(
                $"Estoque insuficiente da cor \"{cor}\" para \"{peca.Nome}\". " +
                "Cadastre entrada dessa cor via Pedido de compra ou ajuste o estoque da peça.");
        }

        // Se filtrou por marca do fornecedor e não achou lote, tenta sem o filtro.
        if (lotes.Count == 0 && !string.IsNullOrWhiteSpace(request.MarcaPeca))
        {
            var filtroSemMarca = Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, request.PecaId)
                & Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0);
            if (!string.IsNullOrWhiteSpace(cor))
                filtroSemMarca &= Builders<LoteEstoque>.Filter.Eq(x => x.Cor, cor);

            lotes = await _lotes.Find(filtroSemMarca)
                .SortBy(x => x.DataEntrada)
                .ThenBy(x => x.CriadoEm)
                .ToListAsync();
        }

        var disponivel = lotes.Sum(l => l.QuantidadeRestante);
        if (disponivel < request.Quantidade)
            throw new InvalidOperationException(
                $"Estoque insuficiente para \"{peca.Nome}\". Em estoque: {disponivel}, solicitado: {request.Quantidade}. " +
                "Cadastre entrada via Pedido de compra ou ajuste o estoque inicial da peça.");

        var restante = request.Quantidade;
        var saidas = new List<MovimentacaoEstoque>();
        var agora = HorarioBrasil.Agora;

        foreach (var lote in lotes)
        {
            if (restante <= 0) break;

            var consumir = Math.Min(restante, lote.QuantidadeRestante);
            var novoSaldo = lote.QuantidadeRestante - consumir;

            var atualizado = await _lotes.FindOneAndUpdateAsync(
                Builders<LoteEstoque>.Filter.And(
                    Builders<LoteEstoque>.Filter.Eq(x => x.Id, lote.Id),
                    Builders<LoteEstoque>.Filter.Gte(x => x.QuantidadeRestante, consumir)),
                Builders<LoteEstoque>.Update.Set(x => x.QuantidadeRestante, novoSaldo),
                new FindOneAndUpdateOptions<LoteEstoque> { ReturnDocument = ReturnDocument.After });

            if (atualizado is null)
                throw new InvalidOperationException("Conflito ao consumir estoque. Tente novamente.");

            var mov = new MovimentacaoEstoque
            {
                Tipo = "saida",
                PecaId = peca.Id!,
                PecaNome = peca.Nome,
                MarcaPeca = lote.MarcaPeca,
                ModeloId = string.IsNullOrWhiteSpace(request.ModeloId) ? null : request.ModeloId.Trim(),
                ModeloNome = ResolverModeloNome(peca, request.ModeloId, request.ModeloNome),
                Cor = cor ?? lote.Cor,
                EstoqueLocal = peca.EstoqueNaLoja,
                LoteId = lote.Id,
                PedidoCompraId = lote.PedidoCompraId,
                NumeroPedido = lote.NumeroPedido,
                Quantidade = consumir,
                CustoUnitario = lote.CustoUnitario,
                OsBlingId = request.OsBlingId,
                OsNumero = request.OsNumero,
                Observacao = request.Observacao,
                Data = agora,
                CriadoEm = agora,
            };
            await _movimentacoes.InsertOneAsync(mov);
            saidas.Add(mov);
            restante -= consumir;
        }

        if (!string.IsNullOrWhiteSpace(cor) && !string.IsNullOrWhiteSpace(request.ModeloId))
        {
            await DecrementarEstoqueCorModeloAsync(
                request.PecaId,
                request.ModeloId,
                request.ModeloNome,
                cor,
                request.Quantidade);
        }

        await SincronizarQuantidadePecaAsync(peca.Id!);
        await _pecasRepo.InvalidarCacheReferenciaAsync();
        return saidas;
    }

    public async Task RegistrarEstornoOsAsync(RegistrarEstornoOsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PecaId))
            throw new ArgumentException("Peça é obrigatória.");
        if (request.Quantidade <= 0) return;

        var peca = await _pecasRepo.ObterPorIdAsync(request.PecaId)
            ?? throw new ArgumentException("Peça não encontrada.");

        var obsBase = $"Estorno OS #{request.OsNumero ?? request.OsBlingId?.ToString() ?? "?"}";
        var restante = request.Quantidade;
        var agora = DateTime.UtcNow;

        if (request.OsBlingId.HasValue)
        {
            var saidas = await _movimentacoes.Find(
                    Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "saida")
                    & Builders<MovimentacaoEstoque>.Filter.Eq(x => x.PecaId, request.PecaId)
                    & Builders<MovimentacaoEstoque>.Filter.Eq(x => x.OsBlingId, request.OsBlingId.Value))
                .SortByDescending(x => x.Data)
                .ThenByDescending(x => x.CriadoEm)
                .ToListAsync();

            foreach (var saida in saidas)
            {
                if (restante <= 0) break;

                var devolver = Math.Min(restante, saida.Quantidade);
                if (devolver <= 0) continue;

                if (!string.IsNullOrWhiteSpace(saida.LoteId))
                {
                    var lote = await _lotes.Find(x => x.Id == saida.LoteId).FirstOrDefaultAsync();
                    if (lote is not null)
                    {
                        await _lotes.UpdateOneAsync(
                            x => x.Id == lote.Id,
                            Builders<LoteEstoque>.Update.Inc(x => x.QuantidadeRestante, devolver));

                        await _movimentacoes.InsertOneAsync(new MovimentacaoEstoque
                        {
                            Tipo = "entrada",
                            PecaId = peca.Id!,
                            PecaNome = peca.Nome,
                            MarcaPeca = saida.MarcaPeca ?? lote.MarcaPeca,
                            ModeloId = saida.ModeloId,
                            ModeloNome = saida.ModeloNome,
                            LoteId = lote.Id,
                            PedidoCompraId = lote.PedidoCompraId,
                            NumeroPedido = lote.NumeroPedido,
                            Quantidade = devolver,
                            CustoUnitario = lote.CustoUnitario,
                            OsBlingId = request.OsBlingId,
                            OsNumero = request.OsNumero,
                            Observacao = obsBase,
                            Data = agora,
                            CriadoEm = agora,
                        });

                        restante -= devolver;
                        continue;
                    }
                }

                await CriarLoteEstornoAsync(peca, devolver, request, obsBase, agora, saida.MarcaPeca);
                restante -= devolver;
            }
        }

        if (restante > 0)
            await CriarLoteEstornoAsync(peca, restante, request, obsBase, agora, peca.MarcaPeca);

        var corEstorno = string.IsNullOrWhiteSpace(request.Cor) ? null : request.Cor.Trim();
        if (!string.IsNullOrWhiteSpace(corEstorno) && !string.IsNullOrWhiteSpace(request.ModeloId))
        {
            await IncrementarEstoqueCorModeloAsync(
                request.PecaId,
                request.ModeloId,
                request.ModeloNome,
                corEstorno,
                request.Quantidade);
        }

        await SincronizarQuantidadePecaAsync(peca.Id!);
        await _pecasRepo.InvalidarCacheReferenciaAsync();
    }

    private async Task CriarLoteEstornoAsync(
        PecaEstoque peca,
        int quantidade,
        RegistrarEstornoOsRequest request,
        string observacao,
        DateTime agora,
        string? marcaPeca)
    {
        var lote = new LoteEstoque
        {
            PedidoCompraId = "estorno-os",
            NumeroPedido = $"ESTORNO-OS-{request.OsNumero ?? request.OsBlingId?.ToString() ?? "sem-id"}",
            Fornecedor = "Estorno OS",
            PecaId = peca.Id!,
            PecaNome = peca.Nome,
            MarcaPeca = marcaPeca ?? peca.MarcaPeca,
            QuantidadeInicial = quantidade,
            QuantidadeRestante = quantidade,
            CustoUnitario = 0,
            GarantiaMeses = 12,
            DataEntrada = agora,
            CriadoEm = agora,
        };
        await _lotes.InsertOneAsync(lote);

        await _movimentacoes.InsertOneAsync(new MovimentacaoEstoque
        {
            Tipo = "entrada",
            PecaId = peca.Id!,
            PecaNome = peca.Nome,
            MarcaPeca = lote.MarcaPeca,
            LoteId = lote.Id,
            NumeroPedido = lote.NumeroPedido,
            Quantidade = quantidade,
            CustoUnitario = 0,
            OsBlingId = request.OsBlingId,
            OsNumero = request.OsNumero,
            Observacao = observacao,
            Data = agora,
            CriadoEm = agora,
        });
    }

    public Task<ReposicaoSemanalResponse> RelatorioReposicaoSemanalAsync(DateTime? fim = null)
        => RelatorioReposicaoAsync(null, fim, "semanal", null);

    public async Task<ReposicaoSemanalResponse> RelatorioReposicaoAsync(
        DateTime? inicio = null,
        DateTime? fim = null,
        string? periodo = null,
        string? modeloId = null)
    {
        var (inicioPeriodo, fimDia, periodoNorm) = ResolverPeriodoReposicao(inicio, fim, periodo);
        var modeloFiltro = string.IsNullOrWhiteSpace(modeloId) ? null : modeloId.Trim();

        // Inclui saídas do estoque local (OS e manuais). Aceita datas em horário Brasil e UTC legado.
        var filtro = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "saida")
            & FiltroPeriodoDataBrasil(inicioPeriodo.Date, fimDia.Date)
            & FiltroSomenteEstoqueLocal();

        if (modeloFiltro is not null)
            filtro &= Builders<MovimentacaoEstoque>.Filter.Eq(x => x.ModeloId, modeloFiltro);

        var saidas = await _movimentacoes.Find(filtro).ToListAsync();

        // Reposição: só conta baixa de OS Concluída (+ saídas manuais).
        // OS aberta ainda não entra; Cancelada devolve estoque e fica de fora.
        saidas = await FiltrarSaidasParaReposicaoAsync(saidas);

        // Garante nome do modelo quando a saída veio sem modeloNome preenchido.
        foreach (var s in saidas.Where(x => string.IsNullOrWhiteSpace(x.ModeloNome) && !string.IsNullOrWhiteSpace(x.ModeloId)))
        {
            var peca = await _pecas.Find(x => x.Id == s.PecaId).FirstOrDefaultAsync();
            if (peca is null) continue;
            s.ModeloNome = ResolverModeloNome(peca, s.ModeloId, null);
        }

        var agrupado = saidas
            .GroupBy(s => new
            {
                s.PecaId,
                s.PecaNome,
                Marca = s.MarcaPeca ?? "",
                ModeloId = s.ModeloId ?? "",
                Modelo = s.ModeloNome ?? s.ModeloId ?? "",
                Cor = (s.Cor ?? "").Trim(),
            })
            .Select(g => new ReposicaoSemanalItem
            {
                PecaId = g.Key.PecaId,
                PecaNome = g.Key.PecaNome,
                MarcaPeca = string.IsNullOrEmpty(g.Key.Marca) ? null : g.Key.Marca,
                ModeloId = string.IsNullOrEmpty(g.Key.ModeloId) ? null : g.Key.ModeloId,
                ModeloNome = string.IsNullOrEmpty(g.Key.Modelo) ? null : g.Key.Modelo,
                Cor = string.IsNullOrEmpty(g.Key.Cor) ? null : g.Key.Cor,
                QuantidadeSaida = g.Sum(x => x.Quantidade),
            })
            .OrderByDescending(x => x.QuantidadeSaida)
            .ThenBy(x => x.PecaNome, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.Cor ?? "", StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var item in agrupado)
        {
            var filtroLote = Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, item.PecaId)
                & Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0);
            if (!string.IsNullOrWhiteSpace(item.MarcaPeca))
                filtroLote &= Builders<LoteEstoque>.Filter.Eq(x => x.MarcaPeca, item.MarcaPeca);
            if (!string.IsNullOrWhiteSpace(item.ModeloId))
                filtroLote &= Builders<LoteEstoque>.Filter.Eq(x => x.ModeloId, item.ModeloId);
            if (!string.IsNullOrWhiteSpace(item.Cor))
                filtroLote &= Builders<LoteEstoque>.Filter.Eq(x => x.Cor, item.Cor);

            var lotes = await _lotes.Find(filtroLote).ToListAsync();
            item.EstoqueAtual = lotes.Sum(l => l.QuantidadeRestante);

            // Fallback: estoque por cor no cadastro da peça (quando não há lote com cor).
            if (item.EstoqueAtual == 0 && !string.IsNullOrWhiteSpace(item.Cor) && !string.IsNullOrWhiteSpace(item.ModeloId))
            {
                var peca = await _pecas.Find(x => x.Id == item.PecaId).FirstOrDefaultAsync();
                var corEstoque = peca?.ModelosCompativeis
                    .FirstOrDefault(m => string.Equals(m.ModeloId, item.ModeloId, StringComparison.OrdinalIgnoreCase))
                    ?.Cores
                    ?.FirstOrDefault(c => string.Equals(c.Cor, item.Cor, StringComparison.OrdinalIgnoreCase));
                if (corEstoque is not null)
                    item.EstoqueAtual = Math.Max(0, corEstoque.Quantidade);
            }

            item.SugestaoReposicao = Math.Max(0, item.QuantidadeSaida - item.EstoqueAtual);
        }

        var resumoPorModelo = agrupado
            .GroupBy(x => new
            {
                ModeloId = x.ModeloId ?? "",
                ModeloNome = x.ModeloNome ?? x.ModeloId ?? "Sem modelo",
            })
            .Select(g => new ReposicaoResumoModelo
            {
                ModeloId = string.IsNullOrEmpty(g.Key.ModeloId) ? null : g.Key.ModeloId,
                ModeloNome = g.Key.ModeloNome,
                QuantidadeSaida = g.Sum(x => x.QuantidadeSaida),
                ItensComReposicao = g.Count(x => x.SugestaoReposicao > 0),
                SugestaoTotal = g.Sum(x => x.SugestaoReposicao),
            })
            .OrderByDescending(x => x.QuantidadeSaida)
            .ThenBy(x => x.ModeloNome, StringComparer.OrdinalIgnoreCase)
            .ToList();

        string? modeloNomeFiltro = null;
        if (modeloFiltro is not null)
        {
            modeloNomeFiltro = saidas
                .Select(s => s.ModeloNome)
                .FirstOrDefault(n => !string.IsNullOrWhiteSpace(n))
                ?? modeloFiltro;
        }

        return new ReposicaoSemanalResponse
        {
            Inicio = inicioPeriodo,
            Fim = fimDia,
            Periodo = periodoNorm,
            ModeloIdFiltro = modeloFiltro,
            ModeloNomeFiltro = modeloNomeFiltro,
            Itens = agrupado,
            ResumoPorModelo = resumoPorModelo,
            TotalSaidas = saidas.Sum(s => s.Quantidade),
        };
    }

    /// <summary>
    /// Saídas manuais entram sempre.
    /// Baixas de OS só entram se a OS estiver Concluída.
    /// Cancelada / em andamento ficam de fora (cancelamento já estorna o estoque).
    /// </summary>
    private async Task<List<MovimentacaoEstoque>> FiltrarSaidasParaReposicaoAsync(
        List<MovimentacaoEstoque> saidas)
    {
        if (saidas.Count == 0) return saidas;

        var idsOs = saidas
            .Where(s => s.OsBlingId is > 0)
            .Select(s => s.OsBlingId!.Value)
            .Distinct()
            .ToList();

        if (idsOs.Count == 0) return saidas;

        var ordens = await _osRepo.ObterPorBlingIdsAsync(idsOs);
        var situacaoPorId = ordens.ToDictionary(o => o.BlingId, o => o.Situacao);

        return saidas.Where(s =>
        {
            if (s.OsBlingId is null or <= 0) return true; // saída manual

            if (!situacaoPorId.TryGetValue(s.OsBlingId.Value, out var situacao))
                return false; // OS não encontrada — não contabiliza

            // Só OS concluída gera necessidade de reposição.
            return OsSituacaoHelper.EhConcluida(situacao);
        }).ToList();
    }

    private static (DateTime inicio, DateTime fimDia, string periodo) ResolverPeriodoReposicao(
        DateTime? inicio,
        DateTime? fim,
        string? periodo)
    {
        var periodoNorm = NormalizarPeriodoReposicao(periodo);

        if (periodoNorm == "personalizado")
        {
            if (!inicio.HasValue || !fim.HasValue)
                throw new ArgumentException("Informe data inicial e final para o período personalizado.");

            var inicioDia = inicio.Value.Date;
            var fimDia = fim.Value.Date;
            if (inicioDia > fimDia)
                throw new ArgumentException("A data inicial não pode ser posterior à data final.");

            return (inicioDia, fimDia.AddDays(1).AddTicks(-1), periodoNorm);
        }

        var fimBase = (fim ?? HorarioBrasil.Agora).Date;
        var dias = periodoNorm switch
        {
            "2dias" => 2,
            "mensal" => 30,
            _ => 7,
        };

        var inicioCalc = fimBase.AddDays(-(dias - 1));
        return (inicioCalc, fimBase.AddDays(1).AddTicks(-1), periodoNorm);
    }

    /// <summary>
    /// Período no calendário de Brasília.
    /// Aceita saídas gravadas em horário Brasil (wall clock) e saídas antigas em UTC real.
    /// </summary>
    private static FilterDefinition<MovimentacaoEstoque> FiltroPeriodoDataBrasil(DateTime inicioDia, DateTime fimDia)
    {
        var inicioLocal = inicioDia.Date;
        var fimLocal = fimDia.Date.AddDays(1).AddTicks(-1);

        var filtroLocal = Builders<MovimentacaoEstoque>.Filter.Gte(x => x.Data, inicioLocal)
            & Builders<MovimentacaoEstoque>.Filter.Lte(x => x.Data, fimLocal);

        var inicioUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(inicioDia.Date, DateTimeKind.Unspecified),
            HorarioBrasil.TimeZone);
        var fimUtc = TimeZoneInfo.ConvertTimeToUtc(
            DateTime.SpecifyKind(fimDia.Date.AddDays(1), DateTimeKind.Unspecified),
            HorarioBrasil.TimeZone).AddTicks(-1);

        var filtroUtc = Builders<MovimentacaoEstoque>.Filter.Gte(x => x.Data, inicioUtc)
            & Builders<MovimentacaoEstoque>.Filter.Lte(x => x.Data, fimUtc);

        return Builders<MovimentacaoEstoque>.Filter.Or(filtroLocal, filtroUtc);
    }

    private static string NormalizarPeriodoReposicao(string? periodo)
    {
        var p = (periodo ?? "semanal").Trim().ToLowerInvariant();
        return p switch
        {
            "2dias" or "2-dias" or "dois-dias" => "2dias",
            "mensal" or "mes" or "30dias" => "mensal",
            "personalizado" or "custom" => "personalizado",
            _ => "semanal",
        };
    }

    private static void ValidarPedido(RegistrarPedidoCompraRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Fornecedor))
            throw new ArgumentException("Fornecedor é obrigatório.");
        if (request.Itens is null || request.Itens.Count == 0)
            throw new ArgumentException("Informe ao menos um item no pedido.");
        if (request.Itens.Count > 100)
            throw new ArgumentException("Limite de 100 itens por pedido.");
        foreach (var item in request.Itens)
            ValidarItemPedido(item);
    }

    private static void ValidarItemPedido(ItemPedidoCompraRequest item)
    {
        if (string.IsNullOrWhiteSpace(item.PecaId))
            throw new ArgumentException("Peça do item é obrigatória.");
        if (item.Quantidade <= 0)
            throw new ArgumentException("Quantidade do item deve ser maior que zero.");
        if (item.CustoUnitario < 0)
            throw new ArgumentException("Custo unitário não pode ser negativo.");
    }

    private async Task<string> GerarNumeroPedidoAsync(DateTime dataPedido)
    {
        var ano = dataPedido.Year;
        var prefixo = $"PC-{ano}-";
        var regex = new BsonRegularExpression($"^{System.Text.RegularExpressions.Regex.Escape(prefixo)}", "i");
        var existentes = await _pedidos
            .Find(Builders<PedidoCompraEstoque>.Filter.Regex(x => x.NumeroPedido, regex))
            .Project(x => x.NumeroPedido)
            .ToListAsync();

        var maxSeq = 0;
        foreach (var num in existentes)
        {
            if (string.IsNullOrWhiteSpace(num) || num.Length <= prefixo.Length) continue;
            if (int.TryParse(num.AsSpan(prefixo.Length), out var seq) && seq > maxSeq)
                maxSeq = seq;
        }

        return $"{prefixo}{(maxSeq + 1):D3}";
    }

    public async Task GarantirLoteCatalogoAsync(string pecaId)
    {
        if (string.IsNullOrWhiteSpace(pecaId)) return;

        var peca = await _pecasRepo.ObterPorIdAsync(pecaId);
        if (peca is null || peca.QuantidadeEstoque <= 0) return;

        var saldoLotes = await _lotes.Find(
                Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, pecaId)
                & Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0))
            .ToListAsync();

        var disponivel = saldoLotes.Sum(l => l.QuantidadeRestante);
        var faltante = peca.QuantidadeEstoque - disponivel;
        if (faltante <= 0) return;

        var agora = DateTime.UtcNow;
        var lote = new LoteEstoque
        {
            PedidoCompraId = "estoque-inicial",
            NumeroPedido = "ESTOQUE-INICIAL",
            Fornecedor = string.IsNullOrWhiteSpace(peca.MarcaPeca) ? "Cadastro" : peca.MarcaPeca.Trim(),
            PecaId = peca.Id!,
            PecaNome = peca.Nome,
            MarcaPeca = peca.MarcaPeca,
            QuantidadeInicial = faltante,
            QuantidadeRestante = faltante,
            CustoUnitario = 0,
            GarantiaMeses = 12,
            DataEntrada = agora,
            CriadoEm = agora,
        };
        await _lotes.InsertOneAsync(lote);

        await _movimentacoes.InsertOneAsync(new MovimentacaoEstoque
        {
            Tipo = "entrada",
            PecaId = peca.Id!,
            PecaNome = peca.Nome,
            MarcaPeca = peca.MarcaPeca,
            LoteId = lote.Id,
            NumeroPedido = lote.NumeroPedido,
            Quantidade = faltante,
            CustoUnitario = 0,
            Observacao = "Estoque inicial sincronizado do cadastro da peça",
            Data = agora,
            CriadoEm = agora,
        });
    }

    private async Task SincronizarQuantidadePecaAsync(string pecaId)
    {
        var total = await _lotes.Find(
                Builders<LoteEstoque>.Filter.Eq(x => x.PecaId, pecaId)
                & Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0))
            .ToListAsync();

        var qtd = total.Sum(l => l.QuantidadeRestante);
        var peca = await _pecas.Find(x => x.Id == pecaId).FirstOrDefaultAsync();
        if (peca is null) return;

        peca.QuantidadeEstoque = qtd;
        peca.AtualizadoEm = DateTime.UtcNow;
        await _pecas.ReplaceOneAsync(x => x.Id == pecaId, peca);
    }

    private async Task DecrementarEstoqueCorModeloAsync(
        string pecaId,
        string modeloId,
        string? modeloNome,
        string cor,
        int quantidade)
    {
        if (quantidade <= 0 || string.IsNullOrWhiteSpace(cor) || string.IsNullOrWhiteSpace(modeloId))
            return;

        var peca = await _pecas.Find(x => x.Id == pecaId).FirstOrDefaultAsync();
        if (peca is null) return;

        var corNorm = cor.Trim();
        var modeloNorm = modeloId.Trim();
        var compat = peca.ModelosCompativeis
            .FirstOrDefault(m => string.Equals(m.ModeloId, modeloNorm, StringComparison.OrdinalIgnoreCase));
        if (compat is null) return;

        compat.Cores ??= [];
        var existente = compat.Cores
            .FirstOrDefault(c => string.Equals(c.Cor, corNorm, StringComparison.OrdinalIgnoreCase));
        if (existente is null) return;

        existente.Quantidade = Math.Max(0, existente.Quantidade - quantidade);
        peca.AtualizadoEm = DateTime.UtcNow;
        await _pecas.ReplaceOneAsync(x => x.Id == pecaId, peca);
    }

    private async Task IncrementarEstoqueCorModeloAsync(
        string pecaId,
        string modeloId,
        string? modeloNome,
        string cor,
        int quantidade)
    {
        if (quantidade <= 0 || string.IsNullOrWhiteSpace(cor) || string.IsNullOrWhiteSpace(modeloId))
            return;

        await AplicarIncrementosCorPedidoAsync([(pecaId, modeloId, modeloNome, cor, quantidade)]);
    }

    /// <summary>Aplica vários incrementos de cor por peça em uma única leitura/gravação.</summary>
    private async Task AplicarIncrementosCorPedidoAsync(
        IReadOnlyList<(string PecaId, string ModeloId, string? ModeloNome, string Cor, int Quantidade)> incrementos)
    {
        if (incrementos.Count == 0) return;

        foreach (var grupo in incrementos.GroupBy(x => x.PecaId, StringComparer.OrdinalIgnoreCase))
        {
            var peca = await _pecas.Find(x => x.Id == grupo.Key).FirstOrDefaultAsync();
            if (peca is null) continue;

            foreach (var inc in grupo)
            {
                if (inc.Quantidade <= 0
                    || string.IsNullOrWhiteSpace(inc.Cor)
                    || string.IsNullOrWhiteSpace(inc.ModeloId))
                    continue;

                var corNorm = inc.Cor.Trim();
                var modeloNorm = inc.ModeloId.Trim();
                var compat = peca.ModelosCompativeis
                    .FirstOrDefault(m => string.Equals(m.ModeloId, modeloNorm, StringComparison.OrdinalIgnoreCase));

                if (compat is null)
                {
                    compat = new ModeloCompativel
                    {
                        ModeloId = modeloNorm,
                        ModeloNome = string.IsNullOrWhiteSpace(inc.ModeloNome) ? null : inc.ModeloNome.Trim(),
                    };
                    peca.ModelosCompativeis.Add(compat);
                }
                else if (string.IsNullOrWhiteSpace(compat.ModeloNome) && !string.IsNullOrWhiteSpace(inc.ModeloNome))
                {
                    compat.ModeloNome = inc.ModeloNome.Trim();
                }

                compat.Cores ??= [];
                var existente = compat.Cores
                    .FirstOrDefault(c => string.Equals(c.Cor, corNorm, StringComparison.OrdinalIgnoreCase));
                if (existente is not null)
                    existente.Quantidade += inc.Quantidade;
                else
                    compat.Cores.Add(new CorEstoqueModelo { Cor = corNorm, Quantidade = inc.Quantidade });
            }

            peca.AtualizadoEm = DateTime.UtcNow;
            await _pecas.ReplaceOneAsync(x => x.Id == peca.Id, peca);
        }
    }

    private static string InferirCategoriaPeca(PecaEstoque peca)
    {
        var cat = peca.Categoria?.Trim();
        if (!string.IsNullOrWhiteSpace(cat)) return cat;

        var n = (peca.Nome ?? string.Empty).ToLowerInvariant();
        if (n.Contains("vidro traseiro") || n.Contains("back glass"))
            return "Vidro Traseiro";
        if (n.Contains("tampa") || n.Contains("back cover"))
            return "Tampa traseira";
        return cat ?? string.Empty;
    }

    private static string? ResolverModeloNome(PecaEstoque peca, string? modeloId, string? modeloNome)
    {
        if (!string.IsNullOrWhiteSpace(modeloNome))
            return modeloNome.Trim();

        if (string.IsNullOrWhiteSpace(modeloId))
            return null;

        var compat = peca.ModelosCompativeis
            .FirstOrDefault(m => string.Equals(m.ModeloId, modeloId.Trim(), StringComparison.OrdinalIgnoreCase));

        return compat?.ModeloNome?.Trim();
    }

    private static FilterDefinition<MovimentacaoEstoque> FiltroSomenteEstoqueLocal()
        => Builders<MovimentacaoEstoque>.Filter.Or(
            Builders<MovimentacaoEstoque>.Filter.Eq(x => x.EstoqueLocal, true),
            Builders<MovimentacaoEstoque>.Filter.Exists(x => x.EstoqueLocal, false));

    public async Task<CustoPecaReferenciaResponse?> ObterCustoReferenciaPecaAsync(string pecaId)
    {
        if (string.IsNullOrWhiteSpace(pecaId)) return null;

        var lotes = await ListarLotesAsync(pecaId, somenteComSaldo: true);
        if (lotes.Count == 0) return null;

        var custoMedio = lotes.Sum(l => l.CustoUnitario * l.QuantidadeRestante);
        var qtd = lotes.Sum(l => l.QuantidadeRestante);
        var fifo = lotes[0];

        if (qtd <= 0)
        {
            return new CustoPecaReferenciaResponse
            {
                PecaId = pecaId,
                CustoUnitario = fifo.CustoUnitario,
                Fornecedor = fifo.Fornecedor,
                MarcaPeca = fifo.MarcaPeca,
                Fonte = "fifo",
            };
        }

        var media = custoMedio / qtd;
        var usarFifo = lotes.Count == 1 || Math.Abs(media - fifo.CustoUnitario) < 0.01m;

        return new CustoPecaReferenciaResponse
        {
            PecaId = pecaId,
            CustoUnitario = usarFifo ? fifo.CustoUnitario : media,
            Fornecedor = usarFifo ? fifo.Fornecedor : null,
            MarcaPeca = usarFifo ? fifo.MarcaPeca : null,
            Fonte = usarFifo ? "fifo" : "media",
        };
    }

    public async Task<RelatorioFinanceiroEstoqueResponse> RelatorioFinanceiroAsync(int meses = 12)
    {
        meses = Math.Clamp(meses, 1, 36);
        var agora = HorarioBrasil.Agora;
        var inicioPeriodo = new DateTime(agora.Year, agora.Month, 1).AddMonths(-(meses - 1));
        var fimPeriodo = new DateTime(agora.Year, agora.Month, 1).AddMonths(1).AddTicks(-1);

        var pedidosExcluidos = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "estoque-inicial",
            "estorno-os",
        };

        var lotesComSaldo = await _lotes
            .Find(x => x.QuantidadeRestante > 0)
            .ToListAsync();

        var valorEstoque = 0m;
        var unidades = 0;
        foreach (var l in lotesComSaldo)
        {
            if (pedidosExcluidos.Contains(l.PedidoCompraId)) continue;
            unidades += l.QuantidadeRestante;
            valorEstoque += l.QuantidadeRestante * l.CustoUnitario;
        }

        var topPecas = lotesComSaldo
            .Where(l => !pedidosExcluidos.Contains(l.PedidoCompraId))
            .GroupBy(l => l.PecaId)
            .Select(g => new FinanceiroEstoquePecaItem
            {
                PecaId = g.Key,
                PecaNome = g.First().PecaNome,
                MarcaPeca = g.Select(x => x.MarcaPeca).FirstOrDefault(m => !string.IsNullOrWhiteSpace(m)),
                Unidades = g.Sum(x => x.QuantidadeRestante),
                Valor = g.Sum(x => x.QuantidadeRestante * x.CustoUnitario),
            })
            .OrderByDescending(x => x.Valor)
            .Take(15)
            .ToList();

        var pedidos = await _pedidos
            .Find(x => x.DataPedido >= inicioPeriodo && x.DataPedido <= fimPeriodo)
            .ToListAsync();

        var saidas = await _movimentacoes
            .Find(x =>
                x.Tipo == "saida"
                && x.EstoqueLocal
                && x.Data >= inicioPeriodo
                && x.Data <= fimPeriodo)
            .ToListAsync();

        var cultura = new System.Globalization.CultureInfo("pt-BR");
        var porMes = new List<FinanceiroEstoqueMesItem>();
        for (var i = 0; i < meses; i++)
        {
            var mesRef = inicioPeriodo.AddMonths(i);
            var anoMes = $"{mesRef.Year:D4}-{mesRef.Month:D2}";
            var pedidosMes = pedidos.Where(p => ChaveAnoMes(p.DataPedido) == anoMes).ToList();
            var saidasMes = saidas.Where(s => ChaveAnoMes(s.Data) == anoMes).ToList();

            porMes.Add(new FinanceiroEstoqueMesItem
            {
                AnoMes = anoMes,
                Label = mesRef.ToString("MMM/yyyy", cultura),
                Investimento = pedidosMes.Sum(p => p.ValorTotal),
                PedidosCompra = pedidosMes.Count,
                UnidadesCompradas = pedidosMes.Sum(p => p.TotalUnidades),
                SaidasCusto = saidasMes.Sum(s => s.Quantidade * (s.CustoUnitario ?? 0m)),
                UnidadesSaida = saidasMes.Sum(s => s.Quantidade),
            });
        }

        var mesAtual = $"{agora.Year:D4}-{agora.Month:D2}";
        var itemAtual = porMes.FirstOrDefault(m => m.AnoMes == mesAtual);
        var totalInvestido = porMes.Sum(m => m.Investimento);
        var totalSaidas = porMes.Sum(m => m.SaidasCusto);

        return new RelatorioFinanceiroEstoqueResponse
        {
            GeradoEm = agora,
            MesesAnalisados = meses,
            ValorEstoqueAtual = valorEstoque,
            UnidadesEmEstoque = unidades,
            LotesComSaldo = lotesComSaldo.Count(l => !pedidosExcluidos.Contains(l.PedidoCompraId)),
            TotalInvestidoPeriodo = totalInvestido,
            MediaInvestimentoMensal = meses > 0 ? Math.Round(totalInvestido / meses, 2) : 0m,
            InvestimentoMesAtual = itemAtual?.Investimento ?? 0m,
            TotalSaidasCustoPeriodo = totalSaidas,
            MediaSaidasCustoMensal = meses > 0 ? Math.Round(totalSaidas / meses, 2) : 0m,
            SaidasCustoMesAtual = itemAtual?.SaidasCusto ?? 0m,
            PorMes = porMes,
            TopPecasEmEstoque = topPecas,
        };
    }

    private static string ChaveAnoMes(DateTime data) => $"{data.Year:D4}-{data.Month:D2}";

    public async Task<RelatorioReposicaoHistorico> SalvarRelatorioReposicaoAsync(SalvarRelatorioReposicaoRequest request)
    {
        if (request.Itens is null || request.Itens.Count == 0)
            throw new ArgumentException("Não há peças utilizadas para gerar o relatório.");
        if (string.IsNullOrWhiteSpace(request.Html))
            throw new ArgumentException("HTML do relatório é obrigatório.");

        var itens = request.Itens
            .Where(i => i.QuantidadeSaida > 0)
            .OrderBy(i => i.PecaNome)
            .ThenBy(i => i.ModeloNome)
            .ToList();
        if (itens.Count == 0)
            throw new ArgumentException("Não há peças utilizadas para gerar o relatório.");

        var inicio = request.Inicio.Date;
        var fim = request.Fim.Date;
        var titulo = string.IsNullOrWhiteSpace(request.Titulo)
            ? $"Reposição {inicio:dd/MM/yyyy} a {fim:dd/MM/yyyy}"
            : request.Titulo.Trim();

        var doc = new RelatorioReposicaoHistorico
        {
            Titulo = titulo,
            Periodo = string.IsNullOrWhiteSpace(request.Periodo) ? "personalizado" : request.Periodo.Trim(),
            PeriodoLabel = request.PeriodoLabel?.Trim() ?? "",
            Inicio = inicio,
            Fim = fim,
            ModeloIdFiltro = string.IsNullOrWhiteSpace(request.ModeloIdFiltro) ? null : request.ModeloIdFiltro.Trim(),
            ModeloNomeFiltro = string.IsNullOrWhiteSpace(request.ModeloNomeFiltro) ? null : request.ModeloNomeFiltro.Trim(),
            TotalSaidas = request.TotalSaidas > 0 ? request.TotalSaidas : itens.Sum(i => i.QuantidadeSaida),
            TotalItens = itens.Count,
            Itens = itens,
            Html = request.Html,
            GeradoEm = HorarioBrasil.Agora,
            GeradoPor = string.IsNullOrWhiteSpace(request.GeradoPor) ? null : request.GeradoPor.Trim(),
            StatusConclusao = "nao_concluido",
        };

        await _relatoriosReposicao.InsertOneAsync(doc);
        return NormalizarStatusRelatorio(doc);
    }

    public async Task<List<RelatorioReposicaoHistorico>> ListarRelatoriosReposicaoAsync(
        int limite = 10,
        string? statusConclusao = null)
    {
        var lim = Math.Clamp(limite, 1, 10);
        var filtroStatus = NormalizarStatusConclusaoOpcional(statusConclusao);

        // Busca um lote maior para ordenar (não concluído primeiro) e cortar em 10.
        var lista = await _relatoriosReposicao.Find(_ => true)
            .SortByDescending(x => x.GeradoEm)
            .Limit(200)
            .ToListAsync();

        foreach (var item in lista)
            NormalizarStatusRelatorio(item);

        if (filtroStatus is not null)
            lista = lista.Where(x => x.StatusConclusao == filtroStatus).ToList();

        return lista
            .OrderBy(x => OrdemStatusConclusao(x.StatusConclusao))
            .ThenByDescending(x => x.GeradoEm)
            .Take(lim)
            .ToList();
    }

    public async Task<RelatorioReposicaoHistorico?> ObterRelatorioReposicaoAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var doc = await _relatoriosReposicao.Find(x => x.Id == id).FirstOrDefaultAsync();
        return doc is null ? null : NormalizarStatusRelatorio(doc);
    }

    public async Task<RelatorioReposicaoHistorico> AtualizarStatusRelatorioReposicaoAsync(
        string id,
        string statusConclusao)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new KeyNotFoundException("Relatório não encontrado.");

        var status = NormalizarStatusConclusao(statusConclusao);
        var doc = await _relatoriosReposicao.Find(x => x.Id == id).FirstOrDefaultAsync()
            ?? throw new KeyNotFoundException("Relatório não encontrado.");

        doc.StatusConclusao = status;
        await _relatoriosReposicao.ReplaceOneAsync(x => x.Id == id, doc);
        return NormalizarStatusRelatorio(doc);
    }

    private static RelatorioReposicaoHistorico NormalizarStatusRelatorio(RelatorioReposicaoHistorico doc)
    {
        doc.StatusConclusao = NormalizarStatusConclusao(doc.StatusConclusao);
        return doc;
    }

    private static string NormalizarStatusConclusao(string? valor)
    {
        var v = (valor ?? "").Trim().ToLowerInvariant();
        return v switch
        {
            "concluido" or "concluído" => "concluido",
            "parcial" or "concluido_parcialmente" or "concluído_parcialmente" => "parcial",
            _ => "nao_concluido",
        };
    }

    private static string? NormalizarStatusConclusaoOpcional(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor) || valor.Trim() is "todos" or "all")
            return null;
        return NormalizarStatusConclusao(valor);
    }

    private static int OrdemStatusConclusao(string? status) =>
        NormalizarStatusConclusao(status) switch
        {
            "nao_concluido" => 0,
            "parcial" => 1,
            _ => 2,
        };

    public async Task<List<LoteGarantiaItem>> ListarLotesEmGarantiaAsync(
        string? fornecedor = null,
        string? osNumero = null,
        string? lote = null)
    {
        var hoje = HorarioBrasil.Agora.Date;
        var osTermo = osNumero?.Trim();
        var loteTermo = lote?.Trim();
        var fornTermo = fornecedor?.Trim();

        if (!string.IsNullOrWhiteSpace(osTermo))
            return await ListarLotesGarantiaPorOsAsync(osTermo, fornTermo, loteTermo, hoje);

        var filtro = Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0)
            & Builders<LoteEstoque>.Filter.Gte(x => x.DataVencimentoGarantia, hoje);

        if (!string.IsNullOrWhiteSpace(fornTermo))
            filtro &= Builders<LoteEstoque>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(fornTermo), "i"));

        if (!string.IsNullOrWhiteSpace(loteTermo))
            filtro &= FiltroLoteTermo(loteTermo);

        var lotes = await _lotes.Find(filtro)
            .SortBy(x => x.Fornecedor)
            .ThenBy(x => x.DataVencimentoGarantia)
            .ThenBy(x => x.PecaNome)
            .Limit(300)
            .ToListAsync();

        var fornecedoresEstoque = await ListarFornecedoresEstoqueCadastradosAsync();
        return lotes
            .Where(l => EhFornecedorEstoqueCadastrado(l.Fornecedor)
                && fornecedoresEstoque.Contains(l.Fornecedor.Trim()))
            .Select(l => MapearLoteGarantia(l, hoje))
            .ToList();
    }

    public async Task<List<LoteGarantiaItem>> ListarLotesPrestesAVencerAsync(
        int dias = 30,
        string? fornecedor = null,
        string? pecaOuPedido = null)
    {
        var hoje = HorarioBrasil.Agora.Date;
        var horizonte = Math.Clamp(dias, 1, 365);
        var limite = hoje.AddDays(horizonte);

        // Saldo > 0 = peça ainda na assistência, não consumida em OS/aparelho.
        var filtro = Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0)
            & Builders<LoteEstoque>.Filter.Gte(x => x.DataVencimentoGarantia, hoje)
            & Builders<LoteEstoque>.Filter.Lte(x => x.DataVencimentoGarantia, limite);

        var fornTermo = fornecedor?.Trim();
        if (!string.IsNullOrWhiteSpace(fornTermo))
        {
            filtro &= Builders<LoteEstoque>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(fornTermo), "i"));
        }

        var busca = pecaOuPedido?.Trim();
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var esc = System.Text.RegularExpressions.Regex.Escape(busca);
            filtro &= Builders<LoteEstoque>.Filter.Or(
                Builders<LoteEstoque>.Filter.Regex(x => x.PecaNome, new BsonRegularExpression(esc, "i")),
                Builders<LoteEstoque>.Filter.Regex(x => x.NumeroPedido, new BsonRegularExpression(esc, "i")),
                Builders<LoteEstoque>.Filter.Regex(x => x.ModeloNome, new BsonRegularExpression(esc, "i")),
                Builders<LoteEstoque>.Filter.Regex(x => x.MarcaPeca, new BsonRegularExpression(esc, "i")));
        }

        var lotes = await _lotes.Find(filtro)
            .SortBy(x => x.DataVencimentoGarantia)
            .ThenBy(x => x.Fornecedor)
            .ThenBy(x => x.PecaNome)
            .Limit(500)
            .ToListAsync();

        var fornecedoresEstoque = await ListarFornecedoresEstoqueCadastradosAsync();
        return lotes
            .Where(l => EhFornecedorEstoqueCadastrado(l.Fornecedor)
                && fornecedoresEstoque.Contains(l.Fornecedor.Trim()))
            .Select(l => MapearLoteGarantia(l, hoje))
            .ToList();
    }

    private async Task<List<LoteGarantiaItem>> ListarLotesGarantiaPorOsAsync(
        string osTermo,
        string? fornecedor,
        string? loteTermo,
        DateTime hoje)
    {
        var filtroSaida = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "saida")
            & Builders<MovimentacaoEstoque>.Filter.Ne(x => x.LoteId, null)
            & Builders<MovimentacaoEstoque>.Filter.Ne(x => x.LoteId, "");

        var filtroOs = Builders<MovimentacaoEstoque>.Filter.Regex(
            x => x.OsNumero,
            new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(osTermo), "i"));

        if (long.TryParse(osTermo, out var osBlingId) && osBlingId > 0)
        {
            filtroOs = Builders<MovimentacaoEstoque>.Filter.Or(
                filtroOs,
                Builders<MovimentacaoEstoque>.Filter.Eq(x => x.OsBlingId, osBlingId));
        }

        var saidas = await _movimentacoes.Find(filtroSaida & filtroOs).ToListAsync();
        if (saidas.Count == 0) return [];

        var porLote = saidas
            .Where(s => !string.IsNullOrWhiteSpace(s.LoteId))
            .GroupBy(s => s.LoteId!.Trim())
            .ToDictionary(
                g => g.Key,
                g => new
                {
                    Qtd = g.Sum(x => x.Quantidade),
                    OsNumero = g.Select(x => x.OsNumero).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)),
                    OsBlingId = g.Select(x => x.OsBlingId).FirstOrDefault(id => id is > 0),
                });

        var loteIds = porLote.Keys.ToList();
        var filtroLotes = Builders<LoteEstoque>.Filter.In(x => x.Id, loteIds)
            & Builders<LoteEstoque>.Filter.Gte(x => x.DataVencimentoGarantia, hoje);

        if (!string.IsNullOrWhiteSpace(fornecedor))
            filtroLotes &= Builders<LoteEstoque>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(fornecedor), "i"));

        if (!string.IsNullOrWhiteSpace(loteTermo))
            filtroLotes &= FiltroLoteTermo(loteTermo);

        var lotes = await _lotes.Find(filtroLotes)
            .SortBy(x => x.Fornecedor)
            .ThenBy(x => x.DataVencimentoGarantia)
            .ThenBy(x => x.PecaNome)
            .Limit(300)
            .ToListAsync();

        // Já enviados ao fornecedor + já na caixa pendente.
        var filtroDev = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "devolucao_garantia")
            & Builders<MovimentacaoEstoque>.Filter.In(x => x.LoteId, loteIds)
            & filtroOs;
        var devolvidas = await _movimentacoes.Find(filtroDev).ToListAsync();
        var devolvidoPorLote = devolvidas
            .Where(d => !string.IsNullOrWhiteSpace(d.LoteId))
            .GroupBy(d => d.LoteId!.Trim())
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantidade));

        var naCaixa = await QuantidadeNaCaixaPorLoteOsAsync(loteIds, osTermo);
        var fornecedoresEstoque = await ListarFornecedoresEstoqueCadastradosAsync();

        var itens = new List<LoteGarantiaItem>();
        foreach (var l in lotes)
        {
            if (l.Id is null || !porLote.TryGetValue(l.Id, out var meta)) continue;
            // Só fornecedores cadastrados via pedido de compra (lista dinâmica).
            if (!EhFornecedorEstoqueCadastrado(l.Fornecedor)
                || !fornecedoresEstoque.Contains(l.Fornecedor.Trim()))
                continue;

            var jaDev = devolvidoPorLote.GetValueOrDefault(l.Id, 0);
            var jaCaixa = naCaixa.GetValueOrDefault(l.Id, 0);
            var restanteOs = Math.Max(0, meta.Qtd - jaDev - jaCaixa);
            if (restanteOs <= 0) continue;

            var item = MapearLoteGarantia(l, hoje);
            item.OsNumero = meta.OsNumero;
            item.OsBlingId = meta.OsBlingId;
            item.QuantidadeUsadaOs = meta.Qtd;
            item.QuantidadeDisponivelRetorno = restanteOs;
            itens.Add(item);
        }

        return itens.OrderBy(i => i.Fornecedor, StringComparer.OrdinalIgnoreCase)
            .ThenBy(i => i.PecaNome, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static FilterDefinition<LoteEstoque> FiltroLoteTermo(string loteTermo)
    {
        var esc = System.Text.RegularExpressions.Regex.Escape(loteTermo);
        var regex = new BsonRegularExpression(esc, "i");
        var filtros = new List<FilterDefinition<LoteEstoque>>
        {
            Builders<LoteEstoque>.Filter.Regex(x => x.NumeroPedido, regex),
        };
        if (ObjectId.TryParse(loteTermo, out _))
            filtros.Add(Builders<LoteEstoque>.Filter.Eq(x => x.Id, loteTermo));
        return Builders<LoteEstoque>.Filter.Or(filtros);
    }

    private static LoteGarantiaItem MapearLoteGarantia(LoteEstoque l, DateTime hoje) => new()
    {
        Id = l.Id,
        PedidoCompraId = l.PedidoCompraId,
        NumeroPedido = l.NumeroPedido,
        Fornecedor = l.Fornecedor,
        PecaId = l.PecaId,
        PecaNome = l.PecaNome,
        MarcaPeca = l.MarcaPeca,
        ModeloId = l.ModeloId,
        ModeloNome = l.ModeloNome,
        Cor = l.Cor,
        QuantidadeInicial = l.QuantidadeInicial,
        QuantidadeRestante = l.QuantidadeRestante,
        CustoUnitario = l.CustoUnitario,
        GarantiaMeses = l.GarantiaMeses,
        DataEntrada = l.DataEntrada,
        DataVencimentoGarantia = l.DataVencimentoGarantia,
        DiasGarantiaRestantes = Math.Max(0, (l.DataVencimentoGarantia.Date - hoje).Days),
        QuantidadeDisponivelRetorno = Math.Max(0, l.QuantidadeRestante),
    };

    public async Task<CaixaRetornoAdicaoResponse> AdicionarCaixaRetornoGarantiaAsync(
        RegistrarDevolucaoGarantiaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.LoteId))
            throw new ArgumentException("Lote é obrigatório.");
        if (request.Quantidade <= 0)
            throw new ArgumentException("Quantidade deve ser maior que zero.");

        var lote = await _lotes.Find(x => x.Id == request.LoteId.Trim()).FirstOrDefaultAsync()
            ?? throw new ArgumentException("Lote não encontrado.");

        if (!EhFornecedorEstoqueCadastrado(lote.Fornecedor))
            throw new InvalidOperationException(
                "Fornecedor do lote não é um fornecedor cadastrado de estoque.");

        var hoje = HorarioBrasil.Agora.Date;
        if (lote.DataVencimentoGarantia.Date < hoje)
            throw new InvalidOperationException(
                $"Garantia do lote vencida em {lote.DataVencimentoGarantia:dd/MM/yyyy}.");

        var origemOs = request.OrigemOs
            || !string.IsNullOrWhiteSpace(request.OsNumero)
            || request.OsBlingId is > 0;

        long? osBlingId = request.OsBlingId is > 0 ? request.OsBlingId : null;
        var osNumero = string.IsNullOrWhiteSpace(request.OsNumero) ? null : request.OsNumero.Trim();
        var qtd = request.Quantidade;
        var baixarSaldo = false;

        if (origemOs)
        {
            var (usadaOs, reservadoOs, osNumResolvido, osIdResolvido) =
                await ObterUsoOsNoLoteAsync(lote.Id!, osNumero, osBlingId);

            if (usadaOs <= 0)
                throw new InvalidOperationException(
                    "Nenhuma saída deste lote foi encontrada para a OS informada.");

            var restanteOs = Math.Max(0, usadaOs - reservadoOs);
            if (qtd > restanteOs)
                throw new InvalidOperationException(
                    $"Quantidade acima do disponível para a caixa. Restante: {restanteOs}.");

            osNumero ??= osNumResolvido;
            osBlingId ??= osIdResolvido;
        }
        else
        {
            var naCaixaSemOs = await QuantidadeNaCaixaLoteSemOsAsync(lote.Id!);
            var disponivel = lote.QuantidadeRestante - naCaixaSemOs;
            // Itens sem OS na caixa já baixaram saldo; disponivel = saldo atual.
            if (qtd > lote.QuantidadeRestante)
                throw new InvalidOperationException(
                    $"Saldo insuficiente no lote. Disponível: {lote.QuantidadeRestante}.");
            _ = disponivel;
            baixarSaldo = true;
        }

        if (baixarSaldo)
        {
            var atualizado = await _lotes.FindOneAndUpdateAsync(
                Builders<LoteEstoque>.Filter.And(
                    Builders<LoteEstoque>.Filter.Eq(x => x.Id, lote.Id),
                    Builders<LoteEstoque>.Filter.Gte(x => x.QuantidadeRestante, qtd)),
                Builders<LoteEstoque>.Update.Inc(x => x.QuantidadeRestante, -qtd),
                new FindOneAndUpdateOptions<LoteEstoque> { ReturnDocument = ReturnDocument.After });

            if (atualizado is null)
                throw new InvalidOperationException("Conflito ao reservar o lote na caixa. Tente novamente.");
        }

        var motivo = string.IsNullOrWhiteSpace(request.Motivo)
            ? "Defeito / problema da peça"
            : request.Motivo.Trim();
        var obs = string.IsNullOrWhiteSpace(request.Observacao) ? null : request.Observacao.Trim();

        var item = new CaixaRetornoGarantiaItem
        {
            Status = "pendente",
            LoteId = lote.Id!,
            PedidoCompraId = lote.PedidoCompraId,
            NumeroPedido = lote.NumeroPedido,
            Fornecedor = lote.Fornecedor.Trim(),
            PecaId = lote.PecaId,
            PecaNome = lote.PecaNome,
            MarcaPeca = lote.MarcaPeca,
            ModeloId = lote.ModeloId,
            ModeloNome = lote.ModeloNome,
            Cor = lote.Cor,
            Quantidade = qtd,
            CustoUnitario = lote.CustoUnitario,
            DataEntrada = lote.DataEntrada,
            DataVencimentoGarantia = lote.DataVencimentoGarantia,
            OsNumero = osNumero,
            OsBlingId = osBlingId,
            OrigemOs = origemOs,
            Motivo = motivo,
            Observacao = obs,
            CriadoEm = HorarioBrasil.Agora,
            BaixouSaldo = baixarSaldo,
        };
        await _caixaRetorno.InsertOneAsync(item);

        var prazoGrupo = await CalcularPrazoCaixaFornecedorAsync(item.Fornecedor);
        return new CaixaRetornoAdicaoResponse
        {
            Item = item,
            DataPrazoMaximoEnvioFornecedor = prazoGrupo.prazo,
            DiasRestantesPrazo = prazoGrupo.dias,
        };
    }

    public async Task<CaixaRetornoGarantiaResponse> ListarCaixaRetornoGarantiaAsync(string? fornecedor = null)
    {
        var filtro = Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.Status, "pendente");
        if (!string.IsNullOrWhiteSpace(fornecedor))
        {
            filtro &= Builders<CaixaRetornoGarantiaItem>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression(
                    "^" + System.Text.RegularExpressions.Regex.Escape(fornecedor.Trim()) + "$", "i"));
        }

        var itens = await _caixaRetorno.Find(filtro)
            .SortBy(x => x.Fornecedor)
            .ThenBy(x => x.DataVencimentoGarantia)
            .ToListAsync();

        var cadastrados = await ListarFornecedoresEstoqueCadastradosAsync();
        var hoje = HorarioBrasil.Agora.Date;

        var grupos = itens
            .Where(i => cadastrados.Contains(i.Fornecedor.Trim()))
            .GroupBy(i => i.Fornecedor.Trim(), StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Min(x => x.DataVencimentoGarantia))
            .Select(g =>
            {
                var vencProx = g.Min(x => x.DataVencimentoGarantia.Date);
                var prazo = vencProx.AddDays(-DiasAntecedenciaPrazoEnvio);
                var dias = (prazo - hoje).Days;
                return new CaixaRetornoFornecedorGrupo
                {
                    Fornecedor = g.Key,
                    TotalItens = g.Count(),
                    TotalUnidades = g.Sum(x => x.Quantidade),
                    DataVencimentoMaisProxima = vencProx,
                    DataPrazoMaximoEnvio = prazo,
                    DiasRestantesPrazo = dias,
                    PrazoVencido = dias < 0,
                    Itens = g.OrderBy(x => x.DataVencimentoGarantia).ThenBy(x => x.PecaNome).ToList(),
                };
            })
            .ToList();

        return new CaixaRetornoGarantiaResponse
        {
            DiasAntecedenciaPrazo = DiasAntecedenciaPrazoEnvio,
            Fornecedores = grupos,
        };
    }

    public async Task RemoverCaixaRetornoGarantiaAsync(string itemId)
    {
        if (string.IsNullOrWhiteSpace(itemId))
            throw new ArgumentException("Item da caixa é obrigatório.");

        var item = await _caixaRetorno.Find(x => x.Id == itemId.Trim() && x.Status == "pendente")
            .FirstOrDefaultAsync()
            ?? throw new ArgumentException("Item não encontrado na caixa.");

        if (item.BaixouSaldo && !string.IsNullOrWhiteSpace(item.LoteId))
        {
            await _lotes.UpdateOneAsync(
                Builders<LoteEstoque>.Filter.Eq(x => x.Id, item.LoteId),
                Builders<LoteEstoque>.Update.Inc(x => x.QuantidadeRestante, item.Quantidade));
        }

        await _caixaRetorno.DeleteOneAsync(x => x.Id == item.Id);
    }

    public async Task<LoteDevolucaoGarantiaDocumento> GerarLoteDevolucaoGarantiaAsync(
        GerarLoteDevolucaoGarantiaRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Fornecedor))
            throw new ArgumentException("Fornecedor é obrigatório para gerar o lote.");

        var forn = request.Fornecedor.Trim();
        var cadastrados = await ListarFornecedoresEstoqueCadastradosAsync();
        if (!cadastrados.Contains(forn))
            throw new ArgumentException(
                "Fornecedor não cadastrado no estoque (só entram fornecedores de pedido de compra).");

        var pendentes = await _caixaRetorno.Find(
                Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.Status, "pendente")
                & Builders<CaixaRetornoGarantiaItem>.Filter.Regex(
                    x => x.Fornecedor,
                    new BsonRegularExpression("^" + System.Text.RegularExpressions.Regex.Escape(forn) + "$", "i")))
            .SortBy(x => x.DataVencimentoGarantia)
            .ToListAsync();

        if (pendentes.Count == 0)
            throw new InvalidOperationException(
                "Nenhuma peça na caixa de retorno para este fornecedor.");

        var motivo = string.IsNullOrWhiteSpace(request.Motivo)
            ? "Lote retorno garantia — problema da peça"
            : request.Motivo.Trim();

        var loteEnvioId = ObjectId.GenerateNewId().ToString();
        var agora = HorarioBrasil.Agora;
        var docs = new List<DevolucaoGarantiaDocumento>();

        foreach (var item in pendentes)
        {
            var mov = new MovimentacaoEstoque
            {
                Tipo = "devolucao_garantia",
                PecaId = item.PecaId,
                PecaNome = item.PecaNome,
                MarcaPeca = item.MarcaPeca,
                ModeloId = item.ModeloId,
                ModeloNome = item.ModeloNome,
                Cor = item.Cor,
                EstoqueLocal = item.BaixouSaldo,
                LoteId = item.LoteId,
                PedidoCompraId = item.PedidoCompraId,
                NumeroPedido = item.NumeroPedido,
                Quantidade = item.Quantidade,
                CustoUnitario = item.CustoUnitario,
                OsBlingId = item.OsBlingId,
                OsNumero = item.OsNumero,
                Observacao = string.IsNullOrWhiteSpace(item.Observacao)
                    ? $"{motivo} (lote {loteEnvioId})"
                    : $"{motivo} — {item.Observacao} (lote {loteEnvioId})",
                Data = agora,
                CriadoEm = agora,
            };
            await _movimentacoes.InsertOneAsync(mov);

            docs.Add(new DevolucaoGarantiaDocumento
            {
                Id = mov.Id ?? ObjectId.GenerateNewId().ToString(),
                GeradoEm = agora,
                Fornecedor = item.Fornecedor,
                NumeroPedido = item.NumeroPedido,
                PecaNome = item.PecaNome,
                MarcaPeca = item.MarcaPeca,
                ModeloNome = item.ModeloNome,
                Cor = item.Cor,
                Quantidade = item.Quantidade,
                CustoUnitario = item.CustoUnitario,
                DataEntrada = item.DataEntrada,
                DataVencimentoGarantia = item.DataVencimentoGarantia,
                Motivo = item.Motivo ?? motivo,
                Observacao = item.Observacao,
                MovimentacaoId = mov.Id ?? "",
                OsNumero = item.OsNumero,
                OsBlingId = item.OsBlingId,
            });
        }

        var vencProx = pendentes.Min(x => x.DataVencimentoGarantia.Date);
        var prazo = vencProx.AddDays(-DiasAntecedenciaPrazoEnvio);
        var totalUnidades = docs.Sum(d => d.Quantidade);

        // Histórico para consulta em tela própria; some da caixa desta tela.
        var historico = new LoteRetornoGarantiaHistorico
        {
            Id = loteEnvioId,
            Fornecedor = forn,
            Motivo = motivo,
            TotalUnidades = totalUnidades,
            TotalItens = docs.Count,
            DataVencimentoMaisProxima = vencProx,
            DataPrazoMaximoEnvio = prazo,
            GeradoEm = agora,
            Itens = docs,
        };
        await _lotesRetornoHistorico.InsertOneAsync(historico);

        var idsCaixa = pendentes.Select(p => p.Id!).Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
        if (idsCaixa.Count > 0)
        {
            await _caixaRetorno.DeleteManyAsync(
                Builders<CaixaRetornoGarantiaItem>.Filter.In(x => x.Id, idsCaixa));
        }

        return new LoteDevolucaoGarantiaDocumento
        {
            Id = loteEnvioId,
            GeradoEm = agora,
            Fornecedor = forn,
            Motivo = motivo,
            TotalUnidades = totalUnidades,
            DataVencimentoMaisProxima = vencProx,
            DataPrazoMaximoEnvio = prazo,
            Itens = docs,
        };
    }

    public async Task<List<LoteRetornoGarantiaHistorico>> ListarLotesRetornoHistoricoAsync(
        string? fornecedor = null,
        DateTime? de = null,
        DateTime? ate = null,
        int limite = 100)
    {
        limite = Math.Clamp(limite, 1, 500);
        var filtro = Builders<LoteRetornoGarantiaHistorico>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(fornecedor))
        {
            filtro &= Builders<LoteRetornoGarantiaHistorico>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression($"^{Regex.Escape(fornecedor.Trim())}$", "i"));
        }

        if (de.HasValue)
        {
            var ini = DateTime.SpecifyKind(de.Value.Date, DateTimeKind.Utc);
            filtro &= Builders<LoteRetornoGarantiaHistorico>.Filter.Gte(x => x.GeradoEm, ini);
        }

        if (ate.HasValue)
        {
            var fim = DateTime.SpecifyKind(ate.Value.Date.AddDays(1), DateTimeKind.Utc);
            filtro &= Builders<LoteRetornoGarantiaHistorico>.Filter.Lt(x => x.GeradoEm, fim);
        }

        return await _lotesRetornoHistorico.Find(filtro)
            .SortByDescending(x => x.GeradoEm)
            .Limit(limite)
            .ToListAsync();
    }

    public async Task<LoteRetornoGarantiaHistorico?> ObterLoteRetornoHistoricoAsync(string id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _lotesRetornoHistorico.Find(x => x.Id == id.Trim()).FirstOrDefaultAsync();
    }

    public async Task<AnaliseRetornoGarantiaResponse> AnalisarRetornosGarantiaAsync(
        DateTime? de = null,
        DateTime? ate = null,
        string? fornecedor = null)
    {
        var lotes = await ListarLotesRetornoHistoricoAsync(fornecedor, de, ate, limite: 500);
        var resp = new AnaliseRetornoGarantiaResponse
        {
            De = de?.Date,
            Ate = ate?.Date,
            TotalLotes = lotes.Count,
            TotalUnidades = lotes.Sum(l => l.TotalUnidades),
        };

        var porFornecedor = lotes
            .GroupBy(l => (l.Fornecedor ?? "").Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var itens = g.SelectMany(l => l.Itens).ToList();
                var pecas = itens
                    .GroupBy(i => ChavePecaRetorno(i.PecaNome, i.MarcaPeca), StringComparer.OrdinalIgnoreCase)
                    .Select(pg =>
                    {
                        var first = pg.First();
                        return new AnaliseRetornoPecaItem
                        {
                            PecaNome = first.PecaNome?.Trim() ?? "(sem nome)",
                            MarcaPeca = string.IsNullOrWhiteSpace(first.MarcaPeca) ? null : first.MarcaPeca.Trim(),
                            Quantidade = pg.Sum(x => x.Quantidade),
                            Ocorrencias = pg.Count(),
                        };
                    })
                    .OrderByDescending(p => p.Quantidade)
                    .ThenBy(p => p.PecaNome, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return new AnaliseRetornoFornecedorItem
                {
                    Fornecedor = string.IsNullOrWhiteSpace(g.Key) ? "(sem fornecedor)" : g.First().Fornecedor.Trim(),
                    TotalLotes = g.Count(),
                    TotalUnidades = g.Sum(l => l.TotalUnidades),
                    TotalItensLinha = itens.Count,
                    Pecas = pecas,
                };
            })
            .OrderByDescending(f => f.TotalUnidades)
            .ThenBy(f => f.Fornecedor, StringComparer.OrdinalIgnoreCase)
            .ToList();

        resp.Fornecedores = porFornecedor;

        var pecasGlobais = lotes
            .SelectMany(l => l.Itens.Select(i => (Forn: l.Fornecedor, Item: i)))
            .GroupBy(x => ChavePecaRetorno(x.Item.PecaNome, x.Item.MarcaPeca), StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var first = g.First().Item;
                var fornTop = g
                    .GroupBy(x => (x.Forn ?? "").Trim(), StringComparer.OrdinalIgnoreCase)
                    .OrderByDescending(fg => fg.Sum(x => x.Item.Quantidade))
                    .Select(fg => string.IsNullOrWhiteSpace(fg.Key) ? null : fg.First().Forn?.Trim())
                    .FirstOrDefault();

                return new AnaliseRetornoPecaItem
                {
                    PecaNome = first.PecaNome?.Trim() ?? "(sem nome)",
                    MarcaPeca = string.IsNullOrWhiteSpace(first.MarcaPeca) ? null : first.MarcaPeca.Trim(),
                    Quantidade = g.Sum(x => x.Item.Quantidade),
                    Ocorrencias = g.Count(),
                    FornecedorMaisFrequente = fornTop,
                };
            })
            .OrderByDescending(p => p.Quantidade)
            .ThenBy(p => p.PecaNome, StringComparer.OrdinalIgnoreCase)
            .ToList();

        resp.Pecas = pecasGlobais;
        return resp;
    }

    private static string ChavePecaRetorno(string? pecaNome, string? marcaPeca)
    {
        var nome = (pecaNome ?? "").Trim().ToLowerInvariant();
        var marca = (marcaPeca ?? "").Trim().ToLowerInvariant();
        return $"{nome}|{marca}";
    }

    private async Task<(int Usada, int Reservado, string? OsNumero, long? OsBlingId)> ObterUsoOsNoLoteAsync(
        string loteId,
        string? osNumero,
        long? osBlingId)
    {
        var filtroOs = Builders<MovimentacaoEstoque>.Filter.Empty;
        if (!string.IsNullOrWhiteSpace(osNumero))
        {
            filtroOs = Builders<MovimentacaoEstoque>.Filter.Regex(
                x => x.OsNumero,
                new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(osNumero), "i"));
            if (long.TryParse(osNumero, out var parsed) && parsed > 0)
            {
                filtroOs = Builders<MovimentacaoEstoque>.Filter.Or(
                    filtroOs,
                    Builders<MovimentacaoEstoque>.Filter.Eq(x => x.OsBlingId, parsed));
            }
        }
        else if (osBlingId is > 0)
        {
            filtroOs = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.OsBlingId, osBlingId.Value);
        }
        else
        {
            throw new ArgumentException("Informe a OS (número) para retorno com origem na OS.");
        }

        var baseLote = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.LoteId, loteId) & filtroOs;
        var saidas = await _movimentacoes.Find(
            baseLote & Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "saida")).ToListAsync();
        var devolucoes = await _movimentacoes.Find(
            baseLote & Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "devolucao_garantia")).ToListAsync();

        var filtroCaixa = Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.Status, "pendente")
            & Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.LoteId, loteId);
        if (!string.IsNullOrWhiteSpace(osNumero))
        {
            var cajaOs = Builders<CaixaRetornoGarantiaItem>.Filter.Regex(
                x => x.OsNumero,
                new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(osNumero), "i"));
            if (long.TryParse(osNumero, out var parsedOs) && parsedOs > 0)
            {
                cajaOs = Builders<CaixaRetornoGarantiaItem>.Filter.Or(
                    cajaOs,
                    Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.OsBlingId, parsedOs));
            }
            filtroCaixa &= cajaOs;
        }
        else if (osBlingId is > 0)
        {
            filtroCaixa &= Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.OsBlingId, osBlingId.Value);
        }

        var naCaixa = await _caixaRetorno.Find(filtroCaixa).ToListAsync();
        var usada = saidas.Sum(s => s.Quantidade);
        var reservado = devolucoes.Sum(d => d.Quantidade) + naCaixa.Sum(c => c.Quantidade);
        var osNum = saidas.Select(s => s.OsNumero).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)) ?? osNumero;
        var osId = saidas.Select(s => s.OsBlingId).FirstOrDefault(id => id is > 0) ?? osBlingId;
        return (usada, reservado, osNum, osId);
    }

    private async Task<Dictionary<string, int>> QuantidadeNaCaixaPorLoteOsAsync(
        List<string> loteIds,
        string osTermo)
    {
        var filtro = Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.Status, "pendente")
            & Builders<CaixaRetornoGarantiaItem>.Filter.In(x => x.LoteId, loteIds);

        var filtroOs = Builders<CaixaRetornoGarantiaItem>.Filter.Regex(
            x => x.OsNumero,
            new BsonRegularExpression(System.Text.RegularExpressions.Regex.Escape(osTermo), "i"));
        if (long.TryParse(osTermo, out var blingId) && blingId > 0)
        {
            filtroOs = Builders<CaixaRetornoGarantiaItem>.Filter.Or(
                filtroOs,
                Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.OsBlingId, blingId));
        }

        var itens = await _caixaRetorno.Find(filtro & filtroOs).ToListAsync();
        return itens
            .GroupBy(i => i.LoteId.Trim())
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Quantidade));
    }

    private async Task<int> QuantidadeNaCaixaLoteSemOsAsync(string loteId)
    {
        var itens = await _caixaRetorno.Find(x =>
                x.Status == "pendente"
                && x.LoteId == loteId
                && !x.OrigemOs)
            .ToListAsync();
        return itens.Sum(i => i.Quantidade);
    }

    private async Task<(DateTime prazo, int dias)> CalcularPrazoCaixaFornecedorAsync(string fornecedor)
    {
        var hoje = HorarioBrasil.Agora.Date;
        var itens = await _caixaRetorno.Find(
            Builders<CaixaRetornoGarantiaItem>.Filter.Eq(x => x.Status, "pendente")
            & Builders<CaixaRetornoGarantiaItem>.Filter.Regex(
                x => x.Fornecedor,
                new BsonRegularExpression(
                    "^" + System.Text.RegularExpressions.Regex.Escape(fornecedor.Trim()) + "$", "i")))
            .ToListAsync();

        if (itens.Count == 0)
            return (hoje, 0);

        var venc = itens.Min(i => i.DataVencimentoGarantia.Date);
        var prazo = venc.AddDays(-DiasAntecedenciaPrazoEnvio);
        return (prazo, (prazo - hoje).Days);
    }

    public async Task<List<EstoqueSugestaoItem>> SugerirOsGarantiaAsync(string? termo, int limite = 20)
    {
        limite = Math.Clamp(limite, 1, 50);
        var hoje = HorarioBrasil.Agora.Date;
        var inicio = hoje.AddDays(-540);
        var filtro = Builders<MovimentacaoEstoque>.Filter.Eq(x => x.Tipo, "saida")
            & Builders<MovimentacaoEstoque>.Filter.Ne(x => x.LoteId, null)
            & Builders<MovimentacaoEstoque>.Filter.Ne(x => x.LoteId, "")
            & FiltroPeriodoDataBrasil(inicio, hoje);

        var t = termo?.Trim();
        if (!string.IsNullOrWhiteSpace(t))
        {
            var esc = System.Text.RegularExpressions.Regex.Escape(t);
            var filtroOs = Builders<MovimentacaoEstoque>.Filter.Regex(
                x => x.OsNumero,
                new BsonRegularExpression(esc, "i"));
            if (long.TryParse(t, out var blingId) && blingId > 0)
            {
                filtroOs = Builders<MovimentacaoEstoque>.Filter.Or(
                    filtroOs,
                    Builders<MovimentacaoEstoque>.Filter.Eq(x => x.OsBlingId, blingId));
            }
            filtro &= filtroOs;
        }
        else
        {
            filtro &= Builders<MovimentacaoEstoque>.Filter.Or(
                Builders<MovimentacaoEstoque>.Filter.Ne(x => x.OsNumero, null)
                    & Builders<MovimentacaoEstoque>.Filter.Ne(x => x.OsNumero, ""),
                Builders<MovimentacaoEstoque>.Filter.Gt(x => x.OsBlingId, 0));
        }

        var saidas = await _movimentacoes.Find(filtro)
            .SortByDescending(x => x.Data)
            .Limit(400)
            .ToListAsync();

        var loteIds = saidas
            .Select(s => s.LoteId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var lotesGarantia = loteIds.Count == 0
            ? new Dictionary<string, LoteEstoque>(StringComparer.OrdinalIgnoreCase)
            : (await _lotes.Find(
                    Builders<LoteEstoque>.Filter.In(x => x.Id, loteIds)
                    & Builders<LoteEstoque>.Filter.Gte(x => x.DataVencimentoGarantia, hoje))
                .ToListAsync())
                .Where(l => !string.IsNullOrWhiteSpace(l.Id))
                .ToDictionary(l => l.Id!, StringComparer.OrdinalIgnoreCase);

        var grupos = saidas
            .Where(s => !string.IsNullOrWhiteSpace(s.LoteId) && lotesGarantia.ContainsKey(s.LoteId!))
            .GroupBy(s =>
            {
                var num = (s.OsNumero ?? "").Trim();
                if (!string.IsNullOrEmpty(num)) return num;
                return s.OsBlingId is > 0 ? s.OsBlingId.Value.ToString() : "";
            })
            .Where(g => !string.IsNullOrEmpty(g.Key))
            .OrderByDescending(g => g.Max(x => x.Data))
            .Take(limite)
            .Select(g =>
            {
                var pecas = g.Select(x => x.PecaNome)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(3)
                    .ToList();
                var modelos = g.Select(x => x.ModeloNome)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(2)
                    .ToList();
                var extras = new List<string>();
                if (pecas.Count > 0) extras.Add(string.Join(", ", pecas));
                if (modelos.Count > 0) extras.Add(string.Join(", ", modelos));
                return new EstoqueSugestaoItem
                {
                    Id = g.Key,
                    Nome = $"OS #{g.Key}",
                    Extra = extras.Count > 0 ? string.Join(" · ", extras) : null,
                };
            })
            .ToList();

        return grupos;
    }

    public async Task<List<EstoqueSugestaoItem>> SugerirLoteGarantiaAsync(string? termo, int limite = 20)
    {
        limite = Math.Clamp(limite, 1, 50);
        var hoje = HorarioBrasil.Agora.Date;
        var filtro = Builders<LoteEstoque>.Filter.Gte(x => x.DataVencimentoGarantia, hoje);

        var t = termo?.Trim();
        if (!string.IsNullOrWhiteSpace(t))
            filtro &= FiltroLoteTermo(t);
        else
            filtro &= Builders<LoteEstoque>.Filter.Gt(x => x.QuantidadeRestante, 0);

        var lotes = await _lotes.Find(filtro)
            .SortByDescending(x => x.DataEntrada)
            .Limit(Math.Max(limite * 3, 40))
            .ToListAsync();

        var fornecedoresEstoque = await ListarFornecedoresEstoqueCadastradosAsync();
        return lotes
            .Where(l => EhFornecedorEstoqueCadastrado(l.Fornecedor)
                && fornecedoresEstoque.Contains(l.Fornecedor.Trim()))
            .Take(limite)
            .Select(l => new EstoqueSugestaoItem
            {
                Id = l.Id ?? l.NumeroPedido,
                Nome = string.IsNullOrWhiteSpace(l.NumeroPedido) ? (l.Id ?? "Lote") : l.NumeroPedido,
                Extra = string.Join(" · ", new[]
                {
                    l.PecaNome,
                    l.Fornecedor,
                    l.Cor,
                }.Where(x => !string.IsNullOrWhiteSpace(x))),
            })
            .ToList();
    }

    public async Task<List<EstoqueSugestaoItem>> SugerirFornecedorGarantiaAsync(string? termo, int limite = 20)
    {
        limite = Math.Clamp(limite, 1, 50);
        var cadastrados = await ListarFornecedoresEstoqueCadastradosAsync();
        var t = termo?.Trim();

        IEnumerable<string> filtrados = cadastrados;
        if (!string.IsNullOrWhiteSpace(t))
            filtrados = cadastrados.Where(f =>
                f.Contains(t, StringComparison.OrdinalIgnoreCase));

        return filtrados
            .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
            .Take(limite)
            .Select(f => new EstoqueSugestaoItem
            {
                Id = f,
                Nome = f,
                Extra = "Fornecedor de estoque",
            })
            .ToList();
    }

    /// <summary>
    /// Fornecedores que alimentam o estoque via pedido de compra.
    /// Lista dinâmica: qualquer novo fornecedor em pedido/lote entra automaticamente.
    /// </summary>
    private async Task<HashSet<string>> ListarFornecedoresEstoqueCadastradosAsync()
    {
        var dosPedidos = await _pedidos.DistinctAsync(x => x.Fornecedor, FilterDefinition<PedidoCompraEstoque>.Empty);
        var lista = await dosPedidos.ToListAsync();

        // Complementa com lotes de entrada real (pedidos), caso algum lote tenha fornecedor distinto.
        var dosLotes = await _lotes.DistinctAsync(
            x => x.Fornecedor,
            Builders<LoteEstoque>.Filter.Ne(x => x.PedidoCompraId, null)
                & Builders<LoteEstoque>.Filter.Ne(x => x.PedidoCompraId, ""));
        lista.AddRange(await dosLotes.ToListAsync());

        return lista
            .Where(EhFornecedorEstoqueCadastrado)
            .Select(f => f.Trim())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private static bool EhFornecedorEstoqueCadastrado(string? fornecedor)
    {
        if (string.IsNullOrWhiteSpace(fornecedor)) return false;
        var f = fornecedor.Trim();
        if (f.Equals("Estorno OS", StringComparison.OrdinalIgnoreCase)) return false;
        if (f.Equals("Cadastro", StringComparison.OrdinalIgnoreCase)) return false;
        if (f.StartsWith("ESTORNO-OS", StringComparison.OrdinalIgnoreCase)) return false;
        return true;
    }
}
