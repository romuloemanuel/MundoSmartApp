using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Services;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Authorize]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IBlingAuthService _authService;
    private readonly BlingSettings _bling;

    public AuthController(IBlingAuthService authService, IOptions<BlingSettings> bling)
    {
        _authService = authService;
        _bling = bling.Value;
    }

    [HttpGet("login")]
    public IActionResult Login()
    {
        if (_bling.ModoLocal)
            return Ok(new { authorizationUrl = _authService.GetAuthorizationUrl(), modoLocal = true });

        var url = _authService.GetAuthorizationUrl();
        return Ok(new { authorizationUrl = url });
    }

    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "Parâmetro 'code' é obrigatório." });

        var token = await _authService.ExchangeCodeAsync(code);
        return Ok(token);
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { message = "refresh_token é obrigatório." });

        var token = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(token);
    }

    [HttpPost("token")]
    public IActionResult SetToken([FromBody] TokenRequest request)
    {
        _authService.SetToken(new Models.Bling.BlingTokenResponse
        {
            AccessToken = request.AccessToken,
            RefreshToken = request.RefreshToken ?? string.Empty,
            ExpiresIn = request.ExpiresIn,
            TokenType = "Bearer",
            ExpiresAt = DateTime.UtcNow.AddSeconds(request.ExpiresIn)
        });
        return Ok(new { message = "Token configurado com sucesso.", modoLocal = _bling.ModoLocal });
    }
}

public record RefreshRequest(string RefreshToken);
public record TokenRequest(string AccessToken, string? RefreshToken, int ExpiresIn);
