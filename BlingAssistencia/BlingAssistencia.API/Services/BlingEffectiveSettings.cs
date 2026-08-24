using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingEffectiveSettings
{
    /// <summary>Settings efetivos (appsettings + override Mongo).</summary>
    BlingSettings Current { get; }
    Task EnsureLoadedAsync(CancellationToken cancellationToken = default);
    Task<BlingConfigAdminDto> ObterAdminAsync(CancellationToken cancellationToken = default);
    Task<BlingConfigAdminDto> SalvarAdminAsync(BlingConfigAdminSalvarDto dto, CancellationToken cancellationToken = default);
}

public class BlingEffectiveSettings : IBlingEffectiveSettings
{
    private readonly BlingSettings _base;
    private readonly IBlingConfigRepository _repo;
    private readonly ILogger<BlingEffectiveSettings> _log;
    private readonly object _gate = new();
    private BlingSettings _current;
    private BlingConfigData? _override;
    private bool _loaded;

    public BlingEffectiveSettings(
        IOptions<BlingSettings> baseOptions,
        IBlingConfigRepository repo,
        ILogger<BlingEffectiveSettings> log)
    {
        _base = baseOptions.Value;
        _repo = repo;
        _log = log;
        _current = Clone(_base);
    }

    public BlingSettings Current
    {
        get
        {
            lock (_gate) return Clone(_current);
        }
    }

    public async Task EnsureLoadedAsync(CancellationToken cancellationToken = default)
    {
        if (_loaded) return;
        await RecarregarAsync(cancellationToken);
    }

    public async Task<BlingConfigAdminDto> ObterAdminAsync(CancellationToken cancellationToken = default)
    {
        await RecarregarAsync(cancellationToken);
        var s = Current;

        return new BlingConfigAdminDto
        {
            ClientId = SemPlaceholder(s.ClientId),
            ClientSecretConfigurado = !string.IsNullOrWhiteSpace(SemPlaceholder(s.ClientSecret)),
            RedirectUri = (s.RedirectUri ?? "").Trim(),
            ConsultaProdutosHabilitada = s.ConsultaProdutosHabilitada,
            ConsultaProdutosSyncMinutos = Math.Max(5, s.ConsultaProdutosSyncMinutos),
            IdCampoPermitePersonalizacao = s.IdCampoPermitePersonalizacao,
            ModoLocal = s.ModoLocal,
            Habilitado = s.Habilitado,
            TemOverrideMongo = _override is not null,
            AtualizadoEm = _override?.AtualizadoEm,
        };
    }

    public async Task<BlingConfigAdminDto> SalvarAdminAsync(
        BlingConfigAdminSalvarDto dto,
        CancellationToken cancellationToken = default)
    {
        var clientId = (dto.ClientId ?? "").Trim();
        var redirect = (dto.RedirectUri ?? "").Trim();
        if (string.IsNullOrWhiteSpace(clientId))
            throw new ArgumentException("Client ID é obrigatório.");
        if (string.IsNullOrWhiteSpace(redirect))
            throw new ArgumentException("Redirect URI é obrigatório.");
        if (!Uri.TryCreate(redirect, UriKind.Absolute, out _))
            throw new ArgumentException("Redirect URI inválida.");

        var syncMin = dto.ConsultaProdutosSyncMinutos > 0 ? dto.ConsultaProdutosSyncMinutos : 15;
        if (syncMin < 5) syncMin = 5;
        if (syncMin > 1440) syncMin = 1440;

        var existente = await _repo.ObterAsync(cancellationToken) ?? new BlingConfigData();
        var novoSecret = (dto.ClientSecret ?? "").Trim();
        var secret = !string.IsNullOrEmpty(novoSecret)
            ? novoSecret
            : SemPlaceholder(existente.ClientSecret);
        if (string.IsNullOrWhiteSpace(secret))
            secret = SemPlaceholder(_base.ClientSecret);

        if (string.IsNullOrWhiteSpace(secret))
            throw new ArgumentException("Client Secret é obrigatório (informe um valor ou configure em appsettings.Development.json).");

        var doc = new BlingConfigData
        {
            ClientId = clientId,
            ClientSecret = secret,
            RedirectUri = redirect,
            ConsultaProdutosHabilitada = dto.ConsultaProdutosHabilitada,
            ConsultaProdutosSyncMinutos = syncMin,
            IdCampoPermitePersonalizacao = dto.IdCampoPermitePersonalizacao < 0
                ? 0
                : dto.IdCampoPermitePersonalizacao,
        };

        await _repo.SalvarAsync(doc, cancellationToken);
        await RecarregarAsync(cancellationToken);
        _log.LogInformation("Config Bling salva por admin (clientId={Id}, sync={Min}min)", clientId, syncMin);
        return await ObterAdminAsync(cancellationToken);
    }

    private async Task RecarregarAsync(CancellationToken cancellationToken)
    {
        try
        {
            var doc = await _repo.ObterAsync(cancellationToken);
            lock (_gate)
            {
                _override = doc;
                _current = Mesclar(_base, doc);
                _loaded = true;
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao carregar override Bling do Mongo — usando appsettings");
            lock (_gate)
            {
                _override = null;
                _current = Clone(_base);
                _loaded = true;
            }
        }
    }

    private static BlingSettings Mesclar(BlingSettings basico, BlingConfigData? o)
    {
        var s = Clone(basico);
        if (o is null) return s;

        if (!string.IsNullOrWhiteSpace(o.ClientId))
            s.ClientId = o.ClientId.Trim();
        if (!string.IsNullOrWhiteSpace(o.ClientSecret))
            s.ClientSecret = o.ClientSecret;
        if (!string.IsNullOrWhiteSpace(o.RedirectUri))
            s.RedirectUri = o.RedirectUri.Trim();
        if (o.ConsultaProdutosHabilitada is not null)
            s.ConsultaProdutosHabilitada = o.ConsultaProdutosHabilitada.Value;
        if (o.ConsultaProdutosSyncMinutos is > 0)
            s.ConsultaProdutosSyncMinutos = o.ConsultaProdutosSyncMinutos.Value;
        if (o.IdCampoPermitePersonalizacao is not null)
            s.IdCampoPermitePersonalizacao = o.IdCampoPermitePersonalizacao.Value;
        return s;
    }

    private static string SemPlaceholder(string? v)
    {
        var t = (v ?? "").Trim();
        if (t.Equals("SEU_CLIENT_ID_AQUI", StringComparison.OrdinalIgnoreCase)
            || t.Equals("SEU_CLIENT_SECRET_AQUI", StringComparison.OrdinalIgnoreCase))
            return "";
        return t;
    }

    private static BlingSettings Clone(BlingSettings s) => new()
    {
        ModoLocal = s.ModoLocal,
        Habilitado = s.Habilitado,
        ConsultaProdutosHabilitada = s.ConsultaProdutosHabilitada,
        ConsultaProdutosSyncMinutos = s.ConsultaProdutosSyncMinutos,
        IdCampoPermitePersonalizacao = s.IdCampoPermitePersonalizacao,
        ClientId = s.ClientId,
        ClientSecret = s.ClientSecret,
        RedirectUri = s.RedirectUri,
        ExigirAutenticacao = s.ExigirAutenticacao,
    };
}
