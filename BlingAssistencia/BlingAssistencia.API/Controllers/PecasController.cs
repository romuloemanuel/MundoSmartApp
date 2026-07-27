using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/pecas")]
public class PecasController : ControllerBase
{
    private readonly IPecaEstoqueRepository _repo;
    private readonly IEstoqueLoteService _estoque;

    public PecasController(IPecaEstoqueRepository repo, IEstoqueLoteService estoque)
    {
        _repo = repo;
        _estoque = estoque;
    }

    [HttpGet]
    public async Task<IActionResult> Buscar([FromQuery] string? termo)
        => Ok(await _repo.BuscarAsync(termo));

    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id)
    {
        var peca = await _repo.ObterPorIdAsync(id);
        return peca is null ? NotFound() : Ok(peca);
    }

    [HttpPost]
    public async Task<IActionResult> Salvar([FromBody] PecaEstoque peca)
    {
        if (string.IsNullOrWhiteSpace(peca.Nome))
            return BadRequest("Nome da peça é obrigatório.");
        var salva = await _repo.SalvarAsync(peca);
        if (!string.IsNullOrWhiteSpace(salva.Id))
            await _estoque.GarantirLoteCatalogoAsync(salva.Id);
        return Ok(salva);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Excluir(string id)
    {
        var peca = await _repo.ObterPorIdAsync(id);
        if (peca is null) return NotFound();

        if ((peca.QuantidadeEstoque ?? 0) > 0)
            return Conflict(new { erro = "Não é possível excluir peça com saldo em estoque. Zere o estoque antes." });

        var lotesComSaldo = await _estoque.ListarLotesAsync(id, somenteComSaldo: true);
        if (lotesComSaldo.Count > 0)
            return Conflict(new { erro = "Não é possível excluir peça com lotes que ainda possuem saldo." });

        var ok = await _repo.ExcluirAsync(id);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>
    /// Consulta disponibilidade de peças compatíveis com um modelo.
    /// Retorna estoque, quantas OS em execução consomem a peça e valores.
    /// </summary>
    [HttpGet("disponibilidade")]
    public async Task<IActionResult> Disponibilidade(
        [FromQuery] string modeloId,
        [FromQuery] string? pecaId)
    {
        if (string.IsNullOrWhiteSpace(modeloId))
            return BadRequest("modeloId é obrigatório.");
        return Ok(await _repo.ConsultarDisponibilidadeAsync(modeloId, pecaId));
    }
}
