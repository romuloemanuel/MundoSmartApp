namespace MundoSmart.BlingAssistencia.API.Models;

public class ComissaoRelatorioResponse
{
    public DateTime? DataConclusaoInicio { get; set; }
    public DateTime? DataConclusaoFim { get; set; }
    /// <summary>Null/vazio = todas as lojas.</summary>
    public string? LojaOrigemFiltro { get; set; }
    public List<string> TecnicosFiltro { get; set; } = [];
    public int QuantidadeOs { get; set; }
    public decimal TotalValor { get; set; }
    public decimal TotalJuros { get; set; }
    public decimal TotalPecas { get; set; }
    public decimal TotalLiquido { get; set; }
    public List<ComissaoPorTecnico> PorTecnico { get; set; } = [];
    public List<ComissaoOsItem> Ordens { get; set; } = [];
}

public class ComissaoPorTecnico
{
    public string TecnicoNome { get; set; } = string.Empty;
    public int QuantidadeOs { get; set; }
    public decimal TotalValor { get; set; }
    public decimal TotalJuros { get; set; }
    public decimal TotalPecas { get; set; }
    public decimal TotalLiquido { get; set; }
}

public class ComissaoOsItem
{
    public long Id { get; set; }
    public string? Numero { get; set; }
    public string? LojaOrigem { get; set; }
    public string? TecnicoNome { get; set; }
    public string? ClienteNome { get; set; }
    public string? Equipamento { get; set; }
    public DateTime? DataConclusao { get; set; }
    public decimal ValorTotal { get; set; }
    public decimal Juros { get; set; }
    public decimal ValorPecas { get; set; }
    public decimal ValorLiquido { get; set; }
}
