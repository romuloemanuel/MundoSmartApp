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
    private readonly IBlingEffectiveSettings _blingConfig;
    private readonly IBlingAuthService _blingAuth;

    public ConfigController(
        IEstoqueNivelService estoqueNivel,
        IAssistenciaConfigService assistenciaConfig,
        IBlingEffectiveSettings blingConfig,
        IBlingAuthService blingAuth)
    {
        _estoqueNivel = estoqueNivel;
        _assistenciaConfig = assistenciaConfig;
        _blingConfig = blingConfig;
        _blingAuth = blingAuth;
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

    /// <summary>Credenciais e flags Bling para produção (somente Admin/Root).</summary>
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpGet("bling")]
    public async Task<IActionResult> Bling(CancellationToken cancellationToken)
    {
        var dto = await _blingConfig.ObterAdminAsync(cancellationToken);
        var token = _blingAuth.GetCurrentToken();
        dto.TokenConectado = token is not null && token.ExpiresAt > DateTime.UtcNow;
        dto.TokenExpiraEm = token?.ExpiresAt;
        return Ok(dto);
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPut("bling")]
    public async Task<IActionResult> SalvarBling(
        [FromBody] BlingConfigAdminSalvarDto dto,
        CancellationToken cancellationToken)
    {
        try
        {
            var salvo = await _blingConfig.SalvarAdminAsync(dto, cancellationToken);
            var token = _blingAuth.GetCurrentToken();
            salvo.TokenConectado = token is not null && token.ExpiresAt > DateTime.UtcNow;
            salvo.TokenExpiraEm = token?.ExpiresAt;
            return Ok(salvo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
