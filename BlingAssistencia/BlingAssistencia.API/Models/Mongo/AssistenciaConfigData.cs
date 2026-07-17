using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class AssistenciaConfigData
{
    [BsonId]
    public string Id { get; set; } = "assistencia";

    [BsonElement("avisoPreOrcamentoOs")]
    public string AvisoPreOrcamentoOs { get; set; } = string.Empty;

    [BsonElement("termosCondicoesOs")]
    public string TermosCondicoesOs { get; set; } = string.Empty;

    [BsonElement("nomeEmpresa")]
    public string NomeEmpresa { get; set; } = string.Empty;

    [BsonElement("enderecoEmpresa")]
    public string EnderecoEmpresa { get; set; } = string.Empty;

    [BsonElement("telefoneEmpresa")]
    public string TelefoneEmpresa { get; set; } = string.Empty;

    [BsonElement("cnpjEmpresa")]
    public string CnpjEmpresa { get; set; } = string.Empty;

    [BsonElement("diasGarantiaPadrao")]
    public int DiasGarantiaPadrao { get; set; } = 90;

    [BsonElement("textoGarantiaTermica")]
    public string TextoGarantiaTermica { get; set; } = string.Empty;

    /// <summary>Acréscimo % no valor sugerido do estoque, por código de loja (MCC, ARCE…).</summary>
    [BsonElement("acrescimoPercentualPorLoja")]
    public Dictionary<string, decimal> AcrescimoPercentualPorLoja { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
