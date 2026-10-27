using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Controllers;

[ApiController]
[Route("api/vendas-celulares")]
public class BlingVendaCelularController : ControllerBase
{
    private readonly IBlingVendaCelularRepository _repo;
    private readonly IBlingVendaCelularSyncService _sync;
    private readonly IClienteAparelhoCompradoService _vinculo;
    private readonly IBlingClienteService _clientes;

    public BlingVendaCelularController(
        IBlingVendaCelularRepository repo,
        IBlingVendaCelularSyncService sync,
        IClienteAparelhoCompradoService vinculo,
        IBlingClienteService clientes)
    {
        _repo = repo;
        _sync = sync;
        _vinculo = vinculo;
        _clientes = clientes;
    }

    [HttpGet("desconto")]
    public async Task<IActionResult> Desconto(
        [FromQuery] string? cpf,
        [FromQuery] string? imei,
        CancellationToken cancellationToken)
    {
        var cpfN = new string((cpf ?? "").Where(char.IsDigit).ToArray());
        var imeiN = new string((imei ?? "").Where(char.IsDigit).ToArray());
        if (cpfN.Length == 0 && imeiN.Length == 0)
            return BadRequest(new { erro = "Informe o CPF ou o IMEI." });

        var vendas = await _repo.ConsultarAsync(cpfN, imeiN, cancellationToken);
        // Se ambos vieram e não bateu o par, ainda devolve matches parciais para a tela explicar.
        if (cpfN.Length > 0 && imeiN.Length > 0 && vendas.Count == 0)
        {
            var porImei = await _repo.ConsultarAsync(null, imeiN, cancellationToken);
            var porCpf = await _repo.ConsultarAsync(cpfN, null, cancellationToken);
            vendas = porImei.Concat(porCpf)
                .GroupBy(v => v.Id)
                .Select(g => g.First())
                .ToList();
        }

        return Ok(_sync.ConsultarDesconto(cpfN, imeiN, vendas));
    }

    [HttpGet("pendencias")]
    public async Task<IActionResult> Pendencias(CancellationToken cancellationToken)
    {
        var lista = await _vinculo.ListarPendenciasAsync(cancellationToken);
        return Ok(lista);
    }

    [HttpGet("passivel-desconto")]
    public async Task<IActionResult> PassivelDesconto(
        [FromQuery] long? clienteId,
        [FromQuery] string? cpf,
        [FromQuery] string? modeloId,
        [FromQuery] string? modeloNome,
        [FromQuery] string? marcaNome,
        CancellationToken cancellationToken)
    {
        if (clienteId is null or <= 0 && string.IsNullOrWhiteSpace(cpf))
            return Ok(new BlingVendaCelularPassivelResponse());
        var res = await _vinculo.ConsultarPassivelAsync(
            clienteId, cpf, modeloId, modeloNome, marcaNome, cancellationToken);
        return Ok(res);
    }

    [HttpPost("{id}/vincular-cliente")]
    public async Task<IActionResult> VincularCliente(
        string id,
        [FromBody] BlingVendaCelularVincularRequest? body,
        CancellationToken cancellationToken)
    {
        if (body is null || body.ClienteId <= 0)
            return BadRequest(new { erro = "Informe o cliente." });
        try
        {
            var cliente = await _clientes.ObterAsync(body.ClienteId);
            await _vinculo.VincularClienteAsync(cliente, id, cancellationToken);
            return Ok(new { ok = true });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { erro = "Cliente não encontrado." });
        }
    }

    [HttpGet]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public async Task<IActionResult> Listar(
        [FromQuery] string? termo,
        [FromQuery] int limite = 80,
        CancellationToken cancellationToken = default)
    {
        var lista = await _repo.ListarRecentesAsync(termo, limite, cancellationToken);
        return Ok(lista.Select(BlingVendaCelularMapper.ParaDto).ToList());
    }

    [HttpPost("sincronizar")]
    [Authorize(Roles = AppRoles.AdminOuRoot)]
    public async Task<IActionResult> Sincronizar(
        [FromBody] BlingVendaCelularSincronizarRequest? body,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await _sync.SincronizarAsync(body ?? new BlingVendaCelularSincronizarRequest(), cancellationToken);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { erro = ex.Message });
        }
    }
}
