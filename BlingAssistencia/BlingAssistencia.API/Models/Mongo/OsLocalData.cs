using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MundoSmart.BlingAssistencia.API.Models.Bling;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

/// <summary>
/// Ordem de serviço armazenada localmente (modo bypass — sem Bling).
/// </summary>
public class OsLocalData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? MongoId { get; set; }

    [BsonElement("blingId")]
    public long BlingId { get; set; }

    [BsonElement("contatoAviso")]
    public ContatoAvisoLocal? ContatoAviso { get; set; }

    [BsonElement("contatoId")]
    public long? ContatoId { get; set; }

    [BsonElement("contatoNome")]
    public string? ContatoNome { get; set; }

    [BsonElement("contatoTelefone")]
    public string? ContatoTelefone { get; set; }

    [BsonElement("contatoCelular")]
    public string? ContatoCelular { get; set; }

    [BsonElement("imei")]
    public string? Imei { get; set; }

    [BsonElement("cpfCnpj")]
    public string? CpfCnpj { get; set; }

    [BsonElement("marcaId")]
    public string? MarcaId { get; set; }

    [BsonElement("marcaNome")]
    public string? MarcaNome { get; set; }

    [BsonElement("modeloId")]
    public string? ModeloId { get; set; }

    [BsonElement("modeloNome")]
    public string? ModeloNome { get; set; }

    [BsonElement("dataEntrada")]
    public DateTime? DataEntrada { get; set; }

    /// <summary>Quando o aparelho chegou na assistência (início do SLA/urgência).</summary>
    [BsonElement("dataInicioAssistencia")]
    public DateTime? DataInicioAssistencia { get; set; }

    /// <summary>Prazo esperado da peça (obrigatório em Aguardando Peça).</summary>
    [BsonElement("dataPrazoPeca")]
    public DateTime? DataPrazoPeca { get; set; }

    /// <summary>Última alteração de situação (base do SLA/urgência).</summary>
    [BsonElement("dataUltimaAlteracaoSituacao")]
    public DateTime? DataUltimaAlteracaoSituacao { get; set; }

    /// <summary>Lista de justificativas de atraso — marca OS em vermelho para avisar o cliente.</summary>
    [BsonElement("justificativasAtraso")]
    public List<JustificativaAtrasoItem> JustificativasAtraso { get; set; } = [];

    /// <summary>Campo legado (texto único). Migrado para JustificativasAtraso na leitura.</summary>
    [BsonElement("justificativaAtraso")]
    public string? JustificativaAtrasoLegado { get; set; }

    [BsonElement("dataPrevistaTermino")]
    public DateTime? DataPrevistaTermino { get; set; }

    [BsonElement("dataAtualizacao")]
    public DateTime? DataAtualizacao { get; set; }

    [BsonElement("dataSaida")]
    public DateTime? DataSaida { get; set; }

    [BsonElement("dataConclusao")]
    public DateTime? DataConclusao { get; set; }

    [BsonElement("data")]
    public DateTime? Data { get; set; }

    [BsonElement("dataPrevista")]
    public DateTime? DataPrevista { get; set; }

    [BsonElement("estadoTela")]
    public string? EstadoTela { get; set; }

    [BsonElement("condicoesAparelho")]
    public string? CondicoesAparelho { get; set; }

    [BsonElement("acessorios")]
    public List<string> Acessorios { get; set; } = [];

    [BsonElement("tecnicoNome")]
    public string? TecnicoNome { get; set; }

    [BsonElement("tecnicoObservacoes")]
    public string? TecnicoObservacoes { get; set; }

    [BsonElement("retorno")]
    public bool Retorno { get; set; }

    /// <summary>Loja de origem do aparelho (MCC, ARCE, SJ, CJR).</summary>
    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    [BsonElement("osOriginalNumero")]
    public string? OsOriginalNumero { get; set; }

    [BsonElement("osOriginalBlingId")]
    public long? OsOriginalBlingId { get; set; }

    [BsonElement("motivoRetorno")]
    public string? MotivoRetorno { get; set; }

    [BsonElement("osNumero")]
    public string? OsNumero { get; set; }

    [BsonElement("tipoPecaProblemaId")]
    public string? TipoPecaProblemaId { get; set; }

    [BsonElement("tipoPecaProblemaNome")]
    public string? TipoPecaProblemaNome { get; set; }

    [BsonElement("tipoServico")]
    public string? TipoServico { get; set; }

    [BsonElement("testeEntrada")]
    public bool TesteEntrada { get; set; }

    [BsonElement("testeSaida")]
    public bool TesteSaida { get; set; }

    [BsonElement("testeEntradaRealizado")]
    public bool TesteEntradaRealizado { get; set; }

    [BsonElement("testeSaidaRealizado")]
    public bool TesteSaidaRealizado { get; set; }

    [BsonElement("defeito")]
    public string? Defeito { get; set; }

    /// <summary>Cliente aceitou risco no reparo.</summary>
    [BsonElement("temRisco")]
    public bool TemRisco { get; set; }

    /// <summary>Descrição do risco acordado com o cliente.</summary>
    [BsonElement("riscoAcordado")]
    public string? RiscoAcordado { get; set; }

    [BsonElement("descricao")]
    public string? Descricao { get; set; }

    [BsonElement("equipamento")]
    public string? Equipamento { get; set; }

    [BsonElement("observacoes")]
    public string? Observacoes { get; set; }

    [BsonElement("valorTotal")]
    public decimal? ValorTotal { get; set; }

    [BsonElement("valorTotalAcordado")]
    public decimal? ValorTotalAcordado { get; set; }

    [BsonElement("formaPagamento")]
    public string? FormaPagamento { get; set; }

    [BsonElement("parcelasPagamento")]
    public int? ParcelasPagamento { get; set; }

    [BsonElement("juros")]
    public decimal? Juros { get; set; }

    [BsonElement("garantiaDias")]
    public int? GarantiaDias { get; set; }

    [BsonElement("itens")]
    public List<BlingOrdemServicoItem> Itens { get; set; } = [];

    [BsonElement("contatoPrincipalIndice")]
    public int? ContatoPrincipalIndice { get; set; }

    [BsonElement("preferenciaContatoSelecionado")]
    public bool PreferenciaContatoSelecionado { get; set; }

    [BsonElement("senhaDispositivoTipo")]
    public string? SenhaDispositivoTipo { get; set; }

    [BsonElement("senhaDispositivo")]
    public string? SenhaDispositivo { get; set; }

    [BsonElement("intakeToken")]
    public string? IntakeToken { get; set; }

    [BsonElement("intakeTokenExpiraEm")]
    public DateTime? IntakeTokenExpiraEm { get; set; }

    [BsonElement("fotosAparelho")]
    public List<OsFotoAparelho> FotosAparelho { get; set; } = [];

    [BsonElement("situacao")]
    public string? Situacao { get; set; }

    [BsonElement("motivoCancelamento")]
    public string? MotivoCancelamento { get; set; }

    [BsonElement("observacoesInternas")]
    public string? ObservacoesInternas { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Soft-delete — permanece no histórico de versões.</summary>
    [BsonElement("excluidoEm")]
    public DateTime? ExcluidoEm { get; set; }

    [BsonElement("excluidoPor")]
    public string? ExcluidoPor { get; set; }
}

public class OsFotoAparelho
{
    [BsonElement("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString("N");

    [BsonElement("nomeArquivo")]
    public string NomeArquivo { get; set; } = string.Empty;

    [BsonElement("url")]
    public string Url { get; set; } = string.Empty;

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>frente | tras | esquerda | direita | cima | baixo | outra</summary>
    [BsonElement("categoria")]
    public string? Categoria { get; set; }

    /// <summary>Texto livre para fotos em "outra" ou detalhe extra</summary>
    [BsonElement("descricaoFoco")]
    public string? DescricaoFoco { get; set; }
}

public class JustificativaAtrasoItem
{
    [BsonElement("texto")]
    public string Texto { get; set; } = string.Empty;

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}

public class ContatoAvisoLocal
{
    [BsonElement("nome")]
    public string? Nome { get; set; }

    [BsonElement("telefone")]
    public string? Telefone { get; set; }

    [BsonElement("celular")]
    public string? Celular { get; set; }

    [BsonElement("parentesco")]
    public string? Parentesco { get; set; }

    /// <summary>True = autorizado a retirar o aparelho além do proprietário.</summary>
    [BsonElement("autorizadoRetirada")]
    public bool AutorizadoRetirada { get; set; } = true;
}
