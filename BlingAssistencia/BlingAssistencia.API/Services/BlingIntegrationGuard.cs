using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingIntegrationGuard
{
    bool IsEnabled { get; }
    void EnsureEnabled();
}

public class BlingIntegrationGuard : IBlingIntegrationGuard
{
    private readonly BlingSettings _settings;

    public BlingIntegrationGuard(IOptions<BlingSettings> options) => _settings = options.Value;

    public bool IsEnabled => _settings.Habilitado;

    public void EnsureEnabled()
    {
        if (!IsEnabled)
            throw new BlingDesabilitadoException();
    }
}
