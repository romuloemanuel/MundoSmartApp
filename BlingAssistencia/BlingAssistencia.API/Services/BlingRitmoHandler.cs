using System.Net;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// O Bling aceita 3 requisições por segundo. Várias leituras ao mesmo tempo
/// (comissão e catálogo) estouram esse limite e a importação de produtos falha.
/// </summary>
public sealed class BlingRitmoHandler : DelegatingHandler
{
    private static readonly SemaphoreSlim Porta = new(1, 1);
    private static readonly TimeSpan Intervalo = TimeSpan.FromMilliseconds(400);
    private static long _proximaTicks;

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        for (var tentativa = 1; tentativa <= 5; tentativa++)
        {
            await EsperarVagaAsync(cancellationToken);
            using var envio = Clonar(request);
            var resposta = await base.SendAsync(envio, cancellationToken);
            if (resposta.StatusCode != HttpStatusCode.TooManyRequests || tentativa == 5)
                return resposta;

            resposta.Dispose();
            await Task.Delay(TimeSpan.FromSeconds(tentativa), cancellationToken);
        }

        throw new InvalidOperationException("Leitura do Bling não concluída.");
    }

    private static async Task EsperarVagaAsync(CancellationToken cancellationToken)
    {
        await Porta.WaitAsync(cancellationToken);
        try
        {
            var agora = DateTime.UtcNow.Ticks;
            var espera = _proximaTicks - agora;
            if (espera > 0)
                await Task.Delay(TimeSpan.FromTicks(espera), cancellationToken);
            _proximaTicks = DateTime.UtcNow.Ticks + Intervalo.Ticks;
        }
        finally
        {
            Porta.Release();
        }
    }

    private static HttpRequestMessage Clonar(HttpRequestMessage origem)
    {
        var copia = new HttpRequestMessage(origem.Method, origem.RequestUri);
        foreach (var header in origem.Headers)
            copia.Headers.TryAddWithoutValidation(header.Key, header.Value);
        return copia;
    }
}
