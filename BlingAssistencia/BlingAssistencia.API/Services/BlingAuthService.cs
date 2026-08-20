using System.Net.Http.Headers;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Models.Bling;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingAuthService
{
    string GetAuthorizationUrl();
    Task<BlingTokenResponse> ExchangeCodeAsync(string code);
    Task<BlingTokenResponse> RefreshTokenAsync(string refreshToken);
    BlingTokenResponse? GetCurrentToken();
    void SetToken(BlingTokenResponse token);
}

public class BlingAuthService : IBlingAuthService
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;
    private BlingTokenResponse? _currentToken;

    private string ClientId => _config["Bling:ClientId"] ?? throw new InvalidOperationException("Bling:ClientId não configurado.");
    private string ClientSecret => _config["Bling:ClientSecret"] ?? throw new InvalidOperationException("Bling:ClientSecret não configurado.");
    private string RedirectUri => _config["Bling:RedirectUri"] ?? throw new InvalidOperationException("Bling:RedirectUri não configurado.");

    public BlingAuthService(IConfiguration config, IHttpClientFactory httpClientFactory)
    {
        _config = config;
        _http = httpClientFactory.CreateClient("BlingAuth");
    }

    public string GetAuthorizationUrl()
    {
        var state = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16))
            .ToLowerInvariant();
        return $"https://www.bling.com.br/Api/v3/oauth/authorize" +
               $"?response_type=code" +
               $"&client_id={Uri.EscapeDataString(ClientId)}" +
               $"&state={state}" +
               $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}";
    }

    public async Task<BlingTokenResponse> ExchangeCodeAsync(string code)
    {
        var credentials = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.bling.com.br/Api/v3/oauth/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = RedirectUri
        });

        var response = await _http.SendAsync(request);
        var json = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"Bling token HTTP {(int)response.StatusCode}: {json}");
        }

        var result = JsonSerializer.Deserialize<BlingTokenRaw>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Resposta de token Bling inválida.");

        _currentToken = MapToken(result);
        return _currentToken;
    }

    public async Task<BlingTokenResponse> RefreshTokenAsync(string refreshToken)
    {
        var credentials = Convert.ToBase64String(
            System.Text.Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.bling.com.br/Api/v3/oauth/token");
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "refresh_token",
            ["refresh_token"] = refreshToken
        });

        var response = await _http.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingTokenRaw>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        _currentToken = MapToken(result);
        return _currentToken;
    }

    public BlingTokenResponse? GetCurrentToken() => _currentToken;

    public void SetToken(BlingTokenResponse token) => _currentToken = token;

    private static BlingTokenResponse MapToken(BlingTokenRaw raw) => new()
    {
        AccessToken = raw.Access_token ?? string.Empty,
        RefreshToken = raw.Refresh_token ?? string.Empty,
        ExpiresIn = raw.Expires_in,
        TokenType = raw.Token_type ?? "Bearer",
        ExpiresAt = DateTime.UtcNow.AddSeconds(raw.Expires_in)
    };

    private sealed class BlingTokenRaw
    {
        public string? Access_token { get; set; }
        public string? Refresh_token { get; set; }
        public int Expires_in { get; set; }
        public string? Token_type { get; set; }
    }
}
