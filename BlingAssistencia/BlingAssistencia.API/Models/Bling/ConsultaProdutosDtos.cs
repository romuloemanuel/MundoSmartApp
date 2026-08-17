namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class ConsultaProdutosResponse
{
    public string Categoria { get; set; } = string.Empty;
    public string Termo { get; set; } = string.Empty;
    public string Origem { get; set; } = "cache";
    public string? Aviso { get; set; }
    public List<ConsultaProdutoGrupo> Grupos { get; set; } = [];
}

public class ConsultaProdutoGrupo
{
    public string Nome { get; set; } = string.Empty;
    public string? Modelo { get; set; }
    public decimal SaldoTotal { get; set; }
    public List<ConsultaProdutoCor> Cores { get; set; } = [];
}

public class ConsultaProdutoCor
{
    public string Cor { get; set; } = string.Empty;
    public decimal Saldo { get; set; }
    public string? Codigo { get; set; }
    public decimal? Preco { get; set; }
}
