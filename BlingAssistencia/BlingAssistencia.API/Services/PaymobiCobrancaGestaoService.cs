using MongoDB.Bson;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IPaymobiCobrancaGestaoService
{
    Task<PaymobiCobrancaConfigDto> ObterConfigAsync(CancellationToken cancellationToken = default);
    Task<PaymobiCobrancaConfigDto> SalvarConfigAsync(
        PaymobiCobrancaConfigDto body,
        CancellationToken cancellationToken = default);
    Task<PaymobiCobrancaListaResponse> ListarAsync(
        string? fila,
        string? tipo,
        string? termo,
        CancellationToken cancellationToken = default);
    Task<PaymobiCobrancaResumoDto> ResumoAsync(CancellationToken cancellationToken = default);
    Task<PaymobiCobrancaItemDto?> AtualizarGestaoAsync(
        string id,
        PaymobiGestaoCobrancaRequest pedido,
        string operador,
        CancellationToken cancellationToken = default);
    Task<PaymobiCobrancaItemDto?> RegistrarAcaoAsync(
        string id,
        PaymobiRegistrarAcaoCobrancaRequest pedido,
        string operador,
        CancellationToken cancellationToken = default);
    Task<int> ProcessarFilaAsync(CancellationToken cancellationToken = default);
}

public class PaymobiCobrancaGestaoService : IPaymobiCobrancaGestaoService
{
    public const string MensagemAlertaPadrao =
        "Olá {nome}, aqui é a Mundo Smart. Lembramos que o boleto do seu {aparelho} vence hoje ({vencimento}), no valor de {valor}. Qualquer dúvida estamos à disposição.";

    public const string MensagemCobrancaPadrao =
        "Olá {nome}, aqui é a Mundo Smart. Identificamos o boleto do seu {aparelho} vencido em {vencimento}, no valor de {valor}. Pode nos confirmar o pagamento ou a previsão?";

    private readonly IPaymobiVendaRepository _vendas;
    private readonly IPaymobiConfigRepository _config;
    private readonly ILogger<PaymobiCobrancaGestaoService> _log;

    public PaymobiCobrancaGestaoService(
        IPaymobiVendaRepository vendas,
        IPaymobiConfigRepository config,
        ILogger<PaymobiCobrancaGestaoService> log)
    {
        _vendas = vendas;
        _config = config;
        _log = log;
    }

    public async Task<PaymobiCobrancaConfigDto> ObterConfigAsync(CancellationToken cancellationToken = default)
    {
        var cfg = await _config.ObterAsync(cancellationToken);
        return MapearConfig(cfg);
    }

    public async Task<PaymobiCobrancaConfigDto> SalvarConfigAsync(
        PaymobiCobrancaConfigDto body,
        CancellationToken cancellationToken = default)
    {
        body ??= new PaymobiCobrancaConfigDto();
        if (body.AlertaHora is < 0 or > 23)
            throw new ArgumentException("A hora do alerta deve estar entre 0 e 23.");
        if (body.AutoHora is < 0 or > 23)
            throw new ArgumentException("A hora da cobrança automática deve estar entre 0 e 23.");
        if (body.AlertaMaxAtraso < 0)
            throw new ArgumentException("O limite de boletos atrasados do alerta não pode ser negativo.");
        if (body.AutoDiasAposVencimento < 0)
            throw new ArgumentException("Os dias após o vencimento não podem ser negativos.");
        if (body.AutoRepetirDias < 1)
            throw new ArgumentException("O intervalo entre cobranças automáticas deve ser de pelo menos 1 dia.");

        var salvo = await _config.ObterAsync(cancellationToken) ?? new PaymobiConfigData();
        salvo.CobrancaAlertaHabilitado = body.AlertaHabilitado;
        salvo.CobrancaAlertaHora = body.AlertaHora;
        salvo.CobrancaAlertaMaxAtraso = body.AlertaMaxAtraso;
        salvo.CobrancaAlertaMensagem = (body.AlertaMensagem ?? "").Trim();
        salvo.CobrancaAutoHabilitada = body.AutoHabilitada;
        salvo.CobrancaAutoDiasAposVencimento = body.AutoDiasAposVencimento;
        salvo.CobrancaAutoRepetirDias = body.AutoRepetirDias;
        salvo.CobrancaAutoHora = body.AutoHora;
        salvo.CobrancaAutoSoDiasUteis = body.AutoSoDiasUteis;
        salvo.CobrancaAutoMensagem = (body.AutoMensagem ?? "").Trim();
        await _config.SalvarAsync(salvo, cancellationToken);
        return MapearConfig(salvo);
    }

