namespace MundoSmart.BlingAssistencia.API.Models;

public class AcrescimoEstoqueLojaDto
{
    public string LojaCodigo { get; set; } = string.Empty;
    public string LojaNome { get; set; } = string.Empty;
    /// <summary>Percentual de acréscimo sobre valor sugerido do estoque (ex.: 10 = +10%).</summary>
    public decimal Percentual { get; set; }
}

public class AcrescimoEstoqueConfigDto
{
    public List<AcrescimoEstoqueLojaDto> Lojas { get; set; } = [];
}
