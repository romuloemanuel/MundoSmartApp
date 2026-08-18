using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class AparelhoConstantes
{
    public static readonly string[] TiposDispositivo =
        ["Celular", "Tablet", "Smartwatch", "Notebook", "Console", "Outro"];

    public static readonly string[] TiposCompatibilidade =
        ["Exato", "Familia", "Compartilhado"];

    /// <summary>Classificação base de tela para peças e filtros (AMOLED -> OLED, IPS -> LCD).</summary>
    public static readonly string[] TiposTelaBase =
        ["OLED", "LCD"];
}

public class MarcaAparelho
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("tipoDispositivo")]
    public string TipoDispositivo { get; set; } = "Celular";

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}

public class AparelhoCompativel
{
    [BsonElement("modeloId")]
    public string ModeloId { get; set; } = string.Empty;

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("marcaNome")]
    public string? MarcaNome { get; set; }

    [BsonElement("tipoDispositivo")]
    public string? TipoDispositivo { get; set; }

    /// <summary>Exato, Familia ou Compartilhado (telas/baterias compartilhadas).</summary>
    [BsonElement("tipoCompatibilidade")]
    public string TipoCompatibilidade { get; set; } = "Exato";

    [BsonElement("observacao")]
    public string? Observacao { get; set; }
}

public class ModeloAparelho
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("marcaId")]
    public string? MarcaId { get; set; }

    [BsonElement("marcaNome")]
    public string? MarcaNome { get; set; }

    [BsonElement("tipoDispositivo")]
    public string TipoDispositivo { get; set; } = "Celular";

    [BsonElement("tipoTela")]
    public string? TipoTela { get; set; }

    [BsonElement("observacoes")]
    public string? Observacoes { get; set; }

    [BsonElement("aparelhosCompativeis")]
    public List<AparelhoCompativel> AparelhosCompativeis { get; set; } = [];

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}
