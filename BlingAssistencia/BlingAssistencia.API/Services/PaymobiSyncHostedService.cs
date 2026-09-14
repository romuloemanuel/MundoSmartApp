namespace MundoSmart.BlingAssistencia.API.Services;

public sealed class PaymobiSyncHostedService : BackgroundService
{
    private static readonly TimeSpan Intervalo = TimeSpan.FromHours(1);
    private static readonly TimeSpan EsperaInicial = TimeSpan.FromMinutes(2);

    private readonly IServiceProvider _sp;
    private readonly ILogger<PaymobiSyncHostedService> _log;
    private readonly IConfiguration _config;

    public PaymobiSyncHostedService(
        IServiceProvider sp,
        ILogger<PaymobiSyncHostedService> log,
        IConfiguration config)
    {
        _sp = sp;
        _log = log;
        _config = config;
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
                if (_config.GetValue("Paymobi:SincronizacaoAutomatica", true))
                {
                    var sync = scope.ServiceProvider.GetRequiredService<IPaymobiSyncService>();
                    var cfg = await sync.ObterConfigAsync(stoppingToken);
                    if (!cfg.SenhaConfigurada)
                    {
                        _log.LogDebug("Sync PayMobi ignorado (conta não configurada).");
                    }
                    else
                    {
                        var res = await sync.SincronizarAsync(
                            new PaymobiSincronizarRequest { SalvarCredenciais = false },
                            stoppingToken);
                        _log.LogInformation(
                            "Sync PayMobi automático OK: {N} vendas. Próximo em 1 hora.",
                            res.Importadas);
                    }
                }
                else
                {
                    _log.LogInformation("Sync PayMobi automático desligado (Paymobi:SincronizacaoAutomatica).");
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("em andamento", StringComparison.OrdinalIgnoreCase))
            {
                _log.LogInformation("Sync PayMobi automático adiado: busca manual em andamento.");
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha no sync automático da PayMobi. Nova tentativa em 1 hora.");
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
}
