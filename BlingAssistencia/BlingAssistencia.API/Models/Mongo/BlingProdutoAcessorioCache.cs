using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>Cache local de acessórios do Bling (capinha, película, térmico).</summary>
public class BlingProdutoAcessorioCache
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("blingId")]
    public long BlingId { get; set; }

    [BsonElement("categoria")]
    public string Categoria { get; set; } = string.Empty;

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("nomeBase")]
    public string NomeBase { get; set; } = string.Empty;

    [BsonElement("modelo")]
    public string? Modelo { get; set; }

    [BsonElement("cor")]
    public string Cor { get; set; } = "Única";

    [BsonElement("codigo")]
    public string? Codigo { get; set; }

    [BsonElement("saldo")]
    public decimal Saldo { get; set; }

    [BsonElement("preco")]
    public decimal? Preco { get; set; }

    [BsonElement("imagemUrl")]
    public string? ImagemUrl { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
