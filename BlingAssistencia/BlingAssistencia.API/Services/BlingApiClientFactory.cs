using System.Net.Http.Headers;
using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingApiClientFactory
{
    bool TemToken { get; }
    HttpClient CreateClient();
}

public class BlingApiClientFactory : IBlingApiClientFactory
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IBlingAuthService _authService;

    public BlingApiClientFactory(IHttpClientFactory httpFactory, IBlingAuthService authService)
    {
        _httpFactory = httpFactory;
        _authService = authService;
    }

    public bool TemToken => _authService.GetCurrentToken() is not null;

    public HttpClient CreateClient()
    {
        var http = _httpFactory.CreateClient("Bling");
        var token = _authService.GetCurrentToken();
        if (token is not null)
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        return http;
    }
}
