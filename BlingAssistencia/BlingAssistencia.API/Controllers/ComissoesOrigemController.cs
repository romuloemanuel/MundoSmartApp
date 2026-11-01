using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/comissoes")]
[Authorize(Roles = AppRoles.AdminOuRoot)]
public class ComissoesOrigemController : ControllerBase
{
    private readonly IComissaoOrigemService _comissoes;

    public ComissoesOrigemController(IComissaoOrigemService comissoes) => _comissoes = comissoes;

    [HttpGet("smartphones")]
    public async Task<IActionResult> Smartphones(
        [FromQuery] string? inicio,
        [FromQuery] string? fim,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _comissoes.SmartphonesAsync(inicio, fim, cancellationToken));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("loja")]
    public async Task<IActionResult> Loja(
        [FromQuery] string? inicio,
        [FromQuery] string? fim,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _comissoes.LojaAsync(inicio, fim, cancellationToken));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
