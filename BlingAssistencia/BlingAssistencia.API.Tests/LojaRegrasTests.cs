using System.Net;
using Xunit;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Tests;

[CollectionDefinition("loja-regras", DisableParallelization = true)]
public class LojaRegrasCollection : ICollectionFixture<LojaApiFactory>;

public class LojaApiFactory : WebApplicationFactory<Program>
{
    private readonly Lazy<HttpClient> _admin;

    public LojaApiFactory()
    {
        _admin = new Lazy<HttpClient>(CriarAdmin);
    }

    public HttpClient Admin => _admin.Value;

    private HttpClient CriarAdmin()
    {
        var client = CreateClient();
        var senha = Services.GetRequiredService<IOptions<AuthSettings>>().Value.Seed.AdminSenha;
        var login = client.PostAsJsonAsync("/api/conta/login", new { usuario = "admin", senha }).GetAwaiter().GetResult();
        login.EnsureSuccessStatusCode();
        var body = login.Content.ReadFromJsonAsync<JsonObject>().GetAwaiter().GetResult();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!["accessToken"]!.GetValue<string>());
        return client;
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        var content = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "BlingAssistencia.API"));
        builder.UseContentRoot(content);
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MongoDB:DatabaseName"] = "MundoSmartTestesLoja",
                ["Auth:Security:LoginRateLimitPorMinuto"] = "1000",
            });
        });
        builder.ConfigureServices(services =>
        {
            var hosted = services.Where(d => d.ServiceType == typeof(IHostedService)).ToList();
            foreach (var d in hosted)
                services.Remove(d);
        });
    }
}

[Collection("loja-regras")]
public class LojaRegrasTests
{
    private readonly LojaApiFactory _factory;
    private readonly HttpClient _admin;
    private static int _seq;

    public LojaRegrasTests(LojaApiFactory factory)
    {
        _factory = factory;
        _admin = factory.Admin;
    }

    [Fact]
    public async Task Painel_informa_os_limites_de_desconto_e_acrescimo()
    {
        var painel = await Get("/api/aparelhos-loja");
        Assert.Equal(5m, Num(painel["descontoVendaMaxPercentual"]));
        Assert.Equal(10m, Num(painel["acrescimoFinanciadoraMaxPercentual"]));
    }

