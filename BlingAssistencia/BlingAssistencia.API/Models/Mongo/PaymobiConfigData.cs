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
}
