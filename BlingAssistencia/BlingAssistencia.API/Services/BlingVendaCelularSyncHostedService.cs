using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public sealed class BlingVendaCelularSyncHostedService : BackgroundService
{
    private static readonly TimeSpan EsperaInicial = TimeSpan.FromMinutes(3);
    private static readonly TimeSpan Intervalo = TimeSpan.FromMinutes(30);

    private readonly IServiceProvider _sp;
    private readonly ILogger<BlingVendaCelularSyncHostedService> _log;

    public BlingVendaCelularSyncHostedService(
        IServiceProvider sp,
        ILogger<BlingVendaCelularSyncHostedService> log)
    {
        _sp = sp;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(EsperaInicial, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _sp.CreateScope();
                var eff = scope.ServiceProvider.GetRequiredService<IBlingEffectiveSettings>();
                await eff.EnsureLoadedAsync(stoppingToken);
                var settings = eff.Current;

                if (!settings.VendasCelularesHabilitada)
                {
                    _log.LogDebug("Sync vendas celular Bling ignorado (desligado).");
                }
                else if (DeveSincronizarAgora(settings))
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IBlingVendaCelularSyncService>();
                    var result = await svc.SincronizarAsync(new BlingVendaCelularSincronizarRequest(), stoppingToken);
                    if (result.Ok)
                        _log.LogInformation(
                            "Sync vendas celular Bling OK: {N} novas, {A} atualizadas. Próximo em 30 min.",
                            result.Importadas, result.Atualizadas);
                    else
                        _log.LogWarning("Sync vendas celular Bling: {Aviso}", result.Aviso);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("em andamento", StringComparison.OrdinalIgnoreCase))
            {
                _log.LogInformation("Sync vendas celular Bling adiado: já em andamento.");
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha no sync de vendas de celular do Bling.");
            }

            try
            {
                await Task.Delay(Intervalo, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    /// <summary>Roda de novo quando a última atualização tem 30 minutos ou mais.</summary>
    private static bool DeveSincronizarAgora(BlingSettings settings)
    {
        if (settings.VendasCelularesUltimaSyncEm is null) return true;

        var last = settings.VendasCelularesUltimaSyncEm.Value;
        if (last.Kind != DateTimeKind.Utc)
            last = DateTime.SpecifyKind(last, DateTimeKind.Utc);
        return DateTime.UtcNow - last >= TimeSpan.FromMinutes(30);
    }
}
