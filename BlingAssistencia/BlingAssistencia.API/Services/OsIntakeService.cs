using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IOsIntakeService
{
    Task<OsIntakeTokenResponse> GerarTokenAsync(long blingId, string? appBaseUrl);
    Task<OsIntakeSessaoResponse?> ObterSessaoAsync(string token);
    Task<OsFotoAparelho> AdicionarFotoAsync(string token, IFormFile arquivo, string uploadsRoot, string? categoria = null, string? descricaoFoco = null);
    Task<OsFotoAparelho> AdicionarFotoPorOsIdAsync(long blingId, IFormFile arquivo, string uploadsRoot, string? categoria = null, string? descricaoFoco = null);
    Task RemoverFotoAsync(long blingId, string fotoId, string uploadsRoot);
    Task RemoverFotoPorTokenAsync(string token, string fotoId, string uploadsRoot);
    Task<OsFotoAparelho> AtualizarCategoriaFotoAsync(long blingId, string fotoId, string? categoria, string? descricaoFoco = null);
    Task<OsIntakeSessaoResponse?> SalvarSenhaAsync(string token, OsIntakeSenhaRequest request);
}

public class OsIntakeService : IOsIntakeService
{
    private static readonly TimeSpan TokenValidade = TimeSpan.FromHours(24);
    private static readonly string[] ExtensoesPermitidas = [".jpg", ".jpeg", ".png", ".webp", ".heic"];
    private const long TamanhoMaxBytes = 12 * 1024 * 1024;

    private static readonly string[] CategoriasFotoValidas =
        ["frente", "tras", "esquerda", "direita", "cima", "baixo", "outra"];

    private readonly IOsLocalRepository _repo;
    private readonly IntakeSettings _intake;
    private readonly IHostEnvironment _env;

    public OsIntakeService(
        IOsLocalRepository repo,
        IOptions<IntakeSettings> intake,
        IHostEnvironment env)
    {
        _repo = repo;
        _intake = intake.Value;
        _env = env;
    }

    public async Task<OsIntakeTokenResponse> GerarTokenAsync(long blingId, string? appBaseUrl)
    {
        var local = await _repo.ObterPorBlingIdAsync(blingId)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");

        var token = Guid.NewGuid().ToString("N");
        var expira = DateTime.UtcNow.Add(TokenValidade);
        await _repo.AtualizarIntakeTokenAsync(blingId, token, expira);

        var baseUrl = NormalizarAppUrl(appBaseUrl);
        return new OsIntakeTokenResponse
        {
            Token = token,
            Url = $"{baseUrl}/intake/{token}",
            ExpiraEm = expira,
            OsId = blingId,
            OsNumero = local.OsNumero
        };
    }

    public async Task<OsIntakeSessaoResponse?> ObterSessaoAsync(string token)
    {
        var local = await ObterValidoAsync(token);
        if (local is null) return null;
        return MapearSessao(local);
    }

    public async Task<OsFotoAparelho> AdicionarFotoAsync(string token, IFormFile arquivo, string uploadsRoot, string? categoria = null, string? descricaoFoco = null)
    {
        var local = await ObterValidoAsync(token)
            ?? throw new KeyNotFoundException("Link de recepção inválido ou expirado.");
        return await SalvarFotoAsync(local, arquivo, uploadsRoot, categoria, descricaoFoco);
    }

    public async Task<OsFotoAparelho> AdicionarFotoPorOsIdAsync(long blingId, IFormFile arquivo, string uploadsRoot, string? categoria = null, string? descricaoFoco = null)
    {
        var local = await _repo.ObterPorBlingIdAsync(blingId)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");
        return await SalvarFotoAsync(local, arquivo, uploadsRoot, categoria, descricaoFoco);
    }

