using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MundoSmart.BlingAssistencia.API.Models.Bling;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class ClienteLocalData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? MongoId { get; set; }

    [BsonElement("blingId")]
    public long BlingId { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("email")]
    public string? Email { get; set; }

    [BsonElement("telefone")]
    public string? Telefone { get; set; }

    [BsonElement("celular")]
    public string? Celular { get; set; }

    [BsonElement("cpfCnpj")]
    [BsonIgnoreIfNull]
    public string? CpfCnpj { get; set; }

    [BsonElement("ie")]
    public string? Ie { get; set; }

    [BsonElement("rg")]
    public string? Rg { get; set; }

    [BsonElement("fantasia")]
    public string? Fantasia { get; set; }

    [BsonElement("tipo")]
    public string? Tipo { get; set; }

    [BsonElement("endereco")]
    public BlingContatoEndereco? Endereco { get; set; }

    [BsonElement("telefone2")]
    public string? Telefone2 { get; set; }

    [BsonElement("contatos")]
    public List<ContatoPrincipalLocal> Contatos { get; set; } = [];

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}

public class ContatoPrincipalLocal
{
    [BsonElement("nome")]
    public string? Nome { get; set; }

    [BsonElement("telefone")]
    public string? Telefone { get; set; }

    [BsonElement("celular")]
    public string? Celular { get; set; }

    [BsonElement("parentesco")]
    public string? Parentesco { get; set; }
}
