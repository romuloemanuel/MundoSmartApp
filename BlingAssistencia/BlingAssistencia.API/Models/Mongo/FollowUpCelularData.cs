using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class FollowUpCelularData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("numero")]
    public long Numero { get; set; }

    [BsonElement("clienteNome")]
    public string ClienteNome { get; set; } = string.Empty;

    [BsonElement("telefone")]
    public string Telefone { get; set; } = string.Empty;

    /// <summary>troca | compra | compra_boleto</summary>
    [BsonElement("interesse")]
    public string Interesse { get; set; } = string.Empty;

    [BsonElement("aparelhoDesejado")]
    public string? AparelhoDesejado { get; set; }

    [BsonElement("aparelhoCliente")]
    public string? AparelhoCliente { get; set; }

    [BsonElement("valorEstimado")]
    public decimal? ValorEstimado { get; set; }

    [BsonElement("observacao")]
    public string? Observacao { get; set; }

    [BsonElement("responsavel")]
    public string? Responsavel { get; set; }

    [BsonElement("situacao")]
    public string Situacao { get; set; } = "Em aberto";

    [BsonElement("dataFollowUp")]
    public DateTime? DataFollowUp { get; set; }

    [BsonElement("vezesContato")]
    public int VezesContato { get; set; }

    [BsonElement("followUps")]
    public List<FollowUpCelularContato> FollowUps { get; set; } = [];

    [BsonElement("motivoDesistencia")]
    public string? MotivoDesistencia { get; set; }

    [BsonElement("observacaoConversao")]
    public string? ObservacaoConversao { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; }
}

public class FollowUpCelularContato
{
    [BsonElement("data")]
    public DateTime Data { get; set; }

    [BsonElement("anotacao")]
    public string Anotacao { get; set; } = string.Empty;

    [BsonElement("responsavel")]
    public string? Responsavel { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; }
}
