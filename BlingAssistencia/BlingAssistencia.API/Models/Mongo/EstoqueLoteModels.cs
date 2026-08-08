using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>Pedido de compra ao fornecedor — gera lotes de estoque.</summary>
public class PedidoCompraEstoque
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("numeroPedido")]
    public string NumeroPedido { get; set; } = string.Empty;

    [BsonElement("fornecedor")]
    public string Fornecedor { get; set; } = string.Empty;

    [BsonElement("numeroNf")]
    public string? NumeroNf { get; set; }

    [BsonElement("dataPedido")]
    public DateTime DataPedido { get; set; }

    [BsonElement("observacoes")]
    public string? Observacoes { get; set; }

    [BsonElement("totalItens")]
    public int TotalItens { get; set; }

    [BsonElement("totalUnidades")]
    public int TotalUnidades { get; set; }

    [BsonElement("valorTotal")]
    public decimal ValorTotal { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

/// <summary>Lote de estoque — unidade rastreável com garantia e custo.</summary>
public class LoteEstoque
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("pedidoCompraId")]
    public string PedidoCompraId { get; set; } = string.Empty;

    [BsonElement("numeroPedido")]
    public string NumeroPedido { get; set; } = string.Empty;

    [BsonElement("fornecedor")]
    public string Fornecedor { get; set; } = string.Empty;

    [BsonElement("pecaId")]
    public string PecaId { get; set; } = string.Empty;

    [BsonElement("pecaNome")]
    public string PecaNome { get; set; } = string.Empty;

    [BsonElement("marcaPeca")]
    public string? MarcaPeca { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    /// <summary>Cor da peça (ex.: Tampa traseira Preto).</summary>
    [BsonElement("cor")]
    public string? Cor { get; set; }

    [BsonElement("quantidadeInicial")]
    public int QuantidadeInicial { get; set; }

    [BsonElement("quantidadeRestante")]
    public int QuantidadeRestante { get; set; }

    [BsonElement("custoUnitario")]
    public decimal CustoUnitario { get; set; }

    [BsonElement("garantiaMeses")]
    public int GarantiaMeses { get; set; } = 12;

    [BsonElement("dataEntrada")]
    public DateTime DataEntrada { get; set; }

    [BsonElement("dataVencimentoGarantia")]
    public DateTime DataVencimentoGarantia { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

/// <summary>Entrada, saída ou ajuste de estoque.</summary>
public class MovimentacaoEstoque
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>entrada | saida | ajuste</summary>
    [BsonElement("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [BsonElement("pecaId")]
    public string PecaId { get; set; } = string.Empty;

    [BsonElement("pecaNome")]
    public string PecaNome { get; set; } = string.Empty;

    [BsonElement("marcaPeca")]
    public string? MarcaPeca { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("cor")]
    public string? Cor { get; set; }

    /// <summary>False = movimentação fora do estoque físico da loja (ex.: fornecedor externo).</summary>
    [BsonElement("estoqueLocal")]
    public bool EstoqueLocal { get; set; } = true;

    [BsonElement("loteId")]
    public string? LoteId { get; set; }

    [BsonElement("pedidoCompraId")]
    public string? PedidoCompraId { get; set; }

    [BsonElement("numeroPedido")]
    public string? NumeroPedido { get; set; }

    [BsonElement("quantidade")]
    public int Quantidade { get; set; }

    /// <summary>
    /// Quantidade desta saída que já voltou ao estoque (remoção de peça / OS cancelada).
    /// Reposição usa Quantidade − QuantidadeEstornada.
    /// Documentos antigos sem o campo são tratados como 0 (não quebra nem altera o histórico).
    /// </summary>
    [BsonElement("quantidadeEstornada")]
    [BsonDefaultValue(0)]
    public int QuantidadeEstornada { get; set; }

    [BsonElement("custoUnitario")]
    public decimal? CustoUnitario { get; set; }

    [BsonElement("osBlingId")]
    public long? OsBlingId { get; set; }

    [BsonElement("osNumero")]
    public string? OsNumero { get; set; }

    [BsonElement("observacao")]
    public string? Observacao { get; set; }

    [BsonElement("data")]
    public DateTime Data { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class ItemPedidoCompraRequest
{
    public string PecaId { get; set; } = string.Empty;
    public string? Fornecedor { get; set; }
    public string? MarcaPeca { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    /// <summary>Obrigatório para Tampa traseira — estoque por cor e modelo.</summary>
    public string? Cor { get; set; }
    public int Quantidade { get; set; }
    public decimal CustoUnitario { get; set; }
    public int GarantiaMeses { get; set; } = 12;
}

public class RegistrarPedidoCompraRequest
{
    public string NumeroPedido { get; set; } = string.Empty;
    public string Fornecedor { get; set; } = string.Empty;
    public string? NumeroNf { get; set; }
    public DateTime? DataPedido { get; set; }
    public string? Observacoes { get; set; }
    public List<ItemPedidoCompraRequest> Itens { get; set; } = [];
}

public class RegistrarSaidaEstoqueRequest
{
    public string PecaId { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    /// <summary>Cor da peça (Tampa traseira) — prioriza lotes dessa cor e baixa o saldo por cor.</summary>
    public string? Cor { get; set; }
    public int Quantidade { get; set; } = 1;
    public long? OsBlingId { get; set; }
    public string? OsNumero { get; set; }
    public string? Observacao { get; set; }
}

/// <summary>Altera metadados e/ou quantidade de um lote já lançado (pedido de compra).</summary>
public class AtualizarLoteEstoqueRequest
{
    public string? Fornecedor { get; set; }
    public string? MarcaPeca { get; set; }
    public decimal? CustoUnitario { get; set; }
    public int? GarantiaMeses { get; set; }
    /// <summary>
    /// Nova quantidade inicial do lote.
    /// Deve ser ≥ unidades já saídas (inicial − restante).
    /// </summary>
    public int? QuantidadeInicial { get; set; }
}

public class RegistrarEstornoOsRequest
{
    public string PecaId { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public long? OsBlingId { get; set; }
    public string? OsNumero { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    public string? Cor { get; set; }
}

public class ListarMovimentacoesFiltros
{
    public string? Tipo { get; set; }
    public DateTime? Inicio { get; set; }
    public DateTime? Fim { get; set; }
    /// <summary>Busca em peça, OS, observação, modelo.</summary>
    public string? Busca { get; set; }
    /// <summary>os | manual — origem da saída.</summary>
    public string? Origem { get; set; }
    /// <summary>ativas | estornadas | parciais</summary>
    public string? StatusEstorno { get; set; }
    public int Pagina { get; set; } = 1;
    public int TamanhoPagina { get; set; } = 20;
}

public class MovimentacoesPaginadasResponse
{
    public List<MovimentacaoEstoque> Itens { get; set; } = [];
    public long Total { get; set; }
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
}

public class PedidoCompraDetalheResponse
{
    public PedidoCompraEstoque Pedido { get; set; } = new();
    public List<LoteEstoque> Lotes { get; set; } = [];
}

public class ReposicaoSemanalItem
{
    public string PecaId { get; set; } = string.Empty;
    public string PecaNome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    /// <summary>Cor utilizada na saída (tampa/vidro) — base para reposição.</summary>
    public string? Cor { get; set; }
    public int QuantidadeSaida { get; set; }
    public int EstoqueAtual { get; set; }
    public int SugestaoReposicao { get; set; }
}

public class ReposicaoResumoModelo
{
    public string? ModeloId { get; set; }
    public string ModeloNome { get; set; } = string.Empty;
    public int QuantidadeSaida { get; set; }
    public int ItensComReposicao { get; set; }
    public int SugestaoTotal { get; set; }
}

public class CustoPecaReferenciaResponse
{
    public string PecaId { get; set; } = string.Empty;
    public decimal CustoUnitario { get; set; }
    public string? Fornecedor { get; set; }
    public string? MarcaPeca { get; set; }
    /// <summary>fifo | media</summary>
    public string Fonte { get; set; } = "fifo";
}

public class ReposicaoSemanalResponse
{
    public DateTime Inicio { get; set; }
    public DateTime Fim { get; set; }
    /// <summary>2dias | semanal | mensal | personalizado</summary>
    public string Periodo { get; set; } = "semanal";
    public string? ModeloIdFiltro { get; set; }
    public string? ModeloNomeFiltro { get; set; }
    public List<ReposicaoSemanalItem> Itens { get; set; } = [];
    public List<ReposicaoResumoModelo> ResumoPorModelo { get; set; } = [];
    public int TotalSaidas { get; set; }
}

/// <summary>
/// Relatório de peças utilizadas gerado para pedido de reposição —
/// snapshot consultável para evitar pedido duplicado.
/// </summary>
public class RelatorioReposicaoHistorico
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [BsonElement("periodo")]
    public string Periodo { get; set; } = "personalizado";

    [BsonElement("periodoLabel")]
    public string PeriodoLabel { get; set; } = string.Empty;

    [BsonElement("inicio")]
    public DateTime Inicio { get; set; }

    [BsonElement("fim")]
    public DateTime Fim { get; set; }

    [BsonElement("modeloIdFiltro")]
    public string? ModeloIdFiltro { get; set; }

    [BsonElement("modeloNomeFiltro")]
    public string? ModeloNomeFiltro { get; set; }

    [BsonElement("totalSaidas")]
    public int TotalSaidas { get; set; }

    [BsonElement("totalItens")]
    public int TotalItens { get; set; }

    [BsonElement("itens")]
    public List<ReposicaoSemanalItem> Itens { get; set; } = [];

    [BsonElement("html")]
    public string Html { get; set; } = string.Empty;

    [BsonElement("geradoEm")]
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("geradoPor")]
    public string? GeradoPor { get; set; }

    /// <summary>nao_concluido | parcial | concluido — padrão: nao_concluido.</summary>
    [BsonElement("statusConclusao")]
    public string StatusConclusao { get; set; } = "nao_concluido";
}

public class AtualizarStatusRelatorioReposicaoRequest
{
    public string StatusConclusao { get; set; } = "nao_concluido";
}

public class SalvarRelatorioReposicaoRequest
{
    public string? Titulo { get; set; }
    public string Periodo { get; set; } = "personalizado";
    public string PeriodoLabel { get; set; } = string.Empty;
    public DateTime Inicio { get; set; }
    public DateTime Fim { get; set; }
    public string? ModeloIdFiltro { get; set; }
    public string? ModeloNomeFiltro { get; set; }
    public int TotalSaidas { get; set; }
    public List<ReposicaoSemanalItem> Itens { get; set; } = [];
    public string Html { get; set; } = string.Empty;
    public string? GeradoPor { get; set; }
}

public class RegistrarDevolucaoGarantiaRequest
{
    public string LoteId { get; set; } = string.Empty;
    public int Quantidade { get; set; } = 1;
    public string? Motivo { get; set; }
    public string? Observacao { get; set; }
    /// <summary>Quando preenchido, permite devolver até a qtd usada na OS sem baixar saldo de novo.</summary>
    public string? OsNumero { get; set; }
    public long? OsBlingId { get; set; }
    public bool OrigemOs { get; set; }
}

/// <summary>Lote elegível a retorno de garantia, com contexto opcional da OS.</summary>
public class LoteGarantiaItem
{
    public string? Id { get; set; }
    public string PedidoCompraId { get; set; } = string.Empty;
    public string NumeroPedido { get; set; } = string.Empty;
    public string Fornecedor { get; set; } = string.Empty;
    public string PecaId { get; set; } = string.Empty;
    public string PecaNome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    public string? Cor { get; set; }
    public int QuantidadeInicial { get; set; }
    public int QuantidadeRestante { get; set; }
    public decimal CustoUnitario { get; set; }
    public int GarantiaMeses { get; set; }
    public DateTime DataEntrada { get; set; }
    public DateTime DataVencimentoGarantia { get; set; }
    public int DiasGarantiaRestantes { get; set; }
    public string? OsNumero { get; set; }
    public long? OsBlingId { get; set; }
    public int QuantidadeUsadaOs { get; set; }
    /// <summary>Máximo que ainda pode ser retornado neste contexto (saldo ou restante da OS).</summary>
    public int QuantidadeDisponivelRetorno { get; set; }
}

public class DevolucaoGarantiaDocumento
{
    public string Id { get; set; } = string.Empty;
    public DateTime GeradoEm { get; set; }
    public string Fornecedor { get; set; } = string.Empty;
    public string NumeroPedido { get; set; } = string.Empty;
    public string PecaNome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public string? ModeloNome { get; set; }
    public string? Cor { get; set; }
    public int Quantidade { get; set; }
    public decimal CustoUnitario { get; set; }
    public DateTime DataEntrada { get; set; }
    public DateTime DataVencimentoGarantia { get; set; }
    public string? Motivo { get; set; }
    public string? Observacao { get; set; }
    public string MovimentacaoId { get; set; } = string.Empty;
    public string? OsNumero { get; set; }
    public long? OsBlingId { get; set; }
}

/// <summary>Item de autocomplete (OS / lote) para retorno de garantia.</summary>
public class EstoqueSugestaoItem
{
    public string Id { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Extra { get; set; }
}

/// <summary>
/// Peça na caixa de retorno ao fornecedor (problema/defeito), aguardando geração do lote de envio.
/// </summary>
public class CaixaRetornoGarantiaItem
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>pendente | enviado</summary>
    [BsonElement("status")]
    public string Status { get; set; } = "pendente";

    [BsonElement("loteId")]
    public string LoteId { get; set; } = string.Empty;

    [BsonElement("pedidoCompraId")]
    public string PedidoCompraId { get; set; } = string.Empty;

    [BsonElement("numeroPedido")]
    public string NumeroPedido { get; set; } = string.Empty;

    [BsonElement("fornecedor")]
    public string Fornecedor { get; set; } = string.Empty;

    [BsonElement("pecaId")]
    public string PecaId { get; set; } = string.Empty;

    [BsonElement("pecaNome")]
    public string PecaNome { get; set; } = string.Empty;

    [BsonElement("marcaPeca")]
    public string? MarcaPeca { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("cor")]
    public string? Cor { get; set; }

    [BsonElement("quantidade")]
    public int Quantidade { get; set; }

    [BsonElement("custoUnitario")]
    public decimal CustoUnitario { get; set; }

    [BsonElement("dataEntrada")]
    public DateTime DataEntrada { get; set; }

    [BsonElement("dataVencimentoGarantia")]
    public DateTime DataVencimentoGarantia { get; set; }

    [BsonElement("osNumero")]
    public string? OsNumero { get; set; }

    [BsonElement("osBlingId")]
    public long? OsBlingId { get; set; }

    [BsonElement("origemOs")]
    public bool OrigemOs { get; set; }

    [BsonElement("motivo")]
    public string? Motivo { get; set; }

    [BsonElement("observacao")]
    public string? Observacao { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("enviadoEm")]
    public DateTime? EnviadoEm { get; set; }

    [BsonElement("loteEnvioId")]
    public string? LoteEnvioId { get; set; }

    /// <summary>True se o saldo do lote já foi reduzido ao colocar na caixa (peça ainda em estoque).</summary>
    [BsonElement("baixouSaldo")]
    public bool BaixouSaldo { get; set; }
}

public class CaixaRetornoFornecedorGrupo
{
    public string Fornecedor { get; set; } = string.Empty;
    public int TotalItens { get; set; }
    public int TotalUnidades { get; set; }
    /// <summary>Menor data de vencimento de garantia entre as peças da caixa.</summary>
    public DateTime DataVencimentoMaisProxima { get; set; }
    /// <summary>Prazo máximo para enviar o lote: vencimento mais próximo menos 7 dias.</summary>
    public DateTime DataPrazoMaximoEnvio { get; set; }
    public int DiasRestantesPrazo { get; set; }
    public bool PrazoVencido { get; set; }
    public List<CaixaRetornoGarantiaItem> Itens { get; set; } = [];
}

public class CaixaRetornoGarantiaResponse
{
    /// <summary>Dias de antecedência usados no cálculo do prazo (fixante: 7).</summary>
    public int DiasAntecedenciaPrazo { get; set; } = 7;
    public List<CaixaRetornoFornecedorGrupo> Fornecedores { get; set; } = [];
}

public class GerarLoteDevolucaoGarantiaRequest
{
    public string Fornecedor { get; set; } = string.Empty;
    public string? Motivo { get; set; }
}

public class LoteDevolucaoGarantiaDocumento
{
    public string Id { get; set; } = string.Empty;
    public DateTime GeradoEm { get; set; }
    public string Fornecedor { get; set; } = string.Empty;
    public string? Motivo { get; set; }
    public int TotalUnidades { get; set; }
    public DateTime DataVencimentoMaisProxima { get; set; }
    public DateTime DataPrazoMaximoEnvio { get; set; }
    public List<DevolucaoGarantiaDocumento> Itens { get; set; } = [];
}

/// <summary>
/// Histórico de lote de retorno já baixado/enviado — consulta em tela própria (não na caixa).
/// </summary>
public class LoteRetornoGarantiaHistorico
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("fornecedor")]
    public string Fornecedor { get; set; } = string.Empty;

    [BsonElement("motivo")]
    public string? Motivo { get; set; }

    [BsonElement("totalUnidades")]
    public int TotalUnidades { get; set; }

    [BsonElement("totalItens")]
    public int TotalItens { get; set; }

    [BsonElement("dataVencimentoMaisProxima")]
    public DateTime DataVencimentoMaisProxima { get; set; }

    [BsonElement("dataPrazoMaximoEnvio")]
    public DateTime DataPrazoMaximoEnvio { get; set; }

    [BsonElement("geradoEm")]
    public DateTime GeradoEm { get; set; }

    [BsonElement("itens")]
    public List<DevolucaoGarantiaDocumento> Itens { get; set; } = [];
}

/// <summary>Resposta ao adicionar peça na caixa (antes do envio ao fornecedor).</summary>
public class CaixaRetornoAdicaoResponse
{
    public CaixaRetornoGarantiaItem Item { get; set; } = new();
    public DateTime DataPrazoMaximoEnvioFornecedor { get; set; }
    public int DiasRestantesPrazo { get; set; }
}

/// <summary>Ranking de retornos baixados: fornecedor e peça.</summary>
public class AnaliseRetornoGarantiaResponse
{
    public DateTime? De { get; set; }
    public DateTime? Ate { get; set; }
    public int TotalLotes { get; set; }
    public int TotalUnidades { get; set; }
    public List<AnaliseRetornoFornecedorItem> Fornecedores { get; set; } = [];
    public List<AnaliseRetornoPecaItem> Pecas { get; set; } = [];
}

public class AnaliseRetornoFornecedorItem
{
    public string Fornecedor { get; set; } = string.Empty;
    public int TotalLotes { get; set; }
    public int TotalUnidades { get; set; }
    public int TotalItensLinha { get; set; }
    public List<AnaliseRetornoPecaItem> Pecas { get; set; } = [];
}

public class AnaliseRetornoPecaItem
{
    public string PecaNome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public int Quantidade { get; set; }
    public int Ocorrencias { get; set; }
    public string? FornecedorMaisFrequente { get; set; }
}

/// <summary>Investimento e giro de estoque em R$ (custo de compra).</summary>
public class RelatorioFinanceiroEstoqueResponse
{
    public DateTime GeradoEm { get; set; }
    public int MesesAnalisados { get; set; }

    /// <summary>Σ (quantidadeRestante × custoUnitario) nos lotes com saldo.</summary>
    public decimal ValorEstoqueAtual { get; set; }
    public int UnidadesEmEstoque { get; set; }
    public int LotesComSaldo { get; set; }

    /// <summary>Σ valorTotal dos pedidos de compra no período.</summary>
    public decimal TotalInvestidoPeriodo { get; set; }
    /// <summary>Média mensal de investimento no período (inclui meses sem compra).</summary>
    public decimal MediaInvestimentoMensal { get; set; }
    public decimal InvestimentoMesAtual { get; set; }

    /// <summary>Σ (qtd × custo) das saídas locais no período.</summary>
    public decimal TotalSaidasCustoPeriodo { get; set; }
    public decimal MediaSaidasCustoMensal { get; set; }
    public decimal SaidasCustoMesAtual { get; set; }

    public List<FinanceiroEstoqueMesItem> PorMes { get; set; } = [];
    public List<FinanceiroEstoquePecaItem> TopPecasEmEstoque { get; set; } = [];
}

public class FinanceiroEstoqueMesItem
{
    /// <summary>yyyy-MM</summary>
    public string AnoMes { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public decimal Investimento { get; set; }
    public int PedidosCompra { get; set; }
    public int UnidadesCompradas { get; set; }
    public decimal SaidasCusto { get; set; }
    public int UnidadesSaida { get; set; }
}

public class FinanceiroEstoquePecaItem
{
    public string PecaId { get; set; } = string.Empty;
    public string PecaNome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public int Unidades { get; set; }
    public decimal Valor { get; set; }
}
