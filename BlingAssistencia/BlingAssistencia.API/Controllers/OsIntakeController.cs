using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/intake")]
public class OsIntakeController : ControllerBase
{
    private readonly IOsIntakeService _intake;
    private readonly IWebHostEnvironment _env;

    public OsIntakeController(IOsIntakeService intake, IWebHostEnvironment env)
    {
        _intake = intake;
        _env = env;
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> ObterSessao(string token)
    {
        var sessao = await _intake.ObterSessaoAsync(token);
        return sessao is null ? NotFound(new { erro = "Link inválido ou expirado." }) : Ok(sessao);
    }

    [HttpPost("{token}/fotos")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 20 * 1024 * 1024)]
    public async Task<IActionResult> EnviarFoto(
        string token,
        [FromForm] IFormFile? arquivo,
        [FromForm] string? categoria,
        [FromForm] string? descricaoFoco)
    {
        // Celulares às vezes enviam o campo com outro nome — aceita o 1º arquivo do form.
        arquivo ??= Request.Form.Files.GetFile("arquivo")
            ?? Request.Form.Files.FirstOrDefault();

        if (arquivo is null || arquivo.Length == 0)
        {
            Console.WriteLine($"[Intake] Upload sem arquivo. token={token[..Math.Min(8, token.Length)]}… files={Request.Form.Files.Count} contentType={Request.ContentType}");
            return BadRequest(new { erro = "Nenhuma imagem enviada. Tire a foto de novo ou escolha da galeria." });
        }

        try
        {
            Console.WriteLine($"[Intake] Recebendo foto {arquivo.FileName} ({arquivo.Length} bytes) cat={categoria} token={token[..Math.Min(8, token.Length)]}…");
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "uploads");
            var foto = await _intake.AdicionarFotoAsync(token, arquivo, uploadsRoot, categoria, descricaoFoco);
            Console.WriteLine($"[Intake] Foto OK id={foto.Id} os={foto.Url}");
            return Ok(foto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Intake] ERRO upload: {ex}");
            return StatusCode(500, new { erro = "Falha interna ao salvar a foto. Tente novamente." });
        }
    }

    [HttpDelete("{token}/fotos/{fotoId}")]
    public async Task<IActionResult> RemoverFoto(string token, string fotoId)
    {
        try
        {
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "uploads");
            await _intake.RemoverFotoPorTokenAsync(token, fotoId, uploadsRoot);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{token}/senha")]
    public async Task<IActionResult> SalvarSenha(string token, [FromBody] OsIntakeSenhaRequest request)
    {
        try
        {
            var sessao = await _intake.SalvarSenhaAsync(token, request);
            return sessao is null ? NotFound(new { erro = "Link inválido ou expirado." }) : Ok(sessao);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
