using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/consulta-produtos")]
public class ConsultaProdutosController : ControllerBase
{
    private readonly IBlingProdutoConsultaService _service;

    public ConsultaProdutosController(IBlingProdutoConsultaService service)
    {
        _service = service;
    }

    /// <summary>
    /// Consulta estoque de capinhas, películas ou térmicos pelo modelo.
    /// Usa Bling quando o token estiver válido; senão o cache local.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Consultar(
        [FromQuery] string categoria,
        [FromQuery] string? q,
        [FromQuery] bool incluirZerados = false)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(categoria))
                return BadRequest(new { erro = "Informe a categoria (capinhas, peliculas ou termicos)." });

            return Ok(await _service.ConsultarAsync(categoria, q, incluirZerados));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
