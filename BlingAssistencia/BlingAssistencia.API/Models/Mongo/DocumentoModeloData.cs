using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class DocumentoTipos
{
    public const string Contrato = "contrato";
    public const string Aviso = "aviso";
    public const string Termo = "termo";

    public static readonly string[] Todos = [Contrato, Aviso, Termo];

    public static bool EhValido(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo)
        && Todos.Contains(tipo.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string Normalizar(string? tipo)
    {
        var t = (tipo ?? "").Trim().ToLowerInvariant();
        return Todos.Contains(t) ? t : Contrato;
    }
}

public static class DocumentoVariavelTipos
{
    public static readonly DocumentoVariavelTipoInfo[] Todos =
    [
        new("texto", "Texto"),
        new("paragrafo", "Parágrafo"),
        new("numero", "Número"),
        new("moeda", "Moeda (R$)"),
        new("data", "Data"),
        new("data_hora", "Data e hora"),
        new("cpf", "CPF"),
        new("cnpj", "CNPJ"),
        new("telefone", "Telefone"),
        new("imei", "IMEI"),
        new("endereco", "Endereço (CEP)"),
    ];

    public static bool EhValido(string? tipo) =>
        !string.IsNullOrWhiteSpace(tipo)
        && Todos.Any(t => string.Equals(t.Id, tipo.Trim(), StringComparison.OrdinalIgnoreCase));

    public static string Normalizar(string? tipo)
    {
        var t = (tipo ?? "").Trim().ToLowerInvariant();
        return Todos.Any(x => x.Id == t) ? t : "texto";
    }
}

public record DocumentoVariavelTipoInfo(string Id, string Rotulo);

public class DocumentoVariavelDef
{
    [BsonElement("chave")]
    public string Chave { get; set; } = string.Empty;

    [BsonElement("rotulo")]
    public string Rotulo { get; set; } = string.Empty;

    [BsonElement("tipo")]
    public string Tipo { get; set; } = "texto";

    [BsonElement("obrigatoria")]
    public bool Obrigatoria { get; set; } = true;

    /// <summary>Não aparece no formulário de emissão (valor fixo ou automático).</summary>
    [BsonElement("oculta")]
    public bool Oculta { get; set; }

    [BsonElement("ordem")]
    public int Ordem { get; set; }
}

public class DocumentoVariavelCatalogoData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("chave")]
    public string Chave { get; set; } = string.Empty;

    [BsonElement("rotulo")]
    public string Rotulo { get; set; } = string.Empty;

    [BsonElement("tipo")]
    public string Tipo { get; set; } = "texto";

    [BsonElement("ordem")]
    public int Ordem { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}

public class DocumentoModeloData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>Identidade estável para seed e para não duplicar modelos padrão.</summary>
    [BsonElement("codigo")]
    public string Codigo { get; set; } = string.Empty;

    [BsonElement("tipo")]
    public string Tipo { get; set; } = DocumentoTipos.Contrato;

    [BsonElement("titulo")]
    public string Titulo { get; set; } = string.Empty;

    [BsonElement("corpo")]
    public string Corpo { get; set; } = string.Empty;

    [BsonElement("ativo")]
    public bool Ativo { get; set; } = true;

    /// <summary>Na emissão, monta duas páginas (via da loja e via do cliente).</summary>
    [BsonElement("imprimirDuasVias")]
    public bool ImprimirDuasVias { get; set; }

    [BsonElement("ordem")]
    public int Ordem { get; set; }

    [BsonElement("variaveis")]
    public List<DocumentoVariavelDef> Variaveis { get; set; } = [];

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }
}
