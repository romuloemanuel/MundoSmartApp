using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>Versão histórica de uma OS (snapshot completo em cada criar/editar/excluir).</summary>
public class OsHistoricoVersao
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("osBlingId")]
    public long OsBlingId { get; set; }

    [BsonElement("osNumero")]
    public string? OsNumero { get; set; }

    /// <summary>Assistência/loja da OS no momento do histórico (filtro por acesso).</summary>
    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    [BsonElement("versao")]
    public int Versao { get; set; }

    /// <summary>criar | atualizar | situacao | excluir</summary>
    [BsonElement("acao")]
    public string Acao { get; set; } = "atualizar";

    [BsonElement("resumo")]
    public string? Resumo { get; set; }

    [BsonElement("usuarioId")]
    public string? UsuarioId { get; set; }

    [BsonElement("usuarioNome")]
    public string? UsuarioNome { get; set; }

    [BsonElement("snapshot")]
    public BsonDocument Snapshot { get; set; } = new();

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public static class OsHistoricoAcoes
{
    public const string Criar = "criar";
    public const string Atualizar = "atualizar";
    public const string Situacao = "situacao";
    public const string Excluir = "excluir";
}
