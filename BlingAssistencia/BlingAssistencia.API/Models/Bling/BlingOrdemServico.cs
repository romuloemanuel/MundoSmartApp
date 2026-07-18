namespace MundoSmart.BlingAssistencia.API.Models.Bling;

public class BlingOrdemServico
{
    public long? Id { get; set; }
    public string? Numero { get; set; }
    public string? Situacao { get; set; }
    public string? MotivoCancelamento { get; set; }
    public DateTime? Data { get; set; }
    public DateTime? DataPrevista { get; set; }
    public DateTime? DataAtualizacao { get; set; }
    public DateTime? DataConclusao { get; set; }
    public BlingContatoRef? Contato { get; set; }
    public BlingContatoRef? ContatoAviso { get; set; }
    public string? Descricao { get; set; }
    public string? Equipamento { get; set; }
    public string? NumeroSerie { get; set; }
    public string? Imei { get; set; }
    public string? CpfCnpj { get; set; }
    public string? Defeito { get; set; }
    /// <summary>Cliente aceitou risco no reparo.</summary>
    public bool TemRisco { get; set; }
    /// <summary>Descrição do risco acordado (obrigatório se TemRisco).</summary>
    public string? RiscoAcordado { get; set; }
    public string? Observacoes { get; set; }
    public decimal? ValorTotal { get; set; }
    /// <summary>Valor total acordado com o cliente (pode diferir da soma dos itens).</summary>
    public decimal? ValorTotalAcordado { get; set; }
  /// <summary>dinheiro | pix | debito | credito_vista | credito_parcelado | na_retirada | a_combinar</summary>
    public string? FormaPagamento { get; set; }
    public int? ParcelasPagamento { get; set; }
    /// <summary>Juros/taxas do pagamento (ex.: cartão). Usado na base de comissão.</summary>
    public decimal? Juros { get; set; }
    public bool? Retorno { get; set; }
    public string? MotivoRetorno { get; set; }
    public string? ObservacoesInternas { get; set; }
    /// <summary>Loja de origem: MCC | ARCE | SJ | CJR</summary>
    public string? LojaOrigem { get; set; }
    public List<BlingOrdemServicoItem>? Itens { get; set; }

    // ── Campos locais (MongoDB) ───────────────────────────────────────────────
    public string? MarcaId { get; set; }
    public string? MarcaNome { get; set; }
    public string? ModeloId { get; set; }
    public string? ModeloNome { get; set; }
    public DateTime? DataEntrada { get; set; }
    /// <summary>Quando o aparelho chegou na assistência (início do SLA/urgência).</summary>
    public DateTime? DataInicioAssistencia { get; set; }
    /// <summary>Prazo esperado da peça (obrigatório em Aguardando Peça).</summary>
    public DateTime? DataPrazoPeca { get; set; }
    /// <summary>Última alteração de situação (base do SLA/urgência).</summary>
    public DateTime? DataUltimaAlteracaoSituacao { get; set; }
    /// <summary>Lista de justificativas de atraso — marca OS em vermelho para avisar o cliente.</summary>
    public List<JustificativaAtrasoItem>? JustificativasAtraso { get; set; }
    public DateTime? DataPrevistaTermino { get; set; }
    public DateTime? DataSaida { get; set; }
    public string? EstadoTela { get; set; }
    public string? CondicoesAparelho { get; set; }
    public List<string>? Acessorios { get; set; }
    public string? TecnicoNome { get; set; }
    public string? TecnicoObservacoes { get; set; }
    public string? OsOriginalNumero { get; set; }
    public long? OsOriginalBlingId { get; set; }
    public string? TipoPecaProblemaId { get; set; }
    public string? TipoPecaProblemaNome { get; set; }
    /// <summary>reparo | orcamento | garantia | troca_peca | software | limpeza | devolucao</summary>
    public string? TipoServico { get; set; }
    public bool TesteEntrada { get; set; }
    public bool TesteSaida { get; set; }
    public bool TesteEntradaRealizado { get; set; }
    public bool TesteSaidaRealizado { get; set; }
    public int? ContatoPrincipalIndice { get; set; }
    public bool PreferenciaContatoSelecionado { get; set; }
    /// <summary>numerica | desenho | nao_deixou | sem_senha — senha para teste do aparelho.</summary>
    public string? SenhaDispositivoTipo { get; set; }
    /// <summary>PIN/senha alfanumérica, índices do desenho, ou marcadores sem_senha/nao_deixou.</summary>
    public string? SenhaDispositivo { get; set; }
    /// <summary>Prazo de garantia acordado com o cliente, em dias.</summary>
    public int? GarantiaDias { get; set; }
    public List<OsFotoAparelhoInfo>? FotosAparelho { get; set; }
}

