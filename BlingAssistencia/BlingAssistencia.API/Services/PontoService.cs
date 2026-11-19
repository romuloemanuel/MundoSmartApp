using System.Security.Cryptography;
using System.Text;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public record PontoAtor(string Id, string Nome);

public record PontoColaboradorDto(string Id, string Nome, string Usuario, string Role);

public record PontoAparelhoDto(
    string Id,
    string Apelido,
    string? LojaOrigem,
    bool Ativo,
    DateTime LiberadoEm,
    string LiberadoPorNome,
    DateTime? RevogadoEm,
    string? RevogadoPorNome,
    bool TemGps);

public record PontoStatusDto(
    int MaximoAparelhos,
    int VagasUsadas,
    int VagasLivres,
    bool EsteAparelhoLiberado,
    string? EsteAparelhoId,
    string? SenhaDoDia,
    DateTime Dia,
    IReadOnlyList<PontoAparelhoDto> Aparelhos,
    IReadOnlyList<PontoColaboradorDto> Colaboradores);

public record PontoLiberarResultado(string Token, PontoAparelhoDto Aparelho);

public record PontoBatidaDto(
    string Id,
    DateTime Horario,
    string Tipo,
    string UsuarioNome,
    string? LojaOrigem,
    string? FotoUrl,
    bool SemGps,
    bool ForaDaLoja,
    double? DistanciaLojaMetros);

public interface IPontoService
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<PontoStatusDto> ObterStatusAsync(string? token, CancellationToken cancellationToken = default);
    Task<PontoLiberarResultado> LiberarAparelhoAsync(
        PontoAtor ator,
        string? tokenExistente,
        string apelido,
        string? lojaOrigem,
        double? latitude,
        double? longitude,
        string? userAgent,
        CancellationToken cancellationToken = default);
    Task RevogarAparelhoAsync(PontoAtor ator, string aparelhoId, CancellationToken cancellationToken = default);
    Task<string> GerarSenhaDoDiaAsync(PontoAtor ator, CancellationToken cancellationToken = default);
    Task<PontoBatidaDto> BaterAsync(
        string token,
        string usuarioId,
        string tipo,
        string senha,
        double? latitude,
        double? longitude,
        double? precisaoMetros,
        Stream? foto,
        string uploadsRoot,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PontoBatidaDto>> ListarBatidasHojeAsync(CancellationToken cancellationToken = default);
}

public class PontoService : IPontoService
{
    public const double RaioLojaMetros = 150;

    private readonly IPontoRepository _repo;
    private readonly IUsuarioRepository _usuarios;

    public PontoService(IPontoRepository repo, IUsuarioRepository usuarios)
    {
        _repo = repo;
        _usuarios = usuarios;
    }

    public Task EnsureIndexesAsync(CancellationToken cancellationToken = default) =>
        _repo.EnsureIndexesAsync(cancellationToken);

    public async Task<PontoStatusDto> ObterStatusAsync(string? token, CancellationToken cancellationToken = default)
    {
        var agora = HorarioBrasil.Agora;
        var dia = InicioDoDia(agora);
        var senha = await _repo.ObterSenhaDoDiaAsync(dia, cancellationToken);
        var aparelhos = (await _repo.ListarAparelhosAsync(cancellationToken))
            .Select(MapearAparelho)
            .ToList();
        var ativos = aparelhos.Count(a => a.Ativo);
        var este = string.IsNullOrWhiteSpace(token)
            ? null
            : await _repo.ObterAtivoPorTokenHashAsync(HashToken(token), cancellationToken);
        var colaboradores = (await _usuarios.ListarAsync(cancellationToken))
            .Where(u => u.Ativo)
            .OrderBy(u => u.Nome)
            .Select(u => new PontoColaboradorDto(u.Id!, u.Nome, u.Usuario, u.Role))
            .ToList();

        return new PontoStatusDto(
            PontoAparelhoData.MaximoAtivos,
            ativos,
            Math.Max(0, PontoAparelhoData.MaximoAtivos - ativos),
            este != null,
            este?.Id,
            senha?.Senha,
            dia,
            aparelhos,
            colaboradores);
    }

    public async Task<PontoLiberarResultado> LiberarAparelhoAsync(
        PontoAtor ator,
        string? tokenExistente,
        string apelido,
        string? lojaOrigem,
        double? latitude,
        double? longitude,
        string? userAgent,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrWhiteSpace(tokenExistente))
        {
            var existente = await _repo.ObterAtivoPorTokenHashAsync(HashToken(tokenExistente), cancellationToken);
            if (existente != null)
                return new PontoLiberarResultado(tokenExistente, MapearAparelho(existente));
        }