    [Fact]
    public async Task Codigo_separa_novo_e_usado_e_nao_muda_no_cadastro()
    {
        var usado = NovoImei();
        var painel = await Comprar(usado, 800);
        var item = ExigirEstoque(painel, usado);
        var codigo = item["codigo"]!.GetValue<string>();
        Assert.Matches("^U[1-9][0-9]*$", codigo);

        var novo = Aparelho(NovoImei());
        novo["condicao"] = "novo";
        var painelNovo = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 900,
            fornecedorNome = "Fornecedor teste",
            aparelho = novo,
        });
        var itemNovo = ExigirEstoque(painelNovo, (string)novo["imei"]!);
        Assert.Matches("^N[1-9][0-9]*$", itemNovo["codigo"]!.GetValue<string>());

        var outro = NovoImei();
        var segundo = ExigirEstoque(await Comprar(outro, 700), outro);
        var n1 = int.Parse(codigo[1..]);
        var n2 = int.Parse(segundo["codigo"]!.GetValue<string>()[1..]);
        Assert.True(n2 > n1);

        var editado = await Put($"/api/aparelhos-loja/{segundo["id"]!.GetValue<string>()}/cadastro", new
        {
            imei = outro,
            marca = "Apple",
            modelo = "iPhone 13",
            cor = "Preto",
            configuracao = "128GB",
            condicao = "novo",
            valorVenda = 10000m,
            valorMinimoVenda = 1m,
            bateriaPerfeita = true,
        });
        var depois = ExigirEstoque(editado, outro);
        Assert.Equal(segundo["codigo"]!.GetValue<string>(), depois["codigo"]!.GetValue<string>());
        Assert.StartsWith("U", depois["codigo"]!.GetValue<string>());
        Assert.Equal("novo", depois["condicao"]!.GetValue<string>());
        Assert.Equal(Num(segundo["custo"]), Num(depois["custo"]));
    }

    [Fact]
    public async Task Cadastro_altera_o_valor_pago_da_compra()
    {
        var imei = NovoImei();
        var painel = await Comprar(imei, 1000);
        var item = ExigirEstoque(painel, imei);
        var editado = await Put($"/api/aparelhos-loja/{item["id"]!.GetValue<string>()}/cadastro", new
        {
            imei,
            marca = "Apple",
            modelo = "iPhone 13",
            cor = "Preto",
            configuracao = "128GB",
            condicao = "usado",
            valorVenda = 2000m,
            valorMinimoVenda = 1500m,
            valorPago = 800m,
            valorParaCompra = 2100m,
            bateriaPerfeita = true,
        });
        var depois = ExigirEstoque(editado, imei);
        Assert.Equal(800m, Num(depois["custo"]));
        Assert.Equal(800m, Num(depois["valorPago"]));
        Assert.Equal(2100m, Num(depois["valorParaCompra"]));
        var op = ExigirOperacao(editado, imei, "compra");
        Assert.Equal(800m, Num(op["dinheiroPago"]));
        Assert.Equal(800m, Num(op["valorAvaliado"]));
    }

    [Fact]
    public async Task Cadastro_altera_o_valor_pago_da_troca_sem_mexer_no_caixa()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Trocar(id, cliente, 2000, entrada, 1100);
        var item = ExigirEstoque(painel, entrada);
        var editado = await Put($"/api/aparelhos-loja/{item["id"]!.GetValue<string>()}/cadastro", new
        {
            imei = entrada,
            marca = "Apple",
            modelo = "iPhone 13",
            cor = "Preto",
            configuracao = "128GB",
            condicao = "usado",
            valorVenda = 2000m,
            valorMinimoVenda = 1500m,
            valorPago = 900m,
            bateriaPerfeita = true,
        });
        var depois = ExigirEstoque(editado, entrada);
        Assert.Equal(900m, Num(depois["custo"]));
        Assert.Equal(900m, Num(depois["valorPago"]));
        var op = ExigirOperacao(editado, entrada, "troca");
        Assert.Equal(900m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));
        Assert.Equal(900m, Num(op["valorAvaliado"]));
        var movimento = op["entrou"]!.AsArray()
            .Select(n => n!.AsObject())
            .First(n => n["imei"]!.GetValue<string>() == entrada);
        Assert.Equal(900m, Num(movimento["valor"]));
    }

    [Fact]
    public async Task Compra_entra_no_estoque_sem_desconto_e_o_caixa_sai_o_valor_pago()
    {
        var imei = NovoImei();
        var painel = await Comprar(imei, 2500);
        var aparelho = ExigirEstoque(painel, imei);
        Assert.Equal("em_estoque", aparelho["status"]!.GetValue<string>());
        Assert.False(aparelho["descontoVigente"]!.GetValue<bool>());
        Assert.Equal(2500m, Num(aparelho["custo"]));
        var op = ExigirOperacao(painel, imei, "compra");
        Assert.Equal(2500m, Num(op["dinheiroPago"]));
        Assert.Equal(0m, Num(op["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Compra_usa_o_nome_do_vendedor_cadastrado()
    {
        var imei = NovoImei();
        var painel = await Comprar(imei, 900);
        var op = ExigirOperacao(painel, imei, "compra");
        Assert.Equal("Administrador", op["vendedorNome"]!.GetValue<string>());
        Assert.False(string.IsNullOrWhiteSpace(op["vendedorId"]?.GetValue<string>()));
        var item = ExigirEstoque(painel, imei);
        Assert.Equal("Administrador", item["vendedorEntradaNome"]!.GetValue<string>());
        var cadastrados = painel["vendedoresCadastrados"]!.AsArray()
            .Select(v => v!["nome"]!.GetValue<string>())
            .ToList();
        Assert.Contains("Administrador", cadastrados);
        Assert.DoesNotContain("Root", cadastrados);
    }

    [Fact]
    public async Task Cadastro_guarda_valor_de_venda_e_nao_vende_abaixo_do_minimo()
    {
        var imei = NovoImei();
        var aparelho = Aparelho(imei);
        aparelho["valorVenda"] = 2000m;
        aparelho["valorMinimoVenda"] = 1950m;
        var painel = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1000,
            fornecedorNome = "Fornecedor teste",
            aparelho,
        });
        var item = ExigirEstoque(painel, imei);
        Assert.Equal(2000m, Num(item["valorVenda"]));
        Assert.Equal(1950m, Num(item["valorMinimoVenda"]));
        Assert.Equal(1000m, Num(item["custo"]));

        var cliente = await ClienteComDocumento();
        var id = item["id"]!.GetValue<string>();
        var abaixo = await PostBruto("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 100,
            acrescimo = 0,
            preco = 1900,
            forma = "avista",
        });
        Assert.Equal(HttpStatusCode.BadRequest, abaixo.StatusCode);
        Assert.Contains("mínimo", await abaixo.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var vendido = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 50,
            acrescimo = 0,
            preco = 1950,
            forma = "avista",
        });
        Assert.Equal(1950m, Num(ExigirOperacao(vendido, imei, "venda")["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Cadastro_recusa_minimo_maior_que_o_valor_de_venda()
    {
        var aparelho = Aparelho(NovoImei());
        aparelho["valorVenda"] = 2000m;
        aparelho["valorMinimoVenda"] = 2500m;
        var res = await PostBruto("/api/aparelhos-loja/compra", new
        {
            valorPago = 1000,
            fornecedorNome = "Fornecedor teste",
            aparelho,
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("mínimo", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Iphone_exige_condicao_da_bateria_e_guarda_peca_trocada()
    {
        var imei = NovoImei();
        var semResposta = Aparelho(imei);
        semResposta.Remove("bateriaPerfeita");
        var bloqueio = await PostBruto("/api/aparelhos-loja/compra", new
        {
            valorPago = 1000,
            fornecedorNome = "Fornecedor teste",
            aparelho = semResposta,
        });
        Assert.Equal(HttpStatusCode.BadRequest, bloqueio.StatusCode);
        Assert.Contains("bateria", await bloqueio.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var aparelho = Aparelho(imei);
        aparelho["bateriaPerfeita"] = false;
        aparelho["pecaTrocada"] = "Bateria";
        aparelho["mensagemPecaTrocada"] = true;
        var painel = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1000,
            fornecedorNome = "Fornecedor teste",
            aparelho,
        });
        var item = ExigirEstoque(painel, imei);
        Assert.False(item["bateriaPerfeita"]!.GetValue<bool>());
        Assert.Equal("Bateria", item["pecaTrocada"]!.GetValue<string>());
        Assert.True(item["mensagemPecaTrocada"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Aparelho_que_nao_e_iphone_nao_exige_condicao_da_bateria()
    {
        var imei = NovoImei();
        var aparelho = Aparelho(imei, "Samsung", "Galaxy A14");
        aparelho.Remove("bateriaPerfeita");
        var painel = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 800,
            fornecedorNome = "Fornecedor teste",
            aparelho,
        });
        var item = ExigirEstoque(painel, imei);
        Assert.True(item["bateriaPerfeita"] is null);
        Assert.Equal("", item["pecaTrocada"]!.GetValue<string>());
    }

    [Fact]
    public async Task Compra_nao_grava_desagio_separado_do_valor_pago()
    {
        var imei = NovoImei();
        var painel = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1800,
            fornecedorNome = "Fornecedor teste",
            aparelho = Aparelho(imei, desagio: 350),
        });
        var aparelho = ExigirEstoque(painel, imei);
        Assert.Equal(0m, Num(aparelho["desagio"]));
        Assert.Equal(1800m, Num(ExigirOperacao(painel, imei, "compra")["dinheiroPago"]));
    }

    [Fact]
    public async Task Aparelho_na_assistencia_nao_vende_ate_ser_liberado()
    {
        await GarantirClienteLoja();
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        var ficha = Aparelho(imei, modelo.Marca, modelo.Nome, passaPorAssistencia: true);
        ficha["modeloId"] = modelo.Id;
        var comprado = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1500,
            fornecedorNome = "Fornecedor teste",
            aparelho = ficha,
        });
        var retido = ExigirEstoque(comprado, imei);
        Assert.Equal("em_assistencia", retido["status"]!.GetValue<string>());
        var numeroOs = retido["osEntradaNumero"]?.GetValue<string>();
        Assert.False(string.IsNullOrWhiteSpace(numeroOs));
        var os = await Get($"/api/ordens-servico/{numeroOs}");
        Assert.Equal("Aberto", os["situacao"]?.GetValue<string>());
        Assert.Equal("Mundo Smart", os["contato"]?["nome"]?.GetValue<string>());
        Assert.Equal(imei, os["imei"]?.GetValue<string>());

        var bloqueio = await PostBruto("/api/aparelhos-loja/venda", Venda(retido["id"]!.GetValue<string>(), cliente, 1500));
        Assert.Equal(HttpStatusCode.BadRequest, bloqueio.StatusCode);
        Assert.Contains("assistência", await bloqueio.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var liberarAberto = await PostBruto($"/api/aparelhos-loja/{retido["id"]!.GetValue<string>()}/liberar", new { });
        Assert.Equal(HttpStatusCode.BadRequest, liberarAberto.StatusCode);
        Assert.Contains("OS", await liberarAberto.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var osLojaId = retido["osEntradaId"]!.GetValue<long>();
        var semValor = await PatchBruto($"/api/ordens-servico/{osLojaId}/situacao", new
        {
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
            alertaPermanenteInformado = true,
            alertaPermanente = "",
        });
        Assert.Equal(HttpStatusCode.BadRequest, semValor.StatusCode);
        Assert.Contains("valor", await semValor.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var fechar = await PatchBruto($"/api/ordens-servico/{osLojaId}/situacao", new
        {
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
            alertaPermanenteInformado = true,
            alertaPermanente = "",
            valorAssistenciaInformado = true,
            valorAssistencia = 80,
        });
        Assert.Equal(HttpStatusCode.NoContent, fechar.StatusCode);

        var liberado = ExigirEstoque(await Get("/api/aparelhos-loja"), imei);
        Assert.Equal("em_estoque", liberado["status"]!.GetValue<string>());
        Assert.Equal(80m, Num(liberado["custoMaoDeObra"]));
        Assert.Equal(1500m, Num(liberado["custo"]));
        Assert.Equal(1500m, Num(liberado["custoTotal"]));
        var vendido = await Post("/api/aparelhos-loja/venda", Venda(retido["id"]!.GetValue<string>(), cliente, 1500));
        Assert.Equal(1500m, Num(ExigirOperacao(vendido, imei, "venda")["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Venda_a_vista_entra_o_preco_e_concede_desconto_no_cpf_e_no_imei()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var painel = await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 2000));
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal(2000m, Num(op["precoSaida"]));
        Assert.Equal(2000m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));

        var desconto = await Get($"/api/vendas-celulares/desconto?cpf={cliente.Cpf}&imei={imei}");
        Assert.True(desconto["elegivel"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Venda_sem_cpf_ou_cnpj_e_recusada()
    {
        var imei = NovoImei();
        var id = await IdComprado(imei, 900);
        var semDoc = await Post("/api/clientes", new { nome = "Sem documento " + imei, telefone = NovoTelefone() });
        var res = await PostBruto("/api/aparelhos-loja/venda", Venda(id, (semDoc["id"]!.GetValue<long>(), ""), 900));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("CPF", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        Assert.NotNull(ExigirEstoque(await Get("/api/aparelhos-loja"), imei));
    }

    [Fact]
    public async Task Venda_abaixo_do_custo_e_permitida()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2500);
        var painel = await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1000));
        Assert.Equal(1000m, Num(ExigirOperacao(painel, imei, "venda")["dinheiroRecebido"]));
        Assert.Equal(1000m, Num(ExigirOperacao(painel, imei, "venda")["precoSaida"]));
    }

    [Fact]
    public async Task Desconto_acima_de_cinco_por_cento_entra_no_caixa()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 101,
            acrescimo = 0,
            preco = 1899,
            forma = "avista",
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal(1899m, Num(op["precoSaida"]));
        Assert.Equal(1899m, Num(op["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Desconto_dentro_do_limite_baixa_o_valor_que_entra_no_caixa()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 100,
            acrescimo = 0,
            preco = 1900,
            forma = "avista",
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal(1900m, Num(op["precoSaida"]));
        Assert.Equal(1900m, Num(op["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Acrescimo_nao_vale_na_venda_a_vista()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var res = await PostBruto("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 100,
            preco = 2100,
            forma = "avista",
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("financiadora", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Financiadora_sobe_o_contrato_e_o_caixa_fica_entrada_mais_repasse()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 200,
            preco = 2200,
            forma = "payjoy",
            entradaLoja = 300,
            repasse = 1500,
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal(2200m, Num(op["precoSaida"]));
        Assert.Equal(1800m, Num(op["dinheiroRecebido"]));
        Assert.Equal("Payjoy", op["financiadoraNome"]!.GetValue<string>());
    }

    [Fact]
    public async Task Acrescimo_acima_de_dez_por_cento_e_recusado()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var res = await PostBruto("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 201,
            preco = 2201,
            forma = "crefaz",
            entradaLoja = 0,
            repasse = 0,
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("limite", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Paymobi_entra_no_caixa_somente_a_entrada()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2000);
        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            preco = 2000,
            forma = "paymobi",
            entradaLoja = 400,
            repasse = 900,
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal(2000m, Num(op["precoSaida"]));
        Assert.Equal(400m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["repasseFinanciadora"]));
    }

    [Fact]
    public async Task Cartao_entra_o_preco_e_recusa_acrescimo()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 1500);
        var bloqueio = await PostBruto("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 100,
            preco = 2100,
            forma = "cartao",
        });
        Assert.Equal(HttpStatusCode.BadRequest, bloqueio.StatusCode);

        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            preco = 2000,
            forma = "cartao",
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal("cartao", op["formaNegociacao"]!.GetValue<string>());
        Assert.Equal(2000m, Num(op["dinheiroRecebido"]));
        Assert.Equal(2000m, Num(op["precoSaida"]));
    }

    [Fact]
    public async Task Avista_mais_cartao_soma_o_preco()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 1500);
        var ruim = await PostBruto("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            preco = 2000,
            forma = "avista_cartao",
            entradaLoja = 800,
            repasse = 1000,
        });
        Assert.Equal(HttpStatusCode.BadRequest, ruim.StatusCode);

        var painel = await Post("/api/aparelhos-loja/venda", new
        {
            aparelhoId = id,
            clienteId = cliente.Id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            preco = 2000,
            forma = "avista_cartao",
            entradaLoja = 800,
            repasse = 1200,
        });
        var op = ExigirOperacao(painel, imei, "venda");
        Assert.Equal("avista_cartao", op["formaNegociacao"]!.GetValue<string>());
        Assert.Equal(2000m, Num(op["dinheiroRecebido"]));
        Assert.Equal(800m, Num(op["entradaLoja"]));
        Assert.Equal(1200m, Num(op["repasseFinanciadora"]));
    }

    [Fact]
    public async Task Troca_de_mesmo_valor_nao_movimenta_caixa()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Trocar(id, cliente, 2000, entrada, 2000);
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(0m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));
        Assert.False(ExigirEstoque(painel, entrada)["descontoVigente"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Troca_cliente_paga_somente_a_diferenca()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Trocar(id, cliente, 2000, entrada, 1100);
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(900m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));
        Assert.Equal(1100m, Num(ExigirEstoque(painel, entrada)["custo"]));
    }

    [Fact]
    public async Task Troca_em_que_a_loja_paga_nao_vira_faturamento()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 1300);
        var painel = await Trocar(id, cliente, 1300, entrada, 2200);
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(0m, Num(op["dinheiroRecebido"]));
        Assert.Equal(900m, Num(op["dinheiroPago"]));
        Assert.False(ExigirEstoque(painel, entrada)["descontoVigente"]!.GetValue<bool>());
        var desconto = await Get($"/api/vendas-celulares/desconto?cpf={cliente.Cpf}&imei={saida}");
        Assert.True(desconto["elegivel"]!.GetValue<bool>());
        var doQueEntrou = await Get($"/api/vendas-celulares/desconto?cpf={cliente.Cpf}&imei={entrada}");
        Assert.False(doQueEntrou["elegivel"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Troca_com_dois_aparelhos_soma_os_valores_e_so_a_diferenca_entra_no_caixa()
    {
        var saida = NovoImei();
        var primeiro = NovoImei();
        var segundo = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 3000);
        var painel = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id,
            precoTabela = 3000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 3000,
            forma = "avista",
            clienteId = cliente.Id,
            entradas = new object[]
            {
                new { valorAvaliado = 1000m, aparelho = Aparelho(primeiro, "Samsung", "Galaxy A14") },
                new { valorAvaliado = 800m, aparelho = Aparelho(segundo) },
            },
        });
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(1200m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));
        Assert.Equal(1800m, Num(op["valorAvaliado"]));
        var resumo = op["entradaResumo"]!.GetValue<string>();
        Assert.Contains(primeiro, resumo);
        Assert.Contains(segundo, resumo);
        Assert.Equal(1000m, Num(ExigirEstoque(painel, primeiro)["custo"]));
        Assert.Equal(800m, Num(ExigirEstoque(painel, segundo)["custo"]));
        Assert.False(ExigirEstoque(painel, primeiro)["descontoVigente"]!.GetValue<bool>());
        Assert.False(ExigirEstoque(painel, segundo)["descontoVigente"]!.GetValue<bool>());
        var desconto = await Get($"/api/vendas-celulares/desconto?cpf={cliente.Cpf}&imei={saida}");
        Assert.True(desconto["elegivel"]!.GetValue<bool>());

        var estornado = await Post($"/api/aparelhos-loja/operacoes/{op["id"]!.GetValue<string>()}/estornar", new { });
        Assert.DoesNotContain(estornado["estoque"]!.AsArray(), n => n!["imei"]!.GetValue<string>() == primeiro);
        Assert.DoesNotContain(estornado["estoque"]!.AsArray(), n => n!["imei"]!.GetValue<string>() == segundo);
        Assert.Equal("em_estoque", ExigirEstoque(estornado, saida)["status"]!.GetValue<string>());
    }

    [Fact]
    public async Task Troca_com_dois_aparelhos_mais_valiosos_a_loja_paga_a_diferenca()
    {
        var saida = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 2000,
            forma = "avista",
            clienteId = cliente.Id,
            entradas = new object[]
            {
                new { valorAvaliado = 1500m, aparelho = Aparelho(NovoImei()) },
                new { valorAvaliado = 900m, aparelho = Aparelho(NovoImei(), "Samsung", "Galaxy A14") },
            },
        });
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(0m, Num(op["dinheiroRecebido"]));
        Assert.Equal(400m, Num(op["dinheiroPago"]));
    }

    [Fact]
    public async Task Troca_recusa_o_mesmo_imei_duas_vezes()
    {
        var saida = NovoImei();
        var repetido = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var res = await PostBruto("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 2000,
            forma = "avista",
            clienteId = cliente.Id,
            entradas = new object[]
            {
                new { valorAvaliado = 500m, aparelho = Aparelho(repetido) },
                new { valorAvaliado = 500m, aparelho = Aparelho(repetido) },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("IMEI", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Troca_financiada_o_acrescimo_nao_altera_o_dinheiro_que_sai()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 200,
            precoSaida = 2200,
            valorAvaliado = 2500,
            forma = "payjoy",
            entradaLoja = 0,
            repasse = 0,
            clienteId = cliente.Id,
            entrada = Aparelho(entrada),
        });
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(2200m, Num(op["precoSaida"]));
        Assert.Equal(500m, Num(op["dinheiroPago"]));
        Assert.Equal(0m, Num(op["dinheiroRecebido"]));
    }

    [Fact]
    public async Task Troca_calcula_a_diferenca_pelos_aparelhos_e_ignora_o_valor_digitado()
    {
        var saida = NovoImei();
        var entrada = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(saida, 2000);
        var painel = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id,
            precoTabela = 2000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 2000,
            valorAvaliado = 1100,
            sentidoDiferenca = "loja",
            diferencaInformada = 400,
            forma = "financiadora",
            financiadoraNome = "Crediário da praça",
            clienteId = cliente.Id,
            entrada = Aparelho(entrada),
        });
        var op = ExigirOperacao(painel, saida, "troca");
        Assert.Equal(900m, Num(op["dinheiroRecebido"]));
        Assert.Equal(0m, Num(op["dinheiroPago"]));
        Assert.Equal("financiadora", op["formaNegociacao"]!.GetValue<string>());
        Assert.Equal("Crediário da praça", op["financiadoraNome"]!.GetValue<string>());
        Assert.Equal(1100m, Num(ExigirEstoque(painel, entrada)["custo"]));

        var devolve = NovoImei();
        var idDevolve = await IdComprado(devolve, 1300);
        var painelCliente = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = idDevolve,
            precoTabela = 1300,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 1300,
            valorAvaliado = 1600,
            sentidoDiferenca = "loja",
            diferencaInformada = 150,
            forma = "pix",
            clienteId = cliente.Id,
            entrada = Aparelho(NovoImei()),
        });
        var volta = ExigirOperacao(painelCliente, devolve, "troca");
        Assert.Equal(0m, Num(volta["dinheiroRecebido"]));
        Assert.Equal(300m, Num(volta["dinheiroPago"]));
        Assert.Equal("pix", volta["formaNegociacao"]!.GetValue<string>());

        var semNome = await PostBruto("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = await IdComprado(NovoImei(), 1000),
            precoTabela = 1000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 1000,
            valorAvaliado = 400,
            sentidoDiferenca = "loja",
            diferencaInformada = 200,
            forma = "financiadora",
            clienteId = cliente.Id,
            entrada = Aparelho(NovoImei()),
        });
        Assert.Equal(HttpStatusCode.BadRequest, semNome.StatusCode);

        var cartaoParaCliente = await PostBruto("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = await IdComprado(NovoImei(), 1000),
            precoTabela = 1000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 1000,
            valorAvaliado = 1400,
            sentidoDiferenca = "cliente",
            diferencaInformada = 200,
            forma = "cartao",
            clienteId = cliente.Id,
            entrada = Aparelho(NovoImei()),
        });
        Assert.Equal(HttpStatusCode.BadRequest, cartaoParaCliente.StatusCode);
    }

    [Fact]
    public async Task Mesmo_modelo_sem_confirmar_imei_so_aponta_que_pode_ser_elegivel()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 2100, "Apple", "iPhone 16");
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 2100, "Apple", "iPhone 16"));

        var mesmo = await Get($"/api/vendas-celulares/passivel-desconto?clienteId={cliente.Id}&cpf={cliente.Cpf}&marcaNome=Apple&modeloNome=iPhone%2016");
        Assert.True(mesmo["passivel"]!.GetValue<bool>());
        Assert.Contains("elegível", mesmo["motivo"]!.GetValue<string>(), StringComparison.OrdinalIgnoreCase);
        var aparelhos = mesmo["aparelhos"]!.AsArray();
        Assert.Contains(aparelhos, a => a!["imei"]!.GetValue<string>() == imei);

        var outro = await Get($"/api/vendas-celulares/passivel-desconto?clienteId={cliente.Id}&cpf={cliente.Cpf}&marcaNome=Apple&modeloNome=iPhone%2013");
        Assert.False(outro["passivel"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Desconto_da_assistencia_exige_o_imei_do_aparelho_vendido()
    {
        var imei = NovoImei();
        var cliente = await ClienteComDocumento();
        var id = await IdComprado(imei, 1600);
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1600));
        var outroImei = NovoImei();
        var consulta = await Get($"/api/vendas-celulares/desconto?cpf={cliente.Cpf}&imei={outroImei}");
        Assert.False(consulta["elegivel"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Operador_nao_ve_custo_nem_dinheiro()
    {
        var imei = NovoImei();
        await Comprar(imei, 1750);
        var operador = _factory.CreateClient();
        var criado = await _admin.PostAsJsonAsync("/api/usuarios", new
        {
            usuario = "operador.loja.teste",
            nome = "Operador teste",
            senha = "Operador@4552",
            role = "Operador",
        });
        if (!criado.IsSuccessStatusCode && criado.StatusCode != HttpStatusCode.BadRequest)
            Assert.Fail(await criado.Content.ReadAsStringAsync());

        var login = await operador.PostAsJsonAsync("/api/conta/login", new { usuario = "operador.loja.teste", senha = "Operador@4552" });
        Assert.True(login.IsSuccessStatusCode, await login.Content.ReadAsStringAsync());
        var token = (await login.Content.ReadFromJsonAsync<JsonObject>())!["accessToken"]!.GetValue<string>();
        operador.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var painel = (await operador.GetFromJsonAsync<JsonObject>("/api/aparelhos-loja"))!;
        var aparelho = ExigirEstoque(painel, imei);
        Assert.Equal(0m, Num(aparelho["custo"]));
        Assert.Equal(0m, Num(painel["resumo"]!["dinheiroPago"]));
        Assert.Equal(0m, Num(painel["resumo"]!["custoEstoque"]));
        Assert.Equal(0m, Num(ExigirOperacao(painel, imei, "compra")["dinheiroPago"]));

        var admin = await Get("/api/aparelhos-loja");
        Assert.Equal(1750m, Num(ExigirEstoque(admin, imei)["custo"]));
    }

    [Fact]
    public async Task Os_concluida_nao_pode_ser_vinculada_na_entrada()
    {
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        var imeiOs = NovoImei();
        var os = await CriarOs(cliente, modelo, imeiOs, "Concluído", "Rômulo");
        var imei = NovoImei();
        var res = await PostBruto("/api/aparelhos-loja/compra", new
        {
            valorPago = 900,
            fornecedorNome = "Fornecedor teste",
            aparelho = Aparelho(imei, osNumero: os.Numero),
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.Contains("aberta", texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Imei_diferente_do_da_os_bloqueia_a_entrada()
    {
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        var os = await CriarOs(cliente, modelo, NovoImei(), "Aberto", null);
        var res = await PostBruto("/api/aparelhos-loja/compra", new
        {
            valorPago = 900,
            fornecedorNome = "Fornecedor teste",
            aparelho = Aparelho(NovoImei(), osNumero: os.Numero),
        });
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        Assert.Contains("IMEI", await res.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cadastro_associa_os_ja_aberta_ao_aparelho_da_loja()
    {
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        var imei = NovoImei();
        var comprado = await Comprar(imei, 1400);
        var item = ExigirEstoque(comprado, imei);
        Assert.True(item["osEntradaId"] is null || item["osEntradaId"]!.GetValue<long>() == 0);

        var os = await CriarOs(cliente, modelo, imei, "Aberto", null);
        var editado = await Put($"/api/aparelhos-loja/{item["id"]!.GetValue<string>()}/cadastro", new
        {
            imei,
            marca = "Apple",
            modelo = "iPhone 13",
            cor = "Preto",
            configuracao = "128GB",
            condicao = "usado",
            valorVenda = 10000m,
            valorMinimoVenda = 1m,
            bateriaPerfeita = true,
            osNumero = os.Numero,
        });
        var depois = ExigirEstoque(editado, imei);
        Assert.Equal(os.Numero, depois["osEntradaNumero"]!.GetValue<string>());
        Assert.True(depois["testesNaOs"]!.GetValue<bool>());
        Assert.Equal("em_assistencia", depois["status"]!.GetValue<string>());
    }

    [Fact]
    public async Task Os_aberta_reaproveita_os_testes_e_o_desagio_fica_no_valor_pago()
    {
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        var imei = NovoImei();
        var os = await CriarOs(cliente, modelo, imei, "Aberto", null);
        var painel = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1400,
            clienteId = cliente.Id,
            aparelho = Aparelho(imei, osNumero: os.Numero, desagio: 200),
        });
        var aparelho = ExigirEstoque(painel, imei);
        Assert.True(aparelho["testesNaOs"]!.GetValue<bool>());
        Assert.Equal(os.Numero, aparelho["osEntradaNumero"]!.GetValue<string>());
        Assert.Equal(0m, Num(aparelho["desagio"]));
        Assert.Contains("deságio já está no valor pago", aparelho["observacoes"]!.GetValue<string>(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Custo_da_os_usa_somente_o_custo_da_peca()
    {
        var imei = NovoImei();
        await Comprar(imei, 1000);
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        await Post("/api/ordens-servico", Os(cliente, modelo, imei, "Aberto", null, itens: true));
        var aparelho = ExigirEstoque(await Get("/api/aparelhos-loja"), imei);
        Assert.Equal(80m, Num(aparelho["custoPecas"]));
        Assert.Equal(0m, Num(aparelho["custoMaoDeObra"]));
        Assert.Equal(1000m, Num(aparelho["custo"]));
        Assert.Equal(1080m, Num(aparelho["custoTotal"]));
    }

    [Fact]
    public async Task Custo_total_soma_compra_e_peca_e_conclusao_grava_alerta()
    {
        await GarantirClienteLoja();
        var imei = NovoImei();
        var modelo = await PrimeiroModelo();
        var ficha = Aparelho(imei, modelo.Marca, modelo.Nome, passaPorAssistencia: true);
        ficha["modeloId"] = modelo.Id;
        var comprado = await Post("/api/aparelhos-loja/compra", new
        {
            valorPago = 1400,
            fornecedorNome = "Fornecedor teste",
            aparelho = ficha,
        });
        var retido = ExigirEstoque(comprado, imei);
        var osLojaId = retido["osEntradaId"]!.GetValue<long>();
        var osLoja = await Get($"/api/ordens-servico/{osLojaId}");
        var contatoId = osLoja["contato"]!["id"]!.GetValue<long>();

        var criada = await Post("/api/ordens-servico", new
        {
            contato = new { id = contatoId, nome = "Mundo Smart" },
            modeloId = modelo.Id,
            modeloNome = modelo.Nome,
            marcaNome = modelo.Marca,
            imei,
            estadoTela = "Inteira",
            condicoesAparelho = "Liga",
            defeito = "Bateria",
            formaPagamento = "avista",
            tipoServico = "orcamento",
            senhaDispositivoTipo = "sem_senha",
            situacao = "Celular da loja",
            itens = new object[]
            {
                new { descricao = "Bateria", quantidade = 1, valorUnitario = 0, tipoItem = "peca", custoPeca = 400 },
            },
        });
        var osPecaId = criada["id"]!.GetValue<long>();

        var aparelho = ExigirEstoque(await Get("/api/aparelhos-loja"), imei);
        Assert.Equal(1400m, Num(aparelho["custo"]));
        Assert.Equal(400m, Num(aparelho["custoPecas"]));
        Assert.Equal(1800m, Num(aparelho["custoTotal"]));
        Assert.Contains(
            aparelho["custosOs"]!.AsArray(),
            c => c!["osId"]!.GetValue<long>() == osPecaId);

        var sem = await PatchBruto($"/api/ordens-servico/{osLojaId}/situacao", new
        {
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
        });
        Assert.Equal(HttpStatusCode.BadRequest, sem.StatusCode);
        Assert.Contains("permanente", await sem.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var semValor = await PatchBruto($"/api/ordens-servico/{osLojaId}/situacao", new
        {
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
            alertaPermanenteInformado = true,
            alertaPermanente = "Face ID sem conserto",
        });
        Assert.Equal(HttpStatusCode.BadRequest, semValor.StatusCode);
        Assert.Contains("valor", await semValor.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        var com = await PatchBruto($"/api/ordens-servico/{osLojaId}/situacao", new
        {
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
            alertaPermanenteInformado = true,
            alertaPermanente = "Face ID sem conserto",
            valorAssistenciaInformado = true,
            valorAssistencia = 250,
        });
        Assert.Equal(HttpStatusCode.NoContent, com.StatusCode);

        var depois = ExigirEstoque(await Get("/api/aparelhos-loja"), imei);
        Assert.Equal("em_estoque", depois["status"]!.GetValue<string>());
        Assert.Equal("Face ID sem conserto", depois["alertaPermanente"]!.GetValue<string>());
        Assert.Equal(1400m, Num(depois["custo"]));
        Assert.Equal(250m, Num(depois["custoMaoDeObra"]));
        Assert.Equal(1800m, Num(depois["custoTotal"]));
    }

    [Fact]
    public async Task Receita_de_celular_separa_bruto_custo_do_item_e_custo_da_loja()
    {
        var antes = await PeriodoAtual();
        var imei = NovoImei();
        var id = await IdComprado(imei, 800);
        var cliente = await ClienteComDocumento();
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1000));
        var depois = await PeriodoAtual();

        var celAntes = antes["celulares"]!.AsObject();
        var celDepois = depois["celulares"]!.AsObject();
        Assert.Equal(1000m, Num(celDepois["bruto"]) - Num(celAntes["bruto"]));
        Assert.Equal(800m, Num(celDepois["custoItem"]) - Num(celAntes["custoItem"]));
        Assert.Equal(0m, Num(celDepois["custoLoja"]) - Num(celAntes["custoLoja"]));
        Assert.Equal(200m, Resultado(celDepois) - Resultado(celAntes));
    }

    [Fact]
    public async Task Receita_permite_venda_de_celular_abaixo_do_custo()
    {
        var antes = await PeriodoAtual();
        var imei = NovoImei();
        var id = await IdComprado(imei, 1000);
        var cliente = await ClienteComDocumento();
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 700));
        var depois = await PeriodoAtual();
        var delta = Resultado(depois["celulares"]!.AsObject()) - Resultado(antes["celulares"]!.AsObject());
        Assert.Equal(-300m, delta);
    }

    [Fact]
    public async Task Receita_de_troca_nao_conta_o_aparelho_que_entrou_como_faturamento()
    {
        var antes = await PeriodoAtual();
        var saida = NovoImei();
        var entrada = NovoImei();
        var id = await IdComprado(saida, 1000);
        var cliente = await ClienteComDocumento();
        var painel = await Trocar(id, cliente, 1000, entrada, 1900);
        var entrou = ExigirEstoque(painel, entrada);
        var depois = await PeriodoAtual();

        var celAntes = antes["celulares"]!.AsObject();
        var celDepois = depois["celulares"]!.AsObject();
        Assert.Equal(0m, Num(celDepois["bruto"]) - Num(celAntes["bruto"]));
        Assert.Equal(1000m, Num(celDepois["custoItem"]) - Num(celAntes["custoItem"]));
        Assert.Equal(900m, Num(celDepois["custoLoja"]) - Num(celAntes["custoLoja"]));
        Assert.Equal(Num(entrou["custo"]), Num(depois["celularesEstoqueEntrou"]) - Num(antes["celularesEstoqueEntrou"]));
    }

    [Fact]
    public async Task Receita_da_assistencia_usa_custo_da_peca_e_juros_sem_repetir_no_celular()
    {
        var antes = await PeriodoAtual();
        var imei = NovoImei();
        await Comprar(imei, 1000);
        var cliente = await ClienteComDocumento();
        var modelo = await PrimeiroModelo();
        await Post("/api/ordens-servico", new
        {
            contato = new { id = cliente.Id, nome = "Cliente teste" },
            modeloId = modelo.Id,
            modeloNome = modelo.Nome,
            marcaNome = modelo.Marca,
            imei,
            estadoTela = "Inteira",
            condicoesAparelho = "Liga",
            defeito = "Tela",
            formaPagamento = "cartao",
            tipoServico = "tela",
            senhaDispositivoTipo = "sem_senha",
            situacao = "Concluído",
            tecnicoNome = "Rômulo",
            valorTotalAcordado = 300m,
            juros = 15m,
            itens = new object[]
            {
                new { descricao = "Tela", quantidade = 2, valorUnitario = 200, tipoItem = "peca", custoPeca = 40 },
                new { descricao = "Mão de obra", quantidade = 1, valorUnitario = 500, tipoItem = "servico", custoPeca = 0 },
            },
        });
        var id = ExigirEstoque(await Get("/api/aparelhos-loja"), imei)["id"]!.GetValue<string>();
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1500));
        var depois = await PeriodoAtual();

        var osAntes = antes["assistencia"]!.AsObject();
        var osDepois = depois["assistencia"]!.AsObject();
        Assert.Equal(300m, Num(osDepois["bruto"]) - Num(osAntes["bruto"]));
        Assert.Equal(80m, Num(osDepois["custoItem"]) - Num(osAntes["custoItem"]));
        Assert.Equal(15m, Num(osDepois["custoLoja"]) - Num(osAntes["custoLoja"]));
        Assert.Equal(205m, Resultado(osDepois) - Resultado(osAntes));

        var celAntes = antes["celulares"]!.AsObject();
        var celDepois = depois["celulares"]!.AsObject();
        Assert.Equal(1500m, Num(celDepois["bruto"]) - Num(celAntes["bruto"]));
        Assert.Equal(1000m, Num(celDepois["custoItem"]) - Num(celAntes["custoItem"]));
        Assert.Equal(0m, Num(celDepois["custoLoja"]) - Num(celAntes["custoLoja"]));
    }

    private async Task<JsonObject> PeriodoAtual()
    {
        var painel = await Get("/api/receitas?agrupamento=mensal&periodos=2");
        var lista = painel["periodos"]!.AsArray();
        Assert.True(lista.Count > 0);
        return lista[lista.Count - 1]!.AsObject();
    }

    private static decimal Resultado(JsonObject faixa) =>
        Num(faixa["bruto"]) - Num(faixa["custoItem"]) - Num(faixa["custoLoja"]);

    private async Task<string> IdComprado(string imei, decimal valor, string marca = "Apple", string modelo = "iPhone 13")
    {
        var painel = await Comprar(imei, valor, marca, modelo);
        return ExigirEstoque(painel, imei)["id"]!.GetValue<string>();
    }

    private Task<JsonObject> Comprar(string imei, decimal valor, string marca = "Apple", string modelo = "iPhone 13") =>
        Post("/api/aparelhos-loja/compra", new
        {
            valorPago = valor,
            fornecedorNome = "Fornecedor teste",
            aparelho = Aparelho(imei, marca, modelo),
        });

    private Task<JsonObject> Trocar(string saidaId, (long Id, string Cpf) cliente, decimal preco, string imeiEntrada, decimal avaliado) =>
        Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = saidaId,
            precoTabela = preco,
            desconto = 0,
            acrescimo = 0,
            precoSaida = preco,
            valorAvaliado = avaliado,
            forma = "avista",
            clienteId = cliente.Id,
            entrada = Aparelho(imeiEntrada),
        });

    private static object Venda(string id, (long Id, string Cpf) cliente, decimal preco, string marca = "Apple", string modelo = "iPhone 13") => new
    {
        aparelhoId = id,
        clienteId = cliente.Id,
        precoTabela = preco,
        desconto = 0,
        acrescimo = 0,
        preco,
        forma = "avista",
        marca,
        modelo,
    };

    private static Dictionary<string, object?> Aparelho(
        string imei,
        string marca = "Apple",
        string modelo = "iPhone 13",
        decimal? desagio = null,
        bool passaPorAssistencia = false,
        string? osNumero = null)
    {
        var aparelho = new Dictionary<string, object?>
        {
            ["imei"] = imei,
            ["marca"] = marca,
            ["modelo"] = modelo,
            ["cor"] = "Preto",
            ["configuracao"] = "128GB",
            ["condicao"] = "usado",
            ["valorVenda"] = 10000m,
            ["valorMinimoVenda"] = 1m,
            ["bateriaPerfeita"] = true,
            ["passaPorAssistencia"] = passaPorAssistencia,
        };
        if (desagio is not null) aparelho["desagio"] = desagio;
        if (!string.IsNullOrWhiteSpace(osNumero)) aparelho["osNumero"] = osNumero;
        return aparelho;
    }

    private async Task GarantirClienteLoja()
    {
        var lista = await GetArray("/api/clientes?nome=Mundo%20Smart");
        if (lista.Any(n => string.Equals(n?["nome"]?.GetValue<string>(), "Mundo Smart", StringComparison.OrdinalIgnoreCase)))
            return;
        await Post("/api/clientes", new
        {
            nome = "Mundo Smart",
            telefone = NovoTelefone(),
            cpfCnpj = NovoCpf(),
        });
    }

    private async Task<(long Id, string Cpf)> ClienteComDocumento()
    {
        var cpf = NovoCpf();
        var criado = await Post("/api/clientes", new
        {
            nome = "Cliente teste " + cpf,
            telefone = NovoTelefone(),
            cpfCnpj = cpf,
        });
        return (criado["id"]!.GetValue<long>(), cpf);
    }

    private async Task<(string Id, string Nome, string Marca, string Numero)> PrimeiroModelo()
    {
        var lista = await GetArray("/api/aparelhos/modelos?tipoDispositivo=Celular&limite=1");
        Assert.True(lista.Count > 0, "O catálogo de celulares não foi semeado.");
        var m = lista[0]!.AsObject();
        return (
            m["id"]!.GetValue<string>(),
            m["nome"]!.GetValue<string>(),
            m["marcaNome"]!.GetValue<string>(),
            "");
    }

    private async Task<(long Id, string Numero)> CriarOs(
        (long Id, string Cpf) cliente,
        (string Id, string Nome, string Marca, string Numero) modelo,
        string imei,
        string situacao,
        string? tecnico)
    {
        var criada = await Post("/api/ordens-servico", Os(cliente, modelo, imei, situacao, tecnico, itens: false));
        var numero = criada["numero"]?.GetValue<string>();
        if (string.IsNullOrWhiteSpace(numero))
            numero = criada["id"]!.GetValue<long>().ToString();
        return (criada["id"]!.GetValue<long>(), numero);
    }

    private static object Os(
        (long Id, string Cpf) cliente,
        (string Id, string Nome, string Marca, string Numero) modelo,
        string imei,
        string situacao,
        string? tecnico,
        bool itens) => new
    {
        contato = new { id = cliente.Id, nome = "Cliente teste" },
        modeloId = modelo.Id,
        modeloNome = modelo.Nome,
        marcaNome = modelo.Marca,
        imei,
        estadoTela = "Inteira",
        condicoesAparelho = "Liga",
        defeito = "Tela",
        formaPagamento = "avista",
        tipoServico = "tela",
        senhaDispositivoTipo = "sem_senha",
        situacao,
        tecnicoNome = tecnico,
        itens = itens
            ? new object[]
            {
                new { descricao = "Tela", quantidade = 2, valorUnitario = 200, tipoItem = "peca", custoPeca = 40 },
                new { descricao = "Mão de obra", quantidade = 1, valorUnitario = 500, tipoItem = "servico", custoPeca = 0 },
            }
            : Array.Empty<object>(),
    };

    private async Task<JsonObject> Get(string url)
    {
        var res = await _admin.GetAsync(url);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsObject();
    }

    private async Task<JsonArray> GetArray(string url)
    {
        var res = await _admin.GetAsync(url);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsArray();
    }

    private async Task<JsonObject> Delete(string url)
    {
        var res = await _admin.DeleteAsync(url);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsObject();
    }

    private Task<HttpResponseMessage> DeleteBruto(string url) =>
        _admin.DeleteAsync(url);

    private async Task<JsonObject> Put(string url, object body)
    {
        var res = await _admin.PutAsJsonAsync(url, body);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsObject();
    }

    private async Task<JsonObject> Post(string url, object body)
    {
        var res = await PostBruto(url, body);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsObject();
    }

    private Task<HttpResponseMessage> PostBruto(string url, object body) =>
        _admin.PostAsJsonAsync(url, body);

    private Task<HttpResponseMessage> PatchBruto(string url, object body) =>
        _admin.PatchAsJsonAsync(url, body);

    private async Task<JsonObject> PostSemAuth(string url, object body)
    {
        using var cru = _factory.CreateClient();
        var res = await cru.PostAsJsonAsync(url, body);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode} {url}\n{texto}");
        return JsonNode.Parse(texto)!.AsObject();
    }

    [Fact]
    public async Task Admin_exclui_compra_e_tira_aparelho_do_estoque()
    {
        var imei = NovoImei();
        var id = await IdComprado(imei, 900);
        var depois = await Delete($"/api/aparelhos-loja/{id}");
        Assert.DoesNotContain(depois["estoque"]!.AsArray(), n => n!["imei"]!.GetValue<string>() == imei);
        Assert.DoesNotContain(depois["operacoes"]!.AsArray(), n =>
            n!["tipo"]!.GetValue<string>() == "compra"
            && (n["entradaResumo"]?.GetValue<string>() ?? "").Contains(imei));
    }

    [Fact]
    public async Task Admin_exclui_venda_e_aparelho_volta_ao_estoque()
    {
        var imei = NovoImei();
        var id = await IdComprado(imei, 900);
        var cliente = await ClienteComDocumento();
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1200));
        var painel = await Get("/api/aparelhos-loja");
        var venda = ExigirOperacao(painel, imei, "venda");
        var depois = await Delete($"/api/aparelhos-loja/operacoes/{venda["id"]!.GetValue<string>()}");
        Assert.DoesNotContain(depois["operacoes"]!.AsArray(), n => n!["id"]!.GetValue<string>() == venda["id"]!.GetValue<string>());
        Assert.Equal("em_estoque", ExigirEstoque(depois, imei)["status"]!.GetValue<string>());
    }

    [Fact]
    public async Task Nao_exclui_aparelho_que_ja_saiu()
    {
        var imei = NovoImei();
        var id = await IdComprado(imei, 900);
        var cliente = await ClienteComDocumento();
        await Post("/api/aparelhos-loja/venda", Venda(id, cliente, 1200));
        var res = await DeleteBruto($"/api/aparelhos-loja/{id}");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.Contains("saiu", texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Nao_exclui_aparelho_que_entrou_por_troca()
    {
        var saida = NovoImei();
        var id = await IdComprado(saida, 2000);
        var cliente = await ClienteComDocumento();
        var entrada = NovoImei();
        var painel = await Trocar(id, cliente, 2500, entrada, 1000);
        var entrou = ExigirEstoque(painel, entrada);
        var res = await DeleteBruto($"/api/aparelhos-loja/{entrou["id"]!.GetValue<string>()}");
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var texto = await res.Content.ReadAsStringAsync();
        Assert.Contains("troca", texto, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Cadeia_mostra_o_prejuizo_da_troca_e_o_lucro_quando_acaba()
    {
        var cliente = await ClienteComDocumento();
        var imei13 = NovoImei();
        var id13 = await IdComprado(imei13, 2000, "Apple", "iPhone 13");
        var imei16 = NovoImei();
        var aberta = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id13,
            precoTabela = 3000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 3000,
            valorAvaliado = 3900,
            sentidoDiferenca = "cliente",
            diferencaInformada = 900,
            forma = "dinheiro",
            clienteId = cliente.Id,
            entrada = Aparelho(imei16, "Apple", "iPhone 16"),
        });
        var cadeia = ExigirCadeia(aberta, imei13);
        Assert.True(cadeia["aberta"]!.GetValue<bool>());
        Assert.Equal(-900m, Num(cadeia["resultadoAteAgora"]));
        Assert.True(cadeia["lucroFinal"] is null);
        Assert.Contains("iPhone 16", cadeia["pendentes"]!.ToJsonString());

        var id16 = ExigirEstoque(aberta, imei16)["id"]!.GetValue<string>();
        var imei14 = NovoImei();
        var meio = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id16,
            precoTabela = 4200,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 4200,
            valorAvaliado = 1400,
            sentidoDiferenca = "loja",
            diferencaInformada = 2800,
            forma = "dinheiro",
            clienteId = cliente.Id,
            entrada = Aparelho(imei14, "Apple", "iPhone 14"),
        });
        var andamento = ExigirCadeia(meio, imei13);
        Assert.True(andamento["aberta"]!.GetValue<bool>());
        Assert.Equal(1900m, Num(andamento["resultadoAteAgora"]));
        Assert.Equal(cadeia["id"]!.GetValue<string>(), andamento["id"]!.GetValue<string>());

        var id14 = ExigirEstoque(meio, imei14)["id"]!.GetValue<string>();
        var fim = await Post("/api/aparelhos-loja/venda", Venda(id14, cliente, 2800, "Apple", "iPhone 14"));
        var fechada = ExigirCadeia(fim, imei13);
        Assert.False(fechada["aberta"]!.GetValue<bool>());
        Assert.Equal(5600m, Num(fechada["dinheiroEntrou"]));
        Assert.Equal(2900m, Num(fechada["dinheiroSaiu"]));
        Assert.Equal(7300m, Num(fechada["valorEntrada"]));
        Assert.Equal(10000m, Num(fechada["valorSaida"]));
        Assert.Equal(2700m, Num(fechada["lucroFinal"]));
        var troca13 = fechada["passos"]!.AsArray()
            .Select(p => p!.AsObject())
            .First(p => p["saiu"]!.AsArray().Any(s => s!["imei"]!.GetValue<string>() == imei13));
        Assert.Contains(cliente.Cpf, troca13["clienteCpf"]!.GetValue<string>());
        Assert.Contains("Cliente teste", troca13["clienteNome"]!.GetValue<string>());
        Assert.False(string.IsNullOrWhiteSpace(troca13["clienteTelefone"]!.GetValue<string>()));
        Assert.Equal(imei16, troca13["entrou"]![0]!["imei"]!.GetValue<string>());
        Assert.Contains("iPhone 16", troca13["entrou"]![0]!["nome"]!.GetValue<string>());

        var mes = fim["meses"]!.AsArray()
            .Select(m => m!.AsObject())
            .First(m => m["unidades"]!.AsArray().Any(u =>
                u!["imei"]!.GetValue<string>() == imei14
                && u["movimento"]!.GetValue<string>() == "venda"));
        var unidades = mes["unidades"]!.AsArray();
        Assert.Contains(unidades, u => u!["imei"]!.GetValue<string>() == imei13 && u["movimento"]!.GetValue<string>() == "saiu");
        Assert.Contains(unidades, u => u!["imei"]!.GetValue<string>() == imei16 && u["movimento"]!.GetValue<string>() == "entrou");
        Assert.Contains(unidades, u => u!["imei"]!.GetValue<string>() == imei16 && u["movimento"]!.GetValue<string>() == "saiu");
        Assert.Contains(unidades, u => u!["imei"]!.GetValue<string>() == imei14 && u["movimento"]!.GetValue<string>() == "entrou");
        Assert.Contains(unidades, u => u!["imei"]!.GetValue<string>() == imei14 && u["movimento"]!.GetValue<string>() == "venda");
    }

    [Fact]
    public async Task Cadeia_da_troca_com_varios_aparelhos_so_fecha_na_ultima_venda()
    {
        var cliente = await ClienteComDocumento();
        var imei16 = NovoImei();
        var id16 = await IdComprado(imei16, 5000, "Apple", "iPhone 16");
        var imei13a = NovoImei();
        var imei13b = NovoImei();
        var imei11 = NovoImei();
        var troca = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = id16,
            precoTabela = 5000,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 5000,
            sentidoDiferenca = "loja",
            diferencaInformada = 1200,
            forma = "dinheiro",
            clienteId = cliente.Id,
            entradas = new object[]
            {
                new { valorAvaliado = 1500, aparelho = Aparelho(imei13a, "Apple", "iPhone 13") },
                new { valorAvaliado = 1500, aparelho = Aparelho(imei13b, "Apple", "iPhone 13") },
                new { valorAvaliado = 800, aparelho = Aparelho(imei11, "Apple", "iPhone 11") },
            },
        });
        var cadeia = ExigirCadeia(troca, imei16);
        Assert.True(cadeia["aberta"]!.GetValue<bool>());
        Assert.Equal(3, cadeia["pendentes"]!.AsArray().Count);
        Assert.Equal(1200m, Num(cadeia["resultadoAteAgora"]));

        var vendido = await Post("/api/aparelhos-loja/venda", Venda(
            ExigirEstoque(troca, imei13a)["id"]!.GetValue<string>(), cliente, 2000, "Apple", "iPhone 13"));
        vendido = await Post("/api/aparelhos-loja/venda", Venda(
            ExigirEstoque(vendido, imei11)["id"]!.GetValue<string>(), cliente, 1000, "Apple", "iPhone 11"));
        var parcial = ExigirCadeia(vendido, imei16);
        Assert.True(parcial["aberta"]!.GetValue<bool>());
        Assert.Single(parcial["pendentes"]!.AsArray());

        var imeiFinal = NovoImei();
        var virou = await Post("/api/aparelhos-loja/troca", new
        {
            aparelhoSaidaId = ExigirEstoque(vendido, imei13b)["id"]!.GetValue<string>(),
            precoTabela = 1800,
            desconto = 0,
            acrescimo = 0,
            precoSaida = 1800,
            valorAvaliado = 1600,
            sentidoDiferenca = "cliente",
            diferencaInformada = 200,
            forma = "dinheiro",
            clienteId = cliente.Id,
            entrada = Aparelho(imeiFinal, "Apple", "iPhone 11"),
        });
        var ainda = ExigirCadeia(virou, imei16);
        Assert.True(ainda["aberta"]!.GetValue<bool>());
        Assert.Equal(cadeia["id"]!.GetValue<string>(), ainda["id"]!.GetValue<string>());

        var fim = await Post("/api/aparelhos-loja/venda", Venda(
            ExigirEstoque(virou, imeiFinal)["id"]!.GetValue<string>(), cliente, 900, "Apple", "iPhone 11"));
        var fechada = ExigirCadeia(fim, imei16);
        Assert.False(fechada["aberta"]!.GetValue<bool>());
        Assert.Empty(fechada["pendentes"]!.AsArray());
        Assert.Equal(Num(fechada["dinheiroEntrou"]) - Num(fechada["dinheiroSaiu"]), Num(fechada["lucroFinal"]));
    }

    private static JsonObject ExigirCadeia(JsonObject painel, string imei)
    {
        var achado = painel["cadeias"]!.AsArray()
            .Select(c => c!.AsObject())
            .FirstOrDefault(c => c.ToJsonString().Contains(imei));
        Assert.True(achado is not null, $"IMEI {imei} não está numa transação.");
        return achado!;
    }

    private static JsonObject ExigirEstoque(JsonObject painel, string imei)
    {
        var achado = painel["estoque"]!.AsArray()
            .Select(a => a!.AsObject())
            .FirstOrDefault(a => a["imei"]!.GetValue<string>() == imei);
        Assert.True(achado is not null, $"IMEI {imei} não está no estoque.");
        return achado!;
    }

    private static JsonObject ExigirOperacao(JsonObject painel, string imei, string tipo)
    {
        var achado = painel["operacoes"]!.AsArray()
            .Select(a => a!.AsObject())
            .FirstOrDefault(a =>
                a["tipo"]!.GetValue<string>() == tipo
                && ((a["entradaResumo"]?.GetValue<string>() ?? "").Contains(imei)
                    || (a["saidaResumo"]?.GetValue<string>() ?? "").Contains(imei)));
        Assert.True(achado is not null, $"Operação {tipo} do IMEI {imei} não apareceu.");
        return achado!;
    }

    private static decimal Num(JsonNode? node)
    {
        if (node is null) return 0;
        if (node is JsonValue valor && valor.TryGetValue<decimal>(out var numero))
            return numero;
        return decimal.Parse(node.ToString(), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static string NovoImei()
    {
        var n = Interlocked.Increment(ref _seq);
        return $"35{DateTime.UtcNow:MMddHHmm}{n:00000}"[..15];
    }

    private static string NovoTelefone()
    {
        var n = Interlocked.Increment(ref _seq);
        return $"119{DateTime.UtcNow:HHmmss}{n % 100:00}"[..11];
    }

    private static string NovoCpf()
    {
        var base9 = $"{DateTime.UtcNow:HHmmss}{Interlocked.Increment(ref _seq):000}"[..9];
        var nums = base9.Select(c => c - '0').ToArray();
        var d1 = DigitoCpf(nums, 10);
        var d2 = DigitoCpf(nums.Append(d1).ToArray(), 11);
        return base9 + d1 + d2;
    }

    private static int DigitoCpf(int[] nums, int pesoInicial)
    {
        var soma = 0;
        for (var i = 0; i < nums.Length; i++)
            soma += nums[i] * (pesoInicial - i);
        var resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    }
}
