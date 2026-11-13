using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class BlingVendaExclusaoData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("pedidoId")]
    public long PedidoId { get; set; }

    [BsonElement("excluidaEm")]
    public DateTime ExcluidaEm { get; set; } = DateTime.UtcNow;
}
