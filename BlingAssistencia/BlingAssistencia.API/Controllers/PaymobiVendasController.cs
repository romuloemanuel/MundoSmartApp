using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/paymobi")]
[Authorize(Roles = AppRoles.AdminOuRoot)]
public class PaymobiVendasController : ControllerBase
{
    private readonly IPaymobiVendaRepository _repo;
    private readonly IPaymobiSyncService _sync;

    public PaymobiVendasController(IPaymobiVendaRepository repo, IPaymobiSyncService sync)
    {
        _repo = repo;
        _sync = sync;
    }

    [HttpGet("config")]
    public async Task<IActionResult> Config(CancellationToken cancellationToken)
        => Ok(await _sync.ObterConfigAsync(cancellationToken));

    [HttpPut("custos")]
    public async Task<IActionResult> SalvarCustos(
        [FromBody] PaymobiCustosRequest? body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _sync.SalvarCustosAsync(body ?? new PaymobiCustosRequest(), cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("sincronizar")]
    public async Task<IActionResult> Sincronizar(
        [FromBody] PaymobiSincronizarRequest? body,
        CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _sync.SincronizarAsync(body ?? new PaymobiSincronizarRequest(), cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("vendas")]
    public async Task<IActionResult> Listar(
        [FromQuery] string? status,
        [FromQuery] string? termo,
        CancellationToken cancellationToken)
        => Ok(await _repo.ListarAsync(status, termo, cancellationToken));

    [HttpGet("vendas/{id}")]
    public async Task<IActionResult> Obter(string id, CancellationToken cancellationToken)
    {
        var item = await _repo.ObterAsync(id, cancellationToken);
        return item is null ? NotFound() : Ok(item);
    }

    [HttpPost("vendas")]
    public async Task<IActionResult> Criar([FromBody] PaymobiVendaData body, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _repo.CriarAsync(body ?? new PaymobiVendaData(), cancellationToken));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("vendas/{id}")]
    public async Task<IActionResult> Atualizar(
        string id,
        [FromBody] PaymobiVendaData body,
        CancellationToken cancellationToken)
    {
        try
        {
            var atualizado = await _repo.AtualizarAsync(id, body ?? new PaymobiVendaData(), cancellationToken);
            return atualizado is null ? NotFound() : Ok(atualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpDelete("vendas/{id}")]
    public async Task<IActionResult> Excluir(string id, CancellationToken cancellationToken)
    {
        try
        {
            await _repo.ExcluirAsync(id, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("vendas/{id}/cobrancas")]
    public async Task<IActionResult> AdicionarCobranca(
        string id,
        [FromBody] PaymobiCobrancaData body,
        CancellationToken cancellationToken)
    {
        try
        {
            var atualizado = await _repo.AdicionarCobrancaAsync(id, body ?? new PaymobiCobrancaData(), cancellationToken);
            return atualizado is null ? NotFound() : Ok(atualizado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpDelete("vendas/{id}/cobrancas/{cobrancaId}")]
    public async Task<IActionResult> RemoverCobranca(
        string id,
        string cobrancaId,
        CancellationToken cancellationToken)
    {
        var atualizado = await _repo.RemoverCobrancaAsync(id, cobrancaId, cancellationToken);
        return atualizado is null ? NotFound() : Ok(atualizado);
    }
}
