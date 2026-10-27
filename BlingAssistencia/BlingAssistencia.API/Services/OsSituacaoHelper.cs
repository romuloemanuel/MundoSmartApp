using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MongoDB.Bson;
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
    /// <summary>Cliente já retirou o aparelho e o pagamento ainda está pendente.</summary>
    public const string RetiradoAguardandoPagamento = "Retirado aguardando pagamento";
    /// <summary>Reparo especializado de placa. Fora do filtro padrão; técnico fixo Rômulo.</summary>
    public const string ReparoAvancadoPlaca = "Reparo avançado em placa";
    public const string TecnicoReparoAvancadoPlaca = "Rômulo";
    /// <summary>Aparelho da loja Mundo Smart, sem prioridade. Fora do filtro padrão.</summary>
    public const string CelularDaLoja = "Celular da loja";
    public const string Cancelado = "Cancelado";
    public const string Concluido = "Concluído";

    /// <summary>Sentinela do filtro de lista: em andamento, sem Concluído, Cancelado, placa e celular da loja.</summary>
    public const string FiltroExcetoConcluido = "__exceto_concluido__";

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
        ReparoAvancadoPlaca,
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
        RetiradoAguardandoPagamento,
        ReparoAvancadoPlaca,
        CelularDaLoja,
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
            "retirado aguardando pagamento" or "retirado aguardando pagto" => RetiradoAguardandoPagamento,
            "reparo avançado em placa" or "reparo avancado em placa" or "reparo em placa" => ReparoAvancadoPlaca,
            "celular da loja" or "celular loja" or "sem prioridade" => CelularDaLoja,
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

    public static bool EhReparoAvancadoPlaca(string? situacao) =>
        string.Equals(Normalizar(situacao), ReparoAvancadoPlaca, StringComparison.OrdinalIgnoreCase);

    public static bool EhCelularDaLoja(string? situacao) =>
        string.Equals(Normalizar(situacao), CelularDaLoja, StringComparison.OrdinalIgnoreCase);

    /// <summary>Cadastro da própria loja, não um cliente externo.</summary>
    public static bool ClienteEhLojaMundoSmart(string? nome)
    {
        var n = SemAcento(nome).Trim();
        return n.Equals("mundo smart", StringComparison.OrdinalIgnoreCase)
            || n.Equals("mundosmart", StringComparison.OrdinalIgnoreCase)
            || n.StartsWith("mundo smart ", StringComparison.OrdinalIgnoreCase);
    }

    public static void ValidarCelularDaLoja(string? situacao, string? clienteNome)
    {
        if (!EhCelularDaLoja(situacao)) return;
        if (!ClienteEhLojaMundoSmart(clienteNome))
            throw new ArgumentException("Celular da loja só pode ser usado no aparelho da Mundo Smart.");
    }

    /// <summary>Fora do filtro padrão da lista: Concluído, Cancelado, placa e celular da loja.</summary>
    public static bool EhForaFiltroPadrao(string? situacao) =>
        EhFinalizada(situacao) || EhReparoAvancadoPlaca(situacao) || EhCelularDaLoja(situacao);

    /// <summary>
    /// Reparo avançado em placa fica com Rômulo.
    /// Nas demais situações devolve o técnico informado, sem alterar.
    /// </summary>
    public static string? ResolverTecnico(string? situacao, string? tecnicoNome)
    {
        if (!EhReparoAvancadoPlaca(situacao))
            return tecnicoNome;

        if (NomesEquivalentes(tecnicoNome, TecnicoReparoAvancadoPlaca))
            return tecnicoNome!.Trim();
        return TecnicoReparoAvancadoPlaca;
    }

    public static bool NomesEquivalentes(string? a, string? b) =>
        string.Equals(SemAcento(a), SemAcento(b), StringComparison.OrdinalIgnoreCase);

    public static string SemAcento(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return "";
        var formD = valor.Trim().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(formD.Length);
        foreach (var c in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }

        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>
    /// Valores canônicos + legado (Concluída/Cancelada) para filtros Mongo Nin.
    /// Prefira <see cref="EhFinalizada"/> em memória quando possível.
    /// </summary>
    public static readonly string[] SituacoesFinalizadasAliases =
    [
        Concluido,
        "Concluida",
        "Concluída",
        "concluido",
        "concluida",
        "concluído",
        "concluída",
        Cancelado,
        "Cancelada",
        "cancelado",
        "cancelada",
    ];

    /// <summary>Regex: só situações do board padrão (exclui Concluído, Cancelado, placa e celular da loja).</summary>
    public static BsonRegularExpression SituacoesEmAndamentoRegex { get; } = CriarRegexEmAndamento();

    private static BsonRegularExpression CriarRegexEmAndamento()
    {
        var ativos = SituacoesValidas
            .Where(s => !EhForaFiltroPadrao(s))
            .Append("Em andamento")
            .Select(Regex.Escape)
            .Distinct(StringComparer.OrdinalIgnoreCase);
        // ^...$ com flag i — Cancelado, Concluído, placa e celular da loja não entram.
        return new BsonRegularExpression($"^\\s*({string.Join("|", ativos)})\\s*$", "i");
    }

    /// <summary>Valores canônicos + legado para excluir Concluído no filtro da lista.</summary>
    public static readonly string[] SituacoesConcluidasAliases =
    [
        Concluido,
        "Concluida",
        "Concluída",
    ];

    public static bool EhFiltroExcetoConcluido(string? situacao) =>
        string.Equals(situacao?.Trim(), FiltroExcetoConcluido, StringComparison.OrdinalIgnoreCase);

    /// <summary>Filtro padrão da lista: em andamento (exclui Concluído, Cancelado, placa e celular da loja).</summary>
    public static bool EhFiltroExcetoFinalizadas(string? situacao) =>
        EhFiltroExcetoConcluido(situacao);

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
