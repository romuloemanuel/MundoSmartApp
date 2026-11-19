using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/ponto")]
[Authorize(Roles = AppRoles.AdminOuRoot)]
public class PontoController : ControllerBase
{
    public const string HeaderToken = "X-Ponto-Aparelho";

    private readonly IPontoService _ponto;
    private readonly IWebHostEnvironment _env;

    public PontoController(IPontoService ponto, IWebHostEnvironment env)
    {
        _ponto = ponto;
        _env = env;
    }

    [HttpGet("status")]
    public async Task<IActionResult> Status(CancellationToken cancellationToken)
    {
        var token = TokenDoHeader();
        return Ok(await _ponto.ObterStatusAsync(token, cancellationToken));
    }

    [HttpGet("batidas")]
    public async Task<IActionResult> Batidas(CancellationToken cancellationToken) =>
        Ok(await _ponto.ListarBatidasHojeAsync(cancellationToken));

    public record LiberarRequest(
        string? Apelido,
        string? LojaOrigem,
        string? TokenExistente,
        double? Latitude,
        double? Longitude);

    [HttpPost("aparelhos/liberar")]
    public async Task<IActionResult> Liberar([FromBody] LiberarRequest body, CancellationToken cancellationToken)
    {
        try
        {
            var r = await _ponto.LiberarAparelhoAsync(
                Ator(),
                body.TokenExistente ?? TokenDoHeader(),
                body.Apelido ?? "",
                body.LojaOrigem,
                body.Latitude,
                body.Longitude,
                Request.Headers.UserAgent.ToString(),
                cancellationToken);
            return Ok(r);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("aparelhos/{id}/revogar")]
    public async Task<IActionResult> Revogar(string id, CancellationToken cancellationToken)
    {
        try
        {
            await _ponto.RevogarAparelhoAsync(Ator(), id, cancellationToken);
            return Ok(new { ok = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("senha-dia")]
    public async Task<IActionResult> GerarSenha(CancellationToken cancellationToken)
    {
        var senha = await _ponto.GerarSenhaDoDiaAsync(Ator(), cancellationToken);
        return Ok(new { senha });
    }

    [HttpPost("bater")]
    [RequestSizeLimit(8_000_000)]
    public async Task<IActionResult> Bater(
        [FromForm] string usuarioId,
        [FromForm] string tipo,
        [FromForm] string senha,
        [FromForm] double? latitude,
        [FromForm] double? longitude,
        [FromForm] double? precisaoMetros,
        IFormFile? foto,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var stream = foto?.OpenReadStream();
            var uploads = Path.Combine(_env.ContentRootPath, "uploads");
            var batida = await _ponto.BaterAsync(
                TokenDoHeader() ?? "",
                usuarioId,
                tipo,
                senha ?? "",
                latitude,
                longitude,
                precisaoMetros,
                stream,
                uploads,
                cancellationToken);
            return Ok(batida);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(403, new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    private string? TokenDoHeader()
    {
        if (Request.Headers.TryGetValue(HeaderToken, out var v))
        {
            var t = v.ToString().Trim();
            if (t.Length > 0) return t;
        }
        return null;
    }

    private PontoAtor Ator()
    {
        var id = User.FindFirstValue("uid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "";
        var nome = User.FindFirstValue("nome")
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.Identity?.Name
            ?? "Admin";
        return new PontoAtor(id, nome);
    }
}
