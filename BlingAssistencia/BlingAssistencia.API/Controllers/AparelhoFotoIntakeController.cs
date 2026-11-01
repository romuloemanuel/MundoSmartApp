using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/aparelho-fotos")]
public class AparelhoFotoIntakeController : ControllerBase
{
    private readonly IAparelhoLojaService _loja;

    public AparelhoFotoIntakeController(IAparelhoLojaService loja)
    {
        _loja = loja;
    }

    [HttpGet("{token}")]
    public async Task<IActionResult> Obter(string token, CancellationToken cancellationToken)
    {
        var sessao = await _loja.ObterSessaoFotosAsync(token, cancellationToken);
        return sessao is null ? NotFound(new { erro = "Este QR expirou. Peça outro no balcão." }) : Ok(sessao);
    }

    [HttpPost("{token}")]
    [RequestSizeLimit(50L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 50L * 1024 * 1024)]
    public async Task<IActionResult> Enviar(string token, [FromForm] IFormFile? arquivo, CancellationToken cancellationToken)
    {
        arquivo ??= Request.Form.Files.FirstOrDefault();
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { erro = "Nenhuma foto ou vídeo enviado. Abra a câmera e tente de novo." });

        try
        {
            AparelhoLojaService.ValidarTamanhoMidia(arquivo.FileName, arquivo.ContentType, arquivo.Length);
            await using var stream = arquivo.OpenReadStream();
            var foto = await _loja.ReceberFotoSessaoAsync(
                token,
                AparelhoLojaService.NomeMidia(arquivo.FileName, arquivo.ContentType),
                stream,
                cancellationToken);
            return Ok(foto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