    public async Task RemoverFotoAsync(long blingId, string fotoId, string uploadsRoot)
    {
        if (string.IsNullOrWhiteSpace(fotoId))
            throw new ArgumentException("Foto não informada.");

        var local = await _repo.ObterPorBlingIdAsync(blingId)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {blingId} não encontrada.");

        var foto = local.FotosAparelho.FirstOrDefault(f => f.Id == fotoId)
            ?? throw new KeyNotFoundException("Foto não encontrada.");

        var removida = await _repo.RemoverFotoAtomicoAsync(blingId, fotoId);
        if (!removida)
            throw new KeyNotFoundException("Foto não encontrada.");

        var caminhoFisico = Path.Combine(uploadsRoot, "os", blingId.ToString(), foto.NomeArquivo);
        if (System.IO.File.Exists(caminhoFisico))
            System.IO.File.Delete(caminhoFisico);
    }

    public async Task RemoverFotoPorTokenAsync(string token, string fotoId, string uploadsRoot)
    {
        var local = await ObterValidoAsync(token)
            ?? throw new KeyNotFoundException("Link de recepção inválido ou expirado.");
        await RemoverFotoAsync(local.BlingId, fotoId, uploadsRoot);
    }

    public async Task<OsFotoAparelho> AtualizarCategoriaFotoAsync(
        long blingId,
        string fotoId,
        string? categoria,
        string? descricaoFoco = null)
    {
        if (string.IsNullOrWhiteSpace(fotoId))
            throw new ArgumentException("Foto não informada.");

        var cat = NormalizarCategoria(categoria);
        var desc = cat == "outra" ? NormalizarDescricaoFoco(descricaoFoco) : null;

        var foto = await _repo.AtualizarCategoriaFotoAtomicoAsync(blingId, fotoId, cat, desc)
            ?? throw new KeyNotFoundException("Foto não encontrada.");
        return foto;
    }

    public async Task<OsIntakeSessaoResponse?> SalvarSenhaAsync(string token, OsIntakeSenhaRequest request)
    {
        var local = await ObterValidoAsync(token);
        if (local is null) return null;

        // Sempre permite informar ou alterar a senha na página do QR (recepção no celular).
        if (string.IsNullOrWhiteSpace(request.Tipo) || string.IsNullOrWhiteSpace(request.Valor))
            throw new ArgumentException("Informe a senha do aparelho.");

        var tipo = request.Tipo.Trim().ToLowerInvariant();
        if (tipo is not ("numerica" or "desenho"))
            throw new ArgumentException("Tipo de senha inválido.");

        await _repo.AtualizarSenhaDispositivoAsync(local.BlingId, tipo, request.Valor.Trim());
        return await ObterSessaoAsync(token);
    }

