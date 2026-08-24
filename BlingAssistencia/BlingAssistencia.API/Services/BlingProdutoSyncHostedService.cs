using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Sincroniza periodicamente o estoque Bling → Mongo.
/// A tela de consulta lê só o cache (rápido e funciona com Bling fora).
/// </summary>
public sealed class BlingProdutoSyncHostedService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<BlingProdutoSyncHostedService> _log;

    public BlingProdutoSyncHostedService(
        IServiceProvider sp,
        ILogger<BlingProdutoSyncHostedService> log)
    {
        _sp = sp;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Espera a API subir e o token poder ser sincronizado pelo front.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(25), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            var intervaloMin = 15;
            try
            {
                using var scope = _sp.CreateScope();
                var eff = scope.ServiceProvider.GetRequiredService<IBlingEffectiveSettings>();
                await eff.EnsureLoadedAsync(stoppingToken);
                var settings = eff.Current;
                intervaloMin = Math.Max(5, settings.ConsultaProdutosSyncMinutos);

                if (!settings.ConsultaProdutosHabilitada)
                {
                    _log.LogDebug("Sync Bling produtos ignorado (ConsultaProdutosHabilitada=false).");
                }
                else
                {
                    var svc = scope.ServiceProvider.GetRequiredService<IBlingProdutoConsultaService>();
                    var result = await svc.SincronizarAsync(null, stoppingToken);
                    if (result.Ok)
                        _log.LogInformation(
                            "Sync Bling produtos OK: {N} itens. Próximo em {Min} min.",
                            result.Itens, intervaloMin);
                    else
                        _log.LogWarning(
                            "Sync Bling produtos sem dados novos: {Aviso}. Retry em {Min} min.",
                            result.Aviso, intervaloMin);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Falha no sync periódico Bling → Mongo");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(intervaloMin), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
