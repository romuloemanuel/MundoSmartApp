using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class BlingComissaoLojaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("blingPedidoId")]
    public long BlingPedidoId { get; set; }

    [BsonElement("blingItemId")]
    public long BlingItemId { get; set; }

    [BsonElement("data")]
    public string Data { get; set; } = string.Empty;

    [BsonElement("pedido")]
    public string Pedido { get; set; } = string.Empty;

    [BsonElement("vendedor")]
    public string Vendedor { get; set; } = string.Empty;

    [BsonElement("produto")]
    public string Produto { get; set; } = string.Empty;

    [BsonElement("cliente")]
    public string Cliente { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valor")]
    public decimal Valor { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonIgnoreIfNull]
    [BsonElement("custo")]
    public decimal? Custo { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; }
}
