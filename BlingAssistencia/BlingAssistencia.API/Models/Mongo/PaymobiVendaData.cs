using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class PaymobiStatus
{
    public const string Aberta = "aberta";
    public const string Atrasada = "atrasada";
    public const string Quitada = "quitada";
    public const string Cancelada = "cancelada";

    public static readonly string[] Todos = [Aberta, Atrasada, Quitada, Cancelada];

    public static string Normalizar(string? status)
    {
        var s = (status ?? "").Trim().ToLowerInvariant();
        return Todos.Contains(s) ? s : Aberta;
    }
}

public static class PaymobiStatusCobranca
{
    public const string Ok = "ok";
    public const string Negociacao = "negociacao";
    public const string Recuperacao = "recuperacao";
    public const string Perdido = "perdido";

    public static readonly string[] Todos = [Ok, Negociacao, Recuperacao, Perdido];

    public static bool Manual(string? status)
    {
        var s = NormalizarOuVazio(status);
        return s is Negociacao or Recuperacao;
    }

    public static string NormalizarOuVazio(string? status)
    {
        var s = (status ?? "").Trim().ToLowerInvariant();
        return Todos.Contains(s) ? s : "";
    }

    public static string Normalizar(string? status, int parcelasAtraso, string statusContrato)
    {
        var atual = NormalizarOuVazio(status);
        if (atual.Length > 0) return atual;
        return Padrao(parcelasAtraso, statusContrato);
    }

    public static string Padrao(int parcelasAtraso, string? statusContrato)
    {
        var contrato = PaymobiStatus.Normalizar(statusContrato);
        if (contrato is PaymobiStatus.Quitada or PaymobiStatus.Cancelada) return Ok;
        return parcelasAtraso > 0 || contrato == PaymobiStatus.Atrasada ? Perdido : Ok;
    }

    public static string AposPagamentoOuRenegociacao(
        string? atual,
        int atrasoAntes,
        decimal pagosAntes,
        int atrasoDepois,
        decimal pagosDepois,
        bool renegociou,
        string? statusContrato)
    {
        var contrato = PaymobiStatus.Normalizar(statusContrato);
        var s = NormalizarOuVazio(atual);
        var entrouDinheiro = pagosDepois > pagosAntes + 0.009m;
        var saiuAtraso = atrasoDepois <= 0 && atrasoAntes > 0;
        var quitou = contrato is PaymobiStatus.Quitada or PaymobiStatus.Cancelada;

        if (quitou) return Ok;

        if (s is Negociacao or Recuperacao)
            return atrasoDepois <= 0 ? Ok : s;

        if (s == Perdido && (entrouDinheiro || renegociou || saiuAtraso || atrasoDepois <= 0))
            return atrasoDepois > 0 ? Negociacao : Ok;

        if (s.Length == 0 || s is Ok or Perdido)
            return Padrao(atrasoDepois, contrato);

        return s;
    }
}

