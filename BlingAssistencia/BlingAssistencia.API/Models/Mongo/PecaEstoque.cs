using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public class PecaEstoque
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    /// <summary>Nome da peça — ex: Tela, Conector de Carga, Bateria.</summary>
    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("descricao")]
    public string? Descricao { get; set; }

    [BsonElement("quantidadeEstoque")]
    public int QuantidadeEstoque { get; set; }

    /// <summary>Valor sugerido para troca da peça (com parcelamento).</summary>
    [BsonElement("valorSugeridoTroca")]
    public decimal? ValorSugeridoTroca { get; set; }

    /// <summary>Valor sugerido mínimo aceitável para o serviço.</summary>
    [BsonElement("valorSugeridoMinimo")]
    public decimal? ValorSugeridoMinimo { get; set; }

    /// <summary>Quantidade máxima de parcelas para o valor de troca.</summary>
    [BsonElement("parcelamento")]
    public int? Parcelamento { get; set; }

    /// <summary>Marca/fabricante da peça de reposição — ex: Dimonds, Skytech.</summary>
    [BsonElement("marcaPeca")]
    public string? MarcaPeca { get; set; }

    /// <summary>Período de garantia — ex: "6 meses", "2 anos".</summary>
    [BsonElement("garantia")]
    public string? Garantia { get; set; }

    /// <summary>Categoria para agrupamento — Tela, Bateria, Conector...</summary>
    [BsonElement("categoria")]
    public string? Categoria { get; set; }

    /// <summary>Modelos de aparelho que utilizam esta peça.</summary>
    [BsonElement("modelosCompativeis")]
    public List<ModeloCompativel> ModelosCompativeis { get; set; } = [];

    /// <summary>Procedimentos de execução na troca (ex: com/sem programação, troca de CI) — não são produtos diferentes.</summary>
    [BsonElement("variacoes")]
    public List<VariacaoServico> Variacoes { get; set; } = [];

    /// <summary>False = peça só via fornecedor externo (não repõe estoque da loja).</summary>
    [BsonElement("estoqueNaLoja")]
    public bool EstoqueNaLoja { get; set; } = true;

    /// <summary>
    /// True = não gera alerta de falta/estoque baixo (aparelho obsoleto / fora de linha).
    /// </summary>
    [BsonElement("ignorarAlertaEstoque")]
    public bool IgnorarAlertaEstoque { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}

public class VariacaoServico
{
    [BsonElement("rotulo")]
    public string Rotulo { get; set; } = string.Empty;

    /// <summary>Texto curto para tooltip — ex: "Sem mensagem de bateria não original".</summary>
    [BsonElement("detalhe")]
    public string? Detalhe { get; set; }

    [BsonElement("valorSugeridoTroca")]
    public decimal? ValorSugeridoTroca { get; set; }

    [BsonElement("valorSugeridoMinimo")]
    public decimal? ValorSugeridoMinimo { get; set; }

    [BsonElement("garantia")]
    public string? Garantia { get; set; }

    [BsonElement("ordem")]
    public int Ordem { get; set; }
}

public class ModeloCompativel
{
    [BsonElement("modeloId")]
    public string ModeloId { get; set; } = string.Empty;

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("marcaNome")]
    public string? MarcaNome { get; set; }

    /// <summary>Override do valor sugerido para este modelo (vazio = usa o global da peça).</summary>
    [BsonElement("valorSugeridoTroca")]
    public decimal? ValorSugeridoTroca { get; set; }

    /// <summary>Override do valor mínimo para este modelo (vazio = usa o global da peça).</summary>
    [BsonElement("valorSugeridoMinimo")]
    public decimal? ValorSugeridoMinimo { get; set; }

    /// <summary>Cores e quantidades por modelo (ex.: Tampa traseira Preto/Branco).</summary>
    [BsonElement("cores")]
    public List<CorEstoqueModelo> Cores { get; set; } = [];
}

/// <summary>Estoque de uma cor específica vinculada a um modelo compatível.</summary>
public class CorEstoqueModelo
{
    [BsonElement("cor")]
    public string Cor { get; set; } = string.Empty;

    [BsonElement("quantidade")]
    public int Quantidade { get; set; }
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

public class DisponibilidadePecaResponse
{
    public string PecaId { get; set; } = string.Empty;
    public string PecaNome { get; set; } = string.Empty;
    public string? Descricao { get; set; }
    public int QuantidadeEstoque { get; set; }
    public int EmExecucao { get; set; }
    public int Disponiveis { get; set; }
    public decimal? ValorSugeridoTroca { get; set; }
    public decimal? ValorSugeridoMinimo { get; set; }
    public int? Parcelamento { get; set; }

