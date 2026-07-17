namespace MundoSmart.BlingAssistencia.API.Models;

public class ImpressaoOsConfigDto
{
    public string AvisoPreOrcamento { get; set; } = string.Empty;
    public string TermosCondicoes { get; set; } = string.Empty;
    public string NomeEmpresa { get; set; } = string.Empty;
    public string EnderecoEmpresa { get; set; } = string.Empty;
    public string TelefoneEmpresa { get; set; } = string.Empty;
    public string CnpjEmpresa { get; set; } = string.Empty;
    public int DiasGarantiaPadrao { get; set; } = 90;
    public string TextoGarantiaTermica { get; set; } = string.Empty;
}
