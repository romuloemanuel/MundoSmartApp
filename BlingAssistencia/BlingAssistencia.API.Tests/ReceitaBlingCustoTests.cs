using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Services;
using Xunit;

namespace MundoSmart.BlingAssistencia.API.Tests;

public class ReceitaBlingCustoTests
{
    [Fact]
    public void Pedido_sem_custo_nao_transforma_preco_de_venda_em_custo()
    {
        using var doc = JsonDocument.Parse("""
            {"total":350,"itens":[{"quantidade":1,"valor":350,"produto":{"id":9}}]}
            """);
        var leitura = ReceitaBlingCusto.Ler(doc.RootElement);
        Assert.False(leitura.Informou);
        Assert.Equal(0m, leitura.Item);
        Assert.Equal(0m, leitura.Loja);
    }

    [Fact]
    public void Separa_custo_do_item_e_custo_da_loja_quando_o_pedido_traz()
    {
        using var doc = JsonDocument.Parse("""
            {"itens":[{"quantidade":2,"precoCusto":10.5},{"quantidade":1,"produto":{"precoCusto":4}}],"taxas":{"taxaComissao":3},"outrasDespesas":1.5}
            """);
        var leitura = ReceitaBlingCusto.Ler(doc.RootElement);
        Assert.True(leitura.Informou);
        Assert.Equal(25m, leitura.Item);
        Assert.Equal(4.5m, leitura.Loja);
    }
}
