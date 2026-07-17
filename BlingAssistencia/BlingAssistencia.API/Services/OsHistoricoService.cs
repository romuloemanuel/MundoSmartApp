using System.Security.Claims;
using MongoDB.Bson;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IOsHistoricoService
{
    Task RegistrarAsync(OsLocalData local, string acao, string? resumo = null);
    Task<List<OsHistoricoResumoDto>> ListarAsync(long osBlingId);
    Task<OsHistoricoConsultaDto> ConsultarAsync(OsHistoricoConsultaFiltros filtros);
    Task<OsHistoricoDetalheDto?> ObterVersaoAsync(long osBlingId, int versao);
}

public class OsHistoricoService : IOsHistoricoService
{
    private readonly IOsHistoricoRepository _repo;
    private readonly IHttpContextAccessor _http;

    public OsHistoricoService(IOsHistoricoRepository repo, IHttpContextAccessor http)
    {
        _repo = repo;
        _http = http;
    }

    public async Task RegistrarAsync(OsLocalData local, string acao, string? resumo = null)
    {
        var versao = await _repo.ProximaVersaoAsync(local.BlingId);
        var (uid, nome) = ObterAtor();

        // Snapshot sem token de intake (não é dado de negócio).
        var clone = CloneParaSnapshot(local);
        clone.IntakeToken = null;
        clone.IntakeTokenExpiraEm = null;

        await _repo.InserirAsync(new OsHistoricoVersao
        {
            OsBlingId = local.BlingId,
            OsNumero = local.OsNumero,
            LojaOrigem = Config.OsLojaHelper.Normalizar(local.LojaOrigem),
            Versao = versao,
            Acao = acao,
            Resumo = resumo ?? ResumoPadrao(acao, local),
            UsuarioId = uid,
            UsuarioNome = nome,
            Snapshot = clone.ToBsonDocument(),
            CriadoEm = DateTime.UtcNow,
        });
    }

    public async Task<List<OsHistoricoResumoDto>> ListarAsync(long osBlingId)
    {
        var lista = await _repo.ListarResumoAsync(osBlingId);
        return lista.Select(MapResumo).ToList();
    }

    public async Task<OsHistoricoConsultaDto> ConsultarAsync(OsHistoricoConsultaFiltros filtros)
    {
        var resultado = await _repo.ConsultarAsync(filtros);
        return new OsHistoricoConsultaDto
        {
            Itens = resultado.Itens.Select(MapResumo).ToList(),
            Total = resultado.Total,
            Pagina = resultado.Pagina,
            TamanhoPagina = resultado.TamanhoPagina,
        };
    }

    private static OsHistoricoResumoDto MapResumo(OsHistoricoVersao v) => new()
    {
        Id = v.Id,
        OsBlingId = v.OsBlingId,
        OsNumero = v.OsNumero,
        Versao = v.Versao,
        Acao = v.Acao,
        Resumo = v.Resumo,
        UsuarioId = v.UsuarioId,
        UsuarioNome = v.UsuarioNome,
        CriadoEm = v.CriadoEm,
    };

    public async Task<OsHistoricoDetalheDto?> ObterVersaoAsync(long osBlingId, int versao)
    {
        var v = await _repo.ObterAsync(osBlingId, versao);
        if (v is null) return null;

        OsLocalData? local = null;
        try
        {
            local = MongoDB.Bson.Serialization.BsonSerializer.Deserialize<OsLocalData>(v.Snapshot);
        }
        catch
        {
            /* snapshot legado/incompatível */
        }

        return new OsHistoricoDetalheDto
        {
            Id = v.Id,
            OsBlingId = v.OsBlingId,
            OsNumero = v.OsNumero,
            Versao = v.Versao,
            Acao = v.Acao,
            Resumo = v.Resumo,
            UsuarioId = v.UsuarioId,
            UsuarioNome = v.UsuarioNome,
            CriadoEm = v.CriadoEm,
            Snapshot = local is null ? null : BlingLocalMappings.ParaOrdemServico(local),
        };
    }

    private (string? Id, string? Nome) ObterAtor()
    {
        var user = _http.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
            return ("sistema", "Sistema");

        var id = user.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? user.FindFirstValue("sub")
            ?? "desconhecido";
        var nome = user.FindFirstValue(ClaimTypes.Name)
            ?? user.Identity?.Name
            ?? id;
        return (id, nome);
    }

    private static string ResumoPadrao(string acao, OsLocalData local) => acao switch
    {
        OsHistoricoAcoes.Criar => $"OS #{local.OsNumero ?? local.BlingId.ToString()} criada",
        OsHistoricoAcoes.Excluir => $"OS #{local.OsNumero ?? local.BlingId.ToString()} excluída",
        OsHistoricoAcoes.Situacao => $"Situação: {local.Situacao}",
        _ => $"OS #{local.OsNumero ?? local.BlingId.ToString()} atualizada",
    };

    private static OsLocalData CloneParaSnapshot(OsLocalData o) =>
        MongoDB.Bson.Serialization.BsonSerializer.Deserialize<OsLocalData>(o.ToBsonDocument());
}

public class OsHistoricoResumoDto
{
    public string? Id { get; set; }
    public long OsBlingId { get; set; }
    public string? OsNumero { get; set; }
    public int Versao { get; set; }
    public string Acao { get; set; } = "";
    public string? Resumo { get; set; }
    public string? UsuarioId { get; set; }
    public string? UsuarioNome { get; set; }
    public DateTime CriadoEm { get; set; }
}

public class OsHistoricoDetalheDto : OsHistoricoResumoDto
{
    public BlingOrdemServico? Snapshot { get; set; }
}

public class OsHistoricoConsultaDto
{
    public List<OsHistoricoResumoDto> Itens { get; set; } = [];
    public long Total { get; set; }
    public int Pagina { get; set; }
    public int TamanhoPagina { get; set; }
}
