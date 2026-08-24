namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class ConsultaProdutosResponse
{
    public string Categoria { get; set; } = string.Empty;
    public string Termo { get; set; } = string.Empty;
    public string Origem { get; set; } = "cache";
    public string? Aviso { get; set; }
    /// <summary>UTC da última atualização dos itens retornados (cache Mongo).</summary>
    public DateTime? AtualizadoEm { get; set; }
    public int SyncIntervaloMinutos { get; set; }
    public List<ConsultaProdutoGrupo> Grupos { get; set; } = [];
}

public class ConsultaProdutoGrupo
{
    public string Nome { get; set; } = string.Empty;
    public string? Modelo { get; set; }
    public string? Marca { get; set; }
    public decimal SaldoTotal { get; set; }
    /// <summary>True se algum SKU do grupo permite personalização (campo customizado Bling).</summary>
    public bool PermitePersonalizacao { get; set; }
    public List<ConsultaProdutoCor> Cores { get; set; } = [];
}

public class ConsultaProdutoCor
{
    public string Cor { get; set; } = string.Empty;
    public decimal Saldo { get; set; }
    public string? Codigo { get; set; }
    public decimal? Preco { get; set; }
}

public class ConsultaProdutosSyncResult
{
    public bool Ok { get; set; }
    public int Itens { get; set; }
    public string? Aviso { get; set; }
    public DateTime? AtualizadoEm { get; set; }
    public Dictionary<string, int> PorCategoria { get; set; } = new();
}

public class ConsultaProdutosSyncStatus
{
    public int SyncIntervaloMinutos { get; set; }
    public DateTime? UltimaSyncEm { get; set; }
    public string? UltimoAviso { get; set; }
    public bool SyncEmAndamento { get; set; }
}
