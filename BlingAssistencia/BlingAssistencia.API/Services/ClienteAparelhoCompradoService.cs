using MundoSmart.BlingAssistencia.API.Data;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IClienteAparelhoCompradoService
{
    Task AplicarVinculoAsync(BlingVendaCelularData venda, CancellationToken cancellationToken = default);
    Task VincularClienteAsync(BlingContato cliente, string? vendaId = null, CancellationToken cancellationToken = default);
    Task RecalcularPendenciasAsync(CancellationToken cancellationToken = default);
    Task<BlingVendaCelularPendenciasResponse> ListarPendenciasAsync(CancellationToken cancellationToken = default);
    Task<BlingVendaCelularPassivelResponse> ConsultarPassivelAsync(
        long? clienteId,
        string? cpf,
        string? modeloId,
        string? modeloNome,
        string? marcaNome,
        CancellationToken cancellationToken = default);
}

public sealed class ClienteAparelhoCompradoService : IClienteAparelhoCompradoService
{
    private static readonly TimeSpan CatalogoTtl = TimeSpan.FromMinutes(10);
    private readonly IBlingVendaCelularRepository _vendas;
    private readonly IClienteLocalRepository _clientes;
    private readonly IAparelhoRepository _aparelhos;
    private readonly object _catLock = new();
    private List<ModeloAparelho> _catalogo = [];
    private DateTime _catalogoEm = DateTime.MinValue;

    public ClienteAparelhoCompradoService(
        IBlingVendaCelularRepository vendas,
        IClienteLocalRepository clientes,
        IAparelhoRepository aparelhos)
    {
        _vendas = vendas;
        _clientes = clientes;
        _aparelhos = aparelhos;
    }

    public async Task AplicarVinculoAsync(BlingVendaCelularData venda, CancellationToken cancellationToken = default)
    {
        var catalogo = await CatalogoAsync(cancellationToken);
        AplicarParse(venda, catalogo);

        ClienteLocalData? cliente = null;
        if (venda.ClienteLocalId is > 0)
            cliente = await _clientes.ObterPorBlingIdAsync(venda.ClienteLocalId.Value);
        if (cliente is null && !string.IsNullOrWhiteSpace(venda.ClienteCpf))
            cliente = await _clientes.ObterPorCpfCnpjAsync(venda.ClienteCpf);

        if (cliente is null)
        {
            venda.ClienteLocalId = null;
            venda.CadastroPendente = true;
            await _vendas.UpsertAsync(venda, cancellationToken);
            return;
        }

        await AnexarAparelhoAsync(cliente, venda);
        venda.ClienteLocalId = cliente.BlingId;
        venda.CadastroPendente = false;
        await _vendas.UpsertAsync(venda, cancellationToken);
    }

    public async Task VincularClienteAsync(
        BlingContato clienteDto,
        string? vendaId = null,
        CancellationToken cancellationToken = default)
    {
        if (clienteDto.Id is null or <= 0) return;
        var cliente = await _clientes.ObterPorBlingIdAsync(clienteDto.Id.Value);
        if (cliente is null) return;

        var cpf = new string((cliente.CpfCnpj ?? clienteDto.CpfCnpj ?? "").Where(char.IsDigit).ToArray());
        var vendas = new List<BlingVendaCelularData>();
        if (!string.IsNullOrWhiteSpace(vendaId))
        {
            var uma = await _vendas.ObterPorIdAsync(vendaId, cancellationToken);
            if (uma is not null) vendas.Add(uma);
        }
        if (cpf.Length > 0)
        {
            foreach (var v in await _vendas.ListarPorCpfAsync(cpf, cancellationToken))
            {
                if (vendas.All(x => x.Id != v.Id))
                    vendas.Add(v);
            }
        }

        var catalogo = await CatalogoAsync(cancellationToken);
        foreach (var venda in vendas)
        {
            AplicarParse(venda, catalogo);
            await AnexarAparelhoAsync(cliente, venda);
            venda.ClienteLocalId = cliente.BlingId;
            venda.CadastroPendente = false;
            await _vendas.UpsertAsync(venda, cancellationToken);
        }
    }

    public async Task RecalcularPendenciasAsync(CancellationToken cancellationToken = default)
    {
        var orfas = await _vendas.ListarSemVinculoAsync(cancellationToken);
        if (orfas.Count == 0) return;

        var catalogo = await CatalogoAsync(cancellationToken);
        foreach (var grupo in orfas.GroupBy(v => v.ClienteCpf ?? ""))
        {
            ClienteLocalData? cliente = null;
            if (grupo.Key.Length > 0)
                cliente = await _clientes.ObterPorCpfCnpjAsync(grupo.Key);

            foreach (var venda in grupo)
            {
                AplicarParse(venda, catalogo);
                if (cliente is not null)
                {
                    await AnexarAparelhoAsync(cliente, venda);
                    venda.ClienteLocalId = cliente.BlingId;
                    venda.CadastroPendente = false;
                }
                else
                {
                    venda.ClienteLocalId = null;
                    venda.CadastroPendente = true;
                }
                await _vendas.UpsertAsync(venda, cancellationToken);
            }
        }
    }

