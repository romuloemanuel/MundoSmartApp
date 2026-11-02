using MundoSmart.BlingAssistencia.API.Settings;
using Xunit;

namespace MundoSmart.BlingAssistencia.API.Tests;

public class QrUrlTests
{
    [Fact]
    public void Producao_ignora_o_dominio_automatico_do_painel()
    {
        var intake = new IntakeSettings { AppBaseUrl = "https://vice.aenkbz.easypanel.host" };

        var url = intake.UrlDoQr("https://vice.aenkbz.easypanel.host", desenvolvimento: false);

        Assert.Equal(IntakeSettings.UrlPublicaPadrao, url);
    }

    [Fact]
    public void Producao_usa_o_site_publico_configurado()
    {
        var intake = new IntakeSettings { AppBaseUrl = "https://gestaosmart.mundosmartoficial.com.br/" };

        var url = intake.UrlDoQr(null, desenvolvimento: false);

        Assert.Equal("https://gestaosmart.mundosmartoficial.com.br", url);
    }

    [Fact]
    public void Desenvolvimento_continua_com_o_endereco_da_rede_local()
    {
        var intake = new IntakeSettings { AppBaseUrl = "https://gestaosmart.mundosmartoficial.com.br" };

        var url = intake.UrlDoQr("http://192.168.0.245:4200", desenvolvimento: true);

        Assert.Equal("http://192.168.0.245:4200", url);
    }
}