    /// <summary>True quando Disponiveis é <= 1 — exige atenção do colaborador.</summary>
    public bool Alerta { get; set; }

    /// <summary>Nível do estoque físico: verde, amarelo, laranja, vermelho.</summary>
    public string NivelEstoque { get; set; } = "vermelho";

    /// <summary>Nível do saldo disponível (estoque − em serviço).</summary>
    public string NivelDisponivel { get; set; } = "vermelho";

    public List<string> ModelosCompativeis { get; set; } = [];
    public List<OsExecucaoInfo> OsEmExecucao { get; set; } = [];
}

public class OsExecucaoInfo
{
    public long BlingId { get; set; }
    public string? OsNumero { get; set; }
    public string? ModeloNome { get; set; }
    public string? MarcaNome { get; set; }
}

// ── Painel de referência do modelo ────────────────────────────────────────────

/// <summary>Valores para orçamento rápido — consulta leve (só peças do modelo).</summary>
public class ModeloServicosValoresResponse
{
    public List<PecaValorInfo> Pecas { get; set; } = [];
}

public class PecaValorInfo
{
    public string PecaId { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string? MarcaPeca { get; set; }
    public decimal? ValorSugeridoTroca { get; set; }
    public decimal? ValorSugeridoMinimo { get; set; }
    public int? Parcelamento { get; set; }
    public string? Garantia { get; set; }
    public int QuantidadeEstoque { get; set; }
    public string NivelEstoque { get; set; } = "vermelho";
    public List<VariacaoServicoInfo> Variacoes { get; set; } = [];
    public List<CorEstoqueModelo> Cores { get; set; } = [];
}

public class VariacaoServicoInfo
{
    public string Rotulo { get; set; } = string.Empty;
    public string? Detalhe { get; set; }
    public decimal? ValorSugeridoTroca { get; set; }
    public decimal? ValorSugeridoMinimo { get; set; }
    public string? Garantia { get; set; }
    public int Ordem { get; set; }
}

/// <summary>Fila na assistência e alertas operacionais.</summary>
public class ModeloOperacaoResponse
{
    public string? MarcaNome { get; set; }
    public string? ModeloNome { get; set; }
    public int OsAbertasHoje { get; set; }
    public int OsModeloEmAssistencia { get; set; }
    public List<OsEmAndamentoInfo> OsEmAndamento { get; set; } = [];
    public List<PecaEstoqueOperacaoInfo> PecasResumo { get; set; } = [];
    public List<AlertaOperacionalInfo> Alertas { get; set; } = [];
}

public class PecaEstoqueOperacaoInfo
{
    public string PecaId { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public int QuantidadeEstoque { get; set; }
    public int EmExecucao { get; set; }
    public int Disponiveis { get; set; }
    public bool Alerta { get; set; }
    public bool IgnorarAlertaEstoque { get; set; }
    public string? NivelDisponivel { get; set; }
}

public class ModeloReferenciaResponse
{
    public string? MarcaNome { get; set; }
    public string? ModeloNome { get; set; }
    public List<OsEmAndamentoInfo> OsEmAndamento { get; set; } = [];
    public List<PecaReferenciaInfo> Pecas { get; set; } = [];
    public List<AlertaOperacionalInfo> Alertas { get; set; } = [];
}

public class AlertaOperacionalInfo
{
    public string Tipo { get; set; } = string.Empty;
    public string Severidade { get; set; } = "aviso";
    public string Titulo { get; set; } = string.Empty;
    public string Mensagem { get; set; } = string.Empty;
    public string? PecaNome { get; set; }
    public bool RelacionadoTela { get; set; }
}

public class OsEmAndamentoInfo
{
    public long BlingId { get; set; }
    public string? OsNumero { get; set; }
    public string? Situacao { get; set; }
    public string? TipoPecaProblemaNome { get; set; }
    public string? Defeito { get; set; }
    public string? EstadoTela { get; set; }
    public DateTime? DataEntrada { get; set; }
    public DateTime? DataPrevistaTermino { get; set; }
}

public class PecaReferenciaInfo
{
    public string PecaId { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string? MarcaPeca { get; set; }
    public decimal? ValorSugeridoTroca { get; set; }
    public decimal? ValorSugeridoMinimo { get; set; }
    public int? Parcelamento { get; set; }
    public string? Garantia { get; set; }
    public string? Descricao { get; set; }
    public int QuantidadeEstoque { get; set; }
    public int EmExecucao { get; set; }
    public int Disponiveis { get; set; }
    public bool TemEstoque { get; set; }
    public bool Alerta { get; set; }
    public string NivelEstoque { get; set; } = "vermelho";
    public string? NivelDisponivel { get; set; }
}
