namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>
/// DTO trafegado na API para os campos locais de uma OS.
/// </summary>
public class OsLocalDataDto
{
    public ContatoAvisoLocal? ContatoAviso { get; set; }
    public string? Imei { get; set; }
    public string? CpfCnpj { get; set; }
    public bool Retorno { get; set; }
    public DateTime? DataConclusao { get; set; }
    public string? ObservacoesInternas { get; set; }
}
