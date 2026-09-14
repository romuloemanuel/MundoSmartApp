using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/documentos")]
public class DocumentosController : ControllerBase
{
    private readonly IDocumentoModeloRepository _repo;

    public DocumentosController(IDocumentoModeloRepository repo) => _repo = repo;

    [HttpGet("tipos-variavel")]
    public async Task<IActionResult> TiposVariavel() => Ok(await _repo.ListarTiposVariavel());

    [HttpGet("variaveis")]
    public async Task<IActionResult> ListarCatalogo(CancellationToken cancellationToken) =>
        Ok(await _repo.ListarCatalogoAsync(cancellationToken));

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPost("variaveis")]
    public async Task<IActionResult> CriarCatalogo(
        [FromBody] DocumentoVariavelCatalogoData body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _repo.CriarCatalogoAsync(body ?? new DocumentoVariavelCatalogoData(), cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPut("variaveis/{id}")]
    public async Task<IActionResult> AtualizarCatalogo(
        string id,
        [FromBody] DocumentoVariavelCatalogoData body,
        CancellationToken cancellationToken)
    {
        try
        {
            var atualizado = await _repo.AtualizarCatalogoAsync(
                id,
                body ?? new DocumentoVariavelCatalogoData(),
                cancellationToken);
            return atualizado is null ? NotFound() : Ok(atualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpDelete("variaveis/{id}")]
    public async Task<IActionResult> ExcluirCatalogo(string id, CancellationToken cancellationToken)
    {
        try
        {
            await _repo.ExcluirCatalogoAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("modelos")]
    public async Task<IActionResult> ListarModelos(
        [FromQuery] bool ativos = false,
        CancellationToken cancellationToken = default) =>
        Ok(await _repo.ListarModelosAsync(ativos, cancellationToken));

    [HttpGet("modelos/{id}")]
    public async Task<IActionResult> ObterModelo(string id, CancellationToken cancellationToken)
    {
        var modelo = await _repo.ObterModeloAsync(id, cancellationToken);
        return modelo is null ? NotFound() : Ok(modelo);
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPost("modelos")]
    public async Task<IActionResult> CriarModelo(
        [FromBody] DocumentoModeloData body,
        CancellationToken cancellationToken)
    {
        try
        {
            var criado = await _repo.CriarModeloAsync(body ?? new DocumentoModeloData(), cancellationToken);
            return Ok(criado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPut("modelos/{id}")]
    public async Task<IActionResult> AtualizarModelo(
        string id,
        [FromBody] DocumentoModeloData body,
        CancellationToken cancellationToken)
    {
        try
        {
            var atualizado = await _repo.AtualizarModeloAsync(
                id,
                body ?? new DocumentoModeloData(),
                cancellationToken);
            return atualizado is null ? NotFound() : Ok(atualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpDelete("modelos/{id}")]
    public async Task<IActionResult> ExcluirModelo(string id, CancellationToken cancellationToken)
    {
        try
        {
            await _repo.ExcluirModeloAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }
}
