using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/consulta-produtos")]
public class ConsultaProdutosController : ControllerBase
{
    private readonly IBlingProdutoConsultaService _service;
    private readonly ILogger<ConsultaProdutosController> _log;

    public ConsultaProdutosController(
        IBlingProdutoConsultaService service,
        ILogger<ConsultaProdutosController> log)
    {
        _service = service;
        _log = log;
    }

    /// <summary>Consulta estoque no cache local (Mongo). Não chama o Bling.</summary>
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
        catch (Exception ex)
        {
            _log.LogError(ex, "Consulta de produtos falhou (categoria={Cat} q={Q})", categoria, q);
            return Ok(new
            {
                categoria = (categoria ?? "").Trim().ToLowerInvariant(),
                termo = q ?? "",
                origem = "erro",
                aviso = "Consulta de produtos falhou inesperadamente. Tente novamente em instantes.",
                grupos = Array.Empty<object>(),
            });
        }
    }

    /// <summary>Status do sync automático Bling → Mongo.</summary>
    [HttpGet("sync-status")]
    public async Task<IActionResult> SyncStatus()
        => Ok(await _service.ObterStatusSyncAsync());

    /// <summary>Força sync agora (botão Atualizar). Opcional: ?categoria=capinhas</summary>
    [HttpPost("sincronizar")]
    public async Task<IActionResult> Sincronizar([FromQuery] string? categoria = null)
    {
        try
        {
            var result = await _service.SincronizarAsync(categoria);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Sync manual consulta-produtos falhou");
            return Ok(new
            {
                ok = false,
                itens = 0,
                aviso = "Não foi possível sincronizar com o Bling agora. O cache local continua disponível.",
            });
        }
    }
}
