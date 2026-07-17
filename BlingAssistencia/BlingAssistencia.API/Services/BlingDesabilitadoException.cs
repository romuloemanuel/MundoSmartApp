namespace MundoSmart.BlingAssistencia.API.Services;

public class BlingDesabilitadoException : Exception
{
    public const string MensagemPadrao = "Integração Bling desabilitada temporariamente.";

    public BlingDesabilitadoException() : base(MensagemPadrao) { }
}
