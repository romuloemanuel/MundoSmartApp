using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>Credenciais e flags Bling editáveis em produção (admin). Sobrepõe appsettings quando preenchido.</summary>
public class BlingConfigData
{
    [BsonId]
    public string Id { get; set; } = "bling";

    [BsonElement("clientId")]
    public string? ClientId { get; set; }

    [BsonElement("clientSecret")]
    public string? ClientSecret { get; set; }

    [BsonElement("redirectUri")]
    public string? RedirectUri { get; set; }

    [BsonElement("consultaProdutosHabilitada")]
    public bool? ConsultaProdutosHabilitada { get; set; }

    [BsonElement("consultaProdutosSyncMinutos")]
    public int? ConsultaProdutosSyncMinutos { get; set; }

    [BsonElement("idCampoPermitePersonalizacao")]
    public long? IdCampoPermitePersonalizacao { get; set; }

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
