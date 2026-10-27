using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class BlingVendaCelularTipo
{
    public const string Novo = "novo";
    public const string IphoneUsado = "iphone_usado";
}

public class BlingVendaCelularData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("blingPedidoId")]
    public long BlingPedidoId { get; set; }

    [BsonElement("blingItemId")]
    public long BlingItemId { get; set; }

    [BsonElement("pedidoNumero")]
    public string PedidoNumero { get; set; } = string.Empty;

    [BsonElement("dataVenda")]
    public DateTime DataVenda { get; set; }

    [BsonElement("clienteNome")]
    public string ClienteNome { get; set; } = string.Empty;

    [BsonElement("clienteCpf")]
    public string ClienteCpf { get; set; } = string.Empty;

    [BsonElement("clienteBlingId")]
    public long? ClienteBlingId { get; set; }

    [BsonElement("produtoId")]
    public long? ProdutoId { get; set; }

    [BsonElement("produtoCodigo")]
    public string ProdutoCodigo { get; set; } = string.Empty;

    [BsonElement("produtoNome")]
    public string ProdutoNome { get; set; } = string.Empty;

    [BsonElement("categoriaId")]
    public long? CategoriaId { get; set; }

    [BsonElement("categoriaNome")]
    public string CategoriaNome { get; set; } = string.Empty;

    /// <summary>novo | iphone_usado</summary>
    [BsonElement("tipo")]
    public string Tipo { get; set; } = BlingVendaCelularTipo.Novo;

    [BsonElement("imei")]
    public string Imei { get; set; } = string.Empty;

    [BsonElement("marca")]
    public string Marca { get; set; } = string.Empty;

    [BsonElement("modelo")]
    public string Modelo { get; set; } = string.Empty;

    [BsonElement("marcaId")]
    public string? MarcaId { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("cor")]
    public string Cor { get; set; } = string.Empty;

    [BsonElement("configuracao")]
    public string Configuracao { get; set; } = string.Empty;

    [BsonElement("clienteLocalId")]
    public long? ClienteLocalId { get; set; }

    [BsonElement("cadastroPendente")]
    public bool CadastroPendente { get; set; }

    [BsonRepresentation(BsonType.Decimal128)]
    [BsonElement("valor")]
    public decimal Valor { get; set; }

    [BsonElement("observacoes")]
    public string Observacoes { get; set; } = string.Empty;

    [BsonElement("importadoEm")]
    public DateTime ImportadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
