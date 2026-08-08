using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/estoque")]
public class EstoqueController : ControllerBase
{
    private readonly IEstoqueLoteService _estoque;
    private readonly IPecaEstoqueRepository _pecas;

    public EstoqueController(IEstoqueLoteService estoque, IPecaEstoqueRepository pecas)
    {
        _estoque = estoque;
        _pecas = pecas;
    }

    [HttpGet("pedidos")]
    public async Task<IActionResult> ListarPedidos() =>
        Ok(await _estoque.ListarPedidosAsync());

    [HttpGet("pedidos/{id}")]
    public async Task<IActionResult> ObterPedido(string id)
    {
        var detalhe = await _estoque.ObterPedidoAsync(id);
        return detalhe is null ? NotFound() : Ok(detalhe);
    }

    [HttpPost("pedidos")]
    public async Task<IActionResult> RegistrarPedido([FromBody] RegistrarPedidoCompraRequest request)
    {
        try
        {
            return Ok(await _estoque.RegistrarPedidoAsync(request));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("lotes")]
    public async Task<IActionResult> ListarLotes(
        [FromQuery] string? pecaId,
        [FromQuery] bool somenteComSaldo = false) =>
        Ok(await _estoque.ListarLotesAsync(pecaId, somenteComSaldo));

    [HttpPut("lotes/{id}")]
    public async Task<IActionResult> AtualizarLote(string id, [FromBody] AtualizarLoteEstoqueRequest request)
    {
        try
        {
            return Ok(await _estoque.AtualizarLoteAsync(id, request));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpDelete("lotes/{id}")]
    public async Task<IActionResult> ExcluirLote(string id)
    {
        try
        {
            await _estoque.ExcluirLoteAsync(id);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { erro = ex.Message });
        }
    }

    [HttpPost("pedidos/{id}/itens")]
    public async Task<IActionResult> AdicionarItemPedido(string id, [FromBody] ItemPedidoCompraRequest item)
    {
        try
        {
            return Ok(await _estoque.AdicionarItemPedidoAsync(id, item));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("movimentacoes")]
    public async Task<IActionResult> ListarMovimentacoes(
        [FromQuery] string? tipo,
        [FromQuery] DateTime? inicio,
        [FromQuery] DateTime? fim,
        [FromQuery] string? busca,
        [FromQuery] string? origem,
        [FromQuery] string? statusEstorno,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanhoPagina = 20)
    {
        var resultado = await _estoque.ListarMovimentacoesPaginadoAsync(new ListarMovimentacoesFiltros
        {
            Tipo = tipo,
            Inicio = inicio,
            Fim = fim,
            Busca = busca,
            Origem = origem,
            StatusEstorno = statusEstorno,
            Pagina = pagina,
            TamanhoPagina = tamanhoPagina,
        });
        return Ok(resultado);
    }

    [HttpPost("saidas")]
    public async Task<IActionResult> RegistrarSaida([FromBody] RegistrarSaidaEstoqueRequest request)
    {
        try
        {
            return Ok(await _estoque.RegistrarSaidaAsync(request));
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

    /// <summary>Valor em estoque hoje + investimento e giro (saídas a custo) por mês.</summary>
    [HttpGet("relatorios/financeiro")]
    public async Task<IActionResult> RelatorioFinanceiro([FromQuery] int meses = 12) =>
        Ok(await _estoque.RelatorioFinanceiroAsync(meses));

    [HttpGet("relatorios/reposicao")]
    public Task<IActionResult> Reposicao(
        [FromQuery] DateTime? inicio,
        [FromQuery] DateTime? fim,
        [FromQuery] string? periodo,
        [FromQuery] string? modeloId) =>
        GerarRelatorioReposicao(inicio, fim, periodo, modeloId);

    [HttpGet("relatorios/reposicao-semanal")]
    public Task<IActionResult> ReposicaoSemanal(
        [FromQuery] DateTime? inicio,
        [FromQuery] DateTime? fim,
        [FromQuery] string? periodo,
        [FromQuery] string? modeloId) =>
        GerarRelatorioReposicao(inicio, fim, periodo ?? "semanal", modeloId);

    private async Task<IActionResult> GerarRelatorioReposicao(
        DateTime? inicio,
        DateTime? fim,
        string? periodo,
        string? modeloId)
    {
        try
        {
            return Ok(await _estoque.RelatorioReposicaoAsync(inicio, fim, periodo, modeloId));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("pecas/{pecaId}/custo-referencia")]
    public async Task<IActionResult> CustoReferenciaPeca(string pecaId)
    {
        var refCusto = await _estoque.ObterCustoReferenciaPecaAsync(pecaId);
        return refCusto is null ? NotFound() : Ok(refCusto);
    }

    [HttpGet("pecas")]
    public async Task<IActionResult> ListarPecas([FromQuery] string? termo) =>
        Ok(await _pecas.BuscarAsync(termo));

    [HttpPost("relatorios/reposicao/historico")]
    public async Task<IActionResult> SalvarRelatorioReposicao([FromBody] SalvarRelatorioReposicaoRequest request)
    {
        try
        {
            return Ok(await _estoque.SalvarRelatorioReposicaoAsync(request));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("relatorios/reposicao/historico")]
    public async Task<IActionResult> ListarRelatoriosReposicao(
        [FromQuery] int limite = 10,
        [FromQuery] string? statusConclusao = null) =>
        Ok(await _estoque.ListarRelatoriosReposicaoAsync(limite, statusConclusao));

    [HttpGet("relatorios/reposicao/historico/{id}")]
    public async Task<IActionResult> ObterRelatorioReposicao(string id)
    {
        var doc = await _estoque.ObterRelatorioReposicaoAsync(id);
        return doc is null ? NotFound() : Ok(doc);
    }

    [HttpPatch("relatorios/reposicao/historico/{id}/status")]
    public async Task<IActionResult> AtualizarStatusRelatorioReposicao(
        string id,
        [FromBody] AtualizarStatusRelatorioReposicaoRequest request)
    {
        try
        {
            return Ok(await _estoque.AtualizarStatusRelatorioReposicaoAsync(id, request.StatusConclusao));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Relatório não encontrado." });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpGet("lotes/em-garantia")]
    public async Task<IActionResult> ListarLotesEmGarantia(
        [FromQuery] string? fornecedor,
        [FromQuery] string? osNumero,
        [FromQuery] string? lote) =>
        Ok(await _estoque.ListarLotesEmGarantiaAsync(fornecedor, osNumero, lote));

    /// <summary>
    /// Peças em estoque (não usadas no aparelho) com garantia do fornecedor a vencer em até N dias.
    /// </summary>
    [HttpGet("lotes/prestes-a-vencer")]
    public async Task<IActionResult> ListarLotesPrestesAVencer(
        [FromQuery] int dias = 30,
        [FromQuery] string? fornecedor = null,
        [FromQuery] string? busca = null) =>
        Ok(await _estoque.ListarLotesPrestesAVencerAsync(dias, fornecedor, busca));

    [HttpGet("sugestoes/os-garantia")]
    public async Task<IActionResult> SugerirOsGarantia([FromQuery] string? termo, [FromQuery] int limite = 20) =>
        Ok(await _estoque.SugerirOsGarantiaAsync(termo, limite));

    [HttpGet("sugestoes/lote-garantia")]
    public async Task<IActionResult> SugerirLoteGarantia([FromQuery] string? termo, [FromQuery] int limite = 20) =>
        Ok(await _estoque.SugerirLoteGarantiaAsync(termo, limite));

    [HttpGet("sugestoes/fornecedor-garantia")]
    public async Task<IActionResult> SugerirFornecedorGarantia([FromQuery] string? termo, [FromQuery] int limite = 20) =>
        Ok(await _estoque.SugerirFornecedorGarantiaAsync(termo, limite));

    [HttpGet("caixa-retorno-garantia")]
    public async Task<IActionResult> ListarCaixaRetornoGarantia([FromQuery] string? fornecedor) =>
        Ok(await _estoque.ListarCaixaRetornoGarantiaAsync(fornecedor));

    [HttpPost("caixa-retorno-garantia")]
    public async Task<IActionResult> AdicionarCaixaRetornoGarantia([FromBody] RegistrarDevolucaoGarantiaRequest request)
    {
        try
        {
            return Ok(await _estoque.AdicionarCaixaRetornoGarantiaAsync(request));
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

    [HttpDelete("caixa-retorno-garantia/{id}")]
    public async Task<IActionResult> RemoverCaixaRetornoGarantia(string id)
    {
        try
        {
            await _estoque.RemoverCaixaRetornoGarantiaAsync(id);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>Compat: adicionar à caixa (mesmo fluxo do POST caixa-retorno-garantia).</summary>
    [HttpPost("devolucoes-garantia")]
    public Task<IActionResult> RegistrarDevolucaoGarantia([FromBody] RegistrarDevolucaoGarantiaRequest request) =>
        AdicionarCaixaRetornoGarantia(request);

    [HttpPost("devolucoes-garantia/lote")]
    public async Task<IActionResult> GerarLoteDevolucaoGarantia([FromBody] GerarLoteDevolucaoGarantiaRequest request)
    {
        try
        {
            return Ok(await _estoque.GerarLoteDevolucaoGarantiaAsync(request));
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

    /// <summary>Consulta de lotes já baixados (não na caixa).</summary>
    [HttpGet("lotes-retorno-garantia")]
    public async Task<IActionResult> ListarLotesRetornoHistorico(
        [FromQuery] string? fornecedor,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate,
        [FromQuery] int limite = 100) =>
        Ok(await _estoque.ListarLotesRetornoHistoricoAsync(fornecedor, de, ate, limite));

    [HttpGet("lotes-retorno-garantia/{id}")]
    public async Task<IActionResult> ObterLoteRetornoHistorico(string id)
    {
        var doc = await _estoque.ObterLoteRetornoHistoricoAsync(id);
        return doc is null ? NotFound() : Ok(doc);
    }

    /// <summary>Análise: fornecedores e peças com mais retorno (lotes baixados).</summary>
    [HttpGet("analise-retorno-garantia")]
    public async Task<IActionResult> AnalisarRetornosGarantia(
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate,
        [FromQuery] string? fornecedor) =>
        Ok(await _estoque.AnalisarRetornosGarantiaAsync(de, ate, fornecedor));
}
