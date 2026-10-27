namespace MundoSmart.BlingAssistencia.API.Services;

public sealed class PaymobiCobrancaHostedService : BackgroundService
{
    private static readonly TimeSpan Intervalo = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan EsperaInicial = TimeSpan.FromMinutes(3);

    private readonly IServiceProvider _sp;
    private readonly ILogger<PaymobiCobrancaHostedService> _log;

    public PaymobiCobrancaHostedService(
        IServiceProvider sp,
        ILogger<PaymobiCobrancaHostedService> log)
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
                var gestao = scope.ServiceProvider.GetRequiredService<IPaymobiCobrancaGestaoService>();
                var n = await gestao.ProcessarFilaAsync(stoppingToken);
                _log.LogDebug("Fila de cobrança PayMobi atualizada ({N} ações hoje).", n);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha ao processar a fila de cobrança PayMobi. Nova tentativa em 15 min.");
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