    public async Task<BlingVendaCelularPendenciasResponse> ListarPendenciasAsync(
        CancellationToken cancellationToken = default)
    {
        var lista = await _vendas.ListarPendentesAsync(cancellationToken);
        return new BlingVendaCelularPendenciasResponse
        {
            Total = lista.Count,
            Vendas = lista.Select(BlingVendaCelularMapper.ParaDto).ToList(),
        };
    }

    public async Task<BlingVendaCelularPassivelResponse> ConsultarPassivelAsync(
        long? clienteId,
        string? cpf,
        string? modeloId,
        string? modeloNome,
        string? marcaNome,
        CancellationToken cancellationToken = default)
    {
        var vazio = new BlingVendaCelularPassivelResponse
        {
            Passivel = false,
            Motivo = "",
        };
        if (string.IsNullOrWhiteSpace(modeloId) && string.IsNullOrWhiteSpace(modeloNome))
            return vazio;

        var vendas = new List<BlingVendaCelularData>();
        if (clienteId is > 0)
            vendas.AddRange(await _vendas.ListarPorClienteLocalIdAsync(clienteId.Value, cancellationToken));

        var cpfN = new string((cpf ?? "").Where(char.IsDigit).ToArray());
        if (cpfN.Length > 0)
        {
            foreach (var v in await _vendas.ListarPorCpfAsync(cpfN, cancellationToken))
            {
                if (vendas.All(x => x.Id != v.Id))
                    vendas.Add(v);
            }
        }

        var ligadas = vendas.Where(v => !v.CadastroPendente && v.ClienteLocalId is > 0).ToList();
        var match = ligadas
            .Where(v => ProdutoCelularNomeParser.MesmoModelo(marcaNome, modeloNome, modeloId, v))
            .ToList();

        if (match.Count == 0)
            return vazio;

        var aparelho = match[0];
        var resumo = string.Join(" · ", new[]
        {
            string.Join(" ", new[] { aparelho.Marca, aparelho.Modelo }.Where(s => !string.IsNullOrWhiteSpace(s))),
            aparelho.Cor,
            aparelho.Configuracao,
        }.Where(s => !string.IsNullOrWhiteSpace(s)));

        return new BlingVendaCelularPassivelResponse
        {
            Passivel = true,
            Motivo = string.IsNullOrWhiteSpace(resumo)
                ? "Passível de Desconto, averiguar IMEI e documento do cliente"
                : $"Passível de Desconto, averiguar IMEI e documento do cliente. Compra na loja: {resumo}.",
            Aparelhos = match.Select(BlingVendaCelularMapper.ParaDto).ToList(),
        };
    }

    private static void AplicarParse(BlingVendaCelularData venda, IReadOnlyList<ModeloAparelho> catalogo)
    {
        var parsed = ProdutoCelularNomeParser.Parse(venda.ProdutoNome, catalogo);
        if (!string.IsNullOrWhiteSpace(parsed.Marca)) venda.Marca = parsed.Marca;
        if (!string.IsNullOrWhiteSpace(parsed.Modelo)) venda.Modelo = parsed.Modelo;
        if (!string.IsNullOrWhiteSpace(parsed.Cor)) venda.Cor = parsed.Cor;
        if (!string.IsNullOrWhiteSpace(parsed.Configuracao)) venda.Configuracao = parsed.Configuracao;
        venda.MarcaId = parsed.MarcaId ?? venda.MarcaId;
        venda.ModeloId = parsed.ModeloId ?? venda.ModeloId;
        if (string.IsNullOrWhiteSpace(venda.Modelo) && !string.IsNullOrWhiteSpace(venda.ProdutoNome))
            venda.Modelo = venda.ProdutoNome.Trim();
    }

    private async Task AnexarAparelhoAsync(ClienteLocalData cliente, BlingVendaCelularData venda)
    {
        cliente.AparelhosComprados ??= [];
        var imei = venda.Imei ?? "";
        var existente = cliente.AparelhosComprados.FirstOrDefault(a =>
            (!string.IsNullOrEmpty(imei) && string.Equals(a.Imei, imei, StringComparison.Ordinal))
            || (!string.IsNullOrWhiteSpace(venda.Id) && a.VendaId == venda.Id));

        if (existente is null)
        {
            existente = new ClienteAparelhoComprado();
            cliente.AparelhosComprados.Add(existente);
        }

        existente.VendaId = venda.Id;
        existente.Imei = imei;
        existente.Marca = venda.Marca;
        existente.Modelo = venda.Modelo;
        existente.MarcaId = venda.MarcaId;
        existente.ModeloId = venda.ModeloId;
        existente.Cor = venda.Cor;
        existente.Configuracao = venda.Configuracao;
        existente.DataVenda = venda.DataVenda;
        await _clientes.SalvarAsync(cliente);
    }

    private async Task<IReadOnlyList<ModeloAparelho>> CatalogoAsync(CancellationToken cancellationToken)
    {
        lock (_catLock)
        {
            if (_catalogo.Count > 0 && DateTime.UtcNow - _catalogoEm < CatalogoTtl)
                return _catalogo;
        }

        var lista = await _aparelhos.ListarModelosAsync(limite: 3000);
        lock (_catLock)
        {
            _catalogo = lista;
            _catalogoEm = DateTime.UtcNow;
            return _catalogo;
        }
    }
}
