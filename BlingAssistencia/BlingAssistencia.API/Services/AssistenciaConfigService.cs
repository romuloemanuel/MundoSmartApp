using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IAssistenciaConfigService
{
    Task<ImpressaoOsConfigDto> ObterImpressaoOsAsync(CancellationToken cancellationToken = default);
    Task<ImpressaoOsConfigDto> SalvarImpressaoOsAsync(ImpressaoOsConfigDto dto, CancellationToken cancellationToken = default);
    Task<AcrescimoEstoqueConfigDto> ObterAcrescimoEstoqueAsync(CancellationToken cancellationToken = default);
    Task<AcrescimoEstoqueConfigDto> SalvarAcrescimoEstoqueAsync(AcrescimoEstoqueConfigDto dto, CancellationToken cancellationToken = default);
}

public class AssistenciaConfigService : IAssistenciaConfigService
{
    private static readonly (string Codigo, string Nome)[] LojasPadrao =
    [
        ("MCC", "Mococa (assistência)"),
        ("ARCE", "Arceburgo"),
        ("SJ", "São José"),
        ("CJR", "Cajuru"),
    ];

    private readonly IAssistenciaConfigRepository _repository;

    public AssistenciaConfigService(IAssistenciaConfigRepository repository)
    {
        _repository = repository;
    }

    public async Task<ImpressaoOsConfigDto> ObterImpressaoOsAsync(CancellationToken cancellationToken = default)
    {
        var doc = await _repository.ObterAsync(cancellationToken);
        return MapearImpressaoDto(doc);
    }

    public async Task<ImpressaoOsConfigDto> SalvarImpressaoOsAsync(
        ImpressaoOsConfigDto dto,
        CancellationToken cancellationToken = default)
    {
        var aviso = dto.AvisoPreOrcamento?.Trim() ?? string.Empty;
        var termos = dto.TermosCondicoes?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(aviso))
            throw new ArgumentException("O aviso de pré-orçamento é obrigatório.");
        if (string.IsNullOrWhiteSpace(termos))
            throw new ArgumentException("Os termos e condições são obrigatórios.");

        var existente = await _repository.ObterAsync(cancellationToken);
        var diasGarantia = dto.DiasGarantiaPadrao > 0 ? dto.DiasGarantiaPadrao : 90;

        await _repository.SalvarAsync(new AssistenciaConfigData
        {
            AvisoPreOrcamentoOs = aviso,
            TermosCondicoesOs = termos,
            NomeEmpresa = dto.NomeEmpresa?.Trim() ?? string.Empty,
            EnderecoEmpresa = dto.EnderecoEmpresa?.Trim() ?? string.Empty,
            TelefoneEmpresa = dto.TelefoneEmpresa?.Trim() ?? string.Empty,
            CnpjEmpresa = dto.CnpjEmpresa?.Trim() ?? string.Empty,
            DiasGarantiaPadrao = diasGarantia,
            TextoGarantiaTermica = string.IsNullOrWhiteSpace(dto.TextoGarantiaTermica)
                ? ImpressaoOsTextosPadrao.TextoGarantiaTermica
                : dto.TextoGarantiaTermica.Trim(),
            AcrescimoPercentualPorLoja = existente.AcrescimoPercentualPorLoja ?? new(StringComparer.OrdinalIgnoreCase),
        }, cancellationToken);

