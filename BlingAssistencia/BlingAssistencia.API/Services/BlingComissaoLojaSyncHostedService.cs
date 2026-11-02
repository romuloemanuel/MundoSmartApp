namespace MundoSmart.BlingAssistencia.API.Services;

public sealed class BlingComissaoLojaSyncHostedService : BackgroundService
{
    private static readonly TimeSpan EsperaInicial = TimeSpan.FromSeconds(20);
    private static readonly TimeSpan Intervalo = TimeSpan.FromMinutes(30);

    private readonly IServiceProvider _sp;
    private readonly ILogger<BlingComissaoLojaSyncHostedService> _log;

    public BlingComissaoLojaSyncHostedService(
        IServiceProvider sp,
        ILogger<BlingComissaoLojaSyncHostedService> log)
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
                var svc = scope.ServiceProvider.GetRequiredService<IComissaoOrigemService>();
                await svc.AtualizarLojaAsync(stoppingToken);
                _log.LogInformation("Comissão da loja atualizada com os pedidos do Bling. Próxima em 30 min.");
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha ao atualizar a comissão da loja com o Bling.");
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
