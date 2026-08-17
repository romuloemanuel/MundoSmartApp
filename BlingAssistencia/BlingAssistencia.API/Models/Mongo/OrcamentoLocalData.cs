using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MundoSmart.BlingAssistencia.API.Models.Bling;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class OrcamentoLocalData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? MongoId { get; set; }

    [BsonElement("blingId")]
    public long BlingId { get; set; }

    [BsonElement("numero")]
    public string? Numero { get; set; }

    [BsonElement("situacao")]
    public string? Situacao { get; set; }

    [BsonElement("data")]
    public DateTime? Data { get; set; }

    [BsonElement("validade")]
    public DateTime? Validade { get; set; }

    [BsonElement("contato")]
    public BlingContatoRef? Contato { get; set; }

    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    /// <summary>whatsapp_internet | atendimento_local</summary>
    [BsonElement("tipoContato")]
    public string? TipoContato { get; set; }

    [BsonElement("justificativaAguardo")]
    public string? JustificativaAguardo { get; set; }

    [BsonElement("dataRetornoMensagem")]
    public DateTime? DataRetornoMensagem { get; set; }

    [BsonElement("responsavelOrcamento")]
    public string? ResponsavelOrcamento { get; set; }

    [BsonElement("dataFollowUp")]
    public DateTime? DataFollowUp { get; set; }

    [BsonElement("vezesContato")]
    public int VezesContato { get; set; }

    [BsonElement("followUps")]
    public List<OrcamentoFollowUpItem> FollowUps { get; set; } = [];

    [BsonElement("observacoes")]
    public string? Observacoes { get; set; }

    [BsonElement("valorTotal")]
    public decimal? ValorTotal { get; set; }

    [BsonElement("valorTotalAcordado")]
    public decimal? ValorTotalAcordado { get; set; }

    [BsonElement("valorAVista")]
    public decimal? ValorAVista { get; set; }

    [BsonElement("valorAPrazo")]
    public decimal? ValorAPrazo { get; set; }

    [BsonElement("formaPagamento")]
    public string? FormaPagamento { get; set; }

    [BsonElement("parcelasPagamento")]
    public int? ParcelasPagamento { get; set; }

    [BsonElement("garantiaMeses")]
    public int? GarantiaMeses { get; set; }

    [BsonElement("marcaId")]
    public string? MarcaId { get; set; }

    [BsonElement("marcaNome")]
    public string? MarcaNome { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("equipamento")]
    public string? Equipamento { get; set; }

    [BsonElement("osGeradaBlingId")]
    public long? OsGeradaBlingId { get; set; }

    [BsonElement("osGeradaNumero")]
    public string? OsGeradaNumero { get; set; }

    [BsonElement("motivoDesistencia")]
    public string? MotivoDesistencia { get; set; }

    [BsonElement("itens")]
    public List<BlingOrcamentoItem> Itens { get; set; } = [];

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
