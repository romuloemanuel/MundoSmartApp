using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IFollowUpCelularService
{
    Task<List<FollowUpCelularData>> ListarAsync(CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> ObterAsync(string id, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> CriarAsync(SalvarFollowUpCelularRequest request, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> AtualizarAsync(string id, SalvarFollowUpCelularRequest request, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> RegistrarFollowUpAsync(string id, RegistrarFollowUpCelularRequest request, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> RegistrarDesistenciaAsync(string id, RegistrarDesistenciaFollowUpCelularRequest request, CancellationToken cancellationToken = default);
    Task<FollowUpCelularData> ConverterAsync(string id, ConverterFollowUpCelularRequest request, CancellationToken cancellationToken = default);
}

public sealed class FollowUpCelularService : IFollowUpCelularService
{
    public const string SituacaoAberto = "Em aberto";
    public const string SituacaoConvertido = "Convertido";
    public const string SituacaoNaoRealizado = "Não realizado";
    public const string SituacaoDesistencia = "Desistência";
    public const int Ciclo = 3;

    private readonly IFollowUpCelularRepository _repo;
    private readonly IDevSequenceRepository _sequencia;

    public FollowUpCelularService(IFollowUpCelularRepository repo, IDevSequenceRepository sequencia)
    {
        _repo = repo;
        _sequencia = sequencia;
    }

    public Task<List<FollowUpCelularData>> ListarAsync(CancellationToken cancellationToken = default) =>
        _repo.ListarAsync(cancellationToken);

    public async Task<FollowUpCelularData> ObterAsync(string id, CancellationToken cancellationToken = default) =>
        await _repo.ObterAsync(id, cancellationToken)
        ?? throw new KeyNotFoundException("Follow-up não encontrado.");

    public async Task<FollowUpCelularData> CriarAsync(
        SalvarFollowUpCelularRequest request,
        CancellationToken cancellationToken = default)
    {
        var agora = HorarioBrasil.Agora;
        var doc = new FollowUpCelularData
        {
            Situacao = SituacaoAberto,
            FollowUps = [],
            VezesContato = 0,
            CriadoEm = agora,
            AtualizadoEm = agora,
        };
        AplicarCadastro(doc, request, primeiraDataSeVazia: true);
        doc.Numero = await _sequencia.ProximoAsync("followup_celular");
        return await _repo.InserirAsync(doc, cancellationToken);
    }

    public async Task<FollowUpCelularData> AtualizarAsync(
        string id,
        SalvarFollowUpCelularRequest request,
        CancellationToken cancellationToken = default)
    {
        var doc = await ObterAsync(id, cancellationToken);
        GarantirAberto(doc, "editar");
        AplicarCadastro(doc, request, primeiraDataSeVazia: false);
        doc.AtualizadoEm = HorarioBrasil.Agora;
        await _repo.SalvarAsync(doc, cancellationToken);
        return doc;
    }

    public async Task<FollowUpCelularData> RegistrarFollowUpAsync(
        string id,
        RegistrarFollowUpCelularRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new ArgumentException("Dados do follow-up são obrigatórios.");

        var anotacao = (request.Anotacao ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(anotacao))
            throw new ArgumentException("Informe a anotação do follow-up.");

        var doc = await ObterAsync(id, cancellationToken);
        GarantirAberto(doc, "registrar follow-up");

        doc.FollowUps ??= [];
        if (doc.FollowUps.Count >= Ciclo)
            throw new InvalidOperationException("Limite de 3 follow-ups atingido — o interesse deve ser Não realizado.");

        var responsavel = string.IsNullOrWhiteSpace(request.Responsavel)
            ? doc.Responsavel
            : request.Responsavel.Trim();
        if (string.IsNullOrWhiteSpace(responsavel))
            throw new ArgumentException("Informe quem fez o contato.");

        var agora = HorarioBrasil.Agora;
        doc.FollowUps.Add(new FollowUpCelularContato
        {
            Data = agora.Date,
            Anotacao = anotacao,
            Responsavel = responsavel,
            CriadoEm = agora,
        });
        doc.VezesContato = doc.FollowUps.Count;

        if (doc.VezesContato >= Ciclo)
        {
            doc.Situacao = SituacaoNaoRealizado;
            doc.DataFollowUp = null;
        }
        else
        {
            doc.DataFollowUp = DataInformada(request.DataFollowUpProxima)
                ?? SugerirDataFollowUp(doc.VezesContato);
            doc.Situacao = SituacaoAberto;
        }

        doc.AtualizadoEm = agora;
        await _repo.SalvarAsync(doc, cancellationToken);
        return doc;
    }

    public async Task<FollowUpCelularData> RegistrarDesistenciaAsync(
        string id,
        RegistrarDesistenciaFollowUpCelularRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request is null)
            throw new ArgumentException("Dados da desistência são obrigatórios.");

        var motivo = (request.Motivo ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(motivo))
            throw new ArgumentException("Informe o motivo da desistência do cliente.");

        var doc = await ObterAsync(id, cancellationToken);
        GarantirAberto(doc, "marcar desistência");
        doc.Situacao = SituacaoDesistencia;
        doc.MotivoDesistencia = motivo;
        doc.DataFollowUp = null;
        doc.AtualizadoEm = HorarioBrasil.Agora;
        await _repo.SalvarAsync(doc, cancellationToken);
        return doc;
    }

    public async Task<FollowUpCelularData> ConverterAsync(
        string id,
        ConverterFollowUpCelularRequest request,
        CancellationToken cancellationToken = default)
    {
        var doc = await ObterAsync(id, cancellationToken);
        GarantirAberto(doc, "marcar como convertido");
        doc.Situacao = SituacaoConvertido;
        doc.ObservacaoConversao = string.IsNullOrWhiteSpace(request?.Observacao)
            ? null
            : request.Observacao.Trim();
        doc.DataFollowUp = null;
        doc.AtualizadoEm = HorarioBrasil.Agora;
        await _repo.SalvarAsync(doc, cancellationToken);
        return doc;
    }

    private static void AplicarCadastro(
        FollowUpCelularData doc,
        SalvarFollowUpCelularRequest request,
        bool primeiraDataSeVazia)
    {
        if (request is null)
            throw new ArgumentException("Dados do follow-up são obrigatórios.");

        var nome = (request.ClienteNome ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(nome))
            throw new ArgumentException("Informe o nome do cliente.");

        var telefone = (request.Telefone ?? string.Empty).Trim();
        var digitos = new string(telefone.Where(char.IsDigit).ToArray());
        if (digitos.Length < 8)
            throw new ArgumentException("Informe o telefone do cliente.");

        var interesse = NormalizarInteresse(request.Interesse);
        var desejado = Texto(request.AparelhoDesejado);
        var doCliente = Texto(request.AparelhoCliente);

        if (interesse == "troca" && doCliente is null)
            throw new ArgumentException("Na troca, informe o aparelho do cliente.");
        if (interesse != "troca" && desejado is null)
            throw new ArgumentException("Informe o aparelho que o cliente quer comprar.");

        var responsavel = Texto(request.Responsavel);
        if (responsavel is null)
            throw new ArgumentException("Informe quem está acompanhando o cliente.");

        doc.ClienteNome = nome;
        doc.Telefone = telefone;
        doc.Interesse = interesse;
        doc.AparelhoDesejado = desejado;
        doc.AparelhoCliente = doCliente;
        doc.ValorEstimado = request.ValorEstimado is > 0
            ? Math.Round(request.ValorEstimado.Value, 2, MidpointRounding.AwayFromZero)
            : null;
        doc.Observacao = Texto(request.Observacao);
        doc.Responsavel = responsavel;

        var data = DataInformada(request.DataFollowUp);
        if (data is null && primeiraDataSeVazia)
            data = SugerirDataFollowUp(1);
        if (data is not null)
            doc.DataFollowUp = data;
    }

    private static void GarantirAberto(FollowUpCelularData doc, string acao)
    {
        if (string.Equals(doc.Situacao, SituacaoConvertido, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cliente já comprou ou trocou — não dá para {acao}.");
        if (string.Equals(doc.Situacao, SituacaoNaoRealizado, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Follow-up já concluído como Não realizado — não dá para {acao}.");
        if (string.Equals(doc.Situacao, SituacaoDesistencia, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cliente desistiu — não dá para {acao}.");
    }

    public static string NormalizarInteresse(string? interesse)
    {
        var bruto = (interesse ?? string.Empty).Trim().ToLowerInvariant();
        return bruto switch
        {
            "troca" => "troca",
            "compra" => "compra",
            "compra_boleto" or "boleto" or "compra boleto" or "compra no boleto" => "compra_boleto",
            _ => throw new ArgumentException("Informe se é troca, compra ou compra no boleto."),
        };
    }

    /// <summary>1º → +3 úteis; 2º → +5; 3º+ → +7.</summary>
    public static DateTime SugerirDataFollowUp(int vezesAposRegistro)
    {
        var dias = vezesAposRegistro <= 1 ? 3
            : vezesAposRegistro == 2 ? 5
            : 7;
        return HorarioBrasil.AdicionarDiasUteis(dias);
    }

    private static DateTime? DataInformada(DateTime? valor)
    {
        if (valor is not { } data || data == default)
            return null;
        return DateTime.SpecifyKind(HorarioBrasil.ComoUtcParede(data).Date, DateTimeKind.Utc);
    }

    private static string? Texto(string? valor)
    {
        var texto = (valor ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(texto) ? null : texto;
    }
}
