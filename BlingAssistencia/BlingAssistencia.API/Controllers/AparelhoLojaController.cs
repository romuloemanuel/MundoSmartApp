using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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
    private readonly IBlingEstoqueCelularImportService _estoqueBling;
    private readonly IWebHostEnvironment _env;

    public AparelhoLojaController(
        IAparelhoLojaService loja,
        IBlingEstoqueCelularImportService estoqueBling,
        IWebHostEnvironment env)
    {
        _loja = loja;
        _estoqueBling = estoqueBling;
        _env = env;
    }

    [HttpPost("importar-bling")]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public async Task<IActionResult> ImportarEstoqueBling(CancellationToken cancellationToken)
    {
        var result = await _estoqueBling.ImportarAsync(cancellationToken);
        return Ok(result);
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
    public async Task<IActionResult> CriarSessaoFotos([FromQuery] string? appUrl, [FromQuery] string? aparelhoId, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _loja.CriarSessaoFotosAsync(appUrl, aparelhoId, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Obter(string id, CancellationToken cancellationToken)
    {
        try
        {
            var dto = await _loja.ObterAsync(id, cancellationToken);
            if (!EhAdmin()) ZerarCusto(dto);
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPut("{id}/cadastro")]
    public Task<IActionResult> EditarCadastro(string id, [FromBody] AparelhoEntradaRequest? body, CancellationToken cancellationToken) =>
        Executar(() => _loja.EditarCadastroAsync(id, body ?? new AparelhoEntradaRequest(), cancellationToken));

    [HttpPost("{id}/imei")]
    public Task<IActionResult> InformarImei(string id, [FromBody] AparelhoImeiRequest? body, CancellationToken cancellationToken) =>
        Executar(() => _loja.InformarImeiAsync(id, body?.Imei, cancellationToken));

    [HttpPost("{id}/liberar")]
    public Task<IActionResult> Liberar(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.LiberarAsync(id, cancellationToken));

    [HttpGet("{id}/fotos")]
    public async Task<IActionResult> ListarFotos(string id, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await _loja.ListarFotosAsync(id, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

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
            var categoria = Request.Form["categoria"].FirstOrDefault();
            var descricao = Request.Form["descricaoFoco"].FirstOrDefault();
            return Ok(ParaQuemPodeVer(await _loja.AdicionarFotosAsync(id, arquivosLidos, uploads, categoria, descricao, cancellationToken)));
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

    [HttpDelete("{id}/fotos/{fotoId}")]
    public Task<IActionResult> RemoverFoto(string id, string fotoId, CancellationToken cancellationToken) =>
        Executar(() => _loja.RemoverFotoAsync(id, fotoId, cancellationToken));

    [HttpPost("operacoes/{id}/estornar")]
    public Task<IActionResult> Estornar(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.EstornarAsync(id, cancellationToken));

    [HttpPut("operacoes/{id}/vendedor")]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public Task<IActionResult> AlterarVendedor(string id, [FromBody] VendedorRef? body, CancellationToken cancellationToken) =>
        Executar(() => _loja.AlterarVendedorAsync(id, body, cancellationToken));

    [HttpDelete("operacoes/{id}")]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public Task<IActionResult> ExcluirOperacao(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.ExcluirOperacaoAsync(id, cancellationToken));

    [HttpDelete("{id}")]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public Task<IActionResult> ExcluirAparelho(string id, CancellationToken cancellationToken) =>
        Executar(() => _loja.ExcluirAparelhoAsync(id, cancellationToken));

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
        foreach (var cadeia in painel.Cadeias)
            ZerarDinheiroDaCadeia(cadeia);
        painel.Meses = [];

        foreach (var operacao in painel.Operacoes)
        {
            operacao.DinheiroRecebido = 0;
            operacao.DinheiroPago = 0;
            operacao.PrecoSaida = 0;
            operacao.ValorAvaliado = 0;
            operacao.EntradaLoja = 0;
            operacao.RepasseFinanciadora = 0;
            foreach (var item in operacao.Entrou.Concat(operacao.Saiu))
            {
                item.Custo = 0;
                item.CustoPecas = 0;
                item.CustoTotal = 0;
            }
        }

        foreach (var movimento in painel.Movimentos)
            movimento.Valor = 0;

        return painel;
    }

    private static void ZerarDinheiroDaCadeia(AparelhoCadeiaDto cadeia)
    {
        cadeia.DinheiroEntrou = 0;
        cadeia.DinheiroSaiu = 0;
        cadeia.CustoPecas = 0;
        cadeia.Investido = 0;
        cadeia.ResultadoAteAgora = 0;
        cadeia.LucroFinal = null;
        foreach (var passo in cadeia.Passos)
        {
            passo.DinheiroEntrou = 0;
            passo.DinheiroSaiu = 0;
            passo.Resultado = 0;
            foreach (var item in passo.Entrou.Concat(passo.Saiu))
                item.Custo = 0;
        }
    }

    private static void ZerarCusto(AparelhoLojaDto aparelho)
    {
        aparelho.Custo = 0;
        aparelho.CustoTotal = 0;
        aparelho.CustoPecas = 0;
        aparelho.CustoMaoDeObra = 0;
        foreach (var custo in aparelho.CustosOs)
        {
            custo.Pecas = 0;
            custo.MaoDeObra = 0;
        }
    }

    private VendedorRef VendedorLogado()
    {
        var login = User.FindFirstValue("unique_name");
        var nomeCadastro = User.FindFirstValue("nome");
        var nomes = User.FindAll(ClaimTypes.Name)
            .Select(c => c.Value)
            .Where(v => !string.IsNullOrWhiteSpace(v))
            .ToList();
        var nome = !string.IsNullOrWhiteSpace(nomeCadastro)
            ? nomeCadastro.Trim()
            : nomes.FirstOrDefault(n => !string.Equals(n, login, StringComparison.OrdinalIgnoreCase))
                ?? nomes.FirstOrDefault()
                ?? login;
        return new()
        {
            Id = User.FindFirstValue("uid") ?? User.FindFirstValue(ClaimTypes.NameIdentifier),
            Nome = nome,
        };
    }

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
