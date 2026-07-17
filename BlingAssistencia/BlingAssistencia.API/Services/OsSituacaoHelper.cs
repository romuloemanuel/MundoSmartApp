using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Config;

namespace MundoSmart.BlingAssistencia.API.Services;

public static class OsSituacaoHelper
{
    public const string Aberto = "Aberto";
    public const string EmTransporte = "Em transporte";
    /// <summary>Aparelho na oficina — a partir daqui o SLA/urgência começa a contar.</summary>
    public const string NaAssistencia = "Na assistência";
    /// <summary>Compatibilidade com situação antiga.</summary>
    public const string EmAndamento = NaAssistencia;
    /// <summary>Serviço em teste / QA — exige técnico responsável.</summary>
    public const string EmTeste = "Em teste";
    /// <summary>Aguardando peça externa — exige prazo.</summary>
    public const string AguardandoPeca = "Aguardando Peça";
    public const string AguardandoAprovacao = "Aguardando aprovação do cliente";
    /// <summary>Aparelho pronto aguardando retorno à loja de origem — exige técnico.</summary>
    public const string AguardandoRetornoLoja = "Aguardando Retorno a Loja";
    /// <summary>Serviço pronto — aguardando o cliente retirar o aparelho.</summary>
    public const string AguardandoCliente = "Aguardando Cliente Retirar";
    public const string Cancelado = "Cancelado";
    public const string Concluido = "Concluído";

    public const string AguardandoAprovacaoCliente = AguardandoAprovacao;

    /// <summary>Dias padrão do prazo ao entrar em Aguardando Peça sem data informada.</summary>
    public const int PrazoAguardandoPecaDiasPadrao = 3;

    public static readonly string[] SituacoesPreAssistencia = [Aberto, EmTransporte];

    /// <summary>Situações que exigem técnico responsável cadastrado.</summary>
    public static readonly string[] SituacoesExigemTecnico =
    [
        EmTeste,
        AguardandoRetornoLoja,
        AguardandoCliente,
        Cancelado,
        Concluido
    ];

    public static readonly string[] SituacoesValidas =
    [
        Aberto,
        EmTransporte,
        NaAssistencia,
        EmTeste,
        AguardandoPeca,
        AguardandoAprovacao,
        AguardandoRetornoLoja,
        AguardandoCliente,
        Cancelado,
        Concluido
    ];

    private static readonly DateTime LimiteMinimo = new(2000, 1, 1);

    public static string Normalizar(string? situacao)
    {
        var raw = situacao?.Trim();
        if (string.IsNullOrEmpty(raw)) return Aberto;

        var chave = raw.ToLowerInvariant();
        return chave switch
        {
            "em aberto" or "aberto" => Aberto,
            "em transporte" or "transporte" => EmTransporte,
            "em andamento" or "na assistencia" or "na assistência" or "assistencia" or "assistência" => NaAssistencia,
            "em teste" or "teste" => EmTeste,
            "aguardando peca" or "aguardando peça" => AguardandoPeca,
            "aguardando aprovacao do cliente" or "aguardando aprovação do cliente" => AguardandoAprovacao,
            "aguardando retorno a loja" or "aguardando retorno à loja" or "aguardando retorno loja" or "retorno a loja" => AguardandoRetornoLoja,
            "aguardando cliente" or "aguardando cliente retirar" or "aguardando retirada" => AguardandoCliente,
            "cancelada" or "cancelado" => Cancelado,
            "concluida" or "concluída" or "concluido" or "concluído" => Concluido,
            _ => SituacoesValidas.Contains(raw, StringComparer.OrdinalIgnoreCase) ? raw : raw
        };
    }

    public static string SituacaoPadraoPorLoja(string? _lojaOrigem) => Aberto;

    public static bool EhPreAssistencia(string? situacao)
    {
        var s = Normalizar(situacao);
        return SituacoesPreAssistencia.Contains(s, StringComparer.OrdinalIgnoreCase);
    }

    public static bool EhNaAssistencia(string? situacao) =>
        string.Equals(Normalizar(situacao), NaAssistencia, StringComparison.OrdinalIgnoreCase);

    public static bool EhAguardandoPeca(string? situacao) =>
        string.Equals(Normalizar(situacao), AguardandoPeca, StringComparison.OrdinalIgnoreCase);

    public static bool ExigeTecnico(string? situacao)
    {
        var s = Normalizar(situacao);
        return SituacoesExigemTecnico.Contains(s, StringComparer.OrdinalIgnoreCase);
    }

