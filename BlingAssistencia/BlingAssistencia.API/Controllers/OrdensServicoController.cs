using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/ordens-servico")]
public class OrdensServicoController : ControllerBase
{
    private readonly IBlingOrdemServicoService _service;
    private readonly IOsLocalRepository _localRepo;
    private readonly ITecnicoRepository _tecnicos;
    private readonly IOsHistoricoService _historico;
    private readonly IWebHostEnvironment _env;

    public OrdensServicoController(
        IBlingOrdemServicoService service,
        IOsLocalRepository localRepo,
        ITecnicoRepository tecnicos,
        IOsHistoricoService historico,
        IWebHostEnvironment env)
    {
        _service = service;
        _localRepo = localRepo;
        _tecnicos = tecnicos;
        _historico = historico;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> Listar([FromQuery] OsListarFiltros filtros)
    {
        // Leitura aberta: qualquer loja pode ver a fila (incl. Mococa) para combinar prazo.
        // Criação/edição segue restrição por loja do usuário.
        var ordens = await _service.ListarAsync(filtros);
        return Ok(ordens);
    }

    /// <summary>
    /// Relatório de comissão: OS concluídas de todas as lojas (assistência Mococa).
    /// Filtro opcional por loja de origem. Somente Admin/Root.
    /// Líquido = valor total − juros − custo das peças.
    /// </summary>
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpGet("relatorio-comissao")]
    public async Task<IActionResult> RelatorioComissao(
        [FromQuery] DateTime? dataConclusaoInicio,
        [FromQuery] DateTime? dataConclusaoFim,
        [FromQuery] List<string>? tecnicos,
        [FromQuery] bool incluirSemTecnico = true,
        [FromQuery] string? lojaOrigem = null)
    {
        // Comissão é paga em Mococa sobre o serviço executado — padrão: todas as lojas.
        // Filtro por loja só se o admin escolher no relatório.
        var lojaFiltro = string.IsNullOrWhiteSpace(lojaOrigem)
            ? null
            : OsLojaHelper.Normalizar(lojaOrigem);

        var locais = await _localRepo.ListarParaComissaoAsync(
            dataConclusaoInicio?.Date,
            dataConclusaoFim?.Date,
            tecnicos,
            incluirSemTecnico,
            lojaFiltro);

        var ordens = new List<ComissaoOsItem>(locais.Count);
        foreach (var local in locais)
        {
            var valorTotal = local.ValorTotalAcordado ?? local.ValorTotal ?? 0m;
            var juros = local.Juros is > 0 ? local.Juros.Value : 0m;
            var valorPecas = CalcularCustoPecas(local.Itens);
            var liquido = valorTotal - juros - valorPecas;

            ordens.Add(new ComissaoOsItem
            {
                Id = local.BlingId,
                Numero = local.OsNumero,
                LojaOrigem = OsLojaHelper.Normalizar(local.LojaOrigem),
                TecnicoNome = string.IsNullOrWhiteSpace(local.TecnicoNome) ? "(sem técnico)" : local.TecnicoNome.Trim(),
                ClienteNome = local.ContatoNome,
                Equipamento = local.Equipamento ?? local.ModeloNome,
                DataConclusao = local.DataConclusao,
                ValorTotal = valorTotal,
                Juros = juros,
                ValorPecas = valorPecas,
                ValorLiquido = liquido,
            });
        }

        var porTecnico = ordens
            .GroupBy(o => o.TecnicoNome, StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase)
            .Select(g => new ComissaoPorTecnico
            {
                TecnicoNome = g.First().TecnicoNome ?? "(sem técnico)",
                QuantidadeOs = g.Count(),
                TotalValor = g.Sum(x => x.ValorTotal),
                TotalJuros = g.Sum(x => x.Juros),
                TotalPecas = g.Sum(x => x.ValorPecas),
                TotalLiquido = g.Sum(x => x.ValorLiquido),
            })
            .ToList();

        return Ok(new ComissaoRelatorioResponse
        {
            DataConclusaoInicio = dataConclusaoInicio?.Date,
            DataConclusaoFim = dataConclusaoFim?.Date,
            LojaOrigemFiltro = lojaFiltro,
            TecnicosFiltro = (tecnicos ?? [])
                .Select(t => t?.Trim())
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            QuantidadeOs = ordens.Count,
            TotalValor = ordens.Sum(x => x.ValorTotal),
            TotalJuros = ordens.Sum(x => x.Juros),
            TotalPecas = ordens.Sum(x => x.ValorPecas),
            TotalLiquido = ordens.Sum(x => x.ValorLiquido),
            PorTecnico = porTecnico,
            Ordens = ordens,
        });
    }

