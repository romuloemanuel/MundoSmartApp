namespace MundoSmart.BlingAssistencia.API.Models;

public class ReceitaPainelDto
{
    public string Agrupamento { get; set; } = "mensal";
    public string? AvisoBling { get; set; }

    /// <summary>A lista de pedidos do Bling não trouxe custo do item nem custo da loja.</summary>
    public bool CustoBlingIndisponivel { get; set; }

    public List<ReceitaPeriodoDto> Periodos { get; set; } = [];
}

public class ReceitaPeriodoDto
{
    public string Chave { get; set; } = string.Empty;
    public string Rotulo { get; set; } = string.Empty;
    public string Inicio { get; set; } = string.Empty;
    public string Fim { get; set; } = string.Empty;
    public ReceitaFaixaDto Bling { get; set; } = new();
    public ReceitaFaixaDto Celulares { get; set; } = new();
    public ReceitaFaixaDto Assistencia { get; set; } = new();

    /// <summary>Valor que entrou no estoque na troca. Não é faturamento.</summary>
    public decimal CelularesEstoqueEntrou { get; set; }
}

public class ReceitaFaixaDto
{
    public decimal Bruto { get; set; }
    public decimal CustoItem { get; set; }
    public decimal CustoLoja { get; set; }
    public int Quantidade { get; set; }
}