public class OsFotoAparelhoInfo
{
    public string Id { get; set; } = string.Empty;
    public string NomeArquivo { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime? CriadoEm { get; set; }
    public string? Categoria { get; set; }
    public string? DescricaoFoco { get; set; }
}

public class BlingContatoRef
{
    public long Id { get; set; }
    public string? Nome { get; set; }
    public string? Telefone { get; set; }
    public string? Celular { get; set; }
    public string? Parentesco { get; set; }
    /// <summary>True = autorizado a retirar o aparelho além do proprietário.</summary>
    public bool? AutorizadoRetirada { get; set; }
}

public class BlingOrdemServicoItem
{
    public long? Id { get; set; }
    public string? Descricao { get; set; }
    public decimal Quantidade { get; set; }
    public decimal ValorUnitario { get; set; }
    /// <summary>peca | servico — serviço/mão de obra sem vínculo ao catálogo.</summary>
    public string? TipoItem { get; set; }
    /// <summary>Id da peça cadastrada (pecas_estoque).</summary>
    public string? PecaId { get; set; }
    public string? MarcaPeca { get; set; }
    /// <summary>Quantidade já baixada do estoque para esta linha.</summary>
    public decimal QuantidadeEstoqueBaixada { get; set; }
    /// <summary>Referência do catálogo — valor mínimo.</summary>
    public decimal? ValorSugeridoMinimo { get; set; }
    /// <summary>Referência do catálogo — valor sugerido.</summary>
    public decimal? ValorSugeridoTroca { get; set; }
    /// <summary>Valor acordado com o cliente nesta OS (preço total — peça + serviço).</summary>
    public decimal? ValorAcontado { get; set; }
    /// <summary>Valor orçado/oferecido em outra assistência (referência).</summary>
    public decimal? ValorOutraAssistencia { get; set; }
    /// <summary>real | percentual — tipo do acréscimo sobre a outra assistência.</summary>
    public string? AcrescimoOutraAssistenciaTipo { get; set; }
    /// <summary>Valor do acréscimo (R$ ou % conforme o tipo).</summary>
    public decimal? AcrescimoOutraAssistenciaValor { get; set; }
    /// <summary>Variação escolhida — ex: Calibrada, Com programação.</summary>
    public string? VariacaoRotulo { get; set; }
    /// <summary>Cor escolhida (Tampa traseira) — estoque por modelo + cor.</summary>
    public string? Cor { get; set; }
    /// <summary>Custo da peça (lote FIFO na baixa; antes disso, referência do estoque).</summary>
    public decimal? CustoPeca { get; set; }
    public int? Parcelamento { get; set; }
    /// <summary>estoque | externo — de onde veio a peça usada no serviço.</summary>
    public string? OrigemPeca { get; set; }
    /// <summary>carlos | paulo | vic | mercado_livre | shopee</summary>
    public string? FornecedorExterno { get; set; }
    public string? CodigoRastreio { get; set; }
    /// <summary>Salvar OS mesmo sem estoque; indica que a baixa não foi feita.</summary>
    public bool EstoqueInsuficiente { get; set; }
}

public class JustificativaAtrasoItem
{
    public string Texto { get; set; } = string.Empty;
    public DateTime? CriadoEm { get; set; }
}