    private static decimal CalcularCustoPecas(List<BlingOrdemServicoItem>? itens)
    {
        if (itens is null || itens.Count == 0) return 0m;

        decimal total = 0m;
        foreach (var item in itens)
        {
            var tipo = item.TipoItem?.Trim();
            var ehPeca = string.Equals(tipo, "peca", StringComparison.OrdinalIgnoreCase)
                || !string.IsNullOrWhiteSpace(item.PecaId);
            if (!ehPeca) continue;

            var custoUnit = item.CustoPeca ?? 0m;
            var qtd = item.Quantidade <= 0 ? 1m : item.Quantidade;
            total += custoUnit * qtd;
        }

        return total;
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> Obter(long id)
    {
        // Visualização liberada (acompanhar fila da assistência / prazos).
        var os = await _service.ObterAsync(id);
        return Ok(os);
    }

    /// <summary>Consulta geral de históricos — somente Admin/Root.</summary>
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    [HttpGet("historico")]
    public async Task<IActionResult> ConsultarHistorico(
        [FromQuery] long? osBlingId,
        [FromQuery] string? osNumero,
        [FromQuery] string? acao,
        [FromQuery] string? usuario,
        [FromQuery] string? lojaOrigem,
        [FromQuery] DateTime? dataInicio,
        [FromQuery] DateTime? dataFim,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanhoPagina = 30)
    {
        var resultado = await _historico.ConsultarAsync(new Repositories.OsHistoricoConsultaFiltros
        {
            OsBlingId = osBlingId,
            OsNumero = osNumero,
            Acao = acao,
            Usuario = usuario,
            LojaOrigem = LojaAcessoHelper.ForcarFiltroLista(User, lojaOrigem),
            DataInicio = dataInicio,
            DataFim = dataFim,
            Pagina = pagina,
            TamanhoPagina = tamanhoPagina,
        });
        return Ok(resultado);
    }

    /// <summary>Lista versões históricas da OS (leitura aberta).</summary>
    [HttpGet("{id:long}/historico")]
    public async Task<IActionResult> ListarHistorico(long id)
    {
        var lista = await _historico.ListarAsync(id);
        return Ok(lista);
    }

    /// <summary>Detalhe de uma versão (leitura aberta).</summary>
    [HttpGet("{id:long}/historico/{versao:int}")]
    public async Task<IActionResult> ObterHistoricoVersao(long id, int versao)
    {
        var detalhe = await _historico.ObterVersaoAsync(id, versao);
        return detalhe is null
            ? NotFound(new { erro = "Versão não encontrada." })
            : Ok(detalhe);
    }

    /// <summary>Soft-delete: remove da lista e grava versão de exclusão no histórico.</summary>
    [HttpDelete("{id:long}")]
    public async Task<IActionResult> Excluir(long id)
    {
        try
        {
            await GarantirAcessoOsAsync(id);
            await _service.ExcluirAsync(id);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Ordem de serviço não encontrada." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Criar([FromBody] BlingOrdemServico os)
    {
        try
        {
            os.LojaOrigem = LojaAcessoHelper.AplicarNaCriacao(User, os.LojaOrigem);
            OsOrdemValidacao.Validar(os);
            await OsOrdemValidacao.ValidarTecnicoAsync(os.Situacao, os.TecnicoNome, _tecnicos);
            var criado = await _service.CriarAsync(os);
            return CreatedAtAction(nameof(Obter), new { id = criado.Id }, criado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Atualizar(long id, [FromBody] BlingOrdemServico os)
    {
        try
        {
            await GarantirAcessoOsAsync(id);
            os.LojaOrigem = LojaAcessoHelper.AplicarNaCriacao(User, os.LojaOrigem);
            OsOrdemValidacao.Validar(os);
            await OsOrdemValidacao.ValidarTecnicoAsync(os.Situacao, os.TecnicoNome, _tecnicos);
            var atualizado = await _service.AtualizarAsync(id, os);
            return Ok(atualizado);
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Ordem de serviço não encontrada." });
        }
    }

    [HttpPatch("{id:long}/situacao")]
    public async Task<IActionResult> AlterarSituacao(long id, [FromBody] AlterarSituacaoRequest request)
    {
        try
        {
            await GarantirAcessoOsAsync(id);
            var existente = await _localRepo.ObterPorBlingIdAsync(id)
                ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");
            var tecnicoNome = !string.IsNullOrWhiteSpace(request.TecnicoNome)
                ? request.TecnicoNome.Trim()
                : existente.TecnicoNome;
            await OsOrdemValidacao.ValidarTecnicoAsync(request.Situacao, tecnicoNome, _tecnicos);
            await _service.AlterarSituacaoAsync(
                id,
                request.Situacao,
                request.MotivoCancelamento,
                request.DataPrazoPeca,
                tecnicoNome,
                permitirOsFinalizada: UsuarioEhAdminOuRoot());
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Ordem de serviço não encontrada." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    [HttpPatch("{id:long}/justificativa-atraso")]
    public async Task<IActionResult> JustificarAtraso(long id, [FromBody] JustificarAtrasoRequest request)
    {
        try
        {
            await GarantirAcessoOsAsync(id);
            await _service.JustificarAtrasoAsync(id, request.JustificativaAtraso);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { erro = ex.Message });
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>Retorna apenas os dados locais (MongoDB) de uma OS.</summary>
    [HttpGet("{id:long}/local")]
    public async Task<IActionResult> ObterLocal(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id);
        if (local is null) return NotFound();
        return Ok(local);
    }

    /// <summary>Salva/atualiza os dados locais (MongoDB) de uma OS sem chamar o Bling.</summary>
    [HttpPut("{id:long}/local")]
    public async Task<IActionResult> SalvarLocal(long id, [FromBody] OsLocalDataDto dto)
    {
        var existente = await _localRepo.ObterPorBlingIdAsync(id);
        var local = existente ?? new OsLocalData { BlingId = id };

        local.ContatoAviso = dto.ContatoAviso;
        local.Imei = dto.Imei;
        local.CpfCnpj = dto.CpfCnpj;
        local.Retorno = dto.Retorno;
        local.DataConclusao = dto.DataConclusao;
        local.ObservacoesInternas = dto.ObservacoesInternas;

        await _localRepo.SalvarAsync(local);
        return Ok(local);
    }

    /// <summary>Gera link/QR de recepção mobile (fotos + senha do aparelho).</summary>
    [HttpPost("{id:long}/intake/token")]
    public async Task<IActionResult> GerarTokenIntake(
        long id,
        [FromQuery] string? appUrl,
        [FromServices] IOsIntakeService intake,
        [FromServices] IAppAuthService auth)
    {
        try
        {
            var resp = await intake.GerarTokenAsync(id, appUrl);
            var uid = User.FindFirstValue("uid")
                ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (!string.IsNullOrWhiteSpace(uid))
            {
                try
                {
                    var handoff = await auth.CriarHandoffQrAsync(uid);
                    var sep = resp.Url.Contains('?', StringComparison.Ordinal) ? '&' : '?';
                    resp.Url = $"{resp.Url}{sep}h={Uri.EscapeDataString(handoff)}";
                }
                catch
                {
                    // QR de intake continua válido sem sessão; só a transferência de login falha.
                }
            }

            return Ok(resp);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Ordem de serviço não encontrada." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }

    /// <summary>Envia foto do aparelho pelo balcão (desktop).</summary>
    [HttpPost("{id:long}/fotos")]
    [RequestSizeLimit(15 * 1024 * 1024)]
    public async Task<IActionResult> EnviarFoto(
        long id,
        IFormFile arquivo,
        [FromForm] string? categoria,
        [FromForm] string? descricaoFoco,
        [FromServices] IOsIntakeService intake)
    {
        if (arquivo is null || arquivo.Length == 0)
            return BadRequest(new { erro = "Nenhuma imagem enviada." });

        try
        {
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "uploads");
            var foto = await intake.AdicionarFotoPorOsIdAsync(id, arquivo, uploadsRoot, categoria, descricaoFoco);
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
    }

    /// <summary>Altera o ângulo/categoria de uma foto já anexada.</summary>
    [HttpPatch("{id:long}/fotos/{fotoId}")]
    public async Task<IActionResult> AtualizarCategoriaFoto(
        long id,
        string fotoId,
        [FromBody] AtualizarCategoriaFotoRequest body,
        [FromServices] IOsIntakeService intake)
    {
        try
        {
            var foto = await intake.AtualizarCategoriaFotoAsync(id, fotoId, body?.Categoria, body?.DescricaoFoco);
            return Ok(foto);
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

    /// <summary>Remove foto do aparelho da OS.</summary>
    [HttpDelete("{id:long}/fotos/{fotoId}")]
    public async Task<IActionResult> RemoverFoto(long id, string fotoId, [FromServices] IOsIntakeService intake)
    {
        try
        {
            var uploadsRoot = Path.Combine(_env.ContentRootPath, "uploads");
            await intake.RemoverFotoAsync(id, fotoId, uploadsRoot);
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

    private async Task GarantirAcessoOsAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"OS {id} não encontrada.");
        LojaAcessoHelper.GarantirAcesso(User, local.LojaOrigem, "esta OS");
    }

    private bool UsuarioEhAdminOuRoot() =>
        User.IsInRole(AppRoles.Admin) || User.IsInRole(AppRoles.Root);
}

public record AlterarSituacaoRequest(
    string Situacao,
    string? MotivoCancelamento = null,
    DateTime? DataPrazoPeca = null,
    string? TecnicoNome = null);
public record JustificarAtrasoRequest(string JustificativaAtraso);
public record AtualizarCategoriaFotoRequest(string? Categoria, string? DescricaoFoco = null);
