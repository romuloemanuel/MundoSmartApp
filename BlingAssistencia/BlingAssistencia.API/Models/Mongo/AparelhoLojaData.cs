using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class AparelhoLojaStatus
{
    public const string EmEstoque = "em_estoque";
    public const string EmAssistencia = "em_assistencia";
    public const string Vendido = "vendido";
    public const string Estornado = "estornado";
}

public static class AparelhoOperacaoTipo
{
    public const string Compra = "compra";
    public const string Venda = "venda";
    public const string Troca = "troca";
}

public static class AparelhoOperacaoStatus
{
    public const string Ativa = "ativa";
    public const string Estornada = "estornada";
}

public static class AparelhoCondicao
{
    public const string Novo = "novo";
    public const string Usado = "usado";
}

/// <summary>Unidade física de celular da loja. Não passa pelo Bling.</summary>
public class AparelhoLojaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("imei")]
    public string Imei { get; set; } = string.Empty;

    /// <summary>Etiqueta colada no aparelho. N de novo ou U de usado, mais um número que não volta. Ex.: N14.</summary>
    [BsonElement("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [BsonElement("marca")]
    public string Marca { get; set; } = string.Empty;

    [BsonElement("modelo")]
    public string Modelo { get; set; } = string.Empty;

    [BsonElement("marcaId")]
    public string? MarcaId { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("cor")]
    public string Cor { get; set; } = string.Empty;

    [BsonElement("configuracao")]
    public string Configuracao { get; set; } = string.Empty;

    /// <summary>novo | usado</summary>
    [BsonElement("condicao")]
    public string Condicao { get; set; } = AparelhoCondicao.Usado;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custo")]
    public decimal Custo { get; set; }

    /// <summary>Preço de tabela informado no cadastro. A venda começa neste valor.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorVenda")]
    public decimal ValorVenda { get; set; }

    /// <summary>Piso da venda. O preço menos o desconto não fica abaixo disto.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorMinimoVenda")]
    public decimal ValorMinimoVenda { get; set; }

    /// <summary>Preço cobrado na saída. Não altera o custo.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("precoVenda")]
    public decimal PrecoVenda { get; set; }

    /// <summary>em_estoque | em_assistencia | vendido | estornado</summary>
    [BsonElement("status")]
    public string Status { get; set; } = AparelhoLojaStatus.EmEstoque;

    /// <summary>compra | troca — como entrou no estoque.</summary>
    [BsonElement("origem")]
    public string Origem { get; set; } = AparelhoOperacaoTipo.Compra;

    [BsonElement("operacaoEntradaId")]
    public string? OperacaoEntradaId { get; set; }

    [BsonElement("operacaoSaidaId")]
    public string? OperacaoSaidaId { get; set; }

    [BsonElement("clienteOrigemId")]
    public long? ClienteOrigemId { get; set; }

    [BsonElement("clienteOrigemNome")]
    public string ClienteOrigemNome { get; set; } = string.Empty;

    [BsonElement("clienteOrigemCpf")]
    public string ClienteOrigemCpf { get; set; } = string.Empty;

    [BsonElement("clienteVendaId")]
    public long? ClienteVendaId { get; set; }

    [BsonElement("clienteVendaNome")]
    public string ClienteVendaNome { get; set; } = string.Empty;

    [BsonElement("clienteVendaCpf")]
    public string ClienteVendaCpf { get; set; } = string.Empty;

    /// <summary>Quem está com o aparelho comprado na loja tem desconto na assistência.</summary>
    [BsonElement("descontoVigente")]
    public bool DescontoVigente { get; set; }

    /// <summary>Produto do Bling que originou esta unidade. A reimportação não duplica.</summary>
    [BsonElement("blingProdutoId")]
    public long? BlingProdutoId { get; set; }

    [BsonElement("dataEntrada")]
    public DateTime DataEntrada { get; set; }

    [BsonElement("dataSaida")]
    public DateTime? DataSaida { get; set; }

    [BsonElement("observacoes")]
    public string Observacoes { get; set; } = string.Empty;

    /// <summary>Problema permanente, que pode não ter conserto.</summary>
    [BsonElement("alertaPermanente")]
    public string AlertaPermanente { get; set; } = string.Empty;

    /// <summary>OS já aberta quando o aparelho entrou. Os testes dessa OS valem.</summary>
    [BsonElement("osEntradaId")]
    public long? OsEntradaId { get; set; }

    [BsonElement("osEntradaNumero")]
    public string OsEntradaNumero { get; set; } = string.Empty;

    /// <summary>Defeito da OS enquanto o aparelho está na assistência. Aparece no I da grade.</summary>
    [BsonElement("justificativaAssistencia")]
    public string JustificativaAssistencia { get; set; } = string.Empty;

    /// <summary>Legado. O deságio novo já está no valor pago pela loja e não é gravado à parte.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("desagio")]
    public decimal Desagio { get; set; }

    [BsonElement("testesNaOs")]
    public bool TestesNaOs { get; set; }

    [BsonElement("saudeBateria")]
    public int? SaudeBateria { get; set; }

    /// <summary>Só iPhone. Null quando a pergunta não se aplica.</summary>
    [BsonElement("bateriaPerfeita")]
    public bool? BateriaPerfeita { get; set; }

    [BsonElement("pecaTrocada")]
    public string PecaTrocada { get; set; } = string.Empty;

    [BsonElement("mensagemPecaTrocada")]
    public bool MensagemPecaTrocada { get; set; }

    [BsonElement("pecasTrocadas")]
    public List<PecaTrocadaData> PecasTrocadas { get; set; } = [];

    [BsonElement("vendedorEntradaId")]
    public string? VendedorEntradaId { get; set; }

    [BsonElement("vendedorEntradaNome")]
    public string VendedorEntradaNome { get; set; } = string.Empty;

    [BsonElement("vendedorSaidaId")]
    public string? VendedorSaidaId { get; set; }

    [BsonElement("vendedorSaidaNome")]
    public string VendedorSaidaNome { get; set; } = string.Empty;

    [BsonElement("testes")]
    public List<AparelhoTesteData> Testes { get; set; } = [];

    [BsonElement("fotos")]
    public List<AparelhoFotoData> Fotos { get; set; } = [];

    [BsonElement("custosOs")]
    public List<AparelhoOsCustoData> CustosOs { get; set; } = [];

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoPecas")]
    public decimal CustoPecas { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoMaoDeObra")]
    public decimal CustoMaoDeObra { get; set; }
}

public class AparelhoMovimentoData
{
    [BsonElement("aparelhoId")]
    public string? AparelhoId { get; set; }

    [BsonElement("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [BsonElement("imei")]
    public string Imei { get; set; } = string.Empty;

    [BsonElement("marca")]
    public string Marca { get; set; } = string.Empty;

    [BsonElement("modelo")]
    public string Modelo { get; set; } = string.Empty;

    [BsonElement("cor")]
    public string Cor { get; set; } = string.Empty;

    [BsonElement("configuracao")]
    public string Configuracao { get; set; } = string.Empty;

    [BsonElement("condicao")]
    public string Condicao { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custo")]
    public decimal Custo { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("preco")]
    public decimal Preco { get; set; }
}

/// <summary>
/// Compra, venda ou troca. O dinheiro registrado é o caixa real:
/// na troca entra só a diferença, não o preço cheio do aparelho que saiu.
/// </summary>
public class AparelhoOperacaoData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("tipo")]
    public string Tipo { get; set; } = string.Empty;

    [BsonElement("status")]
    public string Status { get; set; } = AparelhoOperacaoStatus.Ativa;

    [BsonElement("data")]
    public DateTime Data { get; set; }

    [BsonElement("clienteId")]
    public long? ClienteId { get; set; }

    [BsonElement("clienteNome")]
    public string ClienteNome { get; set; } = string.Empty;

    [BsonElement("clienteCpf")]
    public string ClienteCpf { get; set; } = string.Empty;

    [BsonElement("fornecedorNome")]
    public string FornecedorNome { get; set; } = string.Empty;

    [BsonElement("entrada")]
    public AparelhoMovimentoData? Entrada { get; set; }

    /// <summary>Todos os aparelhos que o cliente entregou nesta troca. Entrada continua sendo o primeiro.</summary>
    [BsonElement("entradas")]
    public List<AparelhoMovimentoData> Entradas { get; set; } = [];

    [BsonElement("saida")]
    public AparelhoMovimentoData? Saida { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorAvaliado")]
    public decimal ValorAvaliado { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("precoSaida")]
    public decimal PrecoSaida { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("dinheiroRecebido")]
    public decimal DinheiroRecebido { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("dinheiroPago")]
    public decimal DinheiroPago { get; set; }

    [BsonElement("formaNegociacao")]
    public string FormaNegociacao { get; set; } = "avista";

    [BsonElement("financiadoraNome")]
    public string FinanciadoraNome { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("entradaLoja")]
    public decimal EntradaLoja { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("repasseFinanciadora")]
    public decimal RepasseFinanciadora { get; set; }

    [BsonElement("observacoes")]
    public string Observacoes { get; set; } = string.Empty;

    [BsonElement("vendedorId")]
    public string? VendedorId { get; set; }

    [BsonElement("vendedorNome")]
    public string VendedorNome { get; set; } = string.Empty;

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; }
}

public class PecaTrocadaData
{
    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("apareceMensagem")]
    public bool ApareceMensagem { get; set; }
}

public class AparelhoTesteData
{
    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("ok")]
    public bool Ok { get; set; }

    [BsonElement("observacao")]
    public string Observacao { get; set; } = string.Empty;
}

public class AparelhoFotoData
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("nomeArquivo")]
    public string NomeArquivo { get; set; } = string.Empty;

    [BsonElement("url")]
    public string Url { get; set; } = string.Empty;

    /// <summary>foto ou video. Vídeo guarda o áudio da gravação.</summary>
    [BsonElement("tipo")]
    public string Tipo { get; set; } = "foto";

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; }
}

