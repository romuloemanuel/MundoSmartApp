using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class PaymobiConfigData
{
    [BsonId]
    public string Id { get; set; } = "paymobi";

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("senha")]
    public string Senha { get; set; } = string.Empty;

    [BsonElement("varejoId")]
    public string VarejoId { get; set; } = string.Empty;

    [BsonElement("ultimaSincronizacao")]
    public DateTime? UltimaSincronizacao { get; set; }

    [BsonElement("ultimoTotalImportado")]
    public int UltimoTotalImportado { get; set; }

    /// <summary>Custo da chave, somado ao valor de compra do aparelho.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoFixoAparelho")]
    public decimal CustoFixoAparelho { get; set; } = 80;

    /// <summary>Acréscimo fixo por aparelho (R$ 20 no início), somado em cada linha.</summary>
    [BsonIgnoreIfNull]
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoPorAparelho")]
    public decimal? CustoPorAparelho { get; set; }

    /// <summary>Custo mensal da plataforma, rateado só nos aparelhos com lucro na margem.</summary>
    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("custoPlataformaTotal")]
    public decimal CustoPlataformaTotal { get; set; } = 200;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAlertaHabilitado")]
    public bool? CobrancaAlertaHabilitado { get; set; }

    /// <summary>Hora de Brasília (0–23) para o alerta no dia do vencimento.</summary>
    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAlertaHora")]
    public int? CobrancaAlertaHora { get; set; }

    /// <summary>Não envia alerta de vencimento se houver mais boletos atrasados do que este limite.</summary>
    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAlertaMaxAtraso")]
    public int? CobrancaAlertaMaxAtraso { get; set; }

    [BsonElement("cobrancaAlertaMensagem")]
    public string CobrancaAlertaMensagem { get; set; } = "";

    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAutoHabilitada")]
    public bool? CobrancaAutoHabilitada { get; set; }

    /// <summary>Dias após o vencimento para a primeira cobrança automática (ex.: venceu dia 5, cobra dia 7 → 2).</summary>
    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAutoDiasAposVencimento")]
    public int? CobrancaAutoDiasAposVencimento { get; set; }

    /// <summary>Intervalo, em dias, entre cobranças automáticas enquanto continuar em atraso.</summary>
    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAutoRepetirDias")]
    public int? CobrancaAutoRepetirDias { get; set; }

    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAutoHora")]
    public int? CobrancaAutoHora { get; set; }

    [BsonIgnoreIfNull]
    [BsonElement("cobrancaAutoSoDiasUteis")]
    public bool? CobrancaAutoSoDiasUteis { get; set; }

    [BsonElement("cobrancaAutoMensagem")]
    public string CobrancaAutoMensagem { get; set; } = "";
}