    public static string AjustarParaLoja(string? situacao, string? _lojaOrigem) =>
        string.IsNullOrWhiteSpace(situacao) ? Aberto : Normalizar(situacao);

    public static void ValidarSituacaoPorLoja(string? _situacao, string? _lojaOrigem)
    {
        // Todas as lojas podem usar qualquer situação válida (padrão: Aberto).
    }

    public static void ValidarPrazoPeca(string? situacao, DateTime? dataPrazoPeca)
    {
        if (!EhAguardandoPeca(situacao)) return;
        if (!DataUtilValida(dataPrazoPeca))
            throw new ArgumentException("Informe o prazo de chegada da peça.");
    }

    public static bool EhConcluida(string? situacao) =>
        string.Equals(Normalizar(situacao), Concluido, StringComparison.OrdinalIgnoreCase);

    public static bool EhCancelada(string? situacao) =>
        string.Equals(Normalizar(situacao), Cancelado, StringComparison.OrdinalIgnoreCase);

    public static bool EhFinalizada(string? situacao) =>
        EhConcluida(situacao) || EhCancelada(situacao);

    /// <summary>
    /// Valores canônicos + legado (Concluída/Cancelada) para filtros Mongo Nin.
    /// Prefira <see cref="EhFinalizada"/> em memória quando possível.
    /// </summary>
    public static readonly string[] SituacoesFinalizadasAliases =
    [
        Concluido,
        "Concluida",
        "Concluída",
        Cancelado,
        "Cancelada",
    ];

    public static void ValidarMotivoCancelamento(string? situacao, string? motivoCancelamento)
    {
        if (!EhCancelada(situacao)) return;
        if (string.IsNullOrWhiteSpace(motivoCancelamento))
            throw new ArgumentException("Informe o motivo do cancelamento.");
    }

    public static bool DataUtilValida(DateTime? data) =>
        data is { } d && d >= LimiteMinimo;

    /// <summary>
    /// Atualiza datas por situação: início do SLA na assistência, prazo de peça e conclusão/saída.
    /// Urgência vermelha conta a partir da última alteração de status (ou da OS).
    /// </summary>
    public static void AplicarDatasPorSituacao(OsLocalData local, string? situacaoAnterior = null)
    {
        var agora = HorarioBrasil.Agora;
        local.DataAtualizacao = agora;
        local.Situacao = AjustarParaLoja(local.Situacao, local.LojaOrigem);

        var situacaoMudou = !string.Equals(
            Normalizar(situacaoAnterior),
            local.Situacao,
            StringComparison.OrdinalIgnoreCase);

        if (situacaoMudou || !DataUtilValida(local.DataUltimaAlteracaoSituacao))
            local.DataUltimaAlteracaoSituacao = agora;

        // Nova fase: limpa justificativas de atraso (vermelho "avisar cliente").
        if (situacaoMudou && !string.IsNullOrWhiteSpace(situacaoAnterior))
        {
            local.JustificativasAtraso = [];
            local.JustificativaAtrasoLegado = null;
        }

        // Tempo de urgência só começa em "Na assistência".
        if (EhNaAssistencia(local.Situacao) && !DataUtilValida(local.DataInicioAssistencia))
            local.DataInicioAssistencia = agora;

        if (EhAguardandoPeca(local.Situacao) && !DataUtilValida(local.DataPrazoPeca))
            local.DataPrazoPeca = agora.AddDays(PrazoAguardandoPecaDiasPadrao);

        if (!EhConcluida(local.Situacao)) return;

        var virouConcluida = !EhConcluida(situacaoAnterior);

        if (virouConcluida || !DataUtilValida(local.DataConclusao))
            local.DataConclusao = agora;

        if (virouConcluida || !DataUtilValida(local.DataSaida))
            local.DataSaida = agora;
    }

    public static void ValidarJustificativaAtraso(string? justificativa)
    {
        if (string.IsNullOrWhiteSpace(justificativa))
            throw new ArgumentException("Informe a justificativa do atraso.");
        if (justificativa.Trim().Length < 5)
            throw new ArgumentException("A justificativa do atraso deve ter ao menos 5 caracteres.");
    }

    public static DateTime? NormalizarDataEntrada(DateTime? valor, DateTime? fallback = null) =>
        DataUtilValida(valor) ? valor : fallback;
}
