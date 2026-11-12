namespace MundoSmart.BlingAssistencia.API.Models;

public class SalvarFollowUpCelularRequest
{
    public string ClienteNome { get; set; } = string.Empty;
    public string Telefone { get; set; } = string.Empty;
    /// <summary>troca | compra | compra_boleto</summary>
    public string Interesse { get; set; } = string.Empty;
    public string? AparelhoDesejado { get; set; }
    public string? AparelhoCliente { get; set; }
    public decimal? ValorEstimado { get; set; }
    public string? Observacao { get; set; }
    public string? Responsavel { get; set; }
    public DateTime? DataFollowUp { get; set; }
}

public class RegistrarFollowUpCelularRequest
{
    public string Anotacao { get; set; } = string.Empty;
    public string? Responsavel { get; set; }
    public DateTime? DataFollowUpProxima { get; set; }
}

public class RegistrarDesistenciaFollowUpCelularRequest
{
    public string Motivo { get; set; } = string.Empty;
}

public class ConverterFollowUpCelularRequest
{
    public string? Observacao { get; set; }
}
