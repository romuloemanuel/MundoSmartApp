using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Models;

public class BlingVendaCelularDto
{
    public string? Id { get; set; }
    public long BlingPedidoId { get; set; }
    public long BlingItemId { get; set; }
    public string PedidoNumero { get; set; } = string.Empty;
    public DateTime DataVenda { get; set; }
    public string ClienteNome { get; set; } = string.Empty;
    public string ClienteCpf { get; set; } = string.Empty;
    public string ProdutoCodigo { get; set; } = string.Empty;
    public string ProdutoNome { get; set; } = string.Empty;
    public long? CategoriaId { get; set; }
    public string CategoriaNome { get; set; } = string.Empty;
    public string Tipo { get; set; } = string.Empty;
    public string Imei { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public string Configuracao { get; set; } = string.Empty;
    public string? MarcaId { get; set; }
    public string? ModeloId { get; set; }
    public long? ClienteLocalId { get; set; }
    public bool CadastroPendente { get; set; }
    public decimal Valor { get; set; }
}

public class BlingVendaCelularPendenciasResponse
{
    public int Total { get; set; }
    public List<BlingVendaCelularDto> Vendas { get; set; } = [];
}

public class BlingVendaCelularPassivelResponse
{
    public bool Passivel { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public List<BlingVendaCelularDto> Aparelhos { get; set; } = [];
}

public class BlingVendaCelularVincularRequest
{
    public long ClienteId { get; set; }
}

public class BlingVendaCelularDescontoResponse
{
    public bool Elegivel { get; set; }
    public string Motivo { get; set; } = string.Empty;
    public decimal DescontoPercentual { get; set; }
    public List<BlingVendaCelularDto> Vendas { get; set; } = [];
}

public class BlingVendaCelularSincronizarRequest
{
    /// <summary>Janela em dias (hoje inclusive). Null = lookback ou histórico inicial.</summary>
    public int? Dias { get; set; }
    public bool HistoricoCompleto { get; set; }
}

public class BlingVendaCelularSyncResult
{
    public bool Ok { get; set; }
    public int PedidosLidos { get; set; }
    public int Importadas { get; set; }
    public int Atualizadas { get; set; }
    public int Ignoradas { get; set; }
    public int SemImei { get; set; }
    public int SemCpf { get; set; }
    public string? Aviso { get; set; }
    public DateTime? ExecutadoEm { get; set; }
}

public static class BlingVendaCelularMapper
{
    public static BlingVendaCelularDto ParaDto(BlingVendaCelularData v) => new()
    {
        Id = v.Id,
        BlingPedidoId = v.BlingPedidoId,
        BlingItemId = v.BlingItemId,
        PedidoNumero = v.PedidoNumero,
        DataVenda = v.DataVenda,
        ClienteNome = v.ClienteNome,
        ClienteCpf = v.ClienteCpf,
        ProdutoCodigo = v.ProdutoCodigo,
        ProdutoNome = v.ProdutoNome,
        CategoriaId = v.CategoriaId,
        CategoriaNome = v.CategoriaNome,
        Tipo = v.Tipo,
        Imei = v.Imei,
        Marca = v.Marca,
        Modelo = v.Modelo,
        Cor = v.Cor,
        Configuracao = v.Configuracao,
        MarcaId = v.MarcaId,
        ModeloId = v.ModeloId,
        ClienteLocalId = v.ClienteLocalId,
        CadastroPendente = v.CadastroPendente,
        Valor = v.Valor,
    };
}
