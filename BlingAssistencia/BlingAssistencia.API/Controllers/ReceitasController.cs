using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
}