    private async Task<OsLocalData?> ObterValidoAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var local = await _repo.ObterPorIntakeTokenAsync(token);
        if (local is null) return null;
        if (local.IntakeTokenExpiraEm.HasValue && local.IntakeTokenExpiraEm < DateTime.UtcNow)
            return null;
        return local;
    }

    private static bool SenhaPendente(OsLocalData local)
    {
        var tipo = local.SenhaDispositivoTipo?.Trim();
        if (string.IsNullOrWhiteSpace(tipo)) return true;
        if (tipo == "nao_deixou") return false;
        if (tipo is "numerica" or "desenho")
            return string.IsNullOrWhiteSpace(local.SenhaDispositivo);
        return false;
    }

    private static OsIntakeSessaoResponse MapearSessao(OsLocalData local) => new()
    {
        OsId = local.BlingId,
        OsNumero = local.OsNumero,
        MarcaNome = local.MarcaNome,
        ModeloNome = local.ModeloNome,
        ClienteNome = local.ContatoNome,
        PrecisaSenha = SenhaPendente(local),
        SenhaPreenchida = !SenhaPendente(local),
        SenhaDispositivoTipo = local.SenhaDispositivoTipo,
        TotalFotos = local.FotosAparelho.Count,
        Fotos = local.FotosAparelho.Select(f => new OsFotoAparelhoInfoDto
        {
            Id = f.Id,
            NomeArquivo = f.NomeArquivo,
            Url = f.Url,
            CriadoEm = f.CriadoEm,
            Categoria = f.Categoria,
            DescricaoFoco = f.DescricaoFoco
        }).ToList(),
        ExpiraEm = local.IntakeTokenExpiraEm
    };

    private async Task<OsFotoAparelho> SalvarFotoAsync(
        OsLocalData local,
        IFormFile arquivo,
        string uploadsRoot,
        string? categoria = null,
        string? descricaoFoco = null)
    {
        if (arquivo.Length <= 0 || arquivo.Length > TamanhoMaxBytes)
            throw new InvalidOperationException("Arquivo inválido ou maior que 12 MB.");

        var ext = Path.GetExtension(arquivo.FileName).ToLowerInvariant();
        if (string.IsNullOrEmpty(ext) || !ExtensoesPermitidas.Contains(ext))
            ext = ".jpg";

        var pastaOs = Path.Combine(uploadsRoot, "os", local.BlingId.ToString());
        Directory.CreateDirectory(pastaOs);

        var id = Guid.NewGuid().ToString("N");
        var nomeArquivo = $"{id}{ext}";
        var caminhoFisico = Path.Combine(pastaOs, nomeArquivo);

        await using (var stream = new FileStream(caminhoFisico, FileMode.Create))
            await arquivo.CopyToAsync(stream);

        var foto = new OsFotoAparelho
        {
            Id = id,
            NomeArquivo = nomeArquivo,
            Url = $"/uploads/os/{local.BlingId}/{nomeArquivo}",
            CriadoEm = HorarioBrasil.Agora,
            Categoria = NormalizarCategoria(categoria),
            DescricaoFoco = NormalizarDescricaoFoco(descricaoFoco)
        };

        // Push atômico: não sobrescreve o documento inteiro (evita apagar fotos concorrentes).
        await _repo.AdicionarFotoAtomicoAsync(local.BlingId, foto);
        return foto;
    }

    private static string NormalizarCategoria(string? categoria)
    {
        var cat = categoria?.Trim().ToLowerInvariant();
        return !string.IsNullOrEmpty(cat) && CategoriasFotoValidas.Contains(cat) ? cat : "outra";
    }

    private static string? NormalizarDescricaoFoco(string? descricao)
    {
        var txt = descricao?.Trim();
        if (string.IsNullOrEmpty(txt)) return null;
        return txt.Length > 120 ? txt[..120] : txt;
    }

    /// <summary>
    /// Development: aceita appUrl do front (IP da LAN). Produção: só Intake:AppBaseUrl / Intake__AppBaseUrl.
    /// </summary>
    private string NormalizarAppUrl(string? appBaseUrl)
    {
        if (_env.IsDevelopment())
        {
            if (!string.IsNullOrWhiteSpace(appBaseUrl))
                return appBaseUrl.Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(_intake.AppBaseUrl))
                return _intake.AppBaseUrl.Trim().TrimEnd('/');
            return "http://localhost:4200";
        }

        if (string.IsNullOrWhiteSpace(_intake.AppBaseUrl))
        {
            throw new InvalidOperationException(
                "Configure Intake:AppBaseUrl (variável de ambiente Intake__AppBaseUrl) com a URL pública do front.");
        }

        return _intake.AppBaseUrl.Trim().TrimEnd('/');
    }
}

public class OsIntakeTokenResponse
{
    public string Token { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime? ExpiraEm { get; set; }
    public long OsId { get; set; }
    public string? OsNumero { get; set; }
}

public class OsIntakeSessaoResponse
{
    public long OsId { get; set; }
    public string? OsNumero { get; set; }
    public string? MarcaNome { get; set; }
    public string? ModeloNome { get; set; }
    public string? ClienteNome { get; set; }
    public bool PrecisaSenha { get; set; }
    public bool SenhaPreenchida { get; set; }
    public string? SenhaDispositivoTipo { get; set; }
    public int TotalFotos { get; set; }
    public List<OsFotoAparelhoInfoDto> Fotos { get; set; } = [];
    public DateTime? ExpiraEm { get; set; }
}

public class OsFotoAparelhoInfoDto
{
    public string Id { get; set; } = string.Empty;
    public string NomeArquivo { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public DateTime CriadoEm { get; set; }
    public string? Categoria { get; set; }
    public string? DescricaoFoco { get; set; }
}

public record OsIntakeSenhaRequest(string Tipo, string Valor);
