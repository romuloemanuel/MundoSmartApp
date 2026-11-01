namespace MundoSmart.BlingAssistencia.API.Models;

public class ComissaoOrigemDto
{
    public string? Aviso { get; set; }
    public decimal Total { get; set; }
    public decimal DinheiroPago { get; set; }
    public int Quantidade { get; set; }
    public int Vendas { get; set; }
    public int Trocas { get; set; }
    public List<ComissaoVendedorDto> Vendedores { get; set; } = [];
    public List<ComissaoLancamentoDto> Lancamentos { get; set; } = [];
}

public class ComissaoVendedorDto
{
    public string Nome { get; set; } = string.Empty;
    public int Quantidade { get; set; }
    public int Vendas { get; set; }
    public int Trocas { get; set; }
    public decimal Total { get; set; }
    public decimal DinheiroPago { get; set; }
}

public class ComissaoLancamentoDto
{
    public string Data { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Vendedor { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public string Cliente { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public decimal DinheiroPago { get; set; }
}
