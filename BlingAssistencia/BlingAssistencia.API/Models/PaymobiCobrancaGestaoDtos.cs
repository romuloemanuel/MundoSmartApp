namespace MundoSmart.BlingAssistencia.API.Models;

public class PaymobiCobrancaConfigDto
{
    public bool AlertaHabilitado { get; set; } = true;
    public int AlertaHora { get; set; } = 9;
    public int AlertaMaxAtraso { get; set; } = 2;
    public string AlertaMensagem { get; set; } = "";
    public bool AutoHabilitada { get; set; } = true;
    public int AutoDiasAposVencimento { get; set; } = 2;
    public int AutoRepetirDias { get; set; } = 3;
    public int AutoHora { get; set; } = 10;
    public bool AutoSoDiasUteis { get; set; } = true;
    public string AutoMensagem { get; set; } = "";
}

public class PaymobiCobrancaAcaoDto
{
    public string Id { get; set; } = "";
    public DateTime Em { get; set; }
    public string Tipo { get; set; } = "";
    public string Modo { get; set; } = "";
    public string Observacao { get; set; } = "";
    public DateTime? VencimentoRef { get; set; }
    public int BoletosAtraso { get; set; }
    public string Operador { get; set; } = "";
    public bool Enviada { get; set; }
}

public class PaymobiCobrancaItemDto
{
    public string Id { get; set; } = "";
    public string ClienteNome { get; set; } = "";
    public string ClienteTelefone { get; set; } = "";
    public string ClienteCpf { get; set; } = "";
    public string Aparelho { get; set; } = "";
    public string AparelhoImei { get; set; } = "";
    public string ContratoNumero { get; set; } = "";
    public DateTime DataVenda { get; set; }
    public string Status { get; set; } = "";
    public int ParcelasAtraso { get; set; }
    public int BoletosPagos { get; set; }
    public decimal ValorDevido { get; set; }
    public decimal ValorParcela { get; set; }
    public DateTime? ProximoVencimento { get; set; }
    public DateTime? VencimentoAtrasado { get; set; }
    public string TipoCobranca { get; set; } = "";
    public string TipoCobrancaRotulo { get; set; } = "";
    public bool NaoCobrarMais { get; set; }
    public DateTime? SonecaAte { get; set; }
    public bool SonecaAtiva { get; set; }
    public DateTime? ProximaAcaoEm { get; set; }
    public string ProximaAcaoRotulo { get; set; } = "";
    public bool FilaHoje { get; set; }
    public bool FilaAlerta { get; set; }
    public bool FilaCobranca { get; set; }
    public bool PendenteEnvio { get; set; }
    public string MotivoPausa { get; set; } = "";
    public string MensagemSugerida { get; set; } = "";
    public string LinkBoleto { get; set; } = "";
    public List<PaymobiCobrancaAcaoDto> Acoes { get; set; } = [];
}

public class PaymobiCobrancaListaResponse
{
    public PaymobiCobrancaResumoDto Resumo { get; set; } = new();
    public List<PaymobiCobrancaItemDto> Itens { get; set; } = [];
}

public class PaymobiCobrancaResumoDto
{
    public int Contratos { get; set; }
    public int AcaoHoje { get; set; }
    public int AlertaHoje { get; set; }
    public int CobrancaHoje { get; set; }
    public int Soneca { get; set; }
    public int NaoCobrar { get; set; }
    public int Atrasados { get; set; }
    public int PendenteEnvio { get; set; }
}

public class PaymobiGestaoCobrancaRequest
{
    public string? TipoCobranca { get; set; }
    public bool? NaoCobrarMais { get; set; }
    public DateTime? SonecaAte { get; set; }
    public bool LimparSoneca { get; set; }
    public string? Observacao { get; set; }
}

public class PaymobiRegistrarAcaoCobrancaRequest
{
    public string Tipo { get; set; } = "cobranca";
    public string? Observacao { get; set; }
    public bool Enviada { get; set; } = true;
}
