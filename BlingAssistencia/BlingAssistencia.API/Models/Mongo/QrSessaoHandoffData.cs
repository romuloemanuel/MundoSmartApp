using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>Código curto one-shot para transferir sessão do balcão → celular via QR.</summary>
public class QrSessaoHandoffData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [BsonElement("usuarioId")]
    public string UsuarioId { get; set; } = string.Empty;

    [BsonElement("expiraEm")]
    public DateTime ExpiraEm { get; set; }

    [BsonElement("usadoEm")]
    public DateTime? UsadoEm { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
