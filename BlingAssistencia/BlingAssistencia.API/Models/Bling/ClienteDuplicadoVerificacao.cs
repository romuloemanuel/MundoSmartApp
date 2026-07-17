namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class ClienteDuplicadoVerificacao
{
    public bool Existe { get; set; }
    public long? ClienteId { get; set; }
    public string? ClienteNome { get; set; }
}

/// <summary>
/// Sugestão de nome para contato alternativo a partir de um telefone já conhecido na base.
/// Não bloqueia cadastro — o número pode se repetir entre alternativos / cliente existente.
/// </summary>
public class ContatoAltSugestao
{
    public bool Encontrado { get; set; }
    public string? Nome { get; set; }
    public long? ClienteId { get; set; }
    /// <summary>True se o telefone é do cadastro principal de um cliente.</summary>
    public bool EClientePrincipal { get; set; }
}
