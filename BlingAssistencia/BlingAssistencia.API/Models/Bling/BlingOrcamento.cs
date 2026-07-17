namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class BlingOrcamento
{
    public long? Id { get; set; }
    public string? Numero { get; set; }
    public string? Situacao { get; set; }
    public DateTime? Data { get; set; }
    /// <summary>Validade padrão: 7 dias úteis a partir da data.</summary>
    public DateTime? Validade { get; set; }
    public BlingContatoRef? Contato { get; set; }
    /// <summary>Loja de origem (MCC = Mococa/assistência, ARCE, SJ, CJR).</summary>
    public string? LojaOrigem { get; set; }
    /// <summary>whatsapp_internet | atendimento_local</summary>
    public string? TipoContato { get; set; }
    /// <summary>Motivo de o cliente não trazer o aparelho agora.</summary>
    public string? JustificativaAguardo { get; set; }
    /// <summary>Dia combinado para retomar contato / mandar mensagem (ex.: virada do cartão).</summary>
    public DateTime? DataRetornoMensagem { get; set; }
    public string? Observacoes { get; set; }
    public decimal? ValorTotal { get; set; }
    /// <summary>Soma dos valores desejados dos itens (sempre recalculado).</summary>
    public decimal? ValorTotalAcordado { get; set; }
    /// <summary>Opção de pagamento à vista oferecida ao cliente.</summary>
    public decimal? ValorAVista { get; set; }
    /// <summary>Opção de pagamento a prazo oferecida ao cliente.</summary>
    public decimal? ValorAPrazo { get; set; }
    /// <summary>avista | parcelado — legado; preferência na conversão para OS.</summary>
    public string? FormaPagamento { get; set; }
    /// <summary>Quantidade de parcelas da opção a prazo.</summary>
    public int? ParcelasPagamento { get; set; }
    public string? MarcaId { get; set; }
    public string? MarcaNome { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    public string? Equipamento { get; set; }
    /// <summary>OS gerada a partir deste orçamento.</summary>
    public long? OsGeradaBlingId { get; set; }
    public string? OsGeradaNumero { get; set; }
    public List<BlingOrcamentoItem>? Itens { get; set; }
}

public class BlingOrcamentoItem
{
    public long? Id { get; set; }
    public string? Descricao { get; set; }
    public decimal Quantidade { get; set; }
    public decimal ValorUnitario { get; set; }
    public decimal? Desconto { get; set; }
    /// <summary>servico | peca — pré-orçamento usa serviço (não reserva estoque).</summary>
    public string? TipoItem { get; set; }
    /// <summary>Referência do catálogo do modelo (valores). Não implica reserva de peça.</summary>
    public string? PecaId { get; set; }
    /// <summary>Variação/procedimento do serviço (ex.: Tela OLED / Incell).</summary>
    public string? VariacaoRotulo { get; set; }
    public decimal? ValorSugeridoMinimo { get; set; }
    public decimal? ValorSugeridoTroca { get; set; }
    /// <summary>Valor desejado/combinado nesta linha.</summary>
    public decimal? ValorAcontado { get; set; }
    /// <summary>Valor orçado/oferecido em outra assistência (referência).</summary>
    public decimal? ValorOutraAssistencia { get; set; }
    /// <summary>real | percentual — tipo do acréscimo sobre a outra assistência.</summary>
    public string? AcrescimoOutraAssistenciaTipo { get; set; }
    /// <summary>Valor do acréscimo (R$ ou % conforme o tipo).</summary>
    public decimal? AcrescimoOutraAssistenciaValor { get; set; }
}
