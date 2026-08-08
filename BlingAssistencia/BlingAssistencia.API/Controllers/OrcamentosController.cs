using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/orcamentos")]
public class OrcamentosController : ControllerBase
{
    private readonly IBlingOrcamentoService _service;

    public OrcamentosController(IBlingOrcamentoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? situacao)
    {
        // Leitura aberta; criação/edição restrita à loja do usuário.
        return Ok(await _service.ListarAsync(situacao));
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Obter(long id)
    {
        try
        {
            return Ok(await _service.ObterAsync(id));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Orçamento não encontrado." });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] BlingOrcamento orcamento)
    {
        try
        {
            orcamento.LojaOrigem = LojaAcessoHelper.AplicarNaCriacao(User, orcamento.LojaOrigem);
            var criado = await _service.CriarAsync(orcamento);
            return CreatedAtAction(nameof(Obter), new { id = criado.Id }, criado);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Atualizar(long id, [FromBody] BlingOrcamento orcamento)
    {
        try
        {
            var existente = await _service.ObterAsync(id);
            // Só edita orçamento da própria loja (Admin sem vínculo edita todos).
            LojaAcessoHelper.GarantirAcesso(User, existente.LojaOrigem, "este orçamento");
            orcamento.LojaOrigem = LojaAcessoHelper.AplicarNaCriacao(User, orcamento.LojaOrigem);
            return Ok(await _service.AtualizarAsync(id, orcamento));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Orçamento não encontrado." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>Converte orçamento em OS diretamente (legado).</summary>
    [HttpPost("{id:long}/converter-os")]
    public async Task<IActionResult> ConverterEmOs(long id)
    {
        try
        {
            var existente = await _service.ObterAsync(id);
            LojaAcessoHelper.GarantirAcesso(User, existente.LojaOrigem, "este orçamento");
            var lojaOs = LojaAcessoHelper.AplicarNaCriacao(User, existente.LojaOrigem);
            var os = await _service.ConverterEmOsAsync(id, lojaOs);
            return Ok(os);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Orçamento não encontrado." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    public sealed class VincularOsRequest
    {
        public long OsBlingId { get; set; }
        public string? OsNumero { get; set; }
    }

    /// <summary>
    /// Vincula o orçamento a uma OS já criada na tela de inclusão (pré-preenchida).
    /// </summary>
    [HttpPost("{id:long}/vincular-os")]
    public async Task<IActionResult> VincularOs(long id, [FromBody] VincularOsRequest body)
    {
        try
        {
            var existente = await _service.ObterAsync(id);
            LojaAcessoHelper.GarantirAcesso(User, existente.LojaOrigem, "este orçamento");
            await _service.VincularOsAsync(id, body.OsBlingId, body.OsNumero);
            return Ok(new { ok = true });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Orçamento não encontrado." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>
    /// Registra follow-up com anotação do colaborador (conta 1 contato) e agenda a próxima data.
    /// </summary>
    [HttpPost("{id:long}/follow-ups")]
    public async Task<IActionResult> RegistrarFollowUp(long id, [FromBody] RegistrarFollowUpOrcamentoRequest body)
    {
        try
        {
            var existente = await _service.ObterAsync(id);
            LojaAcessoHelper.GarantirAcesso(User, existente.LojaOrigem, "este orçamento");
            return Ok(await _service.RegistrarFollowUpAsync(id, body));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Orçamento não encontrado." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