public class PaymobiBoletoData
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("numero")]
    public int Numero { get; set; }

    [BsonElement("vencimento")]
    public DateTime? Vencimento { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valor")]
    public decimal Valor { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = string.Empty;

    [BsonElement("imei")]
    public string Imei { get; set; } = string.Empty;

    [BsonElement("link")]
    public string Link { get; set; } = string.Empty;

    [BsonIgnoreIfNull]
    [BsonElement("pagoEm")]
    public DateTime? PagoEm { get; set; }

    [BsonIgnoreIfDefault]
    [BsonElement("manual")]
    public bool Manual { get; set; }
}

public class PaymobiConfirmarParcelaRequest
{
    public int Numero { get; set; }
    public decimal Valor { get; set; }
    public DateTime? Vencimento { get; set; }
    public string? Imei { get; set; }
}

public class PaymobiCobrancaData
{
    [BsonElement("id")]
    public string Id { get; set; } = string.Empty;

    [BsonElement("data")]
    public DateTime Data { get; set; } = DateTime.UtcNow;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valor")]
    public decimal Valor { get; set; }

    [BsonElement("observacao")]
    public string Observacao { get; set; } = string.Empty;
}

public class PaymobiVendaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("clienteNome")]
    public string ClienteNome { get; set; } = string.Empty;

    [BsonElement("clienteCpf")]
    public string ClienteCpf { get; set; } = string.Empty;

    [BsonElement("clienteTelefone")]
    public string ClienteTelefone { get; set; } = string.Empty;

    [BsonElement("aparelhoMarca")]
    public string AparelhoMarca { get; set; } = string.Empty;

    [BsonElement("aparelhoModelo")]
    public string AparelhoModelo { get; set; } = string.Empty;

    [BsonElement("aparelhoCor")]
    public string AparelhoCor { get; set; } = string.Empty;

    [BsonElement("aparelhoImei")]
    public string AparelhoImei { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorInvestido")]
    public decimal ValorInvestido { get; set; }

    /// <summary>Taxa/custo da PayMobi (plataforma) neste boleto.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoPlataforma")]
    public decimal CustoPlataforma { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorVenda")]
    public decimal ValorVenda { get; set; }

    [BsonElement("parcelas")]
    public int Parcelas { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorParcela")]
    public decimal ValorParcela { get; set; }

    [BsonElement("dataVenda")]
    public DateTime DataVenda { get; set; } = DateTime.UtcNow;

    [BsonElement("status")]
    public string Status { get; set; } = PaymobiStatus.Aberta;

    /// <summary>Situação da cobrança: ok, negociacao, recuperacao, perdido.</summary>
    [BsonElement("statusCobranca")]
    public string StatusCobranca { get; set; } = "";

    [BsonElement("observacoes")]
    public string Observacoes { get; set; } = string.Empty;

    [BsonElement("cobrancas")]
    public List<PaymobiCobrancaData> Cobrancas { get; set; } = [];

    [BsonIgnoreIfNull]
    [BsonElement("paymobiSellId")]
    public string? PaymobiSellId { get; set; }

    [BsonElement("lojaNome")]
    public string LojaNome { get; set; } = string.Empty;

    [BsonElement("vendedorNome")]
    public string VendedorNome { get; set; } = string.Empty;

    [BsonElement("clienteEmail")]
    public string ClienteEmail { get; set; } = string.Empty;

    [BsonElement("contratoNumero")]
    public string ContratoNumero { get; set; } = string.Empty;

    [BsonElement("contratoTipo")]
    public string ContratoTipo { get; set; } = string.Empty;

    [BsonElement("contratoAssinado")]
    public bool ContratoAssinado { get; set; }

    [BsonElement("encerradoEm")]
    public DateTime? EncerradoEm { get; set; }

    [BsonElement("canceladoEm")]
    public DateTime? CanceladoEm { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorOriginal")]
    public decimal ValorOriginal { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorEntrada")]
    public decimal ValorEntrada { get; set; }

    [BsonElement("aparelhoBloqueado")]
    public bool AparelhoBloqueado { get; set; }

    [BsonElement("parcelasAtraso")]
    public int ParcelasAtraso { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorDevido")]
    public decimal ValorDevido { get; set; }

    /// <summary>Boletos da PayMobi deste IMEI (não mistura aparelhos do mesmo cliente).</summary>
    [BsonElement("boletos")]
    public List<PaymobiBoletoData> Boletos { get; set; } = [];

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorBaseAparelho")]
    public decimal ValorBaseAparelho { get; set; }

    [BsonElement("concretizada")]
    public bool Concretizada { get; set; }

    [BsonIgnoreIfNull]
    [BsonElement("concretizadaEm")]
    public DateTime? ConcretizadaEm { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorRevenda")]
    public decimal ValorRevenda { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoManutencao")]
    public decimal CustoManutencao { get; set; }

    /// <summary>Boletos já pagos informados na devolução, quando a PayMobi apaga as parcelas.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valorBoletosPagos")]
    public decimal ValorBoletosPagos { get; set; }

    [BsonElement("origem")]
    public string Origem { get; set; } = "manual";

    [BsonIgnoreIfNull]
    [BsonElement("sincronizadoEm")]
    public DateTime? SincronizadoEm { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}
