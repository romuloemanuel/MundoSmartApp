using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class ReceitaBlingVendaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("pedidoId")]
    public long PedidoId { get; set; }

    [BsonElement("numero")]
    public string Numero { get; set; } = string.Empty;

    [BsonElement("data")]
    public DateTime Data { get; set; }

    [BsonElement("clienteNome")]
    public string ClienteNome { get; set; } = string.Empty;

    [BsonElement("bruto")]
    public decimal Bruto { get; set; }

    [BsonElement("custoItemOrigem")]
    public decimal CustoItemOrigem { get; set; }

    [BsonElement("custoLojaOrigem")]
    public decimal CustoLojaOrigem { get; set; }

    [BsonElement("custoItem")]
    public decimal CustoItem { get; set; }

    [BsonElement("custoLoja")]
    public decimal CustoLoja { get; set; }

    [BsonElement("custoItemEditado")]
    public bool CustoItemEditado { get; set; }

    [BsonElement("custoLojaEditado")]
    public bool CustoLojaEditado { get; set; }

    [BsonElement("excluida")]
    public bool Excluida { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
