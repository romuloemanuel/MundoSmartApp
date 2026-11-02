namespace MundoSmart.BlingAssistencia.API.Models;

public class AparelhoEntradaRequest
{
    public string Imei { get; set; } = string.Empty;
    public string? MarcaId { get; set; }
    public string? Marca { get; set; }
    public string? ModeloId { get; set; }
    public string? Modelo { get; set; }
    public string? Cor { get; set; }
    public string? Configuracao { get; set; }
    public string Condicao { get; set; } = "usado";
    public decimal ValorVenda { get; set; }
    public decimal ValorMinimoVenda { get; set; }
    public string? Observacoes { get; set; }
    public int? SaudeBateria { get; set; }
    public bool? BateriaPerfeita { get; set; }
    public string? PecaTrocada { get; set; }
    public bool MensagemPecaTrocada { get; set; }
    public List<AparelhoTesteDto>? Testes { get; set; }
    public bool PassaPorAssistencia { get; set; }
    public string? OsNumero { get; set; }
    public decimal Desagio { get; set; }
}

public class AparelhoTesteDto
{
    public string Nome { get; set; } = string.Empty;
    public bool Ok { get; set; }
    public string? Observacao { get; set; }
}

public class OsAbertaConsultaDto
{
    public bool Encontrada { get; set; }
    public bool Aberta { get; set; }
    public string Numero { get; set; } = string.Empty;
    public string Situacao { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public string Aparelho { get; set; } = string.Empty;
    public string Imei { get; set; } = string.Empty;
    public string Defeito { get; set; } = string.Empty;
}

public class AparelhoFotoDto
{
    public string Id { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Tipo { get; set; } = "foto";
}

public class AparelhoOsCustoDto
{
    public long OsId { get; set; }
    public string Numero { get; set; } = string.Empty;
    public decimal Pecas { get; set; }
    public decimal MaoDeObra { get; set; }
}

public class VendedorRef
{
    public string? Id { get; set; }
    public string? Nome { get; set; }
}

public class AparelhoCompraRequest
{
    public AparelhoEntradaRequest? Aparelho { get; set; }
    public decimal ValorPago { get; set; }
    public long? ClienteId { get; set; }
    public string? FornecedorNome { get; set; }
    public string? Observacoes { get; set; }
    public string? SessaoToken { get; set; }
    public VendedorRef? Vendedor { get; set; }
}

public class AparelhoVendaRequest
{
    public string AparelhoId { get; set; } = string.Empty;
    public long ClienteId { get; set; }
    public decimal Preco { get; set; }
    public decimal PrecoTabela { get; set; }
    public decimal Desconto { get; set; }
    public decimal Acrescimo { get; set; }
    public string? Forma { get; set; }
    public string? FinanciadoraNome { get; set; }
    public decimal EntradaLoja { get; set; }
    public decimal Repasse { get; set; }
    public string? Observacoes { get; set; }
    public VendedorRef? Vendedor { get; set; }
}

public class AparelhoTrocaEntradaRequest
{
    public AparelhoEntradaRequest? Aparelho { get; set; }
    public decimal ValorAvaliado { get; set; }
    public string? SessaoToken { get; set; }
}

public class AparelhoTrocaRequest
{
    public string AparelhoSaidaId { get; set; } = string.Empty;
    public decimal PrecoSaida { get; set; }
    public decimal PrecoTabela { get; set; }
    public decimal Desconto { get; set; }
    public decimal Acrescimo { get; set; }
    public AparelhoEntradaRequest? Entrada { get; set; }
    public List<AparelhoTrocaEntradaRequest>? Entradas { get; set; }
    public decimal ValorAvaliado { get; set; }
    public string? Forma { get; set; }
    public string? FinanciadoraNome { get; set; }
    public decimal EntradaLoja { get; set; }
    public decimal Repasse { get; set; }
    public long ClienteId { get; set; }
    public string? Observacoes { get; set; }
    public string? SessaoToken { get; set; }
    public VendedorRef? Vendedor { get; set; }
}

public class AparelhoFotoSessaoTokenDto
{
    public string Token { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime ExpiraEm { get; set; }
}

public class AparelhoFotoSessaoDto
{
    public DateTime ExpiraEm { get; set; }
    public List<AparelhoFotoDto> Fotos { get; set; } = [];
}

public class AparelhoLojaDto
{
    public string? Id { get; set; }
    public string Imei { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string? MarcaId { get; set; }
    public string? ModeloId { get; set; }
    public string Cor { get; set; } = string.Empty;
    public string Configuracao { get; set; } = string.Empty;
    public string Condicao { get; set; } = string.Empty;
    public decimal ValorVenda { get; set; }
    public decimal ValorMinimoVenda { get; set; }
    public string FormaNegociacao { get; set; } = string.Empty;
    public string FinanciadoraNome { get; set; } = string.Empty;
    public decimal Custo { get; set; }
    /// <summary>True quando o valor do estoque veio da lista do fornecedor.</summary>
    public bool ValorDaLista { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Origem { get; set; } = string.Empty;
    public string ClienteOrigemNome { get; set; } = string.Empty;
    public string ClienteVendaNome { get; set; } = string.Empty;
    public bool DescontoVigente { get; set; }
    public DateTime DataEntrada { get; set; }
    public DateTime? DataSaida { get; set; }
    public int? SaudeBateria { get; set; }
    public bool? BateriaPerfeita { get; set; }
    public string PecaTrocada { get; set; } = string.Empty;
    public bool MensagemPecaTrocada { get; set; }
    public string VendedorEntradaNome { get; set; } = string.Empty;
    public string VendedorSaidaNome { get; set; } = string.Empty;
    public string Observacoes { get; set; } = string.Empty;
    public long? OsEntradaId { get; set; }
    public string OsEntradaNumero { get; set; } = string.Empty;
    public decimal Desagio { get; set; }
    public bool TestesNaOs { get; set; }
    public List<AparelhoTesteDto> Testes { get; set; } = [];
    public List<AparelhoFotoDto> Fotos { get; set; } = [];
    public List<AparelhoOsCustoDto> CustosOs { get; set; } = [];
    public decimal CustoPecas { get; set; }
    public decimal CustoMaoDeObra { get; set; }
}

public class AparelhoOperacaoDto
{
    public string? Id { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime Data { get; set; }
    public string ClienteNome { get; set; } = string.Empty;
    public string ClienteCpf { get; set; } = string.Empty;
    public string FornecedorNome { get; set; } = string.Empty;
    public string EntradaResumo { get; set; } = string.Empty;
    public string SaidaResumo { get; set; } = string.Empty;
    public decimal ValorAvaliado { get; set; }
    public decimal PrecoSaida { get; set; }
    public decimal DinheiroRecebido { get; set; }
    public decimal DinheiroPago { get; set; }
    public string FormaNegociacao { get; set; } = "avista";
    public string FinanciadoraNome { get; set; } = string.Empty;
    public decimal EntradaLoja { get; set; }
    public decimal RepasseFinanciadora { get; set; }
    public string Observacoes { get; set; } = string.Empty;
    public string VendedorNome { get; set; } = string.Empty;
    public bool PodeEstornar { get; set; }
}

public class AparelhoLojaResumoDto
{
    public int EmEstoque { get; set; }
    public int EmAssistencia { get; set; }
    public decimal CustoEstoque { get; set; }
    public decimal DinheiroRecebido { get; set; }
    public decimal DinheiroPago { get; set; }
    public decimal SaldoCaixa { get; set; }
    public int Compras { get; set; }
    public int Vendas { get; set; }
    public int Trocas { get; set; }
    public decimal CustoPecas { get; set; }
    public decimal CustoMaoDeObra { get; set; }
    public List<AparelhoVendedorResumoDto> PorVendedor { get; set; } = [];
}

public class AparelhoVendedorResumoDto
{
    public string Nome { get; set; } = string.Empty;
    public int Entradas { get; set; }
    public int Vendas { get; set; }
    public int Trocas { get; set; }
    public decimal DinheiroRecebido { get; set; }
    public decimal DinheiroPago { get; set; }
    public decimal CustoPecas { get; set; }
    public decimal CustoMaoDeObra { get; set; }
}

public class AparelhoListaPrecoRequest
{
    public string? ModeloId { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string Condicao { get; set; } = "novo";
    public string? Configuracao { get; set; }
    public decimal Preco { get; set; }
}

public class AparelhoListaPrecoDto
{
    public string? Id { get; set; }
    public string ModeloId { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Condicao { get; set; } = string.Empty;
    public string Configuracao { get; set; } = string.Empty;
    public decimal Preco { get; set; }
    public DateTime AtualizadoEm { get; set; }
}

public class AparelhoLojaPainelDto
{
    public AparelhoLojaResumoDto Resumo { get; set; } = new();
    public List<AparelhoLojaDto> Estoque { get; set; } = [];
    public List<AparelhoLojaDto> CustosAssistencia { get; set; } = [];
    public List<AparelhoOperacaoDto> Operacoes { get; set; } = [];
    public List<AparelhoListaPrecoDto> Lista { get; set; } = [];
    public decimal DescontoVendaMaxPercentual { get; set; }
    public decimal AcrescimoFinanciadoraMaxPercentual { get; set; }
}

public class AparelhoImeiRequest
{
    public string? Imei { get; set; }
}

public class BlingEstoqueCelularImportResult
{
    public bool Ok { get; set; }
    public int ProdutosLidos { get; set; }
    public int Importados { get; set; }
    public int JaNoEstoque { get; set; }
    public int SemImei { get; set; }
    public int SemSaldo { get; set; }
    public int SemCusto { get; set; }
    public string? Aviso { get; set; }
}
