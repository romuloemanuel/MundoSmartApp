using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/categorias-peca")]
public class CategoriasPecaController : ControllerBase
{
    private readonly ICategoriaPecaRepository _repo;

    public CategoriasPecaController(ICategoriaPecaRepository repo) => _repo = repo;

    [HttpGet]
    public async Task<IActionResult> Listar() => Ok(await _repo.ListarAsync());

    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id)
    {
        var cat = await _repo.ObterAsync(id);
        return cat is null ? NotFound() : Ok(cat);
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] CategoriaPecaRequest req)
    {
        try
        {
            var criado = await _repo.CriarAsync(
                req.Nome ?? "",
                req.UsaCoresPorModelo ?? false,
                req.Ordem);
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

    [HttpPut("{id}")]
    public async Task<IActionResult> Atualizar(string id, [FromBody] CategoriaPecaRequest req)
    {
        try
        {
            var atualizado = await _repo.AtualizarAsync(
                id,
                req.Nome ?? "",
                req.UsaCoresPorModelo ?? false,
                req.Ordem ?? 0);
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

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id)
    {
        try
        {
            await _repo.ExcluirAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }
}

public record CategoriaPecaRequest(string? Nome, int? Ordem = null, bool? UsaCoresPorModelo = false);