public class AparelhoFotoSessaoData
{
    [BsonId]
    [BsonElement("token")]
    public string Token { get; set; } = string.Empty;

    [BsonElement("expiraEm")]
    public DateTime ExpiraEm { get; set; }

    [BsonElement("aparelhoId")]
    public string? AparelhoId { get; set; }

    [BsonElement("fotos")]
    public List<AparelhoFotoData> Fotos { get; set; } = [];
}

public class AparelhoOsCustoData
{
    [BsonElement("osId")]
    public long OsId { get; set; }

    [BsonElement("numero")]
    public string Numero { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("pecas")]
    public decimal Pecas { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("maoDeObra")]
    public decimal MaoDeObra { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; }
}

/// <summary>Preço atual do fornecedor. O estoque em loja é reescrito com este valor.</summary>
public class AparelhoListaPrecoData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("modeloId")]
    public string ModeloId { get; set; } = string.Empty;

    [BsonElement("marca")]
    public string Marca { get; set; } = string.Empty;

    [BsonElement("modelo")]
    public string Modelo { get; set; } = string.Empty;

    [BsonElement("condicao")]
    public string Condicao { get; set; } = AparelhoCondicao.Novo;

    [BsonElement("configuracao")]
    public string Configuracao { get; set; } = string.Empty;

    [BsonElement("configuracaoChave")]
    public string ConfiguracaoChave { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("preco")]
    public decimal Preco { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; }
}
