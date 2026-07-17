using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/aparelhos")]
public class AparelhosController : ControllerBase
{
    private readonly IAparelhoRepository _repo;
    private readonly IPecaEstoqueRepository _pecasRepo;

    public AparelhosController(IAparelhoRepository repo, IPecaEstoqueRepository pecasRepo)
    {
        _repo = repo;
        _pecasRepo = pecasRepo;
    }

    [HttpGet("tipos-dispositivo")]
    public IActionResult TiposDispositivo() => Ok(AparelhoConstantes.TiposDispositivo);

    [HttpGet("tipos-compatibilidade")]
    public IActionResult TiposCompatibilidade() => Ok(AparelhoConstantes.TiposCompatibilidade);

    [HttpGet("marcas")]
    public async Task<IActionResult> ListarMarcas(
        [FromQuery] string? termo,
        [FromQuery] string? tipoDispositivo,
        [FromQuery] int limite = 200)
        => Ok(await _repo.ListarMarcasAsync(termo, tipoDispositivo, limite));

    [HttpGet("marcas/{id}")]
    public async Task<IActionResult> ObterMarca(string id)
    {
        var marca = await _repo.ObterMarcaAsync(id);
        return marca is null ? NotFound() : Ok(marca);
    }

    [HttpPost("marcas")]
    public async Task<IActionResult> CriarMarca([FromBody] MarcaRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nome)) return BadRequest("Nome obrigatório.");
        try
        {
            var marca = await _repo.SalvarMarcaAsync(req.Nome.Trim(), req.TipoDispositivo);
            return Ok(marca);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("modelos")]
    public async Task<IActionResult> ListarModelos(
        [FromQuery] string? termo,
        [FromQuery] string? marcaId,
        [FromQuery] string? marcaNome,
        [FromQuery] string? tipoDispositivo,
        [FromQuery] int limite = 500)
        => Ok(await _repo.ListarModelosAsync(termo, marcaId, marcaNome, tipoDispositivo, limite));

    [HttpGet("modelos/{id}")]
    public async Task<IActionResult> ObterModelo(string id)
    {
        var modelo = await _repo.ObterModeloAsync(id);
        return modelo is null ? NotFound() : Ok(modelo);
    }

    [HttpPost("modelos")]
    public async Task<IActionResult> CriarModelo([FromBody] ModeloRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nome)) return BadRequest("Nome obrigatório.");
        if (string.IsNullOrWhiteSpace(req.MarcaNome) && string.IsNullOrWhiteSpace(req.MarcaId))
            return BadRequest("Marca obrigatória.");
        try
        {
            var modelo = await _repo.SalvarModeloAsync(MapModelo(req));
            return Ok(modelo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("modelos/{id}")]
    public async Task<IActionResult> AtualizarModelo(string id, [FromBody] ModeloRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Nome)) return BadRequest("Nome obrigatório.");
        if (string.IsNullOrWhiteSpace(req.MarcaNome) && string.IsNullOrWhiteSpace(req.MarcaId))
            return BadRequest("Marca obrigatória.");
        try
        {
            var modelo = await _repo.AtualizarModeloAsync(id, MapModelo(req));
            return modelo is null ? NotFound() : Ok(modelo);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("modelos/{id}")]
    public async Task<IActionResult> ExcluirModelo(string id)
    {
        try
        {
            var ok = await _repo.ExcluirModeloAsync(id);
            return ok ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [HttpGet("modelos/{modeloId}/servicos-valores")]
    public async Task<IActionResult> ServicosValoresModelo(string modeloId)
    {
        if (string.IsNullOrWhiteSpace(modeloId))
            return BadRequest("modeloId é obrigatório.");
        return Ok(await _pecasRepo.ConsultarServicosValoresAsync(modeloId));
    }

    [HttpGet("modelos/{modeloId}/operacao")]
    public async Task<IActionResult> OperacaoModelo(
        string modeloId,
        [FromQuery] long? excluirOsId)
    {
        if (string.IsNullOrWhiteSpace(modeloId))
            return BadRequest("modeloId é obrigatório.");
        return Ok(await _pecasRepo.ConsultarOperacaoAsync(modeloId, excluirOsId));
    }

    [HttpGet("modelos/{modeloId}/referencia")]
    public async Task<IActionResult> ReferenciaModelo(
        string modeloId,
        [FromQuery] long? excluirOsId)
    {
        if (string.IsNullOrWhiteSpace(modeloId))
            return BadRequest("modeloId é obrigatório.");
        return Ok(await _pecasRepo.ConsultarReferenciaModeloAsync(modeloId, excluirOsId));
    }

    private static ModeloAparelho MapModelo(ModeloRequest req) => new()
    {
        Nome = req.Nome,
        MarcaId = req.MarcaId,
        MarcaNome = req.MarcaNome,
        TipoDispositivo = req.TipoDispositivo ?? "Celular",
        Observacoes = req.Observacoes,
        AparelhosCompativeis = req.AparelhosCompativeis ?? []
    };
}

public record MarcaRequest(string Nome, string? TipoDispositivo = "Celular");

public record ModeloRequest(
    string Nome,
    string? MarcaId,
    string? MarcaNome,
    string? TipoDispositivo = "Celular",
    string? Observacoes = null,
    List<AparelhoCompativel>? AparelhosCompativeis = null);
