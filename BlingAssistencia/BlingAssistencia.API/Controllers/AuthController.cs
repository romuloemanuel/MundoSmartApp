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
    [AllowAnonymous]
    public IActionResult Login()
    {
        // OAuth só para consulta de capinhas/estoque — não habilita sync de OS/clientes.
        if (!_bling.ConsultaProdutosHabilitada)
            return BadRequest(new { message = "Consulta de produtos Bling desabilitada." });

        var url = _authService.GetAuthorizationUrl();
        return Ok(new
        {
            authorizationUrl = url,
            modoLocal = _bling.ModoLocal,
            escopo = "consulta-produtos",
        });
    }

    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return BadRequest(new { message = "Parâmetro 'code' é obrigatório." });

        try
        {
            var token = await _authService.ExchangeCodeAsync(code);
            return Ok(token);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
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
    [AllowAnonymous]
    public IActionResult SetToken([FromBody] TokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AccessToken))
            return BadRequest(new { message = "accessToken é obrigatório." });

        _authService.SetToken(new Models.Bling.BlingTokenResponse
        {
            AccessToken = request.AccessToken,
            RefreshToken = request.RefreshToken ?? string.Empty,
            ExpiresIn = request.ExpiresIn > 0 ? request.ExpiresIn : 3600,
            TokenType = "Bearer",
            ExpiresAt = DateTime.UtcNow.AddSeconds(request.ExpiresIn > 0 ? request.ExpiresIn : 3600)
        });
        return Ok(new
        {
            message = "Token Bling configurado (consulta de produtos).",
            modoLocal = _bling.ModoLocal,
            consultaProdutos = _bling.ConsultaProdutosHabilitada,
        });
    }
}

public record RefreshRequest(string RefreshToken);
public record TokenRequest(string AccessToken, string? RefreshToken, int ExpiresIn);
