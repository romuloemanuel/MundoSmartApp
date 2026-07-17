using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/clientes")]
public class ClientesController : ControllerBase
{
    private readonly IBlingClienteService _service;

    public ClientesController(IBlingClienteService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] string? nome)
    {
        var clientes = await _service.ListarAsync(nome);
        return Ok(clientes);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Obter(long id)
    {
        var cliente = await _service.ObterAsync(id);
        return Ok(cliente);
    }

    [HttpGet("verificar-cpf")]
    public async Task<IActionResult> VerificarCpf([FromQuery] string cpfCnpj, [FromQuery] long? excluirId)
    {
        if (string.IsNullOrWhiteSpace(cpfCnpj))
            return BadRequest("CPF/CNPJ não informado.");
        return Ok(await _service.VerificarCpfCnpjAsync(cpfCnpj, excluirId));
    }

    [HttpGet("verificar-telefone")]
    public async Task<IActionResult> VerificarTelefone([FromQuery] string telefone, [FromQuery] long? excluirId)
    {
        if (string.IsNullOrWhiteSpace(telefone))
            return BadRequest("Telefone não informado.");
        return Ok(await _service.VerificarTelefoneAsync(telefone, excluirId));
    }

    /// <summary>
    /// Sugere nome para contato alternativo a partir de telefone já conhecido.
    /// Não impede o cadastro (alternativos podem repetir número).
    /// </summary>
    [HttpGet("sugerir-contato-alt")]
    public async Task<IActionResult> SugerirContatoAlt([FromQuery] string telefone)
    {
        if (string.IsNullOrWhiteSpace(telefone))
            return BadRequest("Telefone não informado.");
        return Ok(await _service.SugerirContatoAltAsync(telefone));
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] BlingContato contato)
    {
        try
        {
            var criado = await _service.CriarAsync(contato);
            return CreatedAtAction(nameof(Obter), new { id = criado.Id }, criado);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("CPF/CNPJ") || ex.Message.Contains("Telefone"))
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { erro = "Erro ao cadastrar cliente. Tente novamente." });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Atualizar(long id, [FromBody] BlingContato contato)
    {
        try
        {
            var atualizado = await _service.AtualizarAsync(id, contato);
            return Ok(atualizado);
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("CPF/CNPJ") || ex.Message.Contains("Telefone"))
        {
            return Conflict(new { erro = ex.Message });
        }
        catch (Exception)
        {
            return StatusCode(500, new { erro = "Erro ao atualizar cliente. Tente novamente." });
        }
    }
}
