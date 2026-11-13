using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/receitas")]
[Authorize(Roles = AppRoles.AdminOuRoot)]
public class ReceitasController : ControllerBase
{
    private readonly IReceitaService _receitas;

    public ReceitasController(IReceitaService receitas) => _receitas = receitas;

    [HttpGet]
    public async Task<IActionResult> Painel(
        [FromQuery] string agrupamento = "mensal",
        [FromQuery] int periodos = 6,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(await _receitas.MontarAsync(agrupamento, periodos, cancellationToken));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("bling")]
    public async Task<IActionResult> ListarBling(
        [FromQuery] string inicio,
        [FromQuery] string fim,
        CancellationToken cancellationToken = default)
    {
        if (!DateTime.TryParse(inicio, out var de) || !DateTime.TryParse(fim, out var ate))
            return BadRequest(new { erro = "Informe o início e o fim do período." });
        try
        {
            return Ok(await _receitas.ListarBlingAsync(de.Date, ate.Date, cancellationToken));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("bling/{pedidoId:long}")]
    public async Task<IActionResult> AtualizarBling(
        long pedidoId,
        [FromBody] ReceitaBlingVendaAtualizarRequest request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return Ok(await _receitas.AtualizarBlingAsync(pedidoId, request, cancellationToken));
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
