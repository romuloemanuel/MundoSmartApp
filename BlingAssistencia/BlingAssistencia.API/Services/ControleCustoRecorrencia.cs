using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

public static class ControleCustoRecorrencia
{
    public static string Normalizar(string? recorrencia, int? meses, out int quantidade)
    {
        var tipo = (recorrencia ?? ControleCustoCatalogo.RecorrenciaUnico).Trim().ToLowerInvariant();
        if (!ControleCustoCatalogo.Recorrencias.Contains(tipo))
            throw new ArgumentException("Escolha como o custo se repete.");

        quantidade = tipo switch
        {
            ControleCustoCatalogo.RecorrenciaMensal => ExigirQuantidade(meses, 1, 60, "Informe de 1 a 60 meses."),
            ControleCustoCatalogo.RecorrenciaParcelado => ExigirQuantidade(meses, 2, 60, "Informe de 2 a 60 parcelas."),
            ControleCustoCatalogo.RecorrenciaAnual => ExigirQuantidade(meses, 1, 20, "Informe de 1 a 20 anos."),
            _ => 0,
        };
        return tipo;
    }

    public static bool Vigente(ControleCustoLancamentoData custo, string mes)
    {
        if (custo.Tipo == ControleCustoCatalogo.Reinvestimento
            && custo.Recorrencia == ControleCustoCatalogo.RecorrenciaMensal)
        {
            if (string.CompareOrdinal(mes, custo.Competencia) < 0) return false;
            return IndiceMes(custo.Competencia, mes) < Math.Max(1, custo.Meses ?? 1);
        }
        if (custo.Tipo != ControleCustoCatalogo.Custo) return custo.Competencia == mes;
        if (string.CompareOrdinal(mes, custo.Competencia) < 0) return false;
        var tipo = string.IsNullOrWhiteSpace(custo.Recorrencia)
            ? ControleCustoCatalogo.RecorrenciaUnico
            : custo.Recorrencia;
        var indice = IndiceMes(custo.Competencia, mes);
        return tipo switch
        {
            ControleCustoCatalogo.RecorrenciaFixo => true,
            ControleCustoCatalogo.RecorrenciaMensal => indice < Math.Max(1, custo.Meses ?? 1),
            ControleCustoCatalogo.RecorrenciaParcelado => indice < Math.Max(2, custo.Meses ?? 2),
            ControleCustoCatalogo.RecorrenciaAnual => MesmoMes(custo.Competencia, mes)
                && AnosEntre(custo.Competencia, mes) < Math.Max(1, custo.Meses ?? 1),
            _ => indice == 0,
        };
    }

    public static decimal ValorNoMes(ControleCustoLancamentoData custo, string mes)
    {
        if (!Vigente(custo, mes)) return 0;
        if (custo.Recorrencia != ControleCustoCatalogo.RecorrenciaParcelado) return custo.Valor;
        var n = Math.Max(2, custo.Meses ?? 2);
        var indice = IndiceMes(custo.Competencia, mes);
        var parcela = Dinheiro(custo.Valor / n);
        if (indice == n - 1) return Dinheiro(custo.Valor - parcela * (n - 1));
        return parcela;
    }

    public static IEnumerable<string> MesesDaSerie(string inicio, string recorrencia, int quantidade)
    {
        if (recorrencia == ControleCustoCatalogo.RecorrenciaFixo)
        {
            yield return inicio;
            yield break;
        }
        if (recorrencia == ControleCustoCatalogo.RecorrenciaAnual)
        {
            for (var i = 0; i < Math.Max(1, quantidade); i++)
                yield return SomarMeses(inicio, i * 12);
            yield break;
        }
        var total = recorrencia == ControleCustoCatalogo.RecorrenciaUnico ? 1 : Math.Max(1, quantidade);
        for (var i = 0; i < total; i++)
            yield return SomarMeses(inicio, i);
    }

    public static void PreencherExibicao(ControleCustoLancamentoData custo, string mes)
    {
        custo.ValorNoMes = ValorNoMes(custo, mes);
        var tipo = string.IsNullOrWhiteSpace(custo.Recorrencia)
            ? ControleCustoCatalogo.RecorrenciaUnico
            : custo.Recorrencia;
        if (tipo is ControleCustoCatalogo.RecorrenciaUnico or ControleCustoCatalogo.RecorrenciaFixo)
            return;
        custo.TotalParcelas = Math.Max(1, custo.Meses ?? 1);
        custo.Parcela = tipo == ControleCustoCatalogo.RecorrenciaAnual
            ? AnosEntre(custo.Competencia, mes) + 1
            : IndiceMes(custo.Competencia, mes) + 1;
    }

    public static int IndiceMes(string inicio, string mes)
    {
        var (anoInicio, mesInicio) = Partes(inicio);
        var (ano, mesAtual) = Partes(mes);
        return (ano - anoInicio) * 12 + (mesAtual - mesInicio);
    }

    public static string SomarMeses(string competencia, int meses)
    {
        var (ano, mes) = Partes(competencia);
        var total = mes - 1 + meses;
        var anoFinal = ano + Math.DivRem(total, 12, out var resto);
        return $"{anoFinal:0000}-{resto + 1:00}";
    }

    private static bool MesmoMes(string inicio, string mes) => Partes(inicio).Mes == Partes(mes).Mes;

    private static int AnosEntre(string inicio, string mes) => Partes(mes).Ano - Partes(inicio).Ano;

    private static (int Ano, int Mes) Partes(string competencia)
    {
        var pedacos = competencia.Split('-');
        return (int.Parse(pedacos[0]), int.Parse(pedacos[1]));
    }

    private static int ExigirQuantidade(int? valor, int minimo, int maximo, string erro)
    {
        if (valor is null || valor < minimo || valor > maximo)
            throw new ArgumentException(erro);
        return valor.Value;
    }

    private static decimal Dinheiro(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);
}
