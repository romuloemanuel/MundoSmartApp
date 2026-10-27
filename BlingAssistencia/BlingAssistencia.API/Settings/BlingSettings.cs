namespace MundoSmart.BlingAssistencia.API.Settings;

public class BlingSettings
{
    /// <summary>
    /// Quando true (padrão), clientes / OS / orçamentos NÃO usam a API Bling — só Mongo local.
    /// OAuth + consulta de produtos/capinhas pode existir em paralelo.
    /// </summary>
    public bool ModoLocal { get; set; } = true;

    /// <summary>
    /// Reserva para integração ampla Bling (contatos/OS). Manter false enquanto só consultamos capinhas.
    /// </summary>
    public bool Habilitado { get; set; } = false;

    /// <summary>OAuth + GET produtos/estoques para consulta de capinhas (única integração ativa agora).</summary>
    public bool ConsultaProdutosHabilitada { get; set; } = false;

    /// <summary>
    /// Intervalo do sync Bling → Mongo em background (consulta do balcão lê só o cache).
    /// Padrão 15 min — saldo razoável sem estourar rate limit.
    /// </summary>
    public int ConsultaProdutosSyncMinutos { get; set; } = 15;

    /// <summary>
    /// Id do campo customizado Bling «Permite Personalização» (opcional).
    /// Se 0, a API tenta descobrir pelo nome do campo.
    /// </summary>
    public long IdCampoPermitePersonalizacao { get; set; }

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = string.Empty;
    public bool ExigirAutenticacao { get; set; } = false;

    /// <summary>Importa diariamente vendas de celular do Bling (IMEI + CPF → desconto na OS).</summary>
    public bool VendasCelularesHabilitada { get; set; } = true;

    /// <summary>Ids Bling da(s) categoria(s), separados por vírgula. Opcional se houver descrição.</summary>
    public string VendasCelularesCategoriaIds { get; set; } = string.Empty;

    /// <summary>Descrições da categoria (ex.: Celular, Smartphones). Casa por contém, sem acento.</summary>
    public string VendasCelularesCategoriaDescricoes { get; set; } = "Celular,Celulares,Smartphone";

    /// <summary>Percentual de desconto na manutenção quando IMEI + CPF coincidem.</summary>
    public decimal VendasCelularesDescontoPercentual { get; set; } = 10;

    /// <summary>Dias para reler no job diário (cobre falha de um dia).</summary>
    public int VendasCelularesDiasLookback { get; set; } = 3;

    /// <summary>Janela da primeira importação (ou sync manual «histórico»).</summary>
    public int VendasCelularesDiasHistoricoInicial { get; set; } = 60;

    /// <summary>Hora de Brasília em que o job diário pode rodar (0–23).</summary>
    public int VendasCelularesSyncHora { get; set; } = 6;

    public string VendasCelularesPalavrasUsado { get; set; } = "usado,seminovo,semi-novo,semi novo";
    public string VendasCelularesPalavrasIphone { get; set; } = "iphone";
    public DateTime? VendasCelularesUltimaSyncEm { get; set; }
    public string? VendasCelularesUltimoAviso { get; set; }
}
