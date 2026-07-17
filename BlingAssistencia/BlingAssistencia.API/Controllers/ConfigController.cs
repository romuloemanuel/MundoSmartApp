using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly IEstoqueNivelService _estoqueNivel;
    private readonly IAssistenciaConfigService _assistenciaConfig;

    public ConfigController(IEstoqueNivelService estoqueNivel, IAssistenciaConfigService assistenciaConfig)
    {
        _estoqueNivel = estoqueNivel;
        _assistenciaConfig = assistenciaConfig;
    }

    [HttpGet("estoque")]
    [AllowAnonymous]
    public IActionResult EstoqueLimites() => Ok(_estoqueNivel.ObterLimites());

    [HttpGet("impressao-os")]
    [AllowAnonymous]
    public async Task<IActionResult> ImpressaoOs(CancellationToken cancellationToken)
        => Ok(await _assistenciaConfig.ObterImpressaoOsAsync(cancellationToken));

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPut("impressao-os")]
    public async Task<IActionResult> SalvarImpressaoOs(
        [FromBody] ImpressaoOsConfigDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            var salvo = await _assistenciaConfig.SalvarImpressaoOsAsync(dto, cancellationToken);
            return Ok(salvo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("acrescimo-estoque")]
    [AllowAnonymous]
    public async Task<IActionResult> AcrescimoEstoque(CancellationToken cancellationToken)
        => Ok(await _assistenciaConfig.ObterAcrescimoEstoqueAsync(cancellationToken));

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPut("acrescimo-estoque")]
    public async Task<IActionResult> SalvarAcrescimoEstoque(
        [FromBody] AcrescimoEstoqueConfigDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            var salvo = await _assistenciaConfig.SalvarAcrescimoEstoqueAsync(dto, cancellationToken);
            return Ok(salvo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