    public async Task<PaymobiCobrancaListaResponse> ListarAsync(
        string? fila,
        string? tipo,
        string? termo,
        CancellationToken cancellationToken = default)
    {
        var cfg = MapearConfig(await _config.ObterAsync(cancellationToken));
        var hoje = HorarioBrasil.Agora.Date;
        var itens = await MontarItensAsync(cfg, hoje, persistirAgenda: false, cancellationToken);

        var tipoNorm = PaymobiTipoCobranca.NormalizarOuVazio(tipo);
        var filaNorm = (fila ?? "todos").Trim().ToLowerInvariant();
        var busca = (termo ?? "").Trim();

        IEnumerable<PaymobiCobrancaItemDto> filtrado = itens;
        if (tipoNorm.Length > 0)
            filtrado = filtrado.Where(x => x.TipoCobranca == tipoNorm);

        filtrado = filaNorm switch
        {
            "hoje" or "acao" or "fila" => filtrado.Where(x => x.FilaHoje),
            "alerta" => filtrado.Where(x => x.FilaAlerta),
            "cobranca" => filtrado.Where(x => x.FilaCobranca),
            "soneca" => filtrado.Where(x => x.SonecaAtiva),
            "nao_cobrar" or "naocobrar" => filtrado.Where(x => x.NaoCobrarMais),
            "atraso" => filtrado.Where(x => x.ParcelasAtraso > 0),
            "pendente" => filtrado.Where(x => x.PendenteEnvio),
            _ => filtrado,
        };

        if (busca.Length >= 2)
        {
            filtrado = filtrado.Where(x =>
                Contem(x.ClienteNome, busca)
                || Contem(x.ClienteTelefone, busca)
                || Contem(x.ClienteCpf, busca)
                || Contem(x.Aparelho, busca)
                || Contem(x.AparelhoImei, busca)
                || Contem(x.ContratoNumero, busca));
        }

        var lista = filtrado
            .OrderByDescending(x => x.FilaHoje)
            .ThenByDescending(x => x.PendenteEnvio)
            .ThenByDescending(x => x.ParcelasAtraso)
            .ThenBy(x => x.ProximaAcaoEm ?? DateTime.MaxValue)
            .ThenBy(x => x.ClienteNome, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new PaymobiCobrancaListaResponse
        {
            Resumo = SomarResumo(itens),
            Itens = lista,
        };
    }

    public async Task<PaymobiCobrancaResumoDto> ResumoAsync(CancellationToken cancellationToken = default)
    {
        var cfg = MapearConfig(await _config.ObterAsync(cancellationToken));
        var itens = await MontarItensAsync(cfg, HorarioBrasil.Agora.Date, persistirAgenda: false, cancellationToken);
        return SomarResumo(itens);
    }

    public async Task<PaymobiCobrancaItemDto?> AtualizarGestaoAsync(
        string id,
        PaymobiGestaoCobrancaRequest pedido,
        string operador,
        CancellationToken cancellationToken = default)
    {
        var venda = await _vendas.ObterAsync(id, cancellationToken);
        if (venda is null) return null;
        pedido ??= new PaymobiGestaoCobrancaRequest();
        venda.AcoesCobranca ??= [];

        if (pedido.TipoCobranca is not null)
        {
            var tipo = PaymobiTipoCobranca.NormalizarOuVazio(pedido.TipoCobranca);
            if (tipo.Length == 0 && pedido.TipoCobranca.Trim().Length > 0)
                throw new ArgumentException("Tipo de cobrança inválido.");
            if (!string.Equals(venda.TipoCobranca, tipo, StringComparison.Ordinal))
            {
                venda.TipoCobranca = tipo;
                AdicionarAcao(venda, PaymobiAcaoCobrancaTipo.Status, "manual", operador,
                    string.IsNullOrWhiteSpace(pedido.Observacao)
                        ? $"Status: {PaymobiTipoCobranca.Rotulo(tipo)}"
                        : pedido.Observacao.Trim(),
                    enviada: false);
            }
        }

        if (pedido.NaoCobrarMais is true && !venda.NaoCobrarMais)
        {
            venda.NaoCobrarMais = true;
            AdicionarAcao(venda, PaymobiAcaoCobrancaTipo.NaoCobrar, "manual", operador,
                string.IsNullOrWhiteSpace(pedido.Observacao) ? "Não cobrar mais este cliente." : pedido.Observacao.Trim(),
                enviada: false);
        }
        else if (pedido.NaoCobrarMais is false && venda.NaoCobrarMais)
        {
            venda.NaoCobrarMais = false;
            AdicionarAcao(venda, PaymobiAcaoCobrancaTipo.RetomarCobranca, "manual", operador,
                "Cobrança retomada.", enviada: false);
        }

        if (pedido.LimparSoneca)
        {
            if (venda.SonecaAte is not null)
            {
                venda.SonecaAte = null;
                AdicionarAcao(venda, PaymobiAcaoCobrancaTipo.LimparSoneca, "manual", operador,
                    "Soneca removida.", enviada: false);
            }
        }
        else if (pedido.SonecaAte is not null)
        {
            var ate = DataOperacional(pedido.SonecaAte.Value);
            if (ate < HorarioBrasil.Agora.Date)
                throw new ArgumentException("A soneca precisa ser hoje ou uma data futura.");
            venda.SonecaAte = ate;
            AdicionarAcao(venda, PaymobiAcaoCobrancaTipo.Soneca, "manual", operador,
                string.IsNullOrWhiteSpace(pedido.Observacao)
                    ? $"Cobrança pausada até {ate:dd/MM/yyyy}."
                    : pedido.Observacao.Trim(),
                enviada: false,
                vencimentoRef: ate);
        }

        RecalcularAgenda(venda, MapearConfig(await _config.ObterAsync(cancellationToken)), HorarioBrasil.Agora.Date);
        venda.AtualizadoEm = DateTime.UtcNow;
        await _vendas.SubstituirGestaoAsync(venda, cancellationToken);
        return MapearItem(venda, MapearConfig(await _config.ObterAsync(cancellationToken)), HorarioBrasil.Agora.Date);
    }

    public async Task<PaymobiCobrancaItemDto?> RegistrarAcaoAsync(
        string id,
        PaymobiRegistrarAcaoCobrancaRequest pedido,
        string operador,
        CancellationToken cancellationToken = default)
    {
        var venda = await _vendas.ObterAsync(id, cancellationToken);
        if (venda is null) return null;
        pedido ??= new PaymobiRegistrarAcaoCobrancaRequest();
        var tipo = (pedido.Tipo ?? "").Trim().ToLowerInvariant();
        if (tipo is "alerta" or "alerta-vencimento") tipo = PaymobiAcaoCobrancaTipo.AlertaVencimento;
        if (tipo is "cobrança" or "automatica" or "auto") tipo = PaymobiAcaoCobrancaTipo.Cobranca;
        if (tipo is not PaymobiAcaoCobrancaTipo.AlertaVencimento and not PaymobiAcaoCobrancaTipo.Cobranca)
            throw new ArgumentException("Informe se a ação é alerta de vencimento ou cobrança.");

        var cfg = MapearConfig(await _config.ObterAsync(cancellationToken));
        var hoje = HorarioBrasil.Agora.Date;
        var agenda = CalcularAgenda(venda, cfg, hoje);
        AdicionarAcao(
            venda,
            tipo,
            "manual",
            operador,
            (pedido.Observacao ?? "").Trim(),
            pedido.Enviada,
            tipo == PaymobiAcaoCobrancaTipo.AlertaVencimento ? agenda.VenceHoje : agenda.VencimentoAtrasado);
        RecalcularAgenda(venda, cfg, hoje);
        venda.AtualizadoEm = DateTime.UtcNow;
        await _vendas.SubstituirGestaoAsync(venda, cancellationToken);
        return MapearItem(venda, cfg, hoje);
    }

    public async Task<int> ProcessarFilaAsync(CancellationToken cancellationToken = default)
    {
        var cfg = MapearConfig(await _config.ObterAsync(cancellationToken));
        var itens = await MontarItensAsync(cfg, HorarioBrasil.Agora.Date, persistirAgenda: true, cancellationToken);
        var n = itens.Count(x => x.FilaHoje);
        _log.LogInformation("PayMobi cobrança: {N} contratos com ação hoje.", n);
        return n;
    }

    private async Task<List<PaymobiCobrancaItemDto>> MontarItensAsync(
        PaymobiCobrancaConfigDto cfg,
        DateTime hoje,
        bool persistirAgenda,
        CancellationToken cancellationToken)
    {
        var vendas = await _vendas.ListarAsync(null, null, cancellationToken);
        var itens = new List<PaymobiCobrancaItemDto>();
        foreach (var venda in vendas)
        {
            if (!ContratoAtivo(venda)) continue;
            if (persistirAgenda)
            {
                var tipoAntes = venda.TipoCobranca;
                var proxAntes = venda.ProximaAcaoEm;
                RecalcularAgenda(venda, cfg, hoje);
                if (!string.Equals(tipoAntes, venda.TipoCobranca, StringComparison.Ordinal)
                    || proxAntes != venda.ProximaAcaoEm)
                {
                    venda.AtualizadoEm = DateTime.UtcNow;
                    await _vendas.SubstituirGestaoAsync(venda, cancellationToken);
                }
            }
            itens.Add(MapearItem(venda, cfg, hoje));
        }
        return itens;
    }

    private static PaymobiCobrancaItemDto MapearItem(
        PaymobiVendaData venda,
        PaymobiCobrancaConfigDto cfg,
        DateTime hoje)
    {
        var agenda = CalcularAgenda(venda, cfg, hoje);
        var tipo = agenda.TipoEfetivo;
        return new PaymobiCobrancaItemDto
        {
            Id = venda.Id ?? "",
            ClienteNome = venda.ClienteNome,
            ClienteTelefone = venda.ClienteTelefone,
            ClienteCpf = venda.ClienteCpf,
            Aparelho = ResumoAparelho(venda),
            AparelhoImei = venda.AparelhoImei,
            ContratoNumero = string.IsNullOrWhiteSpace(venda.ContratoNumero)
                ? venda.PaymobiSellId ?? ""
                : venda.ContratoNumero,
            DataVenda = venda.DataVenda,
            Status = PaymobiStatus.Normalizar(venda.Status),
            ParcelasAtraso = agenda.BoletosAtraso,
            BoletosPagos = agenda.BoletosPagos,
            ValorDevido = agenda.ValorAtraso > 0 ? agenda.ValorAtraso : venda.ValorDevido,
            ValorParcela = venda.ValorParcela,
            ProximoVencimento = agenda.ProximoVencimento,
            VencimentoAtrasado = agenda.VencimentoAtrasado,
            TipoCobranca = tipo,
            TipoCobrancaRotulo = PaymobiTipoCobranca.Rotulo(tipo),
            NaoCobrarMais = venda.NaoCobrarMais,
            SonecaAte = venda.SonecaAte,
            SonecaAtiva = agenda.SonecaAtiva,
            ProximaAcaoEm = agenda.ProximaAcaoEm,
            ProximaAcaoRotulo = agenda.ProximaAcaoRotulo,
            FilaHoje = agenda.FilaAlerta || agenda.FilaCobranca,
            FilaAlerta = agenda.FilaAlerta,
            FilaCobranca = agenda.FilaCobranca,
            PendenteEnvio = agenda.FilaAlerta || agenda.FilaCobranca,
            MotivoPausa = agenda.MotivoPausa,
            MensagemSugerida = MontarMensagem(venda, cfg, agenda),
            LinkBoleto = agenda.LinkBoleto,
            Acoes = (venda.AcoesCobranca ?? [])
                .OrderByDescending(a => a.Em)
                .Select(a => new PaymobiCobrancaAcaoDto
                {
                    Id = a.Id,
                    Em = a.Em,
                    Tipo = a.Tipo,
                    Modo = a.Modo,
                    Observacao = a.Observacao,
                    VencimentoRef = a.VencimentoRef,
                    BoletosAtraso = a.BoletosAtraso,
                    Operador = a.Operador,
                    Enviada = a.Enviada,
                })
                .ToList(),
        };
    }

    private static void RecalcularAgenda(PaymobiVendaData venda, PaymobiCobrancaConfigDto cfg, DateTime hoje)
    {
        var agenda = CalcularAgenda(venda, cfg, hoje);
        if (string.IsNullOrWhiteSpace(PaymobiTipoCobranca.NormalizarOuVazio(venda.TipoCobranca)))
            venda.TipoCobranca = agenda.TipoEfetivo;
        venda.ProximaAcaoEm = agenda.ProximaAcaoEm;
        venda.AcoesCobranca ??= [];
    }

    private static AgendaCobranca CalcularAgenda(
        PaymobiVendaData venda,
        PaymobiCobrancaConfigDto cfg,
        DateTime hoje)
    {
        var boletos = venda.Boletos ?? [];
        var pagos = 0;
        var atrasados = new List<PaymobiBoletoData>();
        var abertos = new List<PaymobiBoletoData>();
        foreach (var b in boletos)
        {
            if (BoletoPago(b))
            {
                pagos++;
                continue;
            }
            var venc = b.Vencimento?.Date;
            if (venc is null) continue;
            if (venc.Value < hoje) atrasados.Add(b);
            else abertos.Add(b);
        }

        var vencimentoAtrasado = atrasados.Count > 0
            ? atrasados.Min(b => b.Vencimento!.Value.Date)
            : (DateTime?)null;
        var venceHoje = abertos.FirstOrDefault(b => b.Vencimento!.Value.Date == hoje);
        var proximoAberto = abertos.Count > 0 ? abertos.Min(b => b.Vencimento!.Value.Date) : (DateTime?)null;
        var valorAtraso = atrasados.Sum(b => b.Valor);
        var tipoSalvo = PaymobiTipoCobranca.NormalizarOuVazio(venda.TipoCobranca);
        var tipoEfetivo = tipoSalvo.Length > 0
            ? tipoSalvo
            : atrasados.Count > 0
                ? PaymobiTipoCobranca.CobrancaAutomatica
                : PaymobiTipoCobranca.AlertaVencimento;

        var sonecaAte = venda.SonecaAte?.Date;
        var sonecaAtiva = sonecaAte is not null && hoje < sonecaAte.Value;
        var motivo = "";
        if (venda.NaoCobrarMais) motivo = "Não cobrar mais";
        else if (sonecaAtiva) motivo = $"Soneca até {sonecaAte:dd/MM/yyyy}";
        else if (tipoEfetivo == PaymobiTipoCobranca.Extrajudicial) motivo = "Cobrança extrajudicial";
        else if (tipoEfetivo is PaymobiTipoCobranca.RenegAuto or PaymobiTipoCobranca.RenegManual)
            motivo = PaymobiTipoCobranca.Rotulo(tipoEfetivo);

        var pausaAuto = venda.NaoCobrarMais || sonecaAtiva || PaymobiTipoCobranca.PausaAutomatico(tipoEfetivo);
        var jaAlertouHoje = JaEnviou(venda, PaymobiAcaoCobrancaTipo.AlertaVencimento, hoje, venceHoje?.Vencimento?.Date);
        var jaCobrouHoje = JaEnviou(venda, PaymobiAcaoCobrancaTipo.Cobranca, hoje, null);

        var filaAlerta = cfg.AlertaHabilitado
            && venceHoje is not null
            && atrasados.Count <= cfg.AlertaMaxAtraso
            && !venda.NaoCobrarMais
            && !sonecaAtiva
            && tipoEfetivo is not PaymobiTipoCobranca.Extrajudicial
                and not PaymobiTipoCobranca.RenegAuto
                and not PaymobiTipoCobranca.RenegManual
            && !jaAlertouHoje;

        DateTime? proximaCobranca = null;
        if (atrasados.Count > 0 && !venda.NaoCobrarMais)
        {
            var primeira = vencimentoAtrasado!.Value.AddDays(cfg.AutoDiasAposVencimento);
            var ultimaCobranca = (venda.AcoesCobranca ?? [])
                .Where(a => a.Tipo == PaymobiAcaoCobrancaTipo.Cobranca && a.Enviada)
                .Select(a => a.Em.Date)
                .DefaultIfEmpty()
                .Max();
            if (ultimaCobranca != default)
                primeira = Max(primeira, ultimaCobranca.AddDays(cfg.AutoRepetirDias));
            if (sonecaAte is not null)
                primeira = Max(primeira, sonecaAte.Value);
            if (cfg.AutoSoDiasUteis)
                primeira = ProximoDiaUtil(primeira);
            proximaCobranca = primeira;
        }

        var filaCobranca = cfg.AutoHabilitada
            && tipoEfetivo == PaymobiTipoCobranca.CobrancaAutomatica
            && !pausaAuto
            && proximaCobranca is not null
            && proximaCobranca.Value <= hoje
            && !jaCobrouHoje;
        var filaManual = tipoEfetivo == PaymobiTipoCobranca.CobrancaManual
            && atrasados.Count > 0
            && !venda.NaoCobrarMais
            && !sonecaAtiva
            && !jaCobrouHoje;

        DateTime? proximaAcao = null;
        var rotulo = "—";
        if (venda.NaoCobrarMais)
        {
            rotulo = "Não cobrar mais";
        }
        else if (sonecaAtiva)
        {
            proximaAcao = sonecaAte;
            rotulo = $"Soneca até {sonecaAte:dd/MM/yyyy}";
        }
        else if (filaAlerta)
        {
            proximaAcao = hoje;
            rotulo = "Alerta de vencimento hoje";
        }
        else if (filaCobranca || (proximaCobranca is not null && tipoEfetivo == PaymobiTipoCobranca.CobrancaAutomatica))
        {
            proximaAcao = filaCobranca ? hoje : proximaCobranca;
            rotulo = filaCobranca ? "Cobrança automática hoje" : $"Cobrança em {proximaCobranca:dd/MM/yyyy}";
        }
        else if (tipoEfetivo == PaymobiTipoCobranca.CobrancaManual && atrasados.Count > 0)
        {
            proximaAcao = hoje;
            rotulo = "Cobrança manual";
        }
        else if (proximoAberto is not null)
        {
            proximaAcao = proximoAberto;
            rotulo = $"Vence em {proximoAberto:dd/MM/yyyy}";
        }

        var boletoRef = filaAlerta ? venceHoje : atrasados.OrderBy(b => b.Vencimento).FirstOrDefault();

        return new AgendaCobranca
        {
            TipoEfetivo = tipoEfetivo,
            BoletosAtraso = atrasados.Count > 0 ? atrasados.Count : Math.Max(0, venda.ParcelasAtraso),
            BoletosPagos = pagos,
            ValorAtraso = decimal.Round(valorAtraso, 2),
            VencimentoAtrasado = vencimentoAtrasado,
            VenceHoje = venceHoje?.Vencimento?.Date,
            ProximoVencimento = venceHoje?.Vencimento?.Date ?? proximoAberto,
            SonecaAtiva = sonecaAtiva,
            MotivoPausa = motivo,
            FilaAlerta = filaAlerta,
            FilaCobranca = filaCobranca || filaManual,
            ProximaAcaoEm = proximaAcao,
            ProximaAcaoRotulo = rotulo,
            LinkBoleto = boletoRef?.Link ?? "",
            ValorRef = boletoRef?.Valor ?? venda.ValorParcela,
        };
    }

    private static string MontarMensagem(
        PaymobiVendaData venda,
        PaymobiCobrancaConfigDto cfg,
        AgendaCobranca agenda)
    {
        var alerta = agenda.FilaAlerta;
        var modelo = alerta
            ? (string.IsNullOrWhiteSpace(cfg.AlertaMensagem) ? MensagemAlertaPadrao : cfg.AlertaMensagem)
            : (string.IsNullOrWhiteSpace(cfg.AutoMensagem) ? MensagemCobrancaPadrao : cfg.AutoMensagem);
        var venc = (alerta ? agenda.VenceHoje : agenda.VencimentoAtrasado) ?? agenda.ProximoVencimento;
        var nome = (venda.ClienteNome ?? "").Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "cliente";
        return modelo
            .Replace("{nome}", nome, StringComparison.OrdinalIgnoreCase)
            .Replace("{aparelho}", ResumoAparelho(venda), StringComparison.OrdinalIgnoreCase)
            .Replace("{vencimento}", venc is null ? "—" : venc.Value.ToString("dd/MM/yyyy"), StringComparison.OrdinalIgnoreCase)
            .Replace("{valor}", agenda.ValorRef.ToString("C", new System.Globalization.CultureInfo("pt-BR")), StringComparison.OrdinalIgnoreCase)
            .Replace("{atraso}", agenda.BoletosAtraso.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    private static void AdicionarAcao(
        PaymobiVendaData venda,
        string tipo,
        string modo,
        string operador,
        string observacao,
        bool enviada,
        DateTime? vencimentoRef = null)
    {
        venda.AcoesCobranca ??= [];
        venda.AcoesCobranca.Add(new PaymobiAcaoCobrancaData
        {
            Id = ObjectId.GenerateNewId().ToString(),
            Em = HorarioBrasil.Agora,
            Tipo = tipo,
            Modo = modo,
            Observacao = observacao,
            VencimentoRef = vencimentoRef,
            BoletosAtraso = venda.ParcelasAtraso,
            Operador = operador,
            Enviada = enviada,
        });
        if (venda.AcoesCobranca.Count > 80)
            venda.AcoesCobranca = venda.AcoesCobranca.OrderByDescending(a => a.Em).Take(80).ToList();
        venda.UltimaAcaoEm = HorarioBrasil.Agora;
        venda.UltimaAcaoTipo = tipo;
    }

    private static bool JaEnviou(PaymobiVendaData venda, string tipo, DateTime hoje, DateTime? vencimentoRef)
    {
        return (venda.AcoesCobranca ?? []).Any(a =>
            a.Enviada
            && a.Tipo == tipo
            && a.Em.Date == hoje
            && (vencimentoRef is null || a.VencimentoRef is null || a.VencimentoRef.Value.Date == vencimentoRef.Value));
    }

    private static bool ContratoAtivo(PaymobiVendaData venda)
    {
        var st = PaymobiStatus.Normalizar(venda.Status);
        return st is PaymobiStatus.Aberta or PaymobiStatus.Atrasada;
    }

    private static bool BoletoPago(PaymobiBoletoData b)
    {
        var s = (b.Status ?? "").Trim().ToLowerInvariant();
        return s is "paid" or "pago";
    }

    private static bool Contem(string? texto, string busca) =>
        (texto ?? "").Contains(busca, StringComparison.OrdinalIgnoreCase);

    private static string ResumoAparelho(PaymobiVendaData v) =>
        string.Join(" ", new[] { v.AparelhoMarca, v.AparelhoModelo, v.AparelhoCor }.Where(x => !string.IsNullOrWhiteSpace(x)))
            is { Length: > 0 } s ? s : "—";

    private static DateTime DataOperacional(DateTime valor) =>
        DateTime.SpecifyKind(valor.Date, DateTimeKind.Utc);

    private static DateTime Max(DateTime a, DateTime b) => a >= b ? a : b;

    private static DateTime ProximoDiaUtil(DateTime data)
    {
        var d = data.Date;
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
            d = d.AddDays(1);
        return DateTime.SpecifyKind(d, DateTimeKind.Utc);
    }

    private static PaymobiCobrancaResumoDto SomarResumo(IEnumerable<PaymobiCobrancaItemDto> itens)
    {
        var lista = itens as IList<PaymobiCobrancaItemDto> ?? itens.ToList();
        return new PaymobiCobrancaResumoDto
        {
            Contratos = lista.Count,
            AcaoHoje = lista.Count(x => x.FilaHoje),
            AlertaHoje = lista.Count(x => x.FilaAlerta),
            CobrancaHoje = lista.Count(x => x.FilaCobranca),
            Soneca = lista.Count(x => x.SonecaAtiva),
            NaoCobrar = lista.Count(x => x.NaoCobrarMais),
            Atrasados = lista.Count(x => x.ParcelasAtraso > 0),
            PendenteEnvio = lista.Count(x => x.PendenteEnvio),
        };
    }

    public static PaymobiCobrancaConfigDto MapearConfig(PaymobiConfigData? cfg) => new()
    {
        AlertaHabilitado = cfg?.CobrancaAlertaHabilitado ?? true,
        AlertaHora = ClampHora(cfg?.CobrancaAlertaHora, 9),
        AlertaMaxAtraso = cfg?.CobrancaAlertaMaxAtraso is int max && max >= 0 ? max : 2,
        AlertaMensagem = cfg?.CobrancaAlertaMensagem ?? "",
        AutoHabilitada = cfg?.CobrancaAutoHabilitada ?? true,
        AutoDiasAposVencimento = cfg?.CobrancaAutoDiasAposVencimento is int d && d >= 0 ? d : 2,
        AutoRepetirDias = cfg?.CobrancaAutoRepetirDias is int r && r >= 1 ? r : 3,
        AutoHora = ClampHora(cfg?.CobrancaAutoHora, 10),
        AutoSoDiasUteis = cfg?.CobrancaAutoSoDiasUteis ?? true,
        AutoMensagem = cfg?.CobrancaAutoMensagem ?? "",
    };

    private static int ClampHora(int? hora, int padrao) =>
        hora is >= 0 and <= 23 ? hora.Value : padrao;

    private sealed class AgendaCobranca
    {
        public string TipoEfetivo { get; set; } = "";
        public int BoletosAtraso { get; set; }
        public int BoletosPagos { get; set; }
        public decimal ValorAtraso { get; set; }
        public decimal ValorRef { get; set; }
        public DateTime? VencimentoAtrasado { get; set; }
        public DateTime? VenceHoje { get; set; }
        public DateTime? ProximoVencimento { get; set; }
        public bool SonecaAtiva { get; set; }
        public string MotivoPausa { get; set; } = "";
        public bool FilaAlerta { get; set; }
        public bool FilaCobranca { get; set; }
        public DateTime? ProximaAcaoEm { get; set; }
        public string ProximaAcaoRotulo { get; set; } = "";
        public string LinkBoleto { get; set; } = "";
    }
}
