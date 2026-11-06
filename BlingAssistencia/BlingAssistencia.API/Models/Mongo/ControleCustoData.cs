using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class ControleCustoColaboradorData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("nome")]
    public string Nome { get; set; } = "";

    /// <summary>Função no setor, como Gerente ou Diretor.</summary>
    [BsonElement("cargo")]
    public string? Cargo { get; set; }

    [BsonElement("setores")]
    public List<string> Setores { get; set; } = [];

    [BsonElement("ativo")]
    public bool Ativo { get; set; } = true;

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class ControleCustoRateio
{
    [BsonElement("setor")]
    public string Setor { get; set; } = "";

    [BsonElement("percentual")]
    public decimal Percentual { get; set; }
}

public class ControleCustoLancamentoData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>Mês de referência, no formato yyyy-MM.</summary>
    [BsonElement("competencia")]
    public string Competencia { get; set; } = "";

    /// <summary>faturamento, custo ou reinvestimento.</summary>
    [BsonElement("tipo")]
    public string Tipo { get; set; } = "";

    [BsonElement("categoria")]
    public string? Categoria { get; set; }

    [BsonElement("colaboradorId")]
    public string? ColaboradorId { get; set; }

    [BsonElement("colaboradorNome")]
    public string? ColaboradorNome { get; set; }

    [BsonElement("descricao")]
    public string Descricao { get; set; } = "";

    [BsonElement("valor")]
    public decimal Valor { get; set; }

    /// <summary>unico, fixo, mensal, parcelado ou anual. Ausente equivale a único.</summary>
    [BsonElement("recorrencia")]
    public string Recorrencia { get; set; } = "unico";

    /// <summary>Meses da série mensal ou parcelada, ou anos da série anual.</summary>
    [BsonElement("meses")]
    public int? Meses { get; set; }

    [BsonIgnore]
    public decimal ValorNoMes { get; set; }

    [BsonIgnore]
    public int? Parcela { get; set; }

    [BsonIgnore]
    public int? TotalParcelas { get; set; }

    /// <summary>Setor único de faturamento e reinvestimento.</summary>
    [BsonElement("setor")]
    public string? Setor { get; set; }

    [BsonElement("rateio")]
    public List<ControleCustoRateio> Rateio { get; set; } = [];

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class ControleCustoSetorResumo
{
    public string Id { get; set; } = "";
    public string Nome { get; set; } = "";
    /// <summary>De onde veio o lucro líquido do mês.</summary>
    public string Origem { get; set; } = "";
    /// <summary>Lucro líquido do cenário: venda menos o custo do produto.</summary>
    public decimal Faturamento { get; set; }
    public decimal Custos { get; set; }
    public decimal Lucro { get; set; }
    public decimal Reinvestimento { get; set; }
    public decimal Disponivel { get; set; }
}

public class ControleCustoPainel
{
    public string Competencia { get; set; } = "";
    public List<ControleCustoSetorResumo> Setores { get; set; } = [];
    public List<ControleCustoColaboradorData> Colaboradores { get; set; } = [];
    public List<ControleCustoLancamentoData> Custos { get; set; } = [];
    public List<ControleCustoLancamentoData> Reinvestimentos { get; set; } = [];
    public decimal Faturamento { get; set; }
    public decimal CustosTotal { get; set; }
    public decimal Lucro { get; set; }
    public decimal Reinvestimento { get; set; }
    public decimal Disponivel { get; set; }
}

public class ControleCustoComparativo
{
    public string Ate { get; set; } = "";
    public List<string> Meses { get; set; } = [];
    public List<ControleCustoComparativoLinha> Linhas { get; set; } = [];
}

public class ControleCustoComparativoLinha
{
    public string Id { get; set; } = "";
    public string Nome { get; set; } = "";
    /// <summary>total, categoria ou setor.</summary>
    public string Grupo { get; set; } = "";
    public List<decimal> Valores { get; set; } = [];
}
