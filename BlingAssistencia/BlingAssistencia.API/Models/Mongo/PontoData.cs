using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class PontoTipos
{
    public const string Entrada = "entrada";
    public const string Almoco = "almoco";
    public const string Volta = "volta";
    public const string Saida = "saida";

    public static readonly string[] Todos = [Entrada, Almoco, Volta, Saida];

    public static bool EhValido(string? tipo) =>
        Todos.Contains((tipo ?? "").Trim().ToLowerInvariant());

    public static string Normalizar(string? tipo)
    {
        var t = (tipo ?? "").Trim().ToLowerInvariant();
        return EhValido(t) ? t : Entrada;
    }
}

[BsonIgnoreExtraElements]
public class PontoAparelhoData
{
    public const int MaximoAtivos = 3;

    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("tokenHash")]
    public string TokenHash { get; set; } = string.Empty;

    [BsonElement("apelido")]
    public string Apelido { get; set; } = string.Empty;

    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    [BsonElement("latitude")]
    public double? Latitude { get; set; }

    [BsonElement("longitude")]
    public double? Longitude { get; set; }

    [BsonElement("userAgent")]
    public string? UserAgent { get; set; }

    [BsonElement("liberadoPorId")]
    public string? LiberadoPorId { get; set; }

    [BsonElement("liberadoPorNome")]
    public string LiberadoPorNome { get; set; } = string.Empty;

    [BsonElement("liberadoEm")]
    public DateTime LiberadoEm { get; set; }

    [BsonElement("revogadoEm")]
    public DateTime? RevogadoEm { get; set; }

    [BsonElement("revogadoPorNome")]
    public string? RevogadoPorNome { get; set; }
}

[BsonIgnoreExtraElements]
public class PontoSenhaDiaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("dia")]
    public DateTime Dia { get; set; }

    [BsonElement("senha")]
    public string Senha { get; set; } = string.Empty;

    [BsonElement("criadoPorNome")]
    public string CriadoPorNome { get; set; } = string.Empty;

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; }
}

[BsonIgnoreExtraElements]
public class PontoBatidaData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("dia")]
    public DateTime Dia { get; set; }

    [BsonElement("usuarioId")]
    public string UsuarioId { get; set; } = string.Empty;

    [BsonElement("usuarioNome")]
    public string UsuarioNome { get; set; } = string.Empty;

    [BsonElement("tipo")]
    public string Tipo { get; set; } = PontoTipos.Entrada;

    [BsonElement("horario")]
    public DateTime Horario { get; set; }

    [BsonElement("aparelhoId")]
    public string AparelhoId { get; set; } = string.Empty;

    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    [BsonElement("latitude")]
    public double? Latitude { get; set; }

    [BsonElement("longitude")]
    public double? Longitude { get; set; }

    [BsonElement("precisaoMetros")]
    public double? PrecisaoMetros { get; set; }

    [BsonElement("distanciaLojaMetros")]
    public double? DistanciaLojaMetros { get; set; }

    [BsonElement("foraDaLoja")]
    public bool ForaDaLoja { get; set; }

    [BsonElement("semGps")]
    public bool SemGps { get; set; }

    [BsonElement("fotoUrl")]
    public string FotoUrl { get; set; } = string.Empty;
}
