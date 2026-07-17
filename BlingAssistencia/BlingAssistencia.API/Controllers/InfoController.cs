using System.Reflection;

using Microsoft.AspNetCore.Authorization;

using Microsoft.AspNetCore.Mvc;

using Microsoft.Extensions.Options;

using MundoSmart.BlingAssistencia.API.Settings;



namespace MundoSmart.BlingAssistencia.API.Controllers;



[ApiController]

[Route("api")]

public class InfoController : ControllerBase

{

    private readonly BlingSettings _bling;



    public InfoController(IOptions<BlingSettings> bling) => _bling = bling.Value;



    [AllowAnonymous]

    [HttpGet("version")]

    public IActionResult Version()

    {

        var assembly = Assembly.GetExecutingAssembly();

        var info = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion

                   ?? assembly.GetName().Version?.ToString()

                   ?? "unknown";



        return Ok(new

        {

            nome = "MundoSmart.BlingAssistencia.API",

            versao = info,

            modoLocal = _bling.ModoLocal,

            blingIntegracao = _bling.Habilitado && !_bling.ModoLocal

        });

    }

}