        var usados = await _repo.ContarAtivosAsync(cancellationToken);
        if (usados >= PontoAparelhoData.MaximoAtivos)
            throw new InvalidOperationException(
                "Já existem 3 aparelhos liberados. Revogue um no painel para liberar outra vaga.");

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
        var agora = HorarioBrasil.Agora;
        var doc = new PontoAparelhoData
        {
            TokenHash = HashToken(token),
            Apelido = string.IsNullOrWhiteSpace(apelido) ? "Celular da loja" : apelido.Trim(),
            LojaOrigem = string.IsNullOrWhiteSpace(lojaOrigem) ? null : lojaOrigem.Trim().ToUpperInvariant(),
            Latitude = latitude,
            Longitude = longitude,
            UserAgent = userAgent,
            LiberadoPorId = ator.Id,
            LiberadoPorNome = ator.Nome,
            LiberadoEm = agora,
        };
        await _repo.InserirAparelhoAsync(doc, cancellationToken);
        return new PontoLiberarResultado(token, MapearAparelho(doc));
    }

    public async Task RevogarAparelhoAsync(PontoAtor ator, string aparelhoId, CancellationToken cancellationToken = default)
    {
        var aparelho = await _repo.ObterAparelhoPorIdAsync(aparelhoId, cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        if (aparelho.RevogadoEm != null)
            return;
        await _repo.RevogarAparelhoAsync(aparelhoId, ator.Nome, HorarioBrasil.Agora, cancellationToken);
    }

    public async Task<string> GerarSenhaDoDiaAsync(PontoAtor ator, CancellationToken cancellationToken = default)
    {
        var agora = HorarioBrasil.Agora;
        var dia = InicioDoDia(agora);
        var senha = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        await _repo.SubstituirSenhaDoDiaAsync(new PontoSenhaDiaData
        {
            Dia = dia,
            Senha = senha,
            CriadoPorNome = ator.Nome,
            CriadoEm = agora,
        }, cancellationToken);
        return senha;
    }

    public async Task<PontoBatidaDto> BaterAsync(
        string token,
        string usuarioId,
        string tipo,
        string senha,
        double? latitude,
        double? longitude,
        double? precisaoMetros,
        Stream? foto,
        string uploadsRoot,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
            throw new UnauthorizedAccessException("Este aparelho não está liberado para bater ponto.");

        var aparelho = await _repo.ObterAtivoPorTokenHashAsync(HashToken(token), cancellationToken)
            ?? throw new UnauthorizedAccessException("Este aparelho não está liberado. Peça para a dona liberar no sistema.");

        var agora = HorarioBrasil.Agora;
        var dia = InicioDoDia(agora);
        var senhaDia = await _repo.ObterSenhaDoDiaAsync(dia, cancellationToken)
            ?? throw new InvalidOperationException("Ainda não há senha do dia. Peça para a dona gerar.");

        if (!string.Equals(senhaDia.Senha.Trim(), (senha ?? "").Trim(), StringComparison.Ordinal))
            throw new InvalidOperationException("Senha do dia inválida.");

        var colaborador = await _usuarios.ObterPorIdAsync(usuarioId, cancellationToken)
            ?? throw new InvalidOperationException("Colaborador não encontrado.");
        if (!colaborador.Ativo)
            throw new InvalidOperationException("Colaborador inativo.");

        if (!PontoTipos.EhValido(tipo))
            throw new InvalidOperationException("Tipo de batida inválido.");

        if (foto == null || foto.Length == 0)
            throw new InvalidOperationException("A foto é obrigatória para bater o ponto.");

        var semGps = latitude is null || longitude is null;
        double? distancia = null;
        var fora = false;
        if (!semGps && aparelho.Latitude is double latLoja && aparelho.Longitude is double lngLoja)
        {
            distancia = DistanciaMetros(latLoja, lngLoja, latitude!.Value, longitude!.Value);
            fora = distancia > RaioLojaMetros;
        }

        var batida = new PontoBatidaData
        {
            Dia = dia,
            UsuarioId = colaborador.Id!,
            UsuarioNome = colaborador.Nome,
            Tipo = PontoTipos.Normalizar(tipo),
            Horario = agora,
            AparelhoId = aparelho.Id!,
            LojaOrigem = aparelho.LojaOrigem,
            Latitude = latitude,
            Longitude = longitude,
            PrecisaoMetros = precisaoMetros,
            DistanciaLojaMetros = distancia,
            ForaDaLoja = fora,
            SemGps = semGps,
        };
        await _repo.InserirBatidaAsync(batida, cancellationToken);

        var pasta = Path.Combine(uploadsRoot, "ponto", batida.Id!);
        Directory.CreateDirectory(pasta);
        var arquivo = Path.Combine(pasta, "selfie.jpg");
        await using (var fs = File.Create(arquivo))
            await foto.CopyToAsync(fs, cancellationToken);
        batida.FotoUrl = $"/uploads/ponto/{batida.Id}/selfie.jpg";
        await _repo.AtualizarBatidaAsync(batida, cancellationToken);

        return MapearBatida(batida);
    }

    public async Task<IReadOnlyList<PontoBatidaDto>> ListarBatidasHojeAsync(CancellationToken cancellationToken = default)
    {
        var dia = InicioDoDia(HorarioBrasil.Agora);
        var lista = await _repo.ListarBatidasDoDiaAsync(dia, cancellationToken);
        return lista.Select(MapearBatida).ToList();
    }

    private static PontoAparelhoDto MapearAparelho(PontoAparelhoData a) => new(
        a.Id ?? "",
        a.Apelido,
        a.LojaOrigem,
        a.RevogadoEm == null,
        a.LiberadoEm,
        a.LiberadoPorNome,
        a.RevogadoEm,
        a.RevogadoPorNome,
        a.Latitude != null && a.Longitude != null);

    private static PontoBatidaDto MapearBatida(PontoBatidaData b) => new(
        b.Id ?? "",
        b.Horario,
        b.Tipo,
        b.UsuarioNome,
        b.LojaOrigem,
        b.FotoUrl,
        b.SemGps,
        b.ForaDaLoja,
        b.DistanciaLojaMetros);

    private static DateTime InicioDoDia(DateTime agora) =>
        DateTime.SpecifyKind(agora.Date, DateTimeKind.Utc);

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim().ToLowerInvariant()));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static double DistanciaMetros(double lat1, double lng1, double lat2, double lng2)
    {
        const double r = 6371000;
        var dLat = GrausParaRad(lat2 - lat1);
        var dLng = GrausParaRad(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
            + Math.Cos(GrausParaRad(lat1)) * Math.Cos(GrausParaRad(lat2))
            * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return r * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double GrausParaRad(double g) => g * Math.PI / 180;
}
