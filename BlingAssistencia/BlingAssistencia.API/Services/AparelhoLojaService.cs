using System.Globalization;
using Microsoft.Extensions.DependencyInjection;
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
    Task<AparelhoLojaPainelDto> InformarImeiAsync(string aparelhoId, string? imei, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> EditarCadastroAsync(string aparelhoId, AparelhoEntradaRequest pedido, CancellationToken cancellationToken = default);
    Task<OsAbertaConsultaDto> ConsultarOsAbertaAsync(string? numero, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> EstornarAsync(string operacaoId, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> ExcluirOperacaoAsync(string operacaoId, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> ExcluirAparelhoAsync(string aparelhoId, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> SalvarListaAsync(AparelhoListaPrecoRequest pedido, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> RemoverListaAsync(string id, CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> AdicionarFotosAsync(
        string aparelhoId,
        IReadOnlyList<(string Nome, Stream Conteudo)> arquivos,
        string uploadsRoot,
        string? categoria = null,
        string? descricaoFoco = null,
        CancellationToken cancellationToken = default);
    Task<AparelhoLojaPainelDto> RemoverFotoAsync(
        string aparelhoId,
        string fotoId,
        CancellationToken cancellationToken = default);
    Task<List<AparelhoFotoDto>> ListarFotosAsync(string aparelhoId, CancellationToken cancellationToken = default);
    Task RegistrarCustoOsAsync(BlingOrdemServico os, CancellationToken cancellationToken = default);
    Task RegistrarAlertaAoConcluirAsync(
        long osId,
        string? imei,
        string? contatoNome,
        string? situacaoAnterior,
        bool informado,
        string? alerta,
        bool valorInformado = false,
        decimal? valorAssistencia = null,
        long? contatoId = null,
        CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoTokenDto> CriarSessaoFotosAsync(string? appBaseUrl, string? aparelhoId, CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoDto?> ObterSessaoFotosAsync(string token, CancellationToken cancellationToken = default);
    Task<AparelhoFotoDto> ReceberFotoSessaoAsync(
        string token,
        string nome,
        Stream conteudo,
        string? categoria = null,
        string? descricaoFoco = null,
        CancellationToken cancellationToken = default);
    Task<AparelhoFotoSessaoDto?> RemoverFotoSessaoAsync(string token, string fotoId, CancellationToken cancellationToken = default);
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
    private readonly IAparelhoCodigoEstoque _codigos;
    private readonly IOsLocalRepository _os;
    private readonly IClienteLocalRepository _clientes;
    private readonly IClienteAparelhoCompradoService _vinculo;
    private readonly IBlingEffectiveSettings _blingEff;
    private readonly IAparelhoRepository _catalogo;
    private readonly IUsuarioRepository _usuarios;
    private readonly IServiceScopeFactory _escopos;
    private readonly IHostEnvironment _env;
    private readonly IntakeSettings _intake;

    public AparelhoLojaService(
        IAparelhoLojaRepository repo,
        IAparelhoCodigoEstoque codigos,
        IOsLocalRepository os,
        IClienteLocalRepository clientes,
        IClienteAparelhoCompradoService vinculo,
        IBlingEffectiveSettings blingEff,
        IAparelhoRepository catalogo,
        IUsuarioRepository usuarios,
        IServiceScopeFactory escopos,
        IHostEnvironment env,
        IOptions<IntakeSettings> intake)
    {
        _repo = repo;
        _codigos = codigos;
        _os = os;
        _clientes = clientes;
        _vinculo = vinculo;
        _blingEff = blingEff;
        _catalogo = catalogo;
        _usuarios = usuarios;
        _escopos = escopos;
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
        await _codigos.AtribuirNaEntradaAsync([aparelho], cancellationToken);

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
        ExigirImeiParaSair(aparelho);
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
            Saida = Movimento(aparelho, preco, comAssistencia: true),
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
        ExigirImeiParaSair(saida);
        ExigirAcimaDoMinimo(saida, pedido.PrecoTabela, pedido.Desconto, pedido.PrecoSaida);
        var prontas = await ResolverEntradasTrocaAsync(pedido, cancellationToken);
        var imeis = new HashSet<string>(StringComparer.Ordinal);
        foreach (var pronta in prontas)
        {
            if (pronta.Pedido.Imei.Length != 15) continue;
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
        var sentidoCalculado = diferenca > 0 ? "loja" : diferenca < 0 ? "cliente" : "nenhuma";
        var forma = NormalizarForma(pedido.Forma);
        var formaBruta = (pedido.Forma ?? "").Trim().ToLowerInvariant();
        var pagamentoExplicito = formaBruta is "dinheiro" or "cartao" or "financiadora" or "pix";
        decimal recebido;
        decimal pago;
        decimal entradaCaixa = 0;
        decimal repasse = 0;
        var nomeFinanciadora = "";
        if (sentidoCalculado == "nenhuma")
        {
            forma = "avista";
            recebido = 0;
            pago = 0;
        }
        else if (pagamentoExplicito)
        {
            pedido.SentidoDiferenca = sentidoCalculado;
            pedido.DiferencaInformada = Math.Abs(diferenca);
            (forma, nomeFinanciadora, recebido, pago) = CaixaDaDiferencaInformada(pedido);
        }
        else if (forma is "avista" or "cartao")
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

        await _codigos.AtribuirNaEntradaAsync(entradas, cancellationToken);

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
            Saida = Movimento(saida, precoSaida, comAssistencia: true),
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

    public async Task<AparelhoLojaPainelDto> ExcluirOperacaoAsync(
        string operacaoId,
        CancellationToken cancellationToken = default)
    {
        var operacao = await _repo.ObterOperacaoAsync(operacaoId, cancellationToken)
            ?? throw new InvalidOperationException("Operação não encontrada.");

        var entradasParaApagar = new List<string>();
        if (operacao.Status == AparelhoOperacaoStatus.Ativa)
        {
            var desfazEntrada = operacao.Tipo is AparelhoOperacaoTipo.Compra or AparelhoOperacaoTipo.Troca;
            var desfazSaida = operacao.Tipo is AparelhoOperacaoTipo.Venda or AparelhoOperacaoTipo.Troca;
            if (!desfazEntrada && !desfazSaida)
                throw new InvalidOperationException("Tipo de operação desconhecido.");

            if (desfazEntrada)
            {
                var entradas = await ExigirEntradasNoEstoqueAsync(operacao, cancellationToken);
                foreach (var entrada in entradas)
                {
                    if (!string.IsNullOrWhiteSpace(entrada.Id))
                        entradasParaApagar.Add(entrada.Id);
                }
            }
            if (desfazSaida)
                await ExigirSaidaVendidaAsync(operacao, cancellationToken);

            if (desfazEntrada)
                await EstornarEntradaAsync(operacao, cancellationToken);
            if (desfazSaida)
                await EstornarSaidaAsync(operacao, cancellationToken);
        }
        else if (operacao.Status == AparelhoOperacaoStatus.Estornada)
        {
            foreach (var id in IdsDeEntrada(operacao))
            {
                var aparelho = await _repo.ObterAparelhoAsync(id, cancellationToken);
                if (aparelho?.Status == AparelhoLojaStatus.Estornado)
                    entradasParaApagar.Add(id);
            }
        }
        else
            throw new InvalidOperationException("Não dá para excluir esta operação.");

        foreach (var id in entradasParaApagar.Distinct())
        {
            await _repo.RemoverAparelhoAsync(id, cancellationToken);
            ApagarPastaFotos(id);
        }

        if (!string.IsNullOrWhiteSpace(operacao.Id))
            await _repo.RemoverOperacaoAsync(operacao.Id, cancellationToken);

        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> ExcluirAparelhoAsync(
        string aparelhoId,
        CancellationToken cancellationToken = default)
    {
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId, cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        if (!EstaNaLoja(aparelho.Status))
            throw new InvalidOperationException("Este aparelho já saiu. Exclua a venda ou a troca nas transações.");

        if (!string.IsNullOrWhiteSpace(aparelho.OperacaoEntradaId))
        {
            var operacao = await _repo.ObterOperacaoAsync(aparelho.OperacaoEntradaId, cancellationToken);
            if (operacao is { Tipo: AparelhoOperacaoTipo.Troca, Status: AparelhoOperacaoStatus.Ativa })
                throw new InvalidOperationException("Este aparelho entrou numa troca. Exclua a troca nas transações.");
            if (operacao is { Tipo: AparelhoOperacaoTipo.Compra, Status: AparelhoOperacaoStatus.Ativa })
                return await ExcluirOperacaoAsync(operacao.Id!, cancellationToken);
        }

        await _repo.RemoverAparelhoAsync(aparelho.Id!, cancellationToken);
        ApagarPastaFotos(aparelho.Id!);
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

    public async Task<AparelhoLojaPainelDto> InformarImeiAsync(
        string aparelhoId,
        string? imei,
        CancellationToken cancellationToken = default)
    {
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId, cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado no estoque.");
        if (aparelho.Status is not (AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia))
            throw new InvalidOperationException("Esse aparelho não está mais no estoque.");

        var novo = Imei(imei);
        if (novo.Length != 15 || novo.Distinct().Count() <= 1)
            throw new InvalidOperationException("O IMEI precisa ter 15 dígitos.");

        var outro = await _repo.ObterEmEstoquePorImeiAsync(novo, cancellationToken);
        if (outro is not null && outro.Id != aparelho.Id)
            throw new InvalidOperationException("Já existe um aparelho com este IMEI no estoque.");

        aparelho.Imei = novo;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> EditarCadastroAsync(
        string aparelhoId,
        AparelhoEntradaRequest pedido,
        CancellationToken cancellationToken = default)
    {
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId, cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado no estoque.");
        if (!EstaNaLoja(aparelho.Status))
            throw new InvalidOperationException("Esse aparelho já saiu. O cadastro não pode mais ser alterado.");

        var entrada = await NormalizarEntradaAsync(pedido, cancellationToken, aparelho.Id);
        if (entrada.Cor.Length == 0)
            throw new InvalidOperationException("Informe a cor do aparelho.");
        if (entrada.Configuracao.Length == 0)
            throw new InvalidOperationException("Selecione a configuração do aparelho.");

        aparelho.Imei = entrada.Imei;
        aparelho.Marca = entrada.Marca;
        aparelho.Modelo = entrada.Modelo;
        aparelho.MarcaId = entrada.MarcaId;
        aparelho.ModeloId = entrada.ModeloId;
        aparelho.Cor = entrada.Cor;
        aparelho.Configuracao = entrada.Configuracao;
        aparelho.Condicao = entrada.Condicao;
        aparelho.ValorVenda = entrada.ValorVenda;
        aparelho.ValorMinimoVenda = entrada.ValorMinimoVenda;
        aparelho.Observacoes = entrada.Observacoes;
        aparelho.AlertaPermanente = entrada.AlertaPermanente;
        aparelho.SaudeBateria = entrada.SaudeBateria is >= 0 and <= 100 ? entrada.SaudeBateria : null;
        aparelho.BateriaPerfeita = entrada.BateriaPerfeita;
        aparelho.PecasTrocadas = (entrada.PecasTrocadas ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Nome))
            .Select(p => new PecaTrocadaData { Nome = Texto(p.Nome), ApareceMensagem = p.ApareceMensagem })
            .ToList();
        aparelho.PecaTrocada = ResumoPecas(entrada.PecasTrocadas ?? []);
        aparelho.MensagemPecaTrocada = aparelho.PecasTrocadas.Any(p => p.ApareceMensagem);
        if (pedido.ValorPago is not null)
            await AplicarValorPagoAsync(aparelho, pedido.ValorPago.Value, cancellationToken);
        if (pedido.ValorParaCompra is not null)
            aparelho.ValorParaCompra = pedido.ValorParaCompra.Value > 0 ? Dinheiro(pedido.ValorParaCompra.Value) : 0;
        await AssociarOsAsync(aparelho, entrada, exigirAberta: false, cancellationToken);
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    private async Task AplicarValorPagoAsync(
        AparelhoLojaData aparelho,
        decimal informado,
        CancellationToken cancellationToken)
    {
        var pago = Dinheiro(informado);
        if (pago <= 0)
            throw new InvalidOperationException("Informe o valor pago pela loja.");

        aparelho.Custo = pago;
        if (string.IsNullOrWhiteSpace(aparelho.OperacaoEntradaId))
            return;

        var operacao = await _repo.ObterOperacaoAsync(aparelho.OperacaoEntradaId, cancellationToken);
        if (operacao is null || operacao.Status != AparelhoOperacaoStatus.Ativa)
            return;

        if (operacao.Tipo == AparelhoOperacaoTipo.Compra)
        {
            operacao.DinheiroPago = pago;
            operacao.ValorAvaliado = pago;
            if (operacao.Entrada is not null)
            {
                operacao.Entrada.Preco = pago;
                operacao.Entrada.Custo = pago;
            }

            await _repo.SalvarOperacaoAsync(operacao, cancellationToken);
            return;
        }

        if (operacao.Tipo != AparelhoOperacaoTipo.Troca)
            return;

        var movimento = MovimentosDaEntrada(operacao).FirstOrDefault(m => m.AparelhoId == aparelho.Id);
        if (movimento is null)
            return;

        movimento.Preco = pago;
        movimento.Custo = pago;
        operacao.ValorAvaliado = Dinheiro(MovimentosDaEntrada(operacao).Sum(m => m.Preco));
        await _repo.SalvarOperacaoAsync(operacao, cancellationToken);
    }

    private static void ExigirImeiParaSair(AparelhoLojaData aparelho)
    {
        if (aparelho.Imei.Length == 15) return;
        throw new InvalidOperationException("Informe o IMEI deste aparelho antes de vender.");
    }

    private async Task<AparelhoEntradaRequest> NormalizarEntradaAsync(
        AparelhoEntradaRequest? bruto,
        CancellationToken cancellationToken,
        string? ignorarId = null)
    {
        if (bruto is null)
            throw new InvalidOperationException("Informe os dados do aparelho.");

        var imei = Imei(bruto.Imei);
        if (imei.Length != 15 || imei.Distinct().Count() <= 1)
            imei = "";
        else if (await _repo.ObterEmEstoquePorImeiAsync(imei, cancellationToken) is { } outro
                 && !string.Equals(outro.Id, ignorarId, StringComparison.Ordinal))
            throw new InvalidOperationException("Já existe um aparelho com este IMEI no estoque.");

        var marca = Texto(bruto.Marca);
        var modelo = Texto(bruto.Modelo);
        if (marca.Length == 0 || modelo.Length == 0)
            throw new InvalidOperationException("Selecione a marca e o modelo do aparelho.");

        var condicao = string.Equals(bruto.Condicao?.Trim(), AparelhoCondicao.Novo, StringComparison.OrdinalIgnoreCase)
            ? AparelhoCondicao.Novo
            : AparelhoCondicao.Usado;
        var pecas = PecasDoIphone(marca, modelo, bruto);

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
            AlertaPermanente = Limitar(Texto(bruto.AlertaPermanente), 400),
            SaudeBateria = bruto.SaudeBateria,
            BateriaPerfeita = BateriaDoIphone(marca, modelo, bruto),
            PecasTrocadas = pecas,
            PecaTrocada = ResumoPecas(pecas),
            MensagemPecaTrocada = pecas.Any(p => p.ApareceMensagem),
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
        await _codigos.CompletarFaltantesAsync(cancellationToken);
        var estoque = await _repo.ListarEstoqueAsync(cancellationToken);
        await CompletarJustificativaAssistenciaAsync(estoque, cancellationToken);
        var comCusto = await _repo.ListarComCustoOsAsync(cancellationToken);
        var operacoes = await _repo.ListarOperacoesAsync(500, cancellationToken);
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
        var cadastro = new MapaVendedores(await _usuarios.ListarAsync(cancellationToken));
        var cadeias = await MontarCadeiasAsync(cadastro, cancellationToken);
        var porAparelho = (await _repo.ListarNaoEstornadosAsync(cancellationToken))
            .Where(a => !string.IsNullOrWhiteSpace(a.Id))
            .ToDictionary(a => a.Id!);
        var pagos = ValorPagoPorAparelho(operacoes);

        return new AparelhoLojaPainelDto
        {
            Resumo = new AparelhoLojaResumoDto
            {
                EmEstoque = estoque.Count(a => a.Status == AparelhoLojaStatus.EmEstoque),
                EmAssistencia = estoque.Count(a => a.Status == AparelhoLojaStatus.EmAssistencia),
                CustoEstoque = estoque.Sum(a => a.Custo + a.CustoPecas),
                DinheiroRecebido = ativas.Sum(op => op.DinheiroRecebido),
                DinheiroPago = ativas.Sum(op => op.DinheiroPago),
                SaldoCaixa = ativas.Sum(op => op.DinheiroRecebido - op.DinheiroPago),
                Compras = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Compra),
                Vendas = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Venda),
                Trocas = ativas.Count(op => op.Tipo == AparelhoOperacaoTipo.Troca),
                CustoPecas = comCusto.Sum(a => a.CustoPecas),
                CustoMaoDeObra = comCusto.Sum(a => a.CustoMaoDeObra),
                PorVendedor = AgruparVendedores(ativas, comCusto, cadastro),
            },
            Estoque = estoque.Select(a => ComPrecoFornecedor(ComForma(ParaDto(a, cadastro), a, ativas), a, lista)).ToList(),
            CustosAssistencia = comCusto.Select(a => ParaDto(a, cadastro)).ToList(),
            Operacoes = operacoes.Select(op => ParaOperacaoDto(op, porId, cadastro, pagos)).ToList(),
            Movimentos = MontarMovimentos(ativas, porAparelho),
            Cadeias = cadeias,
            Meses = AgruparMeses(cadeias),
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
            VendedoresCadastrados = cadastro.Cadastrados(),
        };
    }

    private async Task<List<AparelhoCadeiaDto>> MontarCadeiasAsync(
        MapaVendedores cadastro,
        CancellationToken cancellationToken)
    {
        var aparelhos = await _repo.ListarNaoEstornadosAsync(cancellationToken);
        var operacoes = await _repo.ListarOperacoesAtivasAsync(cancellationToken);
        var porId = aparelhos
            .Where(a => !string.IsNullOrWhiteSpace(a.Id))
            .ToDictionary(a => a.Id!);
        var opsPorId = operacoes
            .Where(op => !string.IsNullOrWhiteSpace(op.Id))
            .ToDictionary(op => op.Id!);
        var clientes = await ClientesDasOperacoesAsync(operacoes, cancellationToken);
        var pagos = ValorPagoPorAparelho(operacoes);

        string Raiz(string id, HashSet<string> visto)
        {
            if (!visto.Add(id) || !porId.TryGetValue(id, out var aparelho)) return id;
            if (aparelho.OperacaoEntradaId is { } opId
                && opsPorId.TryGetValue(opId, out var op)
                && op.Tipo == AparelhoOperacaoTipo.Troca
                && op.Saida?.AparelhoId is { } pai
                && pai != id
                && porId.ContainsKey(pai))
                return Raiz(pai, visto);
            return id;
        }

        var grupos = new Dictionary<string, List<AparelhoLojaData>>();
        foreach (var aparelho in aparelhos)
        {
            if (string.IsNullOrWhiteSpace(aparelho.Id)) continue;
            var raiz = Raiz(aparelho.Id, []);
            if (!grupos.TryGetValue(raiz, out var membros))
                grupos[raiz] = membros = [];
            membros.Add(aparelho);
        }

        var cadeias = new List<AparelhoCadeiaDto>();
        foreach (var (raiz, membros) in grupos)
        {
            var ids = membros.Select(m => m.Id).Where(id => id is not null).ToHashSet();
            var ops = operacoes
                .Where(op =>
                    (op.Saida?.AparelhoId is { } saida && ids.Contains(saida))
                    || IdsDeEntrada(op).Any(ids.Contains))
                .OrderBy(op => op.Data)
                .ThenBy(op => op.Id)
                .ToList();
            if (!ops.Any(op => op.Tipo is AparelhoOperacaoTipo.Venda or AparelhoOperacaoTipo.Troca))
                continue;

            var passos = ops.Select(op => PassoDaCadeia(op, ClienteDaOperacao(op, clientes), porId, cadastro, pagos)).ToList();
            var aberta = membros.Any(m => m.Status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia);
            var dinheiroEntrou = Dinheiro(ops.Sum(op => op.DinheiroRecebido));
            var dinheiroSaiu = Dinheiro(ops.Sum(op => op.DinheiroPago));
            var investido = Dinheiro(ops.Where(op => op.Tipo == AparelhoOperacaoTipo.Compra).Sum(op => op.DinheiroPago));
            var pecas = Dinheiro(membros.Sum(m => m.CustoPecas));
            var origem = porId.GetValueOrDefault(raiz);
            cadeias.Add(new AparelhoCadeiaDto
            {
                Id = raiz,
                Titulo = origem is null ? "Transação" : NomeAparelho(origem.Marca, origem.Modelo, origem.Configuracao),
                Aberta = aberta,
                Inicio = ops.Min(op => op.Data),
                Fim = aberta ? null : ops.Max(op => op.Data),
                ValorEntrada = Dinheiro(passos.SelectMany(p => p.Entrou).Sum(i => i.Valor)),
                ValorSaida = Dinheiro(passos.SelectMany(p => p.Saiu).Sum(i => i.Valor)),
                DinheiroEntrou = dinheiroEntrou,
                DinheiroSaiu = dinheiroSaiu,
                CustoPecas = pecas,
                Investido = investido,
                ResultadoAteAgora = Dinheiro(dinheiroEntrou - dinheiroSaiu + investido - pecas),
                LucroFinal = aberta ? null : Dinheiro(dinheiroEntrou - dinheiroSaiu - pecas),
                Pendentes = membros
                    .Where(m => m.Status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia)
                    .Select(m => NomeAparelho(m.Marca, m.Modelo, m.Configuracao))
                    .ToList(),
                Passos = passos,
            });
        }

        return cadeias
            .OrderByDescending(c => c.Aberta)
            .ThenByDescending(c => c.Inicio)
            .ToList();
    }

    private static AparelhoCadeiaPassoDto PassoDaCadeia(
        AparelhoOperacaoData op,
        ClienteLocalData? cliente,
        IReadOnlyDictionary<string, AparelhoLojaData> porId,
        MapaVendedores cadastro,
        IReadOnlyDictionary<string, decimal> pagos)
    {
        var entrou = MovimentosDaEntrada(op).Select(m => ItemDaCadeia(m, porId, pagos)).ToList();
        var saiu = op.Saida is null ? [] : new List<AparelhoCadeiaItemDto> { ItemDaCadeia(op.Saida, porId, pagos) };
        var telefone = Texto(cliente?.Celular);
        if (telefone.Length == 0) telefone = Texto(cliente?.Telefone);
        return new AparelhoCadeiaPassoDto
        {
            OperacaoId = op.Id,
            Tipo = op.Tipo,
            Data = op.Data,
            Pessoa = Texto(string.IsNullOrWhiteSpace(op.ClienteNome) ? op.FornecedorNome : op.ClienteNome),
            ClienteNome = Texto(op.ClienteNome),
            ClienteCpf = Texto(op.ClienteCpf),
            ClienteTelefone = telefone,
            ClienteEmail = Texto(cliente?.Email),
            ClienteEndereco = EnderecoDe(cliente?.Endereco),
            Forma = Texto(op.FormaNegociacao),
            Financiadora = Texto(op.FinanciadoraNome),
            VendedorId = op.VendedorId,
            VendedorNome = cadastro.Nome(op.VendedorId, op.VendedorNome),
            Entrou = entrou,
            Saiu = saiu,
            DinheiroEntrou = op.DinheiroRecebido,
            DinheiroSaiu = op.DinheiroPago,
            Resultado = Dinheiro(op.DinheiroRecebido - op.DinheiroPago),
        };
    }

    private static Dictionary<string, decimal> ValorPagoPorAparelho(IEnumerable<AparelhoOperacaoData> operacoes)
    {
        var pagos = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var op in operacoes.Where(o => o.Status == AparelhoOperacaoStatus.Ativa
                     && o.Tipo is AparelhoOperacaoTipo.Compra or AparelhoOperacaoTipo.Troca))
        {
            foreach (var m in MovimentosDaEntrada(op))
            {
                if (string.IsNullOrWhiteSpace(m.AparelhoId) || m.Preco <= 0) continue;
                pagos[m.AparelhoId] = m.Preco;
            }
        }

        return pagos;
    }

    private static AparelhoCadeiaItemDto ItemDaCadeia(
        AparelhoMovimentoData m,
        IReadOnlyDictionary<string, AparelhoLojaData> porId,
        IReadOnlyDictionary<string, decimal> pagos)
    {
        porId.TryGetValue(m.AparelhoId ?? "", out var aparelho);
        var pecas = aparelho?.CustoPecas ?? 0;
        var pago = 0m;
        if (!string.IsNullOrWhiteSpace(m.AparelhoId))
            pagos.TryGetValue(m.AparelhoId, out pago);
        var custo = pago > 0 ? pago : m.Custo;
        var custoTotal = pago > 0
            ? Dinheiro(pago + pecas)
            : aparelho is null ? m.Custo : Dinheiro(aparelho.Custo + pecas);
        return new()
        {
            AparelhoId = m.AparelhoId,
            Codigo = string.IsNullOrWhiteSpace(m.Codigo) ? aparelho?.Codigo ?? "" : m.Codigo,
            Nome = NomeAparelho(m.Marca, m.Modelo, m.Configuracao),
            Imei = m.Imei,
            Cor = m.Cor,
            Configuracao = m.Configuracao,
            Condicao = m.Condicao,
            Custo = custo,
            CustoPecas = pecas,
            CustoTotal = custoTotal,
            Valor = m.Preco,
        };
    }

    private static List<AparelhoMovimentoLinhaDto> MontarMovimentos(
        IEnumerable<AparelhoOperacaoData> operacoes,
        IReadOnlyDictionary<string, AparelhoLojaData> porId)
    {
        var linhas = new List<AparelhoMovimentoLinhaDto>();
        foreach (var op in operacoes.Where(o => o.Status == AparelhoOperacaoStatus.Ativa))
        {
            foreach (var entrada in MovimentosDaEntrada(op))
                linhas.Add(LinhaMovimento(op, entrada, "entrada", porId));
            if (op.Saida is not null)
                linhas.Add(LinhaMovimento(op, op.Saida, "saida", porId));
        }

        return linhas
            .OrderByDescending(l => l.Data)
            .ThenBy(l => l.Codigo)
            .ToList();
    }

    private static AparelhoMovimentoLinhaDto LinhaMovimento(
        AparelhoOperacaoData op,
        AparelhoMovimentoData movimento,
        string sentido,
        IReadOnlyDictionary<string, AparelhoLojaData> porId)
    {
        porId.TryGetValue(movimento.AparelhoId ?? "", out var aparelho);
        var codigo = string.IsNullOrWhiteSpace(movimento.Codigo) ? aparelho?.Codigo ?? "" : movimento.Codigo;
        var valor = Dinheiro(movimento.Preco);
        return new AparelhoMovimentoLinhaDto
        {
            Data = op.Data,
            Tipo = op.Tipo,
            Sentido = sentido,
            Codigo = codigo,
            AparelhoId = movimento.AparelhoId,
            Nome = NomeAparelho(movimento.Marca, movimento.Modelo, movimento.Configuracao),
            Imei = movimento.Imei,
            Valor = sentido == "saida" ? -valor : valor,
            Pessoa = Texto(string.IsNullOrWhiteSpace(op.ClienteNome) ? op.FornecedorNome : op.ClienteNome),
        };
    }

    private async Task<Dictionary<long, ClienteLocalData>> ClientesDasOperacoesAsync(
        IEnumerable<AparelhoOperacaoData> operacoes,
        CancellationToken cancellationToken)
    {
        var mapa = new Dictionary<long, ClienteLocalData>();
        foreach (var id in operacoes.Select(op => op.ClienteId).Where(id => id is > 0).Select(id => id!.Value).Distinct())
        {
            var cliente = await _clientes.ObterPorBlingIdAsync(id);
            if (cliente is not null) mapa[id] = cliente;
        }

        return mapa;
    }

    private static ClienteLocalData? ClienteDaOperacao(
        AparelhoOperacaoData op,
        IReadOnlyDictionary<long, ClienteLocalData> clientes) =>
        op.ClienteId is > 0 && clientes.TryGetValue(op.ClienteId.Value, out var cliente) ? cliente : null;

    private static string EnderecoDe(BlingContatoEndereco? endereco)
    {
        if (endereco is null) return "";
        var rua = string.Join(", ", new[] { endereco.Logradouro, endereco.Numero, endereco.Complemento, endereco.Bairro }
            .Where(s => !string.IsNullOrWhiteSpace(s)));
        var cidade = string.Join("/", new[] { endereco.Municipio, endereco.Uf }.Where(s => !string.IsNullOrWhiteSpace(s)));
        return string.Join(" — ", new[] { rua, cidade, endereco.Cep }.Where(s => !string.IsNullOrWhiteSpace(s)));
    }

    private static IEnumerable<AparelhoMovimentoData> MovimentosDaEntrada(AparelhoOperacaoData op)
    {
        if (op.Entradas is { Count: > 0 }) return op.Entradas;
        return op.Entrada is null ? [] : [op.Entrada];
    }

    private static List<AparelhoCadeiaMesDto> AgruparMeses(IReadOnlyList<AparelhoCadeiaDto> cadeias)
    {
        var cultura = CultureInfo.GetCultureInfo("pt-BR");
        var linhas = new List<(int Ano, int Mes, string OpId, decimal Entrou, decimal Saiu, AparelhoCadeiaUnidadeDto Unidade)>();
        foreach (var cadeia in cadeias)
        {
            var resultado = cadeia.Aberta ? cadeia.ResultadoAteAgora : cadeia.LucroFinal ?? 0;
            foreach (var passo in cadeia.Passos)
            {
                var ano = passo.Data.Year;
                var mes = passo.Data.Month;
                var opId = string.IsNullOrWhiteSpace(passo.OperacaoId)
                    ? $"{cadeia.Id}:{passo.Data.Ticks}:{passo.Tipo}"
                    : passo.OperacaoId;
                void Add(AparelhoCadeiaItemDto item, string movimento)
                {
                    linhas.Add((ano, mes, opId, passo.DinheiroEntrou, passo.DinheiroSaiu, new AparelhoCadeiaUnidadeDto
                    {
                        Data = passo.Data,
                        Nome = item.Nome,
                        Imei = item.Imei,
                        Movimento = movimento,
                        OperacaoId = passo.OperacaoId,
                        Valor = item.Valor,
                        CadeiaId = cadeia.Id,
                        CadeiaTitulo = cadeia.Titulo,
                        CadeiaAberta = cadeia.Aberta,
                        ResultadoCadeia = resultado,
                        Pessoa = passo.Pessoa,
                    }));
                }

                foreach (var item in passo.Entrou)
                    Add(item, passo.Tipo == AparelhoOperacaoTipo.Compra ? "compra" : "entrou");
                foreach (var item in passo.Saiu)
                    Add(item, passo.Tipo == AparelhoOperacaoTipo.Venda ? "venda" : "saiu");
            }
        }

        return linhas
            .GroupBy(l => (l.Ano, l.Mes))
            .OrderByDescending(g => g.Key.Ano)
            .ThenByDescending(g => g.Key.Mes)
            .Select(g =>
            {
                var ops = g.GroupBy(l => l.OpId).Select(op => op.First()).ToList();
                var nomeMes = cultura.DateTimeFormat.GetMonthName(g.Key.Mes);
                var rotulo = string.IsNullOrEmpty(nomeMes)
                    ? $"{g.Key.Mes:00}/{g.Key.Ano}"
                    : $"{char.ToUpper(nomeMes[0], cultura)}{nomeMes[1..]} de {g.Key.Ano}";
                return new AparelhoCadeiaMesDto
                {
                    Ano = g.Key.Ano,
                    Mes = g.Key.Mes,
                    Rotulo = rotulo,
                    DinheiroEntrou = Dinheiro(ops.Sum(op => op.Entrou)),
                    DinheiroSaiu = Dinheiro(ops.Sum(op => op.Saiu)),
                    Resultado = Dinheiro(ops.Sum(op => op.Entrou - op.Saiu)),
                    Unidades = g
                        .OrderByDescending(l => l.Unidade.Data)
                        .ThenBy(l => l.Unidade.Nome)
                        .Select(l => l.Unidade)
                        .ToList(),
                };
            })
            .ToList();
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
            var movimento = MovimentosDaEntrada(entrada).FirstOrDefault(m => m.AparelhoId == aparelho.Id);
            if (movimento is { Preco: > 0 })
                dto.ValorPago = movimento.Preco;
            return dto;
        }

        if (aparelho.Origem == AparelhoOperacaoTipo.Compra)
            dto.FormaNegociacao = "avista";
        return dto;
    }

    private static AparelhoLojaDto ComPrecoFornecedor(
        AparelhoLojaDto dto,
        AparelhoLojaData aparelho,
        IReadOnlyList<AparelhoListaPrecoData> lista)
    {
        var daLista = AcharPreco(aparelho, lista);
        if (daLista is > 0)
            dto.ValorParaCompra = daLista.Value;
        return dto;
    }

    private static AparelhoLojaDto ParaDto(AparelhoLojaData a, MapaVendedores cadastro) => new()
    {
        Id = a.Id,
        Codigo = a.Codigo ?? "",
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
        ValorPago = a.Custo,
        ValorParaCompra = a.ValorParaCompra,
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
        PecasTrocadas = (a.PecasTrocadas ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Nome))
            .Select(p => new PecaTrocadaDto { Nome = p.Nome, ApareceMensagem = p.ApareceMensagem })
            .ToList(),
        VendedorEntradaId = a.VendedorEntradaId,
        VendedorEntradaNome = cadastro.Nome(a.VendedorEntradaId, a.VendedorEntradaNome),
        VendedorSaidaNome = cadastro.Nome(a.VendedorSaidaId, a.VendedorSaidaNome),
        Observacoes = a.Observacoes,
        AlertaPermanente = a.AlertaPermanente,
        OsEntradaId = a.OsEntradaId,
        OsEntradaNumero = a.OsEntradaNumero,
        JustificativaAssistencia = a.JustificativaAssistencia,
        Desagio = a.Desagio,
        TestesNaOs = a.TestesNaOs,
        Testes = (a.Testes ?? []).Select(t => new AparelhoTesteDto
        {
            Nome = t.Nome,
            Ok = t.Ok,
            Observacao = t.Observacao,
        }).ToList(),
        TemFoto = FotosDe(a.Fotos ?? []) > 0,
        Fotos = [],
        CustosOs = (a.CustosOs ?? []).Select(c => new AparelhoOsCustoDto
        {
            OsId = c.OsId,
            Numero = c.Numero,
            Pecas = c.Pecas,
            MaoDeObra = c.MaoDeObra,
        }).ToList(),
        CustoTotal = Dinheiro(a.Custo + a.CustoPecas),
        CustoPecas = a.CustoPecas,
        CustoMaoDeObra = a.CustoMaoDeObra,
    };

    private static AparelhoOperacaoDto ParaOperacaoDto(
        AparelhoOperacaoData op,
        IReadOnlyDictionary<string, AparelhoLojaData> porId,
        MapaVendedores cadastro,
        IReadOnlyDictionary<string, decimal> pagos) => new()
    {
        Id = op.Id,
        Tipo = op.Tipo,
        Status = op.Status,
        Data = op.Data,
        ClienteId = op.ClienteId,
        ClienteNome = string.IsNullOrWhiteSpace(op.ClienteNome) ? op.FornecedorNome : op.ClienteNome,
        ClienteCpf = op.ClienteCpf,
        FornecedorNome = op.FornecedorNome,
        EntradaResumo = ResumoEntradas(op),
        SaidaResumo = ResumoMovimento(op.Saida),
        Entrou = MovimentosDaEntrada(op).Select(m => ItemDaCadeia(m, porId, pagos)).ToList(),
        Saiu = op.Saida is null ? [] : [ItemDaCadeia(op.Saida, porId, pagos)],
        ValorAvaliado = op.ValorAvaliado,
        PrecoSaida = op.PrecoSaida,
        DinheiroRecebido = op.DinheiroRecebido,
        DinheiroPago = op.DinheiroPago,
        FormaNegociacao = string.IsNullOrWhiteSpace(op.FormaNegociacao) ? "avista" : op.FormaNegociacao,
        FinanciadoraNome = op.FinanciadoraNome,
        EntradaLoja = op.EntradaLoja,
        RepasseFinanciadora = op.RepasseFinanciadora,
        Observacoes = op.Observacoes,
        VendedorId = op.VendedorId,
        VendedorNome = cadastro.Nome(op.VendedorId, op.VendedorNome),
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

    private static AparelhoMovimentoData Movimento(AparelhoLojaData a, decimal preco, bool comAssistencia = false) => new()
    {
        AparelhoId = a.Id,
        Codigo = a.Codigo ?? "",
        Imei = a.Imei,
        Marca = a.Marca,
        Modelo = a.Modelo,
        Cor = a.Cor,
        Configuracao = a.Configuracao,
        Condicao = a.Condicao,
        Custo = comAssistencia ? Dinheiro(a.Custo + a.CustoPecas) : a.Custo,
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
        if (m is null) return "";
        var nome = NomeAparelho(m.Marca, m.Modelo, m.Configuracao);
        var partes = new[] { m.Codigo, nome, m.Imei }.Where(s => !string.IsNullOrWhiteSpace(s));
        return string.Join(" · ", partes);
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

    private static bool TemSentidoInformado(string? sentido)
    {
        var texto = (sentido ?? "").Trim().ToLowerInvariant();
        return texto is "loja" or "cliente" or "nenhuma";
    }

    private static (string Forma, string Nome, decimal Recebido, decimal Pago) CaixaDaDiferencaInformada(AparelhoTrocaRequest pedido)
    {
        var sentido = (pedido.SentidoDiferenca ?? "").Trim().ToLowerInvariant();
        var valor = Dinheiro(pedido.DiferencaInformada);
        if (valor < 0)
            throw new InvalidOperationException("A diferença não pode ser negativa.");
        if (sentido == "nenhuma")
        {
            if (valor > 0)
                throw new InvalidOperationException("Se há diferença, informe se ela volta para a loja ou para o cliente.");
            return ("avista", "", 0, 0);
        }

        if (valor <= 0)
            throw new InvalidOperationException("Informe a diferença.");

        var forma = (pedido.Forma ?? "").Trim().ToLowerInvariant();
        if (sentido == "loja")
        {
            if (forma is not ("dinheiro" or "cartao" or "financiadora"))
                throw new InvalidOperationException("Informe se a diferença entra em dinheiro, cartão ou financiadora.");
            var nome = "";
            if (forma == "financiadora")
            {
                nome = Texto(pedido.FinanciadoraNome);
                if (nome.Length == 0)
                    throw new InvalidOperationException("Informe qual é a financiadora.");
            }
            return (forma, nome, valor, 0);
        }

        if (forma is not ("pix" or "dinheiro"))
            throw new InvalidOperationException("Informe se a loja devolve em PIX ou em dinheiro.");
        return (forma, "", 0, valor);
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

    private static List<PecaTrocadaDto> PecasDoIphone(string marca, string modelo, AparelhoEntradaRequest bruto)
    {
        if (!EhIphone(marca, modelo)) return [];
        var lista = (bruto.PecasTrocadas ?? [])
            .Select(p => new PecaTrocadaDto
            {
                Nome = Texto(p.Nome),
                ApareceMensagem = p.ApareceMensagem,
            })
            .Where(p => p.Nome.Length > 0)
            .Take(8)
            .ToList();
        if (lista.Count == 0 && Texto(bruto.PecaTrocada).Length > 0)
        {
            lista.Add(new PecaTrocadaDto
            {
                Nome = Texto(bruto.PecaTrocada),
                ApareceMensagem = bruto.MensagemPecaTrocada,
            });
        }
        foreach (var peca in lista)
            peca.ApareceMensagem = peca.ApareceMensagem && peca.Nome.Length > 0;
        return lista;
    }

    private static string ResumoPecas(IReadOnlyList<PecaTrocadaDto> pecas) =>
        string.Join(", ", pecas.Select(p => p.Nome));

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

    private static string Limitar(string valor, int maximo) =>
        valor.Length <= maximo ? valor : valor[..maximo];

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
        if (aparelho.OsEntradaId is > 0)
        {
            var os = await _os.ObterPorBlingIdAsync(aparelho.OsEntradaId.Value);
            if (os is null || !OsSituacaoHelper.EhConcluida(os.Situacao))
            {
                var numero = string.IsNullOrWhiteSpace(aparelho.OsEntradaNumero)
                    ? aparelho.OsEntradaId.ToString()
                    : aparelho.OsEntradaNumero;
                throw new InvalidOperationException(
                    $"Feche a OS {numero} na assistência antes de liberar para venda. Informe se ficou defeito permanente e o valor da assistência técnica.");
            }
        }
        aparelho.Status = AparelhoLojaStatus.EmEstoque;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    private async Task ReterSeAssistenciaAsync(
        AparelhoLojaData aparelho,
        AparelhoEntradaRequest entrada,
        CancellationToken cancellationToken) =>
        await AssociarOsAsync(aparelho, entrada, exigirAberta: true, cancellationToken);

    private async Task AssociarOsAsync(
        AparelhoLojaData aparelho,
        AparelhoEntradaRequest entrada,
        bool exigirAberta,
        CancellationToken cancellationToken)
    {
        var numero = Texto(entrada.OsNumero);
        if (!entrada.PassaPorAssistencia && numero.Length == 0)
            return;

        if (numero.Length == 0)
        {
            if (aparelho.OsEntradaId is > 0)
            {
                if (entrada.PassaPorAssistencia)
                    aparelho.Status = AparelhoLojaStatus.EmAssistencia;
                return;
            }

            if (entrada.PassaPorAssistencia)
            {
                aparelho.Status = AparelhoLojaStatus.EmAssistencia;
                await AbrirOsDaLojaAsync(aparelho, cancellationToken);
            }
            return;
        }

        var jaVinculada = aparelho.OsEntradaId is > 0
            && (string.Equals(aparelho.OsEntradaNumero, numero, StringComparison.OrdinalIgnoreCase)
                || (aparelho.OsEntradaId?.ToString() == numero));
        if (jaVinculada)
        {
            if (entrada.PassaPorAssistencia)
                aparelho.Status = AparelhoLojaStatus.EmAssistencia;
            return;
        }

        var os = await _os.ObterPorNumeroAsync(numero, cancellationToken)
            ?? throw new InvalidOperationException("Não encontrei essa ordem de serviço.");
        if (OsSituacaoHelper.EhCancelada(os.Situacao))
            throw new InvalidOperationException($"A OS {numero} está {os.Situacao}. Informe outra OS.");
        if (exigirAberta && OsSituacaoHelper.EhFinalizada(os.Situacao))
            throw new InvalidOperationException($"A OS {numero} está {os.Situacao}. Informe uma OS ainda aberta.");

        var imeiOs = Imei(os.Imei);
        if (imeiOs.Length == 15 && aparelho.Imei.Length == 0)
            aparelho.Imei = imeiOs;
        if (imeiOs.Length == 15 && aparelho.Imei.Length == 15 && imeiOs != aparelho.Imei)
            throw new InvalidOperationException("O IMEI da ordem de serviço é outro. Confira o aparelho.");

        aparelho.OsEntradaId = os.BlingId;
        aparelho.OsEntradaNumero = string.IsNullOrWhiteSpace(os.OsNumero) ? os.BlingId.ToString() : os.OsNumero;
        aparelho.JustificativaAssistencia = Limitar(Texto(os.Defeito), 400);
        aparelho.TestesNaOs = true;
        aparelho.Testes = [];
        if (!OsSituacaoHelper.EhFinalizada(os.Situacao) || entrada.PassaPorAssistencia)
            aparelho.Status = AparelhoLojaStatus.EmAssistencia;

        var nota = $"Testes feitos na OS {aparelho.OsEntradaNumero}. O deságio já está no valor pago pela loja.";
        if (string.IsNullOrWhiteSpace(aparelho.Observacoes))
            aparelho.Observacoes = nota;
        else if (aparelho.Observacoes.IndexOf(nota, StringComparison.OrdinalIgnoreCase) < 0)
            aparelho.Observacoes = $"{aparelho.Observacoes} {nota}";
    }

    private async Task AbrirOsDaLojaAsync(AparelhoLojaData aparelho, CancellationToken cancellationToken)
    {
        var cliente = await ClienteDaLojaAsync();
        var modelo = await ResolverModeloDaOsAsync(aparelho);
        var pecas = (aparelho.PecasTrocadas ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Nome))
            .Select(p => p.ApareceMensagem ? $"{p.Nome} (aparece mensagem)" : p.Nome)
            .ToList();
        if (pecas.Count == 0 && !string.IsNullOrWhiteSpace(aparelho.PecaTrocada))
            pecas.Add(aparelho.MensagemPecaTrocada ? $"{aparelho.PecaTrocada} (aparece mensagem)" : aparelho.PecaTrocada);

        var defeito = "Aparelho da loja. Conferir antes de vender.";
        if (aparelho.SaudeBateria is >= 0 and <= 100)
            defeito += $" Bateria {aparelho.SaudeBateria}%.";
        if (aparelho.BateriaPerfeita == false)
            defeito += " Bateria fora das perfeitas condições.";
        if (pecas.Count > 0)
            defeito += " Peças trocadas: " + string.Join(", ", pecas) + ".";
        var alerta = Texto(aparelho.AlertaPermanente);
        if (alerta.Length > 0)
            defeito += $" Alerta permanente: {alerta}.";

        var condicoes = Texto(aparelho.Observacoes);
        if (alerta.Length > 0)
            condicoes = condicoes.Length > 0 ? $"Alerta permanente: {alerta}. {condicoes}" : $"Alerta permanente: {alerta}.";
        var os = new BlingOrdemServico
        {
            Contato = new BlingContatoRef
            {
                Id = cliente.BlingId,
                Nome = cliente.Nome,
                Telefone = cliente.Telefone,
                Celular = cliente.Celular,
            },
            Situacao = OsSituacaoHelper.Aberto,
            LojaOrigem = "MCC",
            TipoServico = "orcamento",
            MarcaId = modelo.MarcaId,
            MarcaNome = modelo.Marca,
            ModeloId = modelo.Id,
            ModeloNome = modelo.Nome,
            Imei = aparelho.Imei,
            Equipamento = $"{modelo.Marca} {modelo.Nome}".Trim(),
            EstadoTela = "A avaliar",
            CondicoesAparelho = condicoes.Length > 0 ? condicoes : "A conferir na assistência.",
            Defeito = defeito,
            SenhaDispositivoTipo = "sem_senha",
            FormaPagamento = "avista",
            ValorAVista = 0,
            ValorTotal = 0,
            ValorTotalAcordado = 0,
            Itens = [],
            DataEntrada = HorarioBrasil.Agora,
            Data = HorarioBrasil.Agora,
        };
        OsOrdemValidacao.Validar(os);

        using var escopo = _escopos.CreateScope();
        var servico = escopo.ServiceProvider.GetRequiredService<IBlingOrdemServicoService>();
        var criada = await servico.CriarAsync(os);
        aparelho.OsEntradaId = criada.Id;
        aparelho.OsEntradaNumero = string.IsNullOrWhiteSpace(criada.Numero)
            ? criada.Id?.ToString() ?? ""
            : criada.Numero;
        aparelho.JustificativaAssistencia = Limitar(Texto(defeito), 400);
    }

    private async Task<ClienteLocalData> ClienteDaLojaAsync()
    {
        foreach (var id in OsSituacaoHelper.ContatoIdsLojaMundoSmart)
        {
            var porId = await _clientes.ObterPorBlingIdAsync(id);
            if (porId is not null && OsSituacaoHelper.ClienteEhLojaMundoSmart(porId.Nome))
                return porId;
        }

        var lista = await _clientes.ListarAsync(OsSituacaoHelper.NomeClienteLojaMundoSmart);
        var cliente = lista.FirstOrDefault(c =>
            c.BlingId > 0 && OsSituacaoHelper.ClienteEhLojaMundoSmart(c.Nome, c.BlingId));
        if (cliente is null)
            throw new InvalidOperationException("Não encontrei o cliente Mundo Smart para abrir a ordem de serviço.");
        return cliente;
    }

    private async Task<(string Id, string Nome, string? MarcaId, string Marca)> ResolverModeloDaOsAsync(AparelhoLojaData aparelho)
    {
        if (!string.IsNullOrWhiteSpace(aparelho.ModeloId))
            return (aparelho.ModeloId, aparelho.Modelo, aparelho.MarcaId, aparelho.Marca);

        var lista = await _catalogo.ListarModelosAsync(aparelho.Modelo, null, aparelho.Marca, "Celular", 20);
        var achado = lista.FirstOrDefault(m =>
            !string.IsNullOrWhiteSpace(m.Id)
            && string.Equals(m.Nome, aparelho.Modelo, StringComparison.OrdinalIgnoreCase)
            && string.Equals(m.MarcaNome, aparelho.Marca, StringComparison.OrdinalIgnoreCase));
        if (achado?.Id is null)
            throw new InvalidOperationException("Não encontrei o modelo no catálogo para abrir a ordem de serviço.");
        return (achado.Id, achado.Nome, achado.MarcaId, achado.MarcaNome ?? aparelho.Marca);
    }

    private async Task CompletarJustificativaAssistenciaAsync(
        List<AparelhoLojaData> estoque,
        CancellationToken cancellationToken)
    {
        foreach (var aparelho in estoque.Where(a =>
            a.Status == AparelhoLojaStatus.EmAssistencia
            && Texto(a.JustificativaAssistencia).Length == 0
            && a.OsEntradaId is > 0))
        {
            var os = await _os.ObterPorBlingIdAsync(aparelho.OsEntradaId.Value);
            var defeito = Limitar(Texto(os?.Defeito), 400);
            if (defeito.Length == 0) continue;
            aparelho.JustificativaAssistencia = defeito;
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        }
    }

    private static bool EstaNaLoja(string status) =>
        status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia;

    private void ApagarPastaFotos(string? aparelhoId)
    {
        if (string.IsNullOrWhiteSpace(aparelhoId)) return;
        var pasta = Path.Combine(_env.ContentRootPath, "uploads", "aparelhos", aparelhoId);
        try
        {
            if (Directory.Exists(pasta))
                Directory.Delete(pasta, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    private void ApagarArquivoFoto(string aparelhoId, AparelhoFotoData foto)
    {
        var nome = Path.GetFileName(string.IsNullOrWhiteSpace(foto.NomeArquivo) ? foto.Url : foto.NomeArquivo);
        if (string.IsNullOrWhiteSpace(nome)) return;
        var pasta = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "uploads", "aparelhos", aparelhoId));
        var caminho = Path.GetFullPath(Path.Combine(pasta, nome));
        var prefixo = pasta.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!caminho.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)) return;
        try
        {
            if (File.Exists(caminho))
                File.Delete(caminho);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private static void PreencherFicha(
        AparelhoLojaData aparelho,
        AparelhoEntradaRequest entrada,
        VendedorRef? vendedor,
        string? observacaoOperacao)
    {
        var info = Texto(entrada.Observacoes);
        aparelho.Observacoes = info.Length > 0 ? info : Texto(observacaoOperacao);
        aparelho.AlertaPermanente = Limitar(Texto(entrada.AlertaPermanente), 400);
        aparelho.SaudeBateria = entrada.SaudeBateria is >= 0 and <= 100 ? entrada.SaudeBateria : null;
        aparelho.BateriaPerfeita = entrada.BateriaPerfeita;
        aparelho.PecasTrocadas = (entrada.PecasTrocadas ?? [])
            .Where(p => !string.IsNullOrWhiteSpace(p.Nome))
            .Select(p => new PecaTrocadaData { Nome = Texto(p.Nome), ApareceMensagem = p.ApareceMensagem })
            .ToList();
        aparelho.PecaTrocada = aparelho.PecasTrocadas.Count > 0
            ? string.Join(", ", aparelho.PecasTrocadas.Select(p => p.Nome))
            : Texto(entrada.PecaTrocada);
        aparelho.MensagemPecaTrocada = aparelho.PecasTrocadas.Any(p => p.ApareceMensagem)
            || (aparelho.PecaTrocada.Length > 0 && entrada.MensagemPecaTrocada);
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
        IReadOnlyList<AparelhoLojaData> estoque,
        MapaVendedores cadastro)
    {
        var nomes = operacoes.Select(o => cadastro.Nome(o.VendedorId, o.VendedorNome))
            .Concat(estoque.Select(a => cadastro.Nome(a.VendedorEntradaId, a.VendedorEntradaNome)))
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return nomes.Select(nome =>
        {
            var doVendedor = operacoes
                .Where(o => cadastro.Eh(o.VendedorId, o.VendedorNome, nome))
                .ToList();
            var aparelhos = estoque
                .Where(a => cadastro.Eh(a.VendedorEntradaId, a.VendedorEntradaNome, nome))
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
        string? categoria = null,
        string? descricaoFoco = null,
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
                Categoria = CategoriaFoto(categoria),
                DescricaoFoco = DescricaoFocoFoto(categoria, descricaoFoco),
                CriadoEm = HorarioBrasil.Agora,
            });
        }

        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<AparelhoLojaPainelDto> RemoverFotoAsync(
        string aparelhoId,
        string fotoId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(aparelhoId))
            throw new InvalidOperationException("Aparelho não informado.");
        if (string.IsNullOrWhiteSpace(fotoId))
            throw new InvalidOperationException("Foto não informada.");

        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId.Trim(), cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        if (!EstaNaLoja(aparelho.Status))
            throw new InvalidOperationException("Esse aparelho já saiu. A foto não pode mais ser excluída.");

        var foto = (aparelho.Fotos ?? []).FirstOrDefault(f =>
            string.Equals(f.Id, fotoId.Trim(), StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Foto não encontrada.");

        aparelho.Fotos!.Remove(foto);
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        ApagarArquivoFoto(aparelho.Id!, foto);
        return await MontarPainelAsync(cancellationToken);
    }

    public async Task<List<AparelhoFotoDto>> ListarFotosAsync(string aparelhoId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(aparelhoId))
            throw new InvalidOperationException("Aparelho não informado.");
        var aparelho = await _repo.ObterAparelhoAsync(aparelhoId.Trim(), cancellationToken)
            ?? throw new InvalidOperationException("Aparelho não encontrado.");
        return (aparelho.Fotos ?? []).Select(ParaFotoDto).ToList();
    }

    public async Task RegistrarCustoOsAsync(BlingOrdemServico os, CancellationToken cancellationToken = default)
    {
        if (os.Id is not > 0) return;

        var aparelho = await LocalizarAparelhoDaOsAsync(os.Id.Value, os.Imei, cancellationToken);
        if (aparelho is null || !NaLoja(aparelho.Status)) return;

        var cancelada = OsSituacaoHelper.EhCancelada(os.Situacao);
        decimal pecas = 0;
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
        var anterior = aparelho.CustosOs.FirstOrDefault(c => c.OsId == os.Id);
        var mao = anterior?.MaoDeObra ?? 0m;
        if (os.ValorAssistenciaInformado && os.ValorAssistencia is >= 0)
            mao = os.ValorAssistencia.Value;
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

        if (!OsSituacaoHelper.EhFinalizada(os.Situacao))
            ReterNaAssistencia(aparelho, os, os.Contato?.Nome, os.Contato?.Id);

        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
    }

    public async Task RegistrarAlertaAoConcluirAsync(
        long osId,
        string? imei,
        string? contatoNome,
        string? situacaoAnterior,
        bool informado,
        string? alerta,
        bool valorInformado = false,
        decimal? valorAssistencia = null,
        long? contatoId = null,
        CancellationToken cancellationToken = default)
    {
        if (osId <= 0) return;

        var aparelho = await LocalizarAparelhoDaOsAsync(osId, imei, cancellationToken);
        if (aparelho is null || !NaLoja(aparelho.Status)) return;

        var daLoja = aparelho.OsEntradaId == osId || CelularDaLoja(situacaoAnterior, contatoNome, contatoId);
        if (!daLoja) return;

        if (!informado)
            throw new InvalidOperationException(
                "Ao finalizar o celular da loja, informe se ficou algum problema permanente.");
        if (!valorInformado || valorAssistencia is null || valorAssistencia < 0)
            throw new InvalidOperationException(
                "Ao finalizar o celular da loja, informe o valor da assistência técnica.");

        aparelho.AlertaPermanente = Limitar(Texto(alerta), 400);
        AplicarValorAssistencia(aparelho, osId, aparelho.OsEntradaNumero, valorAssistencia.Value);
        if (aparelho.Status == AparelhoLojaStatus.EmAssistencia)
            aparelho.Status = AparelhoLojaStatus.EmEstoque;
        await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
    }

    private async Task<AparelhoLojaData?> LocalizarAparelhoDaOsAsync(
        long osId,
        string? imei,
        CancellationToken cancellationToken)
    {
        var porOs = await _repo.ObterPorOsEntradaAsync(osId, cancellationToken);
        if (porOs is not null && NaLoja(porOs.Status)) return porOs;

        var digitos = Imei(imei);
        if (digitos.Length != 15) return porOs;

        var lista = await _repo.ListarPorImeiAsync(digitos, cancellationToken);
        return lista.FirstOrDefault(a => a.OsEntradaId == osId && NaLoja(a.Status))
            ?? lista.FirstOrDefault(a => a.Status == AparelhoLojaStatus.EmAssistencia)
            ?? lista.FirstOrDefault(a => a.Status == AparelhoLojaStatus.EmEstoque)
            ?? porOs;
    }

    private static void ReterNaAssistencia(AparelhoLojaData aparelho, BlingOrdemServico os, string? contatoNome, long? contatoId = null)
    {
        var daLoja = os.Id is > 0 && aparelho.OsEntradaId == os.Id
            || OsSituacaoHelper.EhCelularDaLoja(os.Situacao)
            || OsSituacaoHelper.ClienteEhLojaMundoSmart(contatoNome, contatoId);
        if (!daLoja) return;

        if (aparelho.OsEntradaId is not > 0 && os.Id is > 0)
        {
            aparelho.OsEntradaId = os.Id;
            aparelho.OsEntradaNumero = Texto(os.Numero).Length > 0 ? Texto(os.Numero) : os.Id.Value.ToString();
        }
        var defeito = Limitar(Texto(os.Defeito), 400);
        if (defeito.Length > 0 && Texto(aparelho.JustificativaAssistencia).Length == 0)
            aparelho.JustificativaAssistencia = defeito;
        if (NaLoja(aparelho.Status))
            aparelho.Status = AparelhoLojaStatus.EmAssistencia;
    }

    private static void AplicarValorAssistencia(AparelhoLojaData aparelho, long osId, string numero, decimal valor)
    {
        aparelho.CustosOs ??= [];
        var existente = aparelho.CustosOs.FirstOrDefault(c => c.OsId == osId);
        if (existente is null)
        {
            existente = new AparelhoOsCustoData { OsId = osId, Numero = numero, Pecas = 0 };
            aparelho.CustosOs.Add(existente);
        }
        existente.MaoDeObra = Dinheiro(valor);
        existente.AtualizadoEm = HorarioBrasil.Agora;
        if (string.IsNullOrWhiteSpace(existente.Numero) && numero.Length > 0)
            existente.Numero = numero;
        aparelho.CustoMaoDeObra = aparelho.CustosOs.Sum(c => c.MaoDeObra);
    }

    private static bool NaLoja(string? status) =>
        status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia;

    private static bool CelularDaLoja(string? situacao, string? contatoNome, long? contatoId = null) =>
        OsSituacaoHelper.EhCelularDaLoja(situacao) || OsSituacaoHelper.ClienteEhLojaMundoSmart(contatoNome, contatoId);

    public async Task<AparelhoFotoSessaoTokenDto> CriarSessaoFotosAsync(string? appBaseUrl, string? aparelhoId, CancellationToken cancellationToken = default)
    {
        string? id = null;
        if (!string.IsNullOrWhiteSpace(aparelhoId))
        {
            var aparelho = await _repo.ObterAparelhoAsync(aparelhoId.Trim(), cancellationToken)
                ?? throw new InvalidOperationException("Aparelho não encontrado.");
            id = aparelho.Id;
        }

        var token = Guid.NewGuid().ToString("N");
        var expira = HorarioBrasil.Agora.AddHours(6);
        await _repo.InserirSessaoFotosAsync(new AparelhoFotoSessaoData
        {
            Token = token,
            ExpiraEm = expira,
            AparelhoId = id,
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
        AparelhoLojaData? aparelho = null;
        if (!string.IsNullOrWhiteSpace(sessao.AparelhoId))
            aparelho = await _repo.ObterAparelhoAsync(sessao.AparelhoId, cancellationToken);
        return new AparelhoFotoSessaoDto
        {
            ExpiraEm = sessao.ExpiraEm,
            Codigo = aparelho?.Codigo ?? "",
            Marca = aparelho?.Marca ?? "",
            Modelo = aparelho?.Modelo ?? "",
            Fotos = (sessao.Fotos ?? []).Select(ParaFotoDto).ToList(),
        };
    }

    public async Task<AparelhoFotoDto> ReceberFotoSessaoAsync(
        string token,
        string nome,
        Stream conteudo,
        string? categoria = null,
        string? descricaoFoco = null,
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
                Categoria = CategoriaFoto(categoria),
                DescricaoFoco = DescricaoFocoFoto(categoria, descricaoFoco),
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
            Categoria = CategoriaFoto(categoria),
            DescricaoFoco = DescricaoFocoFoto(categoria, descricaoFoco),
            CriadoEm = HorarioBrasil.Agora,
        };
        sessao.Fotos.Add(foto);
        await _repo.SalvarSessaoFotosAsync(sessao, cancellationToken);
        return ParaFotoDto(foto);
    }

    public async Task<AparelhoFotoSessaoDto?> RemoverFotoSessaoAsync(string token, string fotoId, CancellationToken cancellationToken = default)
    {
        var sessao = await SessaoValidaAsync(token, cancellationToken);
        if (sessao is null) return null;
        var foto = (sessao.Fotos ?? []).FirstOrDefault(f =>
            string.Equals(f.Id, fotoId?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (foto is null)
            throw new InvalidOperationException("Foto não encontrada.");

        sessao.Fotos!.Remove(foto);
        await _repo.SalvarSessaoFotosAsync(sessao, cancellationToken);

        if (!string.IsNullOrWhiteSpace(sessao.AparelhoId))
        {
            var aparelho = await _repo.ObterAparelhoAsync(sessao.AparelhoId, cancellationToken);
            var noAparelho = aparelho?.Fotos?.FirstOrDefault(f =>
                string.Equals(f.Id, foto.Id, StringComparison.OrdinalIgnoreCase));
            if (aparelho is not null && noAparelho is not null)
            {
                aparelho.Fotos!.Remove(noAparelho);
                await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
                ApagarArquivoFoto(aparelho.Id!, noAparelho);
            }
        }
        else
        {
            ApagarArquivoSessao(sessao.Token, foto);
        }

        return await ObterSessaoFotosAsync(token, cancellationToken);
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
                Categoria = foto.Categoria,
                DescricaoFoco = foto.DescricaoFoco,
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

    private string UrlApp(string? appBaseUrl) =>
        _intake.UrlDoQr(appBaseUrl, _env.IsDevelopment());

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

    private static readonly string[] CategoriasFotoAparelho =
        ["frente", "tras", "esquerda", "direita", "cima", "baixo", "outra"];

    private static string CategoriaFoto(string? categoria)
    {
        var cat = (categoria ?? "").Trim().ToLowerInvariant();
        return CategoriasFotoAparelho.Contains(cat) ? cat : "";
    }

    private static string DescricaoFocoFoto(string? categoria, string? descricao)
    {
        if (!string.Equals(CategoriaFoto(categoria), "outra", StringComparison.Ordinal)) return "";
        var texto = (descricao ?? "").Trim();
        return texto.Length <= 120 ? texto : texto[..120];
    }

    private void ApagarArquivoSessao(string token, AparelhoFotoData foto)
    {
        var nome = Path.GetFileName(string.IsNullOrWhiteSpace(foto.NomeArquivo) ? foto.Url : foto.NomeArquivo);
        if (string.IsNullOrWhiteSpace(nome) || string.IsNullOrWhiteSpace(token)) return;
        var pasta = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "uploads", "aparelho-sessoes", token));
        var caminho = Path.GetFullPath(Path.Combine(pasta, nome));
        var prefixo = pasta.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!caminho.StartsWith(prefixo, StringComparison.OrdinalIgnoreCase)) return;
        try
        {
            if (File.Exists(caminho))
                File.Delete(caminho);
        }
        catch (IOException)
        {
        }
    }

    private static AparelhoFotoDto ParaFotoDto(AparelhoFotoData foto) => new()
    {
        Id = foto.Id,
        Url = foto.Url,
        Tipo = string.Equals(foto.Tipo, "video", StringComparison.OrdinalIgnoreCase)
            || EhVideo(Path.GetExtension(foto.NomeArquivo))
            ? "video"
            : "foto",
        Categoria = foto.Categoria ?? "",
        DescricaoFoco = foto.DescricaoFoco ?? "",
        CriadoEm = foto.CriadoEm == default ? null : foto.CriadoEm,
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

    private sealed class MapaVendedores
    {
        private readonly IReadOnlyList<UsuarioData> _usuarios;

        public MapaVendedores(IReadOnlyList<UsuarioData> usuarios) =>
            _usuarios = usuarios ?? [];

        public string Nome(string? id, string? gravado)
        {
            var cadastrado = Encontrar(id, gravado);
            if (cadastrado is not null) return NomeCadastro(cadastrado);
            var texto = (gravado ?? "").Trim();
            return texto.Length == 0 ? "Loja" : texto;
        }

        public bool Eh(string? id, string? gravado, string nome) =>
            string.Equals(Nome(id, gravado), nome, StringComparison.OrdinalIgnoreCase);

        public List<AparelhoVendedorCadastroDto> Cadastrados() =>
            _usuarios
                .Where(u => u.Ativo && !AppRoles.EhRoot(u.Role) && !string.IsNullOrWhiteSpace(u.Id))
                .Select(u => new AparelhoVendedorCadastroDto { Id = u.Id!, Nome = NomeCadastro(u) })
                .OrderBy(u => u.Nome, StringComparer.Create(PtBr, true))
                .ToList();

        private UsuarioData? Encontrar(string? id, string? gravado)
        {
            if (!string.IsNullOrWhiteSpace(id))
            {
                var porId = _usuarios.FirstOrDefault(u => u.Id == id);
                if (porId is not null) return porId;
            }

            var texto = (gravado ?? "").Trim();
            if (texto.Length == 0) return null;
            return _usuarios.FirstOrDefault(u =>
                string.Equals(u.Nome, texto, StringComparison.OrdinalIgnoreCase)
                || string.Equals(u.Usuario, texto, StringComparison.OrdinalIgnoreCase));
        }

        private static string NomeCadastro(UsuarioData usuario)
        {
            var nome = (usuario.Nome ?? "").Trim();
            return nome.Length == 0 ? (usuario.Usuario ?? "").Trim() : nome;
        }
    }

    private static class MidiaLimite
    {
        public const int Fotos = 12;
        public const int Videos = 3;
        public const long FotoBytes = 8L * 1024 * 1024;
        public const long VideoBytes = 40L * 1024 * 1024;
    }
}
