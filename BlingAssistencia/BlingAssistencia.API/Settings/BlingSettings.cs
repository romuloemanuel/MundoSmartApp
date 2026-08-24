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
}
