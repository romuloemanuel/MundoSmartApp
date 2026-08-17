using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class CategoriaPecaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("ordem")]
    public int Ordem { get; set; }

    /// <summary>Estoque controlado por cor dentro de cada modelo (tampa/vidro traseiro).</summary>
    [BsonElement("usaCoresPorModelo")]
    public bool UsaCoresPorModelo { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}
