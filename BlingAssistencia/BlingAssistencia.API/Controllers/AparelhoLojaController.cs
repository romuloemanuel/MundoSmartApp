using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/aparelhos-loja")]
public class AparelhoLojaController : ControllerBase
{
    private readonly IAparelhoLojaService _loja;
    private readonly IWebHostEnvironment _env;

    public AparelhoLojaController(IAparelhoLojaService loja, IWebHostEnvironment env)
    {
        _loja = loja;
        _env = env;
    }

    [HttpGet("os")]
    public async Task<IActionResult> OsAberta([FromQuery] string? numero, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(numero))
            return Ok(new OsAbertaConsultaDto());
        return Ok(await _loja.ConsultarOsAbertaAsync(numero, cancellationToken));
    }

    [HttpGet]
    public async Task<IActionResult> Painel(CancellationToken cancellationToken)
    {
        var painel = await _loja.PainelAsync(cancellationToken);
        return Ok(ParaQuemPodeVer(painel));
    }

    [HttpPost("compra")]
    public Task<IActionResult> Compra([FromBody] AparelhoCompraRequest? body, CancellationToken cancellationToken)
    {
        var pedido = body ?? new AparelhoCompraRequest();
        pedido.Vendedor = VendedorLogado();
        return Executar(() => _loja.ComprarAsync(pedido, cancellationToken));
    }

    [HttpPost("venda")]
    public Task<IActionResult> Venda([FromBody] AparelhoVendaRequest? body, CancellationToken cancellationToken)
    {
        var pedido = body ?? new AparelhoVendaRequest();
        pedido.Vendedor = VendedorLogado();
        return Executar(() => _loja.VenderAsync(pedido, cancellationToken));
    }

    [HttpPost("troca")]
    public Task<IActionResult> Troca([FromBody] AparelhoTrocaRequest? body, CancellationToken cancellationToken)
    {
        var pedido = body ?? new AparelhoTrocaRequest();
        pedido.Vendedor = VendedorLogado();
        return Executar(() => _loja.TrocarAsync(pedido, cancellationToken));
    }

    [HttpPost("fotos-sessao")]
    public async Task<IActionResult> CriarSessaoFotos([FromQuery] string? appUrl, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _loja.CriarSessaoFotosAsync(appUrl, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost("{id}/liberar")]
    public Task<IActionResult> Liberar(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.LiberarAsync(id, cancellationToken));

    [HttpPost("{id}/fotos")]
    [RequestSizeLimit(130L * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 130L * 1024 * 1024)]
    public async Task<IActionResult> Fotos(string id, [FromForm] List<IFormFile>? arquivos, CancellationToken cancellationToken)
    {
        var enviados = (arquivos ?? []).Where(a => a.Length > 0).ToList();
        try
        {
            foreach (var arquivo in enviados)
                AparelhoLojaService.ValidarTamanhoMidia(arquivo.FileName, arquivo.ContentType, arquivo.Length);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }

        var arquivosLidos = new List<(string Nome, Stream Conteudo)>();
        foreach (var arquivo in enviados)
            arquivosLidos.Add((AparelhoLojaService.NomeMidia(arquivo.FileName, arquivo.ContentType), arquivo.OpenReadStream()));

        try
        {
            var uploads = Path.Combine(_env.ContentRootPath, "uploads");
            return Ok(ParaQuemPodeVer(await _loja.AdicionarFotosAsync(id, arquivosLidos, uploads, cancellationToken)));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        finally
        {
            foreach (var (_, stream) in arquivosLidos)
                await stream.DisposeAsync();
        }
    }

    [HttpPost("operacoes/{id}/estornar")]
    public Task<IActionResult> Estornar(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.EstornarAsync(id, cancellationToken));

    private bool EhAdmin() =>
        User.IsInRole(AppRoles.Admin) || User.IsInRole(AppRoles.Root);

    private AparelhoLojaPainelDto ParaQuemPodeVer(AparelhoLojaPainelDto painel)
    {
        if (EhAdmin()) return painel;

        painel.Resumo.CustoEstoque = 0;
        painel.Resumo.DinheiroRecebido = 0;
        painel.Resumo.DinheiroPago = 0;
        painel.Resumo.SaldoCaixa = 0;
        painel.Resumo.CustoPecas = 0;
        painel.Resumo.CustoMaoDeObra = 0;
        foreach (var vendedor in painel.Resumo.PorVendedor)
        {
            vendedor.DinheiroRecebido = 0;
            vendedor.DinheiroPago = 0;
            vendedor.CustoPecas = 0;
            vendedor.CustoMaoDeObra = 0;
        }

        foreach (var aparelho in painel.Estoque.Concat(painel.CustosAssistencia))
            ZerarCusto(aparelho);
        painel.CustosAssistencia = [];

        foreach (var operacao in painel.Operacoes)
        {
            operacao.DinheiroRecebido = 0;
            operacao.DinheiroPago = 0;
            operacao.PrecoSaida = 0;
            operacao.ValorAvaliado = 0;
            operacao.EntradaLoja = 0;
            operacao.RepasseFinanciadora = 0;
        }

        return painel;
    }

    private static void ZerarCusto(AparelhoLojaDto aparelho)
    {
        aparelho.Custo = 0;
        aparelho.CustoPecas = 0;
        aparelho.CustoMaoDeObra = 0;
        foreach (var custo in aparelho.CustosOs)
        {
            custo.Pecas = 0;
            custo.MaoDeObra = 0;
        }
    }

    private VendedorRef VendedorLogado() => new()
    {
        Id = User.FindFirstValue("uid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
        Nome = User.FindFirstValue(ClaimTypes.Name),
    };

    private async Task<IActionResult> Executar(Func<Task<AparelhoLojaPainelDto>> acao)
    {
        try
        {
            return Ok(ParaQuemPodeVer(await acao()));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
