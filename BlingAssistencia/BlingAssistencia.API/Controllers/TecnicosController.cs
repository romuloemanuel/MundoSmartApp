using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/tecnicos")]
public class TecnicosController : ControllerBase
{
    private readonly ITecnicoRepository _repo;

    public TecnicosController(ITecnicoRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] bool? ativos)
        => Ok(await _repo.ListarAsync(ativos));

    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id)
    {
        var tecnico = await _repo.ObterAsync(id);
        return tecnico is null ? NotFound() : Ok(tecnico);
    }

    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] TecnicoRequest req)
    {
        try
        {
            var criado = await _repo.CriarAsync(req.Nome ?? "");
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
    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] TecnicoRequest req)
    {
        try
        {
            var atualizado = await _repo.AtualizarAsync(id, req.Nome ?? "", req.Ativo ?? true);
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
    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id)
    {
        var ok = await _repo.ExcluirAsync(id);
        return ok ? NoContent() : NotFound();
    }
}

public record TecnicoRequest(string? Nome, bool? Ativo = true);
