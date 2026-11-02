using MundoSmart.BlingAssistencia.API.Services;
using Xunit;

namespace MundoSmart.BlingAssistencia.API.Tests;

public class BlingCelularEstoqueLeituraTests
{
    [Fact]
    public void Imei_no_codigo_e_custo_nao_copia_o_preco()
    {
        var leitura = BlingCelularEstoqueLeitura.Ler(
            "iPhone 13 128GB Preto",
            "490154203237518",
            null,
            null,
            null,
            preco: 3500,
            precoCusto: 2500,
            saldo: 1);

        Assert.True(leitura.PareceCelular);
        Assert.Equal(["490154203237518"], leitura.Imeis);
        Assert.Equal(2500m, leitura.Custo);
        Assert.Equal(3500m, leitura.ValorVenda);
        Assert.Equal("128 GB", leitura.Configuracao);
        Assert.Equal("Apple", leitura.Marca);
    }

    [Fact]
    public void Sem_preco_de_custo_o_custo_fica_zero()
    {
        var leitura = BlingCelularEstoqueLeitura.Ler(
            "Samsung Galaxy A54 128GB",
            "351756051523999",
            null,
            null,
            null,
            preco: 1800,
            precoCusto: 0,
            saldo: 1);

        Assert.Equal(0m, leitura.Custo);
        Assert.Equal(1800m, leitura.ValorVenda);
    }

    [Fact]
    public void Capinha_nao_entra_como_celular()
    {
        var leitura = BlingCelularEstoqueLeitura.Ler(
            "Capinha iPhone 13 preta",
            "CAP-13",
            null,
            null,
            null,
            40,
            15,
            8);

        Assert.False(leitura.PareceCelular);
    }

    [Fact]
    public void Imei_repetido_e_digitos_iguais_sao_ignorados()
    {
        var imeis = BlingCelularEstoqueLeitura.ImeisDe(
        [
            "111111111111111",
            "IMEI 490154203237518 e de novo 490154203237518",
        ]);

        Assert.Equal(["490154203237518"], imeis);
    }
}
