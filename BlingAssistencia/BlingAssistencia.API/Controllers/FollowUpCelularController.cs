using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/follow-ups-celulares")]
public class FollowUpCelularController : ControllerBase
{
    private readonly IFollowUpCelularService _service;

    public FollowUpCelularController(IFollowUpCelularService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Listar(CancellationToken cancellationToken)
    {
        return Ok(await _service.ListarAsync(cancellationToken));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.ObterAsync(id, cancellationToken));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Follow-up não encontrado." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Criar(
        [FromBody] SalvarFollowUpCelularRequest body,
        CancellationToken cancellationToken)
    {
        try
        {
            var criado = await _service.CriarAsync(body, cancellationToken);
            return CreatedAtAction(nameof(Obter), new { id = criado.Id }, criado);
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(
        string id,
        [FromBody] SalvarFollowUpCelularRequest body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.AtualizarAsync(id, body, cancellationToken));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Follow-up não encontrado." });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{id}/follow-ups")]
    public async Task<IActionResult> RegistrarFollowUp(
        string id,
        [FromBody] RegistrarFollowUpCelularRequest body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.RegistrarFollowUpAsync(id, body, cancellationToken));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Follow-up não encontrado." });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{id}/desistencia")]
    public async Task<IActionResult> RegistrarDesistencia(
        string id,
        [FromBody] RegistrarDesistenciaFollowUpCelularRequest body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.RegistrarDesistenciaAsync(id, body, cancellationToken));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Follow-up não encontrado." });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{id}/converter")]
    public async Task<IActionResult> Converter(
        string id,
        [FromBody] ConverterFollowUpCelularRequest? body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _service.ConverterAsync(id, body ?? new ConverterFollowUpCelularRequest(), cancellationToken));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Follow-up não encontrado." });
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