        return await ObterImpressaoOsAsync(cancellationToken);
    }

    public async Task<AcrescimoEstoqueConfigDto> ObterAcrescimoEstoqueAsync(CancellationToken cancellationToken = default)
    {
        var doc = await _repository.ObterAsync(cancellationToken);
        return MapearAcrescimoDto(doc);
    }

    public async Task<AcrescimoEstoqueConfigDto> SalvarAcrescimoEstoqueAsync(
        AcrescimoEstoqueConfigDto dto,
        CancellationToken cancellationToken = default)
    {
        var existente = await _repository.ObterAsync(cancellationToken);
        var mapa = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in dto.Lojas ?? [])
        {
            var codigo = OsLojaHelper.Normalizar(item.LojaCodigo);
            if (string.IsNullOrWhiteSpace(codigo)) continue;
            if (item.Percentual < 0)
                throw new ArgumentException($"Percentual inválido para a loja {codigo}.");
            mapa[codigo] = Math.Round(item.Percentual, 2, MidpointRounding.AwayFromZero);
        }

        // Garante todas as lojas conhecidas.
        foreach (var (codigo, _) in LojasPadrao)
        {
            if (!mapa.ContainsKey(codigo))
                mapa[codigo] = 0;
        }

        await _repository.SalvarAsync(new AssistenciaConfigData
        {
            AvisoPreOrcamentoOs = existente.AvisoPreOrcamentoOs,
            TermosCondicoesOs = existente.TermosCondicoesOs,
            NomeEmpresa = existente.NomeEmpresa,
            EnderecoEmpresa = existente.EnderecoEmpresa,
            TelefoneEmpresa = existente.TelefoneEmpresa,
            CnpjEmpresa = existente.CnpjEmpresa,
            DiasGarantiaPadrao = existente.DiasGarantiaPadrao > 0 ? existente.DiasGarantiaPadrao : 90,
            TextoGarantiaTermica = existente.TextoGarantiaTermica,
            AcrescimoPercentualPorLoja = mapa,
        }, cancellationToken);

        return await ObterAcrescimoEstoqueAsync(cancellationToken);
    }

    private static ImpressaoOsConfigDto MapearImpressaoDto(AssistenciaConfigData doc)
    {
        return new ImpressaoOsConfigDto
        {
            AvisoPreOrcamento = string.IsNullOrWhiteSpace(doc.AvisoPreOrcamentoOs)
                ? ImpressaoOsTextosPadrao.AvisoPreOrcamento
                : doc.AvisoPreOrcamentoOs.Trim(),
            TermosCondicoes = string.IsNullOrWhiteSpace(doc.TermosCondicoesOs)
                ? ImpressaoOsTextosPadrao.TermosCondicoes
                : doc.TermosCondicoesOs.Trim(),
            NomeEmpresa = string.IsNullOrWhiteSpace(doc.NomeEmpresa)
                ? ImpressaoOsTextosPadrao.NomeEmpresa
                : doc.NomeEmpresa.Trim(),
            EnderecoEmpresa = doc.EnderecoEmpresa?.Trim() ?? string.Empty,
            TelefoneEmpresa = doc.TelefoneEmpresa?.Trim() ?? string.Empty,
            CnpjEmpresa = doc.CnpjEmpresa?.Trim() ?? string.Empty,
            DiasGarantiaPadrao = doc.DiasGarantiaPadrao > 0 ? doc.DiasGarantiaPadrao : 90,
            TextoGarantiaTermica = string.IsNullOrWhiteSpace(doc.TextoGarantiaTermica)
                ? ImpressaoOsTextosPadrao.TextoGarantiaTermica
                : doc.TextoGarantiaTermica.Trim(),
        };
    }

    private static AcrescimoEstoqueConfigDto MapearAcrescimoDto(AssistenciaConfigData doc)
    {
        var mapa = doc.AcrescimoPercentualPorLoja ?? new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        return new AcrescimoEstoqueConfigDto
        {
            Lojas = LojasPadrao.Select(l => new AcrescimoEstoqueLojaDto
            {
                LojaCodigo = l.Codigo,
                LojaNome = l.Nome,
                Percentual = mapa.TryGetValue(l.Codigo, out var pct) && pct > 0 ? Math.Round(pct, 2) : 0,
            }).ToList(),
        };
    }
}

internal static class ImpressaoOsTextosPadrao
{
    public const string NomeEmpresa = "MundoSmart Assistência";

    public const string TextoGarantiaTermica =
        "Garantia exclusiva da peca substituida ou do reparo executado nesta OS. " +
        "Perde validade em caso de queda, liquido, violacao de lacre ou abertura por terceiros.";

    public const string AvisoPreOrcamento =
        "Este documento registra a ordem de serviço no momento da entrada do aparelho. " +
        "Os valores e itens abaixo são um pré-orçamento, pois o equipamento ainda não foi aberto " +
        "para diagnóstico interno. Após a análise técnica, podem ser identificados defeitos ou " +
        "serviços adicionais, com atualização do orçamento final.";

    public const string TermosCondicoes =
        "O prazo para retirada do equipamento é de 30 (trinta) dias após a nossa notificação de conclusão ou orçamento. " +
        "A partir do 31º dia, incidirá uma taxa de guarda e seguro de R$ 5,00 diários. Caso o valor acumulado (conserto e/ou estadia) " +
        "ultrapasse o valor de mercado do aparelho, medidas legais poderão ser adotadas para a quitação do débito. " +
        "Sobre o nosso serviço, oferecemos 90 (noventa) dias de garantia referentes exclusivamente à peça substituída ou ao reparo executado. " +
        "Para mantermos essa cobertura, a garantia perde a validade se o equipamento sofrer novas quedas, forte pressão mecânica, contato com líquidos, " +
        "violação dos selos de segurança ou for aberto por terceiros. Em caso de desistência após a aprovação do orçamento e início do serviço, " +
        "será cobrada a taxa de hora técnica referente ao tempo de bancada para a desmontagem e reversão do procedimento.\n\n" +
        "O cliente compreende que quedas e fortes impactos causam danos internos que não podem ser dimensionados antes da abertura do aparelho. " +
        "A real extensão do choque sofrido pelos componentes e pela placa só pode ser constatada durante a desmontagem técnica. " +
        "Devido à fragilidade gerada pelo acidente original, as lesões ocultas podem se manifestar durante o diagnóstico, podendo o aparelho parar de funcionar. " +
        "A assistência técnica não se responsabiliza pela evolução de defeitos que já estavam presentes no interior do equipamento.\n\n" +
        "O cliente autoriza o recebimento de notificações e a aprovação de orçamentos através do WhatsApp cadastrado, " +
        "reconhecendo o aceite por mensagem como assinatura válida.";
}
