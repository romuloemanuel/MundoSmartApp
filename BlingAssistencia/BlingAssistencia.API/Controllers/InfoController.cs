using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api")]
public class InfoController : ControllerBase
{
    private readonly IBlingEffectiveSettings _bling;

    public InfoController(IBlingEffectiveSettings bling) => _bling = bling;

    [AllowAnonymous]
    [HttpGet("version")]
    public async Task<IActionResult> Version()
    {
        await _bling.EnsureLoadedAsync();
        var assembly = Assembly.GetExecutingAssembly();
        var info = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                   ?? assembly.GetName().Version?.ToString()
                   ?? "unknown";

        var s = _bling.Current;
        return Ok(new
        {
            nome = "MundoSmart.BlingAssistencia.API",
            versao = info,
            modoLocal = s.ModoLocal,
            blingIntegracao = false,
            blingConsultaProdutos = s.ConsultaProdutosHabilitada
        });
    }
}
