using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.AdminOuRoot)]
[Route("api/controle-custo")]
public class ControleCustoController : ControllerBase
{
    private readonly IControleCustoService _service;

    public ControleCustoController(IControleCustoService service) => _service = service;

    [HttpGet("painel")]
    public async Task<IActionResult> Painel([FromQuery] string? competencia)
    {
        try { return Ok(await _service.PainelAsync(competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpGet("comparativo")]
    public async Task<IActionResult> Comparativo([FromQuery] string? ate, [FromQuery] int quantidade = 6)
    {
        try { return Ok(await _service.ComparativoAsync(ate, quantidade)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpGet("previsao")]
    public async Task<IActionResult> Previsao() =>
        Ok(await _service.PrevisaoAsync());

    [HttpGet("contas-fixas")]
    public async Task<IActionResult> ContasFixas() =>
        Ok(await _service.ListarContasFixasAsync());

    [HttpPost("colaboradores")]
    public async Task<IActionResult> CriarColaborador([FromBody] ColaboradorControleRequest req)
    {
        try { return Ok(await _service.SalvarColaboradorAsync(null, req.Nome, req.Cargo, req.Setores, req.Competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpPut("colaboradores/{id}")]
    public async Task<IActionResult> AtualizarColaborador(string id, [FromBody] ColaboradorControleRequest req)
    {
        try { return Ok(await _service.SalvarColaboradorAsync(id, req.Nome, req.Cargo, req.Setores, req.Competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { erro = ex.Message }); }
    }

    [HttpDelete("colaboradores/{id}")]
    public async Task<IActionResult> ExcluirColaborador(string id, [FromQuery] string? competencia)
    {
        try { return Ok(await _service.ExcluirColaboradorAsync(id, competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { erro = ex.Message }); }
    }

    [HttpPut("faturamento")]
    public async Task<IActionResult> Faturamento([FromBody] FaturamentoControleRequest req)
    {
        try { return Ok(await _service.SalvarFaturamentoAsync(req.Competencia, req.Setor, req.Valor)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpPost("custos")]
    public async Task<IActionResult> Custo([FromBody] CustoControleRequest req)
    {
        try { return Ok(await _service.LancarCustoAsync(req)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpPut("custos/{id}")]
    public async Task<IActionResult> AtualizarCusto(string id, [FromQuery] string? competencia, [FromBody] CustoControleRequest req)
    {
        try { return Ok(await _service.AtualizarCustoAsync(id, req, competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { erro = ex.Message }); }
    }

    [HttpPost("reinvestimentos")]
    public async Task<IActionResult> Reinvestimento([FromBody] ReinvestimentoControleRequest req)
    {
        try { return Ok(await _service.LancarReinvestimentoAsync(req)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
    }

    [HttpDelete("lancamentos/{id}")]
    public async Task<IActionResult> ExcluirLancamento(string id, [FromQuery] string? competencia)
    {
        try { return Ok(await _service.ExcluirLancamentoAsync(id, competencia)); }
        catch (ArgumentException ex) { return BadRequest(new { erro = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { erro = ex.Message }); }
    }
}

public record ColaboradorControleRequest(string? Nome, string? Cargo, List<string>? Setores, string? Competencia);
public record FaturamentoControleRequest(string? Competencia, string? Setor, decimal Valor);
