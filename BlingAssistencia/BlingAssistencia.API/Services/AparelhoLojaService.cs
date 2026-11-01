using System.Globalization;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Data;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IAparelhoLojaService
{
    Task<AparelhoLojaPainelDto> PainelAsync(CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> ComprarAsync(AparelhoCompraRequest pedido, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> VenderAsync(AparelhoVendaRequest pedido, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> TrocarAsync(AparelhoTrocaRequest pedido, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> LiberarAsync(string aparelhoId, CancellationToken cancellationToken = default);
    Task<OsAbertaConsultaDto> ConsultarOsAbertaAsync(string? numero, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> EstornarAsync(string operacaoId, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> SalvarListaAsync(AparelhoListaPrecoRequest pedido, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> RemoverListaAsync(string id, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> AdicionarFotosAsync(
        string aparelhoId,
        IReadOnlyList<(string Nome, Stream Conteudo)> arquivos,
        string uploadsRoot,
        CancellationToken cancellationToken = default);
    Task RegistrarCustoOsAsync(BlingOrdemServico os, CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoTokenDto> CriarSessaoFotosAsync(string? appBaseUrl, CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoDto?> ObterSessaoFotosAsync(string token, CancellationToken cancellationToken = default);
    Task<AparelhoFotoDto> ReceberFotoSessaoAsync(string token, string nome, Stream conteudo, CancellationToken cancellationToken = default);
    Task<BlingVendaCelularDescontoResponse> ConsultarDescontoAsync(string? cpf, string? imei, CancellationToken cancellationToken = default);
    Task<bool> ImeiJaPassouPelaLojaAsync(string? imei, CancellationToken cancellationToken = default);
    Task<BlingVendaCelularPassivelResponse> ConsultarPassivelAsync(
        long? clienteId,
        string? cpf,
        string? modeloId,
        string? modeloNome,
        string? marcaNome,
        CancellationToken cancellationToken = default);
}

public sealed class AparelhoLojaService : IAparelhoLojaService
{
    private static readonly CultureInfo PtBr = new("pt-BR");
    private readonly IAparelhoLojaRepository _repo;
    private readonly IOsLocalRepository _os;
    private readonly IClienteLocalRepository _clientes;
    private readonly IClienteAparelhoCompradoService _vinculo;
    private readonly IBlingEffectiveSettings _blingEff;
    private readonly IHostEnvironment _env;
    private readonly IntakeSettings _intake;

    public AparelhoLojaService(
        IAparelhoLojaRepository repo,
        IOsLocalRepository os,
        IClienteLocalRepository clientes,
        IClienteAparelhoCompradoService vinculo,
        IBlingEffectiveSettings blingEff,
        IHostEnvironment env,
        IOptions<IntakeSettings> intake)
    {
        _repo = repo;
        _os = os;
        _clientes = clientes;
        _vinculo = vinculo;
        _blingEff = blingEff;
        _env = env;
        _intake = intake.Value;
    }

    public Task<AparelhoLojaPainelDto> PainelAsync(CancellationToken cancellationToken = default) =>
        MontarPainelAsync(cancellationToken);

    public async Task<AparelhoLojaPainelDto> ComprarAsync(
        AparelhoCompraRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var valor = Dinheiro(pedido.ValorPago);
        if (valor <= 0)
            throw new InvalidOperationException("Informe o valor pago pela loja.");

        var entrada = await NormalizarEntradaAsync(pedido.Aparelho, cancellationToken);
        var (clienteId, clienteNome, clienteCpf, fornecedor) = await ResolverOrigemCompraAsync(pedido, cancellationToken);
        var agora = HorarioBrasil.Agora;
        var aparelhoId = NovoId();
        var operacaoId = NovoId();

        var aparelho = new AparelhoLojaData
        {
            Id = aparelhoId,
            Imei = entrada.Imei,
            Marca = entrada.Marca ?? "",
            Modelo = entrada.Modelo ?? "",
            MarcaId = entrada.MarcaId,
            ModeloId = entrada.ModeloId,
            Cor = entrada.Cor ?? "",
            Configuracao = entrada.Configuracao ?? "",
            Condicao = entrada.Condicao,
            Custo = valor,
            ValorVenda = entrada.ValorVenda,
            ValorMinimoVenda = entrada.ValorMinimoVenda,
            Status = AparelhoLojaStatus.EmEstoque,
            Origem = AparelhoOperacaoTipo.Compra,
            OperacaoEntradaId = operacaoId,
            ClienteOrigemId = clienteId,
            ClienteOrigemNome = clienteNome,
            ClienteOrigemCpf = clienteCpf,
            DataEntrada = agora,
            DescontoVigente = false,
        };
        PreencherFicha(aparelho, entrada, pedido.Vendedor, pedido.Observacoes);
        await ReterSeAssistenciaAsync(aparelho, entrada, cancellationToken);
        aparelho.Custo = await ValorDeEstoqueAsync(aparelho, valor, cancellationToken);

        var operacao = new AparelhoOperacaoData
        {
            Id = operacaoId,
            Tipo = AparelhoOperacaoTipo.Compra,
            Status = AparelhoOperacaoStatus.Ativa,
            Data = agora,
            ClienteId = clienteId,
            ClienteNome = clienteNome,
            ClienteCpf = clienteCpf,
            FornecedorNome = fornecedor,
            Entrada = Movimento(aparelho, valor),
            ValorAvaliado = valor,
            DinheiroPago = valor,
            Observacoes = Texto(pedido.Observacoes),
            CriadoEm = agora,
        };
        MarcarVendedor(operacao, pedido.Vendedor);

        await RevogarDescontoDoImeiAsync(entrada.Imei, cancellationToken);
        await _repo.InserirAparelhoAsync(aparelho, cancellationToken);
        await AnexarSessaoFotosAsync(aparelho, pedido.SessaoToken, cancellationToken);
        try
        {
            await _repo.InserirOperacaoAsync(operacao, cancellationToken);
        }
        catch
        {
            aparelho.Status = AparelhoLojaStatus.Estornado;
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
            throw;
        }

        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> VenderAsync(
        AparelhoVendaRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var preco = PrecoCobrado(pedido.PrecoTabela, pedido.Desconto, pedido.Acrescimo, pedido.Forma, pedido.Preco);

        var aparelho = await ExigirEmEstoqueAsync(pedido.AparelhoId, cancellationToken);
        ExigirAcimaDoMinimo(aparelho, pedido.PrecoTabela, pedido.Desconto, pedido.Preco);
        var cliente = await ExigirClienteComCpfAsync(pedido.ClienteId, cancellationToken);
        var agora = HorarioBrasil.Agora;
        var operacaoId = NovoId();
        var caixa = CaixaNegociacao(pedido.Forma, pedido.FinanciadoraNome, pedido.EntradaLoja, pedido.Repasse, preco);

        aparelho.Status = AparelhoLojaStatus.Vendido;
        aparelho.OperacaoSaidaId = operacaoId;
        aparelho.DataSaida = agora;
        aparelho.ClienteVendaId = cliente.BlingId;
        aparelho.ClienteVendaNome = cliente.Nome;
        aparelho.ClienteVendaCpf = Doc(cliente.CpfCnpj);
        aparelho.PrecoVenda = preco;
        aparelho.DescontoVigente = true;
        MarcarVendedorSaida(aparelho, pedido.Vendedor);

        var operacao = new AparelhoOperacaoData
        {
            Id = operacaoId,
            Tipo = AparelhoOperacaoTipo.Venda,
            Status = AparelhoOperacaoStatus.Ativa,
            Data = agora,
            ClienteId = cliente.BlingId,
            ClienteNome = cliente.Nome,
            ClienteCpf = aparelho.ClienteVendaCpf,
            Saida = Movimento(aparelho, preco),
            PrecoSaida = preco,
            DinheiroRecebido = caixa.Recebido,
            FormaNegociacao = caixa.Forma,
            FinanciadoraNome = caixa.Nome,
            EntradaLoja = caixa.Entrada,
            RepasseFinanciadora = caixa.Repasse,
            Observacoes = Texto(pedido.Observacoes),
            VendedorId = aparelho.VendedorSaidaId,
            VendedorNome = aparelho.VendedorSaidaNome,
            CriadoEm = agora,
        };

        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        await _repo.InserirOperacaoAsync(operacao, cancellationToken);
        await ConcederDescontoAsync(aparelho, operacaoId, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> TrocarAsync(
        AparelhoTrocaRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var precoSaida = PrecoCobrado(pedido.PrecoTabela, pedido.Desconto, pedido.Acrescimo, pedido.Forma, pedido.PrecoSaida);
        var baseCaixa = pedido.PrecoTabela > 0
            ? PrecoCobrado(pedido.PrecoTabela, pedido.Desconto, 0, "avista", 0)
            : precoSaida;

        var saida = await ExigirEmEstoqueAsync(pedido.AparelhoSaidaId, cancellationToken);
        ExigirAcimaDoMinimo(saida, pedido.PrecoTabela, pedido.Desconto, pedido.PrecoSaida);
        var prontas = await ResolverEntradasTrocaAsync(pedido, cancellationToken);
        var imeis = new HashSet<string>(StringComparer.Ordinal);
        foreach (var pronta in prontas)
        {
            if (!imeis.Add(pronta.Pedido.Imei))
                throw new InvalidOperationException("Não repita o mesmo IMEI na troca.");
            if (pronta.Pedido.Imei == saida.Imei)
                throw new InvalidOperationException("O aparelho que entra não pode ser o mesmo que sai.");
        }

        var cliente = await ExigirClienteComCpfAsync(pedido.ClienteId, cancellationToken);
        var agora = HorarioBrasil.Agora;
        var operacaoId = NovoId();
        var avaliado = Dinheiro(prontas.Sum(p => p.Avaliado));
        var diferenca = Dinheiro(baseCaixa - avaliado);
        var forma = NormalizarForma(pedido.Forma);
        decimal recebido;
        decimal pago;
        decimal entradaCaixa = 0;
        decimal repasse = 0;
        var nomeFinanciadora = "";
        if (forma is "avista" or "cartao")
        {
            recebido = diferenca > 0 ? diferenca : 0;
            pago = diferenca < 0 ? -diferenca : 0;
        }
        else if (forma == "avista_cartao")
        {
            if (diferenca <= 0)
                throw new InvalidOperationException("À vista + cartão vale quando o cliente paga a diferença.");
            var avista = Dinheiro(pedido.EntradaLoja);
            var cartao = Dinheiro(pedido.Repasse);
            if (avista <= 0 || cartao <= 0)
                throw new InvalidOperationException("Informe o valor à vista e o valor no cartão.");
            if (Dinheiro(avista + cartao) != diferenca)
                throw new InvalidOperationException("À vista e cartão precisam somar a diferença.");
            entradaCaixa = avista;
            repasse = cartao;
            recebido = diferenca;
            pago = 0;
        }
        else
        {
            var caixa = CaixaNegociacao(forma, pedido.FinanciadoraNome, pedido.EntradaLoja, pedido.Repasse, 0);
            forma = caixa.Forma;
            nomeFinanciadora = caixa.Nome;
            entradaCaixa = caixa.Entrada;
            repasse = caixa.Repasse;
            pago = diferenca < 0 ? -diferenca : 0;
            recebido = caixa.Recebido;
        }
        var cpf = Doc(cliente.CpfCnpj);
        var entradas = new List<AparelhoLojaData>();
        foreach (var pronta in prontas)
        {
            var entradaReq = pronta.Pedido;
            var entrada = new AparelhoLojaData
            {
                Id = NovoId(),
                Imei = entradaReq.Imei,
                Marca = entradaReq.Marca ?? "",
                Modelo = entradaReq.Modelo ?? "",
                MarcaId = entradaReq.MarcaId,
                ModeloId = entradaReq.ModeloId,
                Cor = entradaReq.Cor ?? "",
                Configuracao = entradaReq.Configuracao ?? "",
                Condicao = entradaReq.Condicao,
                Custo = pronta.Avaliado,
                ValorVenda = entradaReq.ValorVenda,
                ValorMinimoVenda = entradaReq.ValorMinimoVenda,
                Status = AparelhoLojaStatus.EmEstoque,
                Origem = AparelhoOperacaoTipo.Troca,
                OperacaoEntradaId = operacaoId,
                ClienteOrigemId = cliente.BlingId,
                ClienteOrigemNome = cliente.Nome,
                ClienteOrigemCpf = cpf,
                DataEntrada = agora,
                DescontoVigente = false,
            };
            PreencherFicha(entrada, entradaReq, pedido.Vendedor, pedido.Observacoes);
            await ReterSeAssistenciaAsync(entrada, entradaReq, cancellationToken);
            entrada.Custo = await ValorDeEstoqueAsync(entrada, pronta.Avaliado, cancellationToken);
            entradas.Add(entrada);
        }

        saida.Status = AparelhoLojaStatus.Vendido;
        saida.OperacaoSaidaId = operacaoId;
        saida.DataSaida = agora;
        saida.ClienteVendaId = cliente.BlingId;
        saida.ClienteVendaNome = cliente.Nome;
        saida.ClienteVendaCpf = cpf;
        saida.PrecoVenda = precoSaida;
        saida.DescontoVigente = true;
        MarcarVendedorSaida(saida, pedido.Vendedor);

        var movimentos = entradas.Select((aparelho, i) => Movimento(aparelho, prontas[i].Avaliado)).ToList();
        var operacao = new AparelhoOperacaoData
        {
            Id = operacaoId,
            Tipo = AparelhoOperacaoTipo.Troca,
            Status = AparelhoOperacaoStatus.Ativa,
            Data = agora,
            ClienteId = cliente.BlingId,
            ClienteNome = cliente.Nome,
            ClienteCpf = cpf,
            Entrada = movimentos[0],
            Entradas = movimentos,
            Saida = Movimento(saida, precoSaida),
            ValorAvaliado = avaliado,
            PrecoSaida = precoSaida,
            DinheiroRecebido = recebido,
            DinheiroPago = pago,
            FormaNegociacao = forma,
            FinanciadoraNome = nomeFinanciadora,
            EntradaLoja = entradaCaixa,
            RepasseFinanciadora = repasse,
            Observacoes = Texto(pedido.Observacoes),
            CriadoEm = agora,
        };
        MarcarVendedor(operacao, pedido.Vendedor);

        var gravados = new List<AparelhoLojaData>();
        try
        {
            for (var i = 0; i < entradas.Count; i++)
            {
                var entrada = entradas[i];
                await RevogarDescontoDoImeiAsync(entrada.Imei, cancellationToken);
                await _repo.InserirAparelhoAsync(entrada, cancellationToken);
                gravados.Add(entrada);
                await AnexarSessaoFotosAsync(entrada, prontas[i].SessaoToken, cancellationToken);
            }

            await _repo.SalvarAparelhoAsync(saida, cancellationToken);
            await _repo.InserirOperacaoAsync(operacao, cancellationToken);
        }
        catch
        {
            try
            {
                foreach (var entrada in gravados)
                {
                    entrada.Status = AparelhoLojaStatus.Estornado;
                    entrada.DescontoVigente = false;
                    await _repo.SalvarAparelhoAsync(entrada, cancellationToken);
                }

                saida.Status = AparelhoLojaStatus.EmEstoque;
                saida.OperacaoSaidaId = null;
                saida.DataSaida = null;
                saida.ClienteVendaId = null;
                saida.ClienteVendaNome = "";
                saida.ClienteVendaCpf = "";
                saida.PrecoVenda = 0;
                saida.DescontoVigente = false;
                await _repo.SalvarAparelhoAsync(saida, cancellationToken);
            }
            catch
            {
                // A falha original da troca é a que o usuário precisa ver.
            }

            throw;
        }

        await ConcederDescontoAsync(saida, operacaoId, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    private sealed record EntradaTrocaPronta(AparelhoEntradaRequest Pedido, decimal Avaliado, string? SessaoToken);

    private async Task<List<EntradaTrocaPronta>> ResolverEntradasTrocaAsync(
        AparelhoTrocaRequest pedido,
        CancellationToken cancellationToken)
    {
        var itens = new List<(AparelhoEntradaRequest? Aparelho, decimal Valor, string? Sessao)>();
        if (pedido.Entradas is { Count: > 0 })
        {
            foreach (var item in pedido.Entradas)
                itens.Add((item.Aparelho, item.ValorAvaliado, item.SessaoToken));
        }
        else if (pedido.Entrada is not null)
        {
            itens.Add((pedido.Entrada, pedido.ValorAvaliado, pedido.SessaoToken));
        }
        else
        {
            throw new InvalidOperationException("Informe o aparelho que entra.");
        }

        var prontas = new List<EntradaTrocaPronta>();
        foreach (var item in itens)
        {
            var valor = Dinheiro(item.Valor);
            if (valor < 0)
                throw new InvalidOperationException("O valor avaliado do aparelho que entra não pode ser negativo.");
            prontas.Add(new EntradaTrocaPronta(
                await NormalizarEntradaAsync(item.Aparelho, cancellationToken),
                valor,
                item.Sessao));
        }

        return prontas;
    }

    public async Task<AparelhoLojaPainelDto> SalvarListaAsync(
        AparelhoListaPrecoRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var preco = Dinheiro(pedido.Preco);
        if (preco <= 0)
            throw new InvalidOperationException("Informe o preço da lista.");
        var modeloId = Texto(pedido.ModeloId);
        var marca = Texto(pedido.Marca);
        var modelo = Texto(pedido.Modelo);
        if (modeloId.Length == 0 || marca.Length == 0 || modelo.Length == 0)
            throw new InvalidOperationException("Selecione o modelo da lista.");

        var condicao = string.Equals(pedido.Condicao?.Trim(), AparelhoCondicao.Usado, StringComparison.OrdinalIgnoreCase)
            ? AparelhoCondicao.Usado
            : AparelhoCondicao.Novo;
        var config = Texto(pedido.Configuracao);
        var chave = ChaveConfig(config);
        var agora = HorarioBrasil.Agora;
        var item = await _repo.ObterListaPorChaveAsync(modeloId, condicao, chave, cancellationToken);
        if (item is null)
        {
            item = new AparelhoListaPrecoData
            {
                Id = NovoId(),
                ModeloId = modeloId,
                Condicao = condicao,
                ConfiguracaoChave = chave,
            };
            PreencherLista(item, marca, modelo, config, preco, agora);
            await _repo.InserirListaAsync(item, cancellationToken);
        }
        else
        {
            PreencherLista(item, marca, modelo, config, preco, agora);
            await _repo.SalvarListaAsync(item, cancellationToken);
        }

        await ProjetarEstoqueAsync(cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> RemoverListaAsync(string id, CancellationToken cancellationToken = default)
    {
        var lista = await _repo.ListarListaAsync(cancellationToken);
        if (lista.All(p => p.Id != id))
            throw new InvalidOperationException("Preço da lista não encontrado.");
        await _repo.RemoverListaAsync(id, cancellationToken);
        await ProjetarEstoqueAsync(cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> EstornarAsync(
        string operacaoId,
        CancellationToken cancellationToken = default)
    {
        var operacao = await _repo.ObterOperacaoAsync(operacaoId, cancellationToken)
            ?? throw new InvalidOperationException("Operação não encontrada.");
        if (operacao.Status != AparelhoOperacaoStatus.Ativa)
            throw new InvalidOperationException("Essa operação já foi desfeita.");

        var desfazEntrada = operacao.Tipo is AparelhoOperacaoTipo.Compra or AparelhoOperacaoTipo.Troca;
        var desfazSaida = operacao.Tipo is AparelhoOperacaoTipo.Venda or AparelhoOperacaoTipo.Troca;
        if (!desfazEntrada && !desfazSaida)
            throw new InvalidOperationException("Tipo de operação desconhecido.");

        if (desfazEntrada)
            await ExigirEntradasNoEstoqueAsync(operacao, cancellationToken);
        if (desfazSaida)
            await ExigirSaidaVendidaAsync(operacao, cancellationToken);

        if (desfazEntrada)
            await EstornarEntradaAsync(operacao, cancellationToken);
        if (desfazSaida)
            await EstornarSaidaAsync(operacao, cancellationToken);

        operacao.Status = AparelhoOperacaoStatus.Estornada;
        await _repo.SalvarOperacaoAsync(operacao, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<BlingVendaCelularDescontoResponse> ConsultarDescontoAsync(
        string? cpf,
        string? imei,
        CancellationToken cancellationToken = default)
    {
        var percentual = Math.Max(0, _blingEff.Current.VendasCelularesDescontoPercentual);
        var cpfN = Doc(cpf);
        var imeiN = Imei(imei);

        if (cpfN.Length > 0 && imeiN.Length > 0)
        {
            var pares = await _repo.ListarDescontoVigenteAsync(null, cpfN, imeiN, cancellationToken);
            var match = pares.FirstOrDefault(a => a.ClienteVendaCpf == cpfN && a.Imei == imeiN);
            if (match is not null)
            {
                return new BlingVendaCelularDescontoResponse
                {
                    Elegivel = true,
                    Motivo = $"Aparelho {RotuloCondicao(match.Condicao)} entregue pela loja em {Quando(match.DataSaida)}. Desconto de {percentual:0.##}% na manutenção.",
                    DescontoPercentual = percentual,
                    Vendas = [ParaVendaDto(match)],
                };
            }

            var historico = await _repo.ListarPorImeiAsync(imeiN, cancellationToken);
            var antigo = historico.FirstOrDefault(a =>
                a.ClienteVendaCpf == cpfN && a.Status == AparelhoLojaStatus.Vendido && !a.DescontoVigente);
            if (antigo is not null)
            {
                return new BlingVendaCelularDescontoResponse
                {
                    Elegivel = false,
                    Motivo = "Este aparelho voltou para o estoque da loja. O desconto desse cliente não está mais vigente.",
                    DescontoPercentual = percentual,
                    Vendas = [ParaVendaDto(antigo)],
                };
            }
        }

        var vendas = new List<AparelhoLojaData>();
        if (imeiN.Length > 0)
            vendas.AddRange(await _repo.ListarPorImeiAsync(imeiN, cancellationToken));
        if (cpfN.Length > 0)
        {
            foreach (var v in await _repo.ListarDescontoVigenteAsync(null, cpfN, null, cancellationToken))
            {
                if (vendas.All(x => x.Id != v.Id))
                    vendas.Add(v);
            }
        }

        vendas = vendas.Where(v => v.Status == AparelhoLojaStatus.Vendido).ToList();
        var noEstoque = imeiN.Length > 0 && vendas.Count == 0
            && (await _repo.ObterEmEstoquePorImeiAsync(imeiN, cancellationToken)) is not null;
        var dtos = vendas.Select(ParaVendaDto).ToList();
        var motivo = noEstoque
            ? "Este IMEI está no estoque da loja. O desconto só vale para quem levou o aparelho numa venda ou troca."
            : MotivoParcial(cpfN, imeiN, dtos.Count);
        return new BlingVendaCelularDescontoResponse
        {
            Elegivel = false,
            Motivo = motivo,
            DescontoPercentual = percentual,
            Vendas = dtos,
        };
    }

    public async Task<bool> ImeiJaPassouPelaLojaAsync(string? imei, CancellationToken cancellationToken = default)
    {
        var imeiN = Imei(imei);
        if (imeiN.Length != 15) return false;
        var lista = await _repo.ListarPorImeiAsync(imeiN, cancellationToken);
        return lista.Count > 0;
    }

    public async Task<BlingVendaCelularPassivelResponse> ConsultarPassivelAsync(
        long? clienteId,
        string? cpf,
        string? modeloId,
        string? modeloNome,
        string? marcaNome,
        CancellationToken cancellationToken = default)
    {
        var vazio = new BlingVendaCelularPassivelResponse();
        if (string.IsNullOrWhiteSpace(modeloId) && string.IsNullOrWhiteSpace(modeloNome))
            return vazio;
        if (clienteId is null or <= 0 && string.IsNullOrWhiteSpace(cpf))
            return vazio;

        var vendas = await _repo.ListarDescontoVigenteAsync(clienteId, Doc(cpf), null, cancellationToken);
        var match = vendas.Where(v => ModeloBate(marcaNome, modeloNome, modeloId, v)).ToList();
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
                ? "Cliente pode ser elegível à promoção. Valide o IMEI do aparelho que entrou na assistência."
                : $"Cliente pode ser elegível à promoção. Aparelho vendido: {resumo}. Valide o IMEI.",
            Aparelhos = match.Select(ParaVendaDto).ToList(),
        };
    }

    private async Task<List<AparelhoLojaData>> ExigirEntradasNoEstoqueAsync(
        AparelhoOperacaoData operacao,
        CancellationToken cancellationToken)
    {
        var ids = IdsDeEntrada(operacao);
        if (ids.Count == 0)
            throw new InvalidOperationException("Não dá para desfazer: o aparelho que entrou já saiu do estoque.");

        var lista = new List<AparelhoLojaData>();
        foreach (var id in ids)
        {
            var aparelho = await ObterMovimentoAsync(id, cancellationToken);
            if (aparelho is null || !EstaNaLoja(aparelho.Status) || aparelho.OperacaoEntradaId != operacao.Id)
                throw new InvalidOperationException("Não dá para desfazer: o aparelho que entrou já saiu do estoque.");
            lista.Add(aparelho);
        }

        return lista;
    }

    private async Task<AparelhoLojaData> ExigirSaidaVendidaAsync(
        AparelhoOperacaoData operacao,
        CancellationToken cancellationToken)
    {
        var aparelho = await ObterMovimentoAsync(operacao.Saida?.AparelhoId, cancellationToken);
        if (aparelho is null || aparelho.Status != AparelhoLojaStatus.Vendido || aparelho.OperacaoSaidaId != operacao.Id)
            throw new InvalidOperationException("Não dá para desfazer: o aparelho que saiu já voltou ou foi vendido de novo.");
        return aparelho;
    }

    private async Task EstornarEntradaAsync(AparelhoOperacaoData operacao, CancellationToken cancellationToken)
    {
        foreach (var aparelho in await ExigirEntradasNoEstoqueAsync(operacao, cancellationToken))
        {
            var imei = aparelho.Imei;
            aparelho.Status = AparelhoLojaStatus.Estornado;
            aparelho.DescontoVigente = false;
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);

            if (await _repo.ObterEmEstoquePorImeiAsync(imei, cancellationToken) is not null)
                continue;

            var anterior = (await _repo.ListarPorImeiAsync(imei, cancellationToken))
                .Where(a => a.Id != aparelho.Id && a.Status == AparelhoLojaStatus.Vendido && a.ClienteVendaId is > 0)
                .OrderByDescending(a => a.DataSaida ?? a.DataEntrada)
                .FirstOrDefault();
            if (anterior is not null)
                await ConcederDescontoAsync(anterior, anterior.OperacaoSaidaId, cancellationToken);
        }
    }

    private async Task EstornarSaidaAsync(AparelhoOperacaoData operacao, CancellationToken cancellationToken)
    {
        var aparelho = await ExigirSaidaVendidaAsync(operacao, cancellationToken);
        if (aparelho.ClienteVendaId is > 0)
            await _vinculo.RemoverCompradoAsync(aparelho.ClienteVendaId.Value, aparelho.Imei, cancellationToken);

        aparelho.Status = AparelhoLojaStatus.EmEstoque;
        aparelho.DescontoVigente = false;
        aparelho.OperacaoSaidaId = null;
        aparelho.DataSaida = null;
        aparelho.ClienteVendaId = null;
        aparelho.ClienteVendaNome = "";
        aparelho.ClienteVendaCpf = "";
        aparelho.PrecoVenda = 0;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
    }

    private async Task<AparelhoLojaData?> ObterMovimentoAsync(string? id, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        return await _repo.ObterAparelhoAsync(id, cancellationToken);
    }

    private async Task<(long? ClienteId, string Nome, string Cpf, string Fornecedor)> ResolverOrigemCompraAsync(
        AparelhoCompraRequest pedido,
        CancellationToken cancellationToken)
    {
        var fornecedor = Texto(pedido.FornecedorNome);
        if (pedido.ClienteId is > 0)
        {
            var cliente = await _clientes.ObterPorBlingIdAsync(pedido.ClienteId.Value);
            if (cliente is null)
                throw new InvalidOperationException("Cliente não encontrado.");
            return (cliente.BlingId, cliente.Nome, Doc(cliente.CpfCnpj), fornecedor);
        }

        if (fornecedor.Length == 0)
            throw new InvalidOperationException("Informe o cliente ou o fornecedor de quem a loja comprou o aparelho.");
        return (null, fornecedor, "", fornecedor);
    }

    private async Task<ClienteLocalData> ExigirClienteComCpfAsync(long clienteId, CancellationToken cancellationToken)
    {
        if (clienteId <= 0)
            throw new InvalidOperationException("Selecione o cliente.");
        var cliente = await _clientes.ObterPorBlingIdAsync(clienteId)
            ?? throw new InvalidOperationException("Cliente não encontrado.");
        var cpf = Doc(cliente.CpfCnpj);
        if (cpf.Length is not (11 or 14))
            throw new InvalidOperationException("O cliente precisa ter CPF ou CNPJ cadastrado. O desconto da assistência usa esse documento junto com o IMEI.");
        return cliente;
    }

    private async Task<AparelhoLojaData> ExigirEmEstoqueAsync(string? id, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new InvalidOperationException("Selecione o aparelho do estoque.");
        var aparelho = await _repo.ObterAparelhoAsync(id.Trim(), cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado no estoque.");
        if (aparelho.Status == AparelhoLojaStatus.EmAssistencia)
            throw new InvalidOperationException("Este aparelho está na assistência e ainda não foi liberado para venda.");
        if (aparelho.Status != AparelhoLojaStatus.EmEstoque)
            throw new InvalidOperationException("Esse aparelho não está mais no estoque.");
        return aparelho;
    }

    private async Task<AparelhoEntradaRequest> NormalizarEntradaAsync(
        AparelhoEntradaRequest? bruto,
        CancellationToken cancellationToken)
    {
        if (bruto is null)
            throw new InvalidOperationException("Informe os dados do aparelho.");

        var imei = Imei(bruto.Imei);
        if (imei.Length != 15)
            throw new InvalidOperationException("O IMEI precisa ter 15 dígitos.");
        if (imei.Distinct().Count() <= 1)
            throw new InvalidOperationException("IMEI inválido.");

        if (await _repo.ObterEmEstoquePorImeiAsync(imei, cancellationToken) is not null)
            throw new InvalidOperationException("Já existe um aparelho com este IMEI no estoque.");

        var marca = Texto(bruto.Marca);
        var modelo = Texto(bruto.Modelo);
        if (marca.Length == 0 || modelo.Length == 0)
            throw new InvalidOperationException("Selecione a marca e o modelo do aparelho.");

        var condicao = string.Equals(bruto.Condicao?.Trim(), AparelhoCondicao.Novo, StringComparison.OrdinalIgnoreCase)
            ? AparelhoCondicao.Novo
            : AparelhoCondicao.Usado;

        return new AparelhoEntradaRequest
        {
            Imei = imei,
            Marca = marca,
            Modelo = modelo,
            MarcaId = string.IsNullOrWhiteSpace(bruto.MarcaId) ? null : bruto.MarcaId.Trim(),
            ModeloId = string.IsNullOrWhiteSpace(bruto.ModeloId) ? null : bruto.ModeloId.Trim(),
            Cor = Texto(bruto.Cor),
            Configuracao = Texto(bruto.Configuracao),
            Condicao = condicao,
            ValorVenda = ExigirValorDeVenda(bruto.ValorVenda, bruto.ValorMinimoVenda),
            ValorMinimoVenda = Dinheiro(bruto.ValorMinimoVenda),
            Observacoes = Texto(bruto.Observacoes),
            SaudeBateria = bruto.SaudeBateria,
            BateriaPerfeita = BateriaDoIphone(marca, modelo, bruto),
            PecaTrocada = PecaDoIphone(marca, modelo, bruto),
            MensagemPecaTrocada = MensagemDaPeca(marca, modelo, bruto),
            Testes = bruto.Testes,
            PassaPorAssistencia = bruto.PassaPorAssistencia,
            OsNumero = Texto(bruto.OsNumero),
        };
    }

    private async Task RevogarDescontoDoImeiAsync(string imei, CancellationToken cancellationToken)
    {
        foreach (var aparelho in await _repo.ListarPorImeiAsync(imei, cancellationToken))
        {
            if (!aparelho.DescontoVigente) continue;
            aparelho.DescontoVigente = false;
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
            if (aparelho.ClienteVendaId is > 0)
                await _vinculo.RemoverCompradoAsync(aparelho.ClienteVendaId.Value, imei, cancellationToken);
        }
    }

    private async Task ConcederDescontoAsync(
        AparelhoLojaData aparelho,
        string? operacaoId,
        CancellationToken cancellationToken)
    {
        aparelho.DescontoVigente = true;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        if (aparelho.ClienteVendaId is not > 0) return;

        await _vinculo.RegistrarCompradoAsync(aparelho.ClienteVendaId.Value, new ClienteAparelhoComprado
        {
            VendaId = operacaoId,
            Imei = aparelho.Imei,
            Marca = aparelho.Marca,
            Modelo = aparelho.Modelo,
            MarcaId = aparelho.MarcaId,
            ModeloId = aparelho.ModeloId,
            Cor = aparelho.Cor,
            Configuracao = aparelho.Configuracao,
            DataVenda = aparelho.DataSaida ?? HorarioBrasil.Agora,
        }, cancellationToken);
    }

    private async Task<AparelhoLojaPainelDto> MontarPainelAsync(CancellationToken cancellationToken)
    {
        var estoque = await _repo.ListarEstoqueAsync(cancellationToken);
        var comCusto = await _repo.ListarComCustoOsAsync(cancellationToken);
        var operacoes = await _repo.ListarOperacoesAsync(80, cancellationToken);
        var ativas = await _repo.ListarOperacoesAtivasAsync(cancellationToken);
        var ids = operacoes
            .SelectMany(IdsDaOperacao)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .Distinct()
            .ToList();
        var porId = (await _repo.ListarPorIdsAsync(ids, cancellationToken))
            .Where(a => a.Id is not null)
            .ToDictionary(a => a.Id!);
        var lista = await _repo.ListarListaAsync(cancellationToken);

        return new AparelhoLojaPainelDto
        {
            Resumo = new AparelhoLojaResumoDto
            {
                EmEstoque = estoque.Count(a => a.Status == AparelhoLojaStatus.EmEstoque),
                EmAssistencia = estoque.Count(a => a.Status == AparelhoLojaStatus.EmAssistencia),
                CustoEstoque = estoque.Sum(a => a.Custo),
                DinheiroRecebido = ativas.Sum(op => op.DinheiroRecebido),
                DinheiroPago = ativas.Sum(op => op.DinheiroPago),
                SaldoCaixa = ativas.Sum(op => op.DinheiroRecebido - op.DinheiroPago),
                Compras = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Compra),
                Vendas = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Venda),
                Trocas = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Troca),
                CustoPecas = comCusto.Sum(a => a.CustoPecas),
                CustoMaoDeObra = comCusto.Sum(a => a.CustoMaoDeObra),
                PorVendedor = AgruparVendedores(ativas, comCusto),
            },
            Estoque = estoque.Select(a => ComForma(ParaDto(a), a, ativas)).ToList(),
            CustosAssistencia = comCusto.Select(ParaDto).ToList(),
            Operacoes = operacoes.Select(op => ParaOperacaoDto(op, porId)).ToList(),
            DescontoVendaMaxPercentual = PercentualLimite(_blingEff.Current.VendasCelularesDescontoVendaMaxPercentual),
            AcrescimoFinanciadoraMaxPercentual = PercentualLimite(_blingEff.Current.VendasCelularesAcrescimoFinanciadoraMaxPercentual),
            Lista = lista.Select(p => new AparelhoListaPrecoDto
            {
                Id = p.Id,
                ModeloId = p.ModeloId,
                Marca = p.Marca,
                Modelo = p.Modelo,
                Condicao = p.Condicao,
                Configuracao = p.Configuracao,
                Preco = p.Preco,
                AtualizadoEm = p.AtualizadoEm,
            }).ToList(),
        };
    }

    private async Task<decimal> ValorDeEstoqueAsync(
        AparelhoLojaData aparelho,
        decimal fallback,
        CancellationToken cancellationToken)
    {
        var lista = await _repo.ListarListaAsync(cancellationToken);
        var preco = AcharPreco(aparelho, lista);
        return preco is > 0 ? preco.Value : fallback;
    }

    private async Task ProjetarEstoqueAsync(CancellationToken cancellationToken)
    {
        var lista = await _repo.ListarListaAsync(cancellationToken);
        foreach (var aparelho in await _repo.ListarEstoqueAsync(cancellationToken))
        {
            var preco = AcharPreco(aparelho, lista);
            if (preco is not > 0 || aparelho.Custo == preco.Value) continue;
            aparelho.Custo = preco.Value;
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        }
    }

    private static decimal? AcharPreco(AparelhoLojaData aparelho, IReadOnlyList<AparelhoListaPrecoData> lista)
    {
        if (string.IsNullOrWhiteSpace(aparelho.ModeloId)) return null;
        var condicao = aparelho.Condicao == AparelhoCondicao.Usado
            ? AparelhoCondicao.Usado
            : AparelhoCondicao.Novo;
        var chave = ChaveConfig(aparelho.Configuracao);
        var doModelo = lista.Where(p => p.ModeloId == aparelho.ModeloId && p.Condicao == condicao).ToList();
        if (chave.Length > 0)
        {
            var exato = doModelo.FirstOrDefault(p => p.ConfiguracaoChave == chave);
            if (exato is not null) return exato.Preco;
        }

        return doModelo.FirstOrDefault(p => p.ConfiguracaoChave.Length == 0)?.Preco;
    }

    private static void PreencherLista(
        AparelhoListaPrecoData item,
        string marca,
        string modelo,
        string config,
        decimal preco,
        DateTime agora)
    {
        item.Marca = marca;
        item.Modelo = modelo;
        item.Configuracao = config;
        item.Preco = preco;
        item.AtualizadoEm = agora;
    }

    private static string ChaveConfig(string? config)
    {
        var t = (config ?? "").Trim().ToUpperInvariant();
        return t.Replace(" ", "").Replace("-", "");
    }

    private static bool PodeEstornar(AparelhoOperacaoData op, IReadOnlyDictionary<string, AparelhoLojaData> porId)
    {
        if (op.Status != AparelhoOperacaoStatus.Ativa) return false;
        bool EntradaNoEstoque() =>
            IdsDeEntrada(op).Count > 0
            && IdsDeEntrada(op).All(id =>
                porId.TryGetValue(id, out var a)
                && EstaNaLoja(a.Status)
                && a.OperacaoEntradaId == op.Id);
        bool SaidaAindaVendida() =>
            op.Saida?.AparelhoId is string id
            && porId.TryGetValue(id, out var a)
            && a.Status == AparelhoLojaStatus.Vendido
            && a.OperacaoSaidaId == op.Id;

        return op.Tipo switch
        {
            AparelhoOperacaoTipo.Compra => EntradaNoEstoque(),
            AparelhoOperacaoTipo.Venda => SaidaAindaVendida(),
            AparelhoOperacaoTipo.Troca => EntradaNoEstoque() && SaidaAindaVendida(),
            _ => false,
        };
    }

    private static AparelhoLojaDto ComForma(
        AparelhoLojaDto dto,
        AparelhoLojaData aparelho,
        IEnumerable<AparelhoOperacaoData> operacoes)
    {
        var entrada = operacoes.FirstOrDefault(op =>
            op.Id is not null && op.Id == aparelho.OperacaoEntradaId);
        if (entrada is not null)
        {
            dto.FormaNegociacao = string.IsNullOrWhiteSpace(entrada.FormaNegociacao) ? "avista" : entrada.FormaNegociacao;
            dto.FinanciadoraNome = entrada.FinanciadoraNome ?? "";
            return dto;
        }

        if (aparelho.Origem == AparelhoOperacaoTipo.Compra)
            dto.FormaNegociacao = "avista";
        return dto;
    }

    private static AparelhoLojaDto ParaDto(AparelhoLojaData a) => new()
    {
        Id = a.Id,
        Imei = a.Imei,
        Marca = a.Marca,
        Modelo = a.Modelo,
        MarcaId = a.MarcaId,
        ModeloId = a.ModeloId,
        Cor = a.Cor,
        Configuracao = a.Configuracao,
        Condicao = a.Condicao,
        ValorVenda = a.ValorVenda,
        ValorMinimoVenda = a.ValorMinimoVenda,
        Custo = a.Custo,
        Status = a.Status,
        Origem = a.Origem,
        ClienteOrigemNome = a.ClienteOrigemNome,
        ClienteVendaNome = a.ClienteVendaNome,
        DescontoVigente = a.DescontoVigente,
        DataEntrada = a.DataEntrada,
        DataSaida = a.DataSaida,
        SaudeBateria = a.SaudeBateria,
        BateriaPerfeita = a.BateriaPerfeita,
        PecaTrocada = a.PecaTrocada,
        MensagemPecaTrocada = a.MensagemPecaTrocada,
        VendedorEntradaNome = a.VendedorEntradaNome,
        VendedorSaidaNome = a.VendedorSaidaNome,
        Observacoes = a.Observacoes,
        OsEntradaId = a.OsEntradaId,
        OsEntradaNumero = a.OsEntradaNumero,
        Desagio = a.Desagio,
        TestesNaOs = a.TestesNaOs,
        Testes = (a.Testes ?? []).Select(t => new AparelhoTesteDto
        {
            Nome = t.Nome,
            Ok = t.Ok,
            Observacao = t.Observacao,
        }).ToList(),
        Fotos = (a.Fotos ?? []).Select(ParaFotoDto).ToList(),
        CustosOs = (a.CustosOs ?? []).Select(c => new AparelhoOsCustoDto
        {
            OsId = c.OsId,
            Numero = c.Numero,
            Pecas = c.Pecas,
            MaoDeObra = c.MaoDeObra,
        }).ToList(),
        CustoPecas = a.CustoPecas,
        CustoMaoDeObra = a.CustoMaoDeObra,
    };

    private static AparelhoOperacaoDto ParaOperacaoDto(
        AparelhoOperacaoData op,
        IReadOnlyDictionary<string, AparelhoLojaData> porId) => new()
    {
        Id = op.Id,
        Tipo = op.Tipo,
        Status = op.Status,
        Data = op.Data,
        ClienteNome = string.IsNullOrWhiteSpace(op.ClienteNome) ? op.FornecedorNome : op.ClienteNome,
        ClienteCpf = op.ClienteCpf,
        FornecedorNome = op.FornecedorNome,
        EntradaResumo = ResumoEntradas(op),
        SaidaResumo = ResumoMovimento(op.Saida),
        ValorAvaliado = op.ValorAvaliado,
        PrecoSaida = op.PrecoSaida,
        DinheiroRecebido = op.DinheiroRecebido,
        DinheiroPago = op.DinheiroPago,
        FormaNegociacao = string.IsNullOrWhiteSpace(op.FormaNegociacao) ? "avista" : op.FormaNegociacao,
        FinanciadoraNome = op.FinanciadoraNome,
        EntradaLoja = op.EntradaLoja,
        RepasseFinanciadora = op.RepasseFinanciadora,
        Observacoes = op.Observacoes,
        VendedorNome = op.VendedorNome,
        PodeEstornar = PodeEstornar(op, porId),
    };

    private static BlingVendaCelularDto ParaVendaDto(AparelhoLojaData a) => new()
    {
        Id = a.Id,
        PedidoNumero = "loja",
        DataVenda = a.DataSaida ?? a.DataEntrada,
        ClienteNome = a.ClienteVendaNome,
        ClienteCpf = a.ClienteVendaCpf,
        ProdutoNome = NomeAparelho(a.Marca, a.Modelo, a.Configuracao),
        Tipo = a.Condicao,
        Imei = a.Imei,
        Marca = a.Marca,
        Modelo = a.Modelo,
        Cor = a.Cor,
        Configuracao = a.Configuracao,
        MarcaId = a.MarcaId,
        ModeloId = a.ModeloId,
        ClienteLocalId = a.ClienteVendaId,
        CadastroPendente = false,
        Valor = a.PrecoVenda,
    };

    private static bool ModeloBate(string? marca, string? modelo, string? modeloId, AparelhoLojaData aparelho)
    {
        var venda = new BlingVendaCelularData
        {
            Marca = aparelho.Marca,
            Modelo = aparelho.Modelo,
            ModeloId = aparelho.ModeloId,
            MarcaId = aparelho.MarcaId,
            ProdutoNome = NomeAparelho(aparelho.Marca, aparelho.Modelo, aparelho.Configuracao),
            Imei = aparelho.Imei,
            Cor = aparelho.Cor,
            Configuracao = aparelho.Configuracao,
        };
        return ProdutoCelularNomeParser.MesmoModelo(marca, modelo, modeloId, venda);
    }

    private static AparelhoMovimentoData Movimento(AparelhoLojaData a, decimal preco) => new()
    {
        AparelhoId = a.Id,
        Imei = a.Imei,
        Marca = a.Marca,
        Modelo = a.Modelo,
        Cor = a.Cor,
        Configuracao = a.Configuracao,
        Condicao = a.Condicao,
        Custo = a.Custo,
        Preco = preco,
    };

    private static IEnumerable<string?> IdsDaOperacao(AparelhoOperacaoData op) =>
        IdsDeEntrada(op).Concat([op.Saida?.AparelhoId]);

    private static List<string> IdsDeEntrada(AparelhoOperacaoData op)
    {
        var ids = (op.Entradas ?? [])
            .Select(e => e.AparelhoId)
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .ToList();
        if (ids.Count == 0 && !string.IsNullOrWhiteSpace(op.Entrada?.AparelhoId))
            ids.Add(op.Entrada.AparelhoId);
        return ids;
    }

    private static string ResumoEntradas(AparelhoOperacaoData op)
    {
        var lista = op.Entradas is { Count: > 0 }
            ? op.Entradas
            : op.Entrada is null ? [] : new List<AparelhoMovimentoData> { op.Entrada };
        return string.Join(" + ", lista.Select(ResumoMovimento).Where(s => s.Length > 0));
    }

    private static string ResumoMovimento(AparelhoMovimentoData? m)
    {
        if (m is null || string.IsNullOrWhiteSpace(m.Imei)) return "";
        var nome = NomeAparelho(m.Marca, m.Modelo, m.Configuracao);
        return string.IsNullOrWhiteSpace(nome) ? m.Imei : $"{nome} · {m.Imei}";
    }

    private static string NomeAparelho(string? marca, string? modelo, string? config) =>
        string.Join(" ", new[] { marca, modelo, config }.Where(s => !string.IsNullOrWhiteSpace(s)));

    private static string MotivoParcial(string cpf, string imei, int qtd)
    {
        if (cpf.Length > 0 && imei.Length > 0)
        {
            return qtd == 0
                ? "Não há venda da loja com este CPF e IMEI."
                : "Este IMEI não está vinculado a este CPF nas vendas da loja.";
        }

        if (imei.Length > 0)
        {
            return qtd == 0
                ? "IMEI não encontrado nas vendas da loja."
                : "IMEI encontrado. Informe o CPF do cliente para confirmar o desconto.";
        }

        return qtd == 0
            ? "Nenhuma venda de aparelho da loja encontrada para este CPF."
            : "Vendas encontradas. Informe o IMEI do aparelho para confirmar o desconto.";
    }

    private static string RotuloCondicao(string condicao) =>
        condicao == AparelhoCondicao.Novo ? "novo" : "usado";

    private static string Quando(DateTime? data) =>
        (data ?? HorarioBrasil.Agora).ToString("dd/MM/yyyy");

    private readonly record struct NegociacaoCaixa(
        string Forma,
        string Nome,
        decimal Entrada,
        decimal Repasse,
        decimal Recebido);

    private static NegociacaoCaixa CaixaNegociacao(
        string? forma,
        string? nome,
        decimal entrada,
        decimal repasse,
        decimal valorAvista)
    {
        var normalizada = NormalizarForma(forma);
        if (normalizada is "avista" or "cartao")
        {
            var recebidoAvista = valorAvista > 0 ? Dinheiro(valorAvista) : 0;
            return new NegociacaoCaixa(normalizada, "", recebidoAvista, 0, recebidoAvista);
        }

        if (normalizada == "avista_cartao")
        {
            var avista = Dinheiro(entrada);
            var cartao = Dinheiro(repasse);
            if (avista <= 0 || cartao <= 0)
                throw new InvalidOperationException("Informe o valor à vista e o valor no cartão.");
            var soma = Dinheiro(avista + cartao);
            if (valorAvista > 0 && soma != Dinheiro(valorAvista))
                throw new InvalidOperationException("À vista e cartão precisam somar o valor da venda.");
            return new NegociacaoCaixa(normalizada, "", avista, cartao, soma);
        }

        var financiadora = normalizada switch
        {
            "payjoy" => "Payjoy",
            "paymobi" => "Paymobi",
            "crefaz" => "Crefaz",
            _ => Texto(nome),
        };
        if (financiadora.Length == 0)
            throw new InvalidOperationException("Informe o nome da financiadora.");

        var entradaLoja = Dinheiro(entrada);
        var repasseFinanciadora = normalizada == "paymobi" ? 0 : Dinheiro(repasse);
        if (entradaLoja < 0 || repasseFinanciadora < 0)
            throw new InvalidOperationException("Entrada e repasse não podem ser negativos.");

        return new NegociacaoCaixa(
            normalizada,
            financiadora,
            entradaLoja,
            repasseFinanciadora,
            Dinheiro(entradaLoja + repasseFinanciadora));
    }

    private static string NormalizarForma(string? forma)
    {
        var texto = (forma ?? "").Trim().ToLowerInvariant();
        return texto is "cartao" or "avista_cartao" or "payjoy" or "paymobi" or "crefaz" or "outra" ? texto : "avista";
    }

    private static bool EhIphone(string marca, string modelo) =>
        $"{marca} {modelo}".Contains("iphone", StringComparison.OrdinalIgnoreCase);

    private static bool? BateriaDoIphone(string marca, string modelo, AparelhoEntradaRequest bruto)
    {
        if (!EhIphone(marca, modelo)) return null;
        if (bruto.BateriaPerfeita is null)
            throw new InvalidOperationException("Informe se a saúde da bateria do iPhone está em perfeitas condições.");
        return bruto.BateriaPerfeita.Value;
    }

    private static string PecaDoIphone(string marca, string modelo, AparelhoEntradaRequest bruto) =>
        EhIphone(marca, modelo) ? Texto(bruto.PecaTrocada) : "";

    private static bool MensagemDaPeca(string marca, string modelo, AparelhoEntradaRequest bruto)
    {
        var peca = PecaDoIphone(marca, modelo, bruto);
        return peca.Length > 0 && bruto.MensagemPecaTrocada;
    }

    private static bool EhFinanciada(string? forma)
    {
        var texto = NormalizarForma(forma);
        return texto is "payjoy" or "paymobi" or "crefaz" or "outra";
    }

    private decimal ExigirValorDeVenda(decimal venda, decimal minimo)
    {
        var preco = Dinheiro(venda);
        var piso = Dinheiro(minimo);
        if (preco <= 0)
            throw new InvalidOperationException("Informe o valor de venda.");
        if (piso <= 0)
            throw new InvalidOperationException("Informe o valor mínimo para venda.");
        if (piso > preco)
            throw new InvalidOperationException("O valor mínimo para venda não pode passar do valor de venda.");
        return preco;
    }

    private static void ExigirAcimaDoMinimo(AparelhoLojaData aparelho, decimal tabela, decimal desconto, decimal precoInformado)
    {
        var minimo = Dinheiro(aparelho.ValorMinimoVenda);
        if (minimo <= 0) return;
        var basePreco = Dinheiro(tabela) > 0
            ? Dinheiro(Dinheiro(tabela) - Dinheiro(desconto))
            : Dinheiro(precoInformado);
        if (basePreco < minimo)
            throw new InvalidOperationException("O valor fica abaixo do mínimo para venda.");
    }

    private decimal PrecoCobrado(decimal tabela, decimal desconto, decimal acrescimo, string? forma, decimal precoInformado)
    {
        var basePreco = Dinheiro(tabela);
        if (basePreco <= 0)
        {
            var direto = Dinheiro(precoInformado);
            if (direto <= 0)
                throw new InvalidOperationException("Informe o preço do aparelho.");
            return direto;
        }

        var desc = Dinheiro(desconto);
        var acr = Dinheiro(acrescimo);
        if (desc < 0 || acr < 0)
            throw new InvalidOperationException("Desconto e acréscimo não podem ser negativos.");

        var tetoDesconto = Dinheiro(basePreco * PercentualLimite(_blingEff.Current.VendasCelularesDescontoVendaMaxPercentual) / 100m);
        if (desc > tetoDesconto)
            throw new InvalidOperationException($"O desconto passa do limite de {PercentualLimite(_blingEff.Current.VendasCelularesDescontoVendaMaxPercentual):0.##}% sobre o preço do aparelho.");

        var financiada = EhFinanciada(forma);
        if (!financiada && acr > 0)
            throw new InvalidOperationException("O acréscimo só vale quando a venda é por financiadora.");

        var tetoAcrescimo = Dinheiro(basePreco * PercentualLimite(_blingEff.Current.VendasCelularesAcrescimoFinanciadoraMaxPercentual) / 100m);
        if (acr > tetoAcrescimo)
            throw new InvalidOperationException($"O acréscimo passa do limite de {PercentualLimite(_blingEff.Current.VendasCelularesAcrescimoFinanciadoraMaxPercentual):0.##}% sobre o preço do aparelho.");

        var cobrado = Dinheiro(basePreco - desc + (financiada ? acr : 0));
        if (cobrado <= 0)
            throw new InvalidOperationException("O valor cobrado precisa ser maior que zero.");
        if (Dinheiro(precoInformado) > 0 && Dinheiro(precoInformado) != cobrado)
            throw new InvalidOperationException("O preço cobrado não fecha com o preço do aparelho, o desconto e o acréscimo.");
        return cobrado;
    }

    private static decimal PercentualLimite(decimal valor) =>
        valor < 0 ? 0 : Math.Min(100, valor);

    private static decimal Dinheiro(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);

    private static string Texto(string? valor) => (valor ?? "").Trim();

    private static string Doc(string? valor) =>
        new string((valor ?? "").Where(char.IsDigit).ToArray());

    private static string Imei(string? valor)
    {
        var d = Doc(valor);
        return d.Length > 15 ? d[..15] : d;
    }

    public async Task<OsAbertaConsultaDto> ConsultarOsAbertaAsync(string? numero, CancellationToken cancellationToken = default)
    {
        var os = await _os.ObterPorNumeroAsync(numero ?? "", cancellationToken);
        if (os is null)
            return new OsAbertaConsultaDto();

        var aparelho = $"{os.MarcaNome} {os.ModeloNome}".Trim();
        if (aparelho.Length == 0) aparelho = Texto(os.Equipamento);
        var imei = Imei(os.Imei);
        return new OsAbertaConsultaDto
        {
            Encontrada = true,
            Aberta = !OsSituacaoHelper.EhFinalizada(os.Situacao),
            Numero = string.IsNullOrWhiteSpace(os.OsNumero) ? os.BlingId.ToString() : os.OsNumero,
            Situacao = Texto(os.Situacao),
            Cliente = Texto(os.ContatoNome),
            Aparelho = aparelho,
            Imei = imei.Length == 15 ? imei : "",
            Defeito = Texto(os.Defeito),
        };
    }

    public async Task<AparelhoLojaPainelDto> LiberarAsync(string aparelhoId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(aparelhoId))
            throw new InvalidOperationException("Selecione o aparelho.");
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId.Trim(), cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        if (aparelho.Status != AparelhoLojaStatus.EmAssistencia)
            throw new InvalidOperationException("Este aparelho já está liberado para venda.");
        aparelho.Status = AparelhoLojaStatus.EmEstoque;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    private async Task ReterSeAssistenciaAsync(
        AparelhoLojaData aparelho,
        AparelhoEntradaRequest entrada,
        CancellationToken cancellationToken)
    {
        var numero = Texto(entrada.OsNumero);
        if (!entrada.PassaPorAssistencia && numero.Length == 0)
            return;

        if (entrada.PassaPorAssistencia)
            aparelho.Status = AparelhoLojaStatus.EmAssistencia;
        if (numero.Length == 0)
            return;

        var os = await _os.ObterPorNumeroAsync(numero, cancellationToken)
            ?? throw new InvalidOperationException("Não encontrei essa ordem de serviço.");
        if (OsSituacaoHelper.EhFinalizada(os.Situacao))
            throw new InvalidOperationException($"A OS {numero} está {os.Situacao}. Informe uma OS ainda aberta.");
        var imeiOs = Imei(os.Imei);
        if (imeiOs.Length == 15 && imeiOs != aparelho.Imei)
            throw new InvalidOperationException("O IMEI da ordem de serviço é outro. Confira o aparelho.");

        aparelho.OsEntradaId = os.BlingId;
        aparelho.OsEntradaNumero = string.IsNullOrWhiteSpace(os.OsNumero) ? os.BlingId.ToString() : os.OsNumero;
        aparelho.TestesNaOs = true;
        aparelho.Testes = [];
        var nota = $"Testes feitos na OS {aparelho.OsEntradaNumero}. O deságio já está no valor pago pela loja.";
        aparelho.Observacoes = string.IsNullOrWhiteSpace(aparelho.Observacoes) ? nota : $"{aparelho.Observacoes} {nota}";
    }

    private static bool EstaNaLoja(string status) =>
        status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia;

    private static void PreencherFicha(
        AparelhoLojaData aparelho,
        AparelhoEntradaRequest entrada,
        VendedorRef? vendedor,
        string? observacaoOperacao)
    {
        var info = Texto(entrada.Observacoes);
        aparelho.Observacoes = info.Length > 0 ? info : Texto(observacaoOperacao);
        aparelho.SaudeBateria = entrada.SaudeBateria is >= 0 and <= 100 ? entrada.SaudeBateria : null;
        aparelho.BateriaPerfeita = entrada.BateriaPerfeita;
        aparelho.PecaTrocada = Texto(entrada.PecaTrocada);
        aparelho.MensagemPecaTrocada = aparelho.PecaTrocada.Length > 0 && entrada.MensagemPecaTrocada;
        aparelho.Testes = (entrada.Testes ?? [])
            .Where(t => !string.IsNullOrWhiteSpace(t.Nome))
            .Take(20)
            .Select(t => new AparelhoTesteData
            {
                Nome = Texto(t.Nome),
                Ok = t.Ok,
                Observacao = Texto(t.Observacao),
            })
            .ToList();
        MarcarVendedorEntrada(aparelho, vendedor);
    }

    private static void MarcarVendedorEntrada(AparelhoLojaData aparelho, VendedorRef? vendedor)
    {
        aparelho.VendedorEntradaId = IdVendedor(vendedor);
        aparelho.VendedorEntradaNome = NomeVendedor(vendedor);
    }

    private static void MarcarVendedorSaida(AparelhoLojaData aparelho, VendedorRef? vendedor)
    {
        aparelho.VendedorSaidaId = IdVendedor(vendedor);
        aparelho.VendedorSaidaNome = NomeVendedor(vendedor);
    }

    private static void MarcarVendedor(AparelhoOperacaoData operacao, VendedorRef? vendedor)
    {
        operacao.VendedorId = IdVendedor(vendedor);
        operacao.VendedorNome = NomeVendedor(vendedor);
    }

    private static string? IdVendedor(VendedorRef? vendedor) =>
        string.IsNullOrWhiteSpace(vendedor?.Id) ? null : vendedor.Id.Trim();

    private static string NomeVendedor(VendedorRef? vendedor)
    {
        var nome = Texto(vendedor?.Nome);
        return nome.Length == 0 ? "Loja" : nome;
    }

    private static List<AparelhoVendedorResumoDto> AgruparVendedores(
        IReadOnlyList<AparelhoOperacaoData> operacoes,
        IReadOnlyList<AparelhoLojaData> estoque)
    {
        var nomes = operacoes.Select(o => o.VendedorNome)
            .Concat(estoque.Select(a => a.VendedorEntradaNome))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return nomes.Select(nome =>
        {
            var doVendedor = operacoes
                .Where(o => string.Equals(o.VendedorNome, nome, StringComparison.OrdinalIgnoreCase))
                .ToList();
            var aparelhos = estoque
                .Where(a => string.Equals(a.VendedorEntradaNome, nome, StringComparison.OrdinalIgnoreCase))
                .ToList();
            return new AparelhoVendedorResumoDto
            {
                Nome = nome,
                Entradas = doVendedor.Count(o => o.Entrada is not null),
                Vendas = doVendedor.Count(o => o.Tipo == AparelhoOperacaoTipo.Venda),
                Trocas = doVendedor.Count(o => o.Tipo == AparelhoOperacaoTipo.Troca),
                DinheiroRecebido = doVendedor.Sum(o => o.DinheiroRecebido),
                DinheiroPago = doVendedor.Sum(o => o.DinheiroPago),
                CustoPecas = aparelhos.Sum(a => a.CustoPecas),
                CustoMaoDeObra = aparelhos.Sum(a => a.CustoMaoDeObra),
            };
        }).ToList();
    }

    public async Task<AparelhoLojaPainelDto> AdicionarFotosAsync(
        string aparelhoId,
        IReadOnlyList<(string Nome, Stream Conteudo)> arquivos,
        string uploadsRoot,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(aparelhoId))
            throw new InvalidOperationException("Aparelho não informado.");
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId.Trim(), cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        if (arquivos.Count == 0)
            throw new InvalidOperationException("Envie ao menos uma foto ou um vídeo.");

        aparelho.Fotos ??= [];
        var pasta = Path.Combine(uploadsRoot, "aparelhos", aparelho.Id!);
        Directory.CreateDirectory(pasta);
        foreach (var (nome, conteudo) in arquivos)
        {
            var ext = ExtensaoMidia(nome);
            var video = EhVideo(ext);
            ExigirVaga(aparelho.Fotos, video);
            var id = Guid.NewGuid().ToString("N");
            var arquivo = $"{id}{ext}";
            var caminho = Path.Combine(pasta, arquivo);
            await using (var destino = new FileStream(caminho, FileMode.Create))
                await conteudo.CopyToAsync(destino, cancellationToken);
            aparelho.Fotos.Add(new AparelhoFotoData
            {
                Id = id,
                NomeArquivo = arquivo,
                Url = $"/uploads/aparelhos/{aparelho.Id}/{arquivo}",
                Tipo = video ? "video" : "foto",
                CriadoEm = HorarioBrasil.Agora,
            });
        }

        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task RegistrarCustoOsAsync(BlingOrdemServico os, CancellationToken cancellationToken = default)
    {
        var imei = Imei(os.Imei);
        if (imei.Length != 15 || os.Id is not > 0) return;

        var lista = await _repo.ListarPorImeiAsync(imei, cancellationToken);
        var aparelho = lista.FirstOrDefault(a => a.Status == AparelhoLojaStatus.EmEstoque)
            ?? lista.FirstOrDefault(a => a.Status == AparelhoLojaStatus.EmAssistencia)
            ?? lista.FirstOrDefault();
        if (aparelho is null) return;

        var cancelada = (os.Situacao ?? "").Contains("cancel", StringComparison.OrdinalIgnoreCase);
        decimal pecas = 0;
        decimal mao = 0;
        if (!cancelada)
        {
            foreach (var item in os.Itens ?? [])
            {
                if (string.Equals(item.TipoItem, "servico", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (item.CustoPeca is not > 0) continue;
                var qtd = item.Quantidade <= 0 ? 1 : item.Quantidade;
                pecas += item.CustoPeca.Value * qtd;
            }
        }

        aparelho.CustosOs ??= [];
        aparelho.CustosOs.RemoveAll(c => c.OsId == os.Id);
        aparelho.CustosOs.Add(new AparelhoOsCustoData
        {
            OsId = os.Id.Value,
            Numero = Texto(os.Numero),
            Pecas = Dinheiro(pecas),
            MaoDeObra = Dinheiro(mao),
            AtualizadoEm = HorarioBrasil.Agora,
        });
        aparelho.CustoPecas = aparelho.CustosOs.Sum(c => c.Pecas);
        aparelho.CustoMaoDeObra = aparelho.CustosOs.Sum(c => c.MaoDeObra);
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
    }

    public async Task<AparelhoFotoSessaoTokenDto> CriarSessaoFotosAsync(string? appBaseUrl, CancellationToken cancellationToken = default)
    {
        var token = Guid.NewGuid().ToString("N");
        var expira = HorarioBrasil.Agora.AddHours(6);
        await _repo.InserirSessaoFotosAsync(new AparelhoFotoSessaoData
        {
            Token = token,
            ExpiraEm = expira,
        }, cancellationToken);

        return new AparelhoFotoSessaoTokenDto
        {
            Token = token,
            Url = $"{UrlApp(appBaseUrl)}/aparelho-fotos/{token}",
            ExpiraEm = expira,
        };
    }

    public async Task<AparelhoFotoSessaoDto?> ObterSessaoFotosAsync(string token, CancellationToken cancellationToken = default)
    {
        var sessao = await SessaoValidaAsync(token, cancellationToken);
        if (sessao is null) return null;
        return new AparelhoFotoSessaoDto
        {
            ExpiraEm = sessao.ExpiraEm,
            Fotos = (sessao.Fotos ?? []).Select(ParaFotoDto).ToList(),
        };
    }

    public async Task<AparelhoFotoDto> ReceberFotoSessaoAsync(
        string token,
        string nome,
        Stream conteudo,
        CancellationToken cancellationToken = default)
    {
        var sessao = await SessaoValidaAsync(token, cancellationToken)
            ?? throw new InvalidOperationException("Este QR expirou. Peça outro no balcão.");
        sessao.Fotos ??= [];
        var ext = ExtensaoMidia(nome);
        var video = EhVideo(ext);
        ExigirVaga(sessao.Fotos, video);

        var id = Guid.NewGuid().ToString("N");
        var arquivo = $"{id}{ext}";
        var uploads = Path.Combine(_env.ContentRootPath, "uploads");
        string url;

        if (!string.IsNullOrWhiteSpace(sessao.AparelhoId))
        {
            var aparelho = await _repo.ObterAparelhoAsync(sessao.AparelhoId, cancellationToken)
                ?? throw new InvalidOperationException("Aparelho não encontrado.");
            aparelho.Fotos ??= [];
            ExigirVaga(aparelho.Fotos, video);
            var pasta = Path.Combine(uploads, "aparelhos", aparelho.Id!);
            Directory.CreateDirectory(pasta);
            await using (var destino = new FileStream(Path.Combine(pasta, arquivo), FileMode.Create))
                await conteudo.CopyToAsync(destino, cancellationToken);
            url = $"/uploads/aparelhos/{aparelho.Id}/{arquivo}";
            aparelho.Fotos.Add(new AparelhoFotoData
            {
                Id = id,
                NomeArquivo = arquivo,
                Url = url,
                Tipo = video ? "video" : "foto",
                CriadoEm = HorarioBrasil.Agora,
            });
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        }
        else
        {
            var pasta = Path.Combine(uploads, "aparelho-sessoes", sessao.Token);
            Directory.CreateDirectory(pasta);
            await using (var destino = new FileStream(Path.Combine(pasta, arquivo), FileMode.Create))
                await conteudo.CopyToAsync(destino, cancellationToken);
            url = $"/uploads/aparelho-sessoes/{sessao.Token}/{arquivo}";
        }

        var foto = new AparelhoFotoData
        {
            Id = id,
            NomeArquivo = arquivo,
            Url = url,
            Tipo = video ? "video" : "foto",
            CriadoEm = HorarioBrasil.Agora,
        };
        sessao.Fotos.Add(foto);
        await _repo.SalvarSessaoFotosAsync(sessao, cancellationToken);
        return new AparelhoFotoDto { Id = foto.Id, Url = foto.Url };
    }

    private async Task AnexarSessaoFotosAsync(AparelhoLojaData aparelho, string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return;
        var sessao = await SessaoValidaAsync(token, cancellationToken)
            ?? throw new InvalidOperationException("O QR das fotos expirou. Gere outro e envie as fotos de novo.");

        var uploads = Path.Combine(_env.ContentRootPath, "uploads");
        var pasta = Path.Combine(uploads, "aparelhos", aparelho.Id!);
        Directory.CreateDirectory(pasta);
        aparelho.Fotos ??= [];

        foreach (var foto in sessao.Fotos ?? [])
        {
            if (EhVideo(Path.GetExtension(foto.NomeArquivo)) ? VideosDe(aparelho.Fotos) >= MidiaLimite.Videos : FotosDe(aparelho.Fotos) >= MidiaLimite.Fotos)
                continue;
            var origem = Path.Combine(uploads, "aparelho-sessoes", sessao.Token, foto.NomeArquivo);
            if (!File.Exists(origem)) continue;
            var destino = Path.Combine(pasta, foto.NomeArquivo);
            File.Copy(origem, destino, overwrite: true);
            aparelho.Fotos.Add(new AparelhoFotoData
            {
                Id = foto.Id,
                NomeArquivo = foto.NomeArquivo,
                Url = $"/uploads/aparelhos/{aparelho.Id}/{foto.NomeArquivo}",
                Tipo = string.IsNullOrWhiteSpace(foto.Tipo) ? (EhVideo(Path.GetExtension(foto.NomeArquivo)) ? "video" : "foto") : foto.Tipo,
                CriadoEm = foto.CriadoEm,
            });
        }

        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        sessao.AparelhoId = aparelho.Id;
        await _repo.SalvarSessaoFotosAsync(sessao, cancellationToken);
    }

    private async Task<AparelhoFotoSessaoData?> SessaoValidaAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;
        var sessao = await _repo.ObterSessaoFotosAsync(token.Trim(), cancellationToken);
        if (sessao is null || sessao.ExpiraEm < HorarioBrasil.Agora) return null;
        return sessao;
    }

    private string UrlApp(string? appBaseUrl)
    {
        if (_env.IsDevelopment())
        {
            if (!string.IsNullOrWhiteSpace(appBaseUrl))
                return appBaseUrl.Trim().TrimEnd('/');
            if (!string.IsNullOrWhiteSpace(_intake.AppBaseUrl))
                return _intake.AppBaseUrl.Trim().TrimEnd('/');
            return "http://localhost:4200";
        }

        if (string.IsNullOrWhiteSpace(_intake.AppBaseUrl))
            throw new InvalidOperationException("Configure a URL pública do sistema para o QR das fotos.");
        return _intake.AppBaseUrl.Trim().TrimEnd('/');
    }

    private static string NovoId() => ObjectId.GenerateNewId().ToString();

    public static void ValidarTamanhoMidia(string? nome, string? contentType, long bytes)
    {
        var video = EhVideo(Path.GetExtension(nome ?? ""))
            || (contentType ?? "").StartsWith("video/", StringComparison.OrdinalIgnoreCase);
        var limite = video ? MidiaLimite.VideoBytes : MidiaLimite.FotoBytes;
        if (bytes > limite)
        {
            throw new InvalidOperationException(video
                ? "Cada vídeo pode ter no máximo 40 MB."
                : "Cada foto pode ter no máximo 8 MB.");
        }
    }

    public static string NomeMidia(string? nome, string? contentType)
    {
        var arquivo = Path.GetFileName(string.IsNullOrWhiteSpace(nome) ? "midia" : nome);
        var ext = Path.GetExtension(arquivo).ToLowerInvariant();
        if (ext == ".jpeg") ext = ".jpg";
        if (EhVideo(ext) || ext is ".jpg" or ".png" or ".webp" or ".heic")
            return Path.ChangeExtension(arquivo, ext);
        var tipo = (contentType ?? "").ToLowerInvariant();
        if (tipo.Contains("quicktime")) return arquivo + ".mov";
        if (tipo.Contains("webm")) return arquivo + ".webm";
        if (tipo.Contains("3gpp")) return arquivo + ".3gp";
        if (tipo.StartsWith("video/")) return arquivo + ".mp4";
        if (tipo.Contains("png")) return arquivo + ".png";
        if (tipo.Contains("webp")) return arquivo + ".webp";
        if (tipo.Contains("heic") || tipo.Contains("heif")) return arquivo + ".heic";
        return arquivo + ".jpg";
    }

    private static AparelhoFotoDto ParaFotoDto(AparelhoFotoData foto) => new()
    {
        Id = foto.Id,
        Url = foto.Url,
        Tipo = string.Equals(foto.Tipo, "video", StringComparison.OrdinalIgnoreCase)
            || EhVideo(Path.GetExtension(foto.NomeArquivo))
            ? "video"
            : "foto",
    };

    private static void ExigirVaga(IReadOnlyList<AparelhoFotoData> atuais, bool video)
    {
        if (video && VideosDe(atuais) >= MidiaLimite.Videos)
            throw new InvalidOperationException("Cada aparelho aceita no máximo 3 vídeos.");
        if (!video && FotosDe(atuais) >= MidiaLimite.Fotos)
            throw new InvalidOperationException("Cada aparelho aceita no máximo 12 fotos.");
    }

    private static int VideosDe(IReadOnlyList<AparelhoFotoData> atuais) =>
        atuais.Count(f => string.Equals(f.Tipo, "video", StringComparison.OrdinalIgnoreCase)
            || EhVideo(Path.GetExtension(f.NomeArquivo)));

    private static int FotosDe(IReadOnlyList<AparelhoFotoData> atuais) => atuais.Count - VideosDe(atuais);

    private static bool EhVideo(string ext) =>
        ext is ".mp4" or ".mov" or ".webm" or ".m4v" or ".3gp";

    private static string ExtensaoMidia(string nome)
    {
        var ext = Path.GetExtension(nome).ToLowerInvariant();
        if (ext == ".jpeg") ext = ".jpg";
        if (EhVideo(ext) || ext is ".jpg" or ".png" or ".webp" or ".heic")
            return ext;
        throw new InvalidOperationException("Envie foto (jpg, png, webp ou heic) ou vídeo com áudio (mp4, mov ou webm).");
    }

    private static class MidiaLimite
    {
        public const int Fotos = 12;
        public const int Videos = 3;
        public const long FotoBytes = 8L * 1024 * 1024;
        public const long VideoBytes = 40L * 1024 * 1024;
    }
}
