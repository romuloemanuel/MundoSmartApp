using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/conta")]
public class ContaController : ControllerBase
{
    private readonly IAppAuthService _auth;

    public ContaController(IAppAuthService auth) => _auth = auth;

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _auth.LoginAsync(request.Usuario ?? "", request.Senha ?? "", cancellationToken);
            return Ok(new
            {
                accessToken = result.AccessToken,
                tokenType = "Bearer",
                expiraEm = result.ExpiraEm,
                refreshToken = result.RefreshToken,
                refreshExpiraEm = result.RefreshExpiraEm,
                usuario = result.Usuario,
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
    }

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] ContaRefreshRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _auth.RefreshAsync(request.RefreshToken ?? "", cancellationToken);
            return Ok(new
            {
                accessToken = result.AccessToken,
                tokenType = "Bearer",
                expiraEm = result.ExpiraEm,
                refreshToken = result.RefreshToken,
                refreshExpiraEm = result.RefreshExpiraEm,
                usuario = result.Usuario,
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
    }

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("sessao-qr")]
    public async Task<IActionResult> SessaoQr([FromBody] ContaSessaoQrRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _auth.TrocarHandoffQrAsync(request.Codigo ?? "", cancellationToken);
            return Ok(new
            {
                accessToken = result.AccessToken,
                tokenType = "Bearer",
                expiraEm = result.ExpiraEm,
                refreshToken = result.RefreshToken,
                refreshExpiraEm = result.RefreshExpiraEm,
                usuario = result.Usuario,
            });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var id = UserId();
        if (id is null) return Unauthorized();
        var me = await _auth.ObterMeAsync(id, cancellationToken);
        return me is null ? Unauthorized() : Ok(me);
    }

    [Authorize]
    [HttpPost("alterar-senha")]
    public async Task<IActionResult> AlterarSenha([FromBody] AlterarSenhaRequest request, CancellationToken cancellationToken)
    {
        var id = UserId();
        if (id is null) return Unauthorized();
        try
        {
            await _auth.AlterarSenhaAsync(id, request.SenhaAtual ?? "", request.SenhaNova ?? "", cancellationToken);
            return Ok(new { ok = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Usuário não encontrado." });
        }
    }

    private string? UserId() =>
        User.FindFirstValue("uid")
        ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
}

[ApiController]
[Authorize(Roles = AppRoles.AdminOuRoot)]
[Route("api/usuarios")]
public class UsuariosController : ControllerBase
{
    private readonly IAppAuthService _auth;

    public UsuariosController(IAppAuthService auth) => _auth = auth;

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken cancellationToken)
        => Ok(await _auth.ListarAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CriarUsuarioBody body, CancellationToken cancellationToken)
    {
        try
        {
            var criado = await _auth.CriarAsync(new CriarUsuarioRequest(
                body.Usuario ?? "",
                body.Nome ?? "",
                body.Senha ?? "",
                body.Role ?? AppRoles.Operador,
                body.TecnicoId,
                body.LojaOrigem,
                body.Ativo ?? true), cancellationToken);
            return Ok(criado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] AtualizarUsuarioBody body, CancellationToken cancellationToken)
    {
        try
        {
            var atualizado = await _auth.AtualizarAsync(id, new AtualizarUsuarioRequest(
                body.Nome ?? "",
                body.Role ?? AppRoles.Operador,
                body.TecnicoId,
                body.LojaOrigem,
                body.Ativo ?? true), cancellationToken);
            return Ok(atualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Usuário não encontrado." });
        }
    }

    [HttpPost("{id}/reset-senha")]
    public async Task<IActionResult> ResetSenha(string id, [FromBody] ResetSenhaBody body, CancellationToken cancellationToken)
    {
        try
        {
            await _auth.ResetarSenhaAsync(id, body.SenhaNova ?? "", cancellationToken);
            return Ok(new { ok = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Usuário não encontrado." });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id, CancellationToken cancellationToken)
    {
        var solicitante = User.FindFirstValue("uid")
            ?? User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? "";
        try
        {
            await _auth.ExcluirAsync(id, solicitante, cancellationToken);
            return Ok(new { ok = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Usuário não encontrado." });
        }
    }
}

public record LoginRequest(string? Usuario, string? Senha);
public record ContaRefreshRequest(string? RefreshToken);
public record ContaSessaoQrRequest(string? Codigo);
public record AlterarSenhaRequest(string? SenhaAtual, string? SenhaNova);
public record CriarUsuarioBody(string? Usuario, string? Nome, string? Senha, string? Role, string? TecnicoId, string? LojaOrigem, bool? Ativo);
public record AtualizarUsuarioBody(string? Nome, string? Role, string? TecnicoId, string? LojaOrigem, bool? Ativo);
public record ResetSenhaBody(string? SenhaNova);
