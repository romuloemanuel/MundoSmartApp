namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class BlingContato
{
    public long? Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Telefone { get; set; }
    public string? Celular { get; set; }
    public string? CpfCnpj { get; set; }
    public string? Ie { get; set; }
    public string? Rg { get; set; }
    public string? Fantasia { get; set; }
    public string? Tipo { get; set; }
    public BlingContatoEndereco? Endereco { get; set; }

    // ── Campos locais (MongoDB) ───────────────────────────────────────────────
    /// <summary>Segundo número de telefone/celular do cliente.</summary>
    public string? Telefone2 { get; set; }

    /// <summary>Até dois contatos principais (familiar, responsável etc.).</summary>
    public List<ContatoPrincipalDto>? Contatos { get; set; }

    /// <summary>Origem do registro na listagem: local ou bling.</summary>
    public string? Origem { get; set; }
}

public class ContatoPrincipalDto
{
    public string? Nome { get; set; }
    public string? Telefone { get; set; }
    public string? Celular { get; set; }
    public string? Parentesco { get; set; }
}

public class BlingContatoEndereco
{
    public string? Logradouro { get; set; }
    public string? Numero { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Municipio { get; set; }
    public string? Uf { get; set; }
    public string? Cep { get; set; }
}

