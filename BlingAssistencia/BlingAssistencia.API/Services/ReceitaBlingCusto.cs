using System.Text.Json;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Lê custo do item e custo da loja quando o pedido do Bling traz esses campos.
/// O preço de venda do item não é custo.
/// </summary>
public static class ReceitaBlingCusto
{
    public readonly record struct Leitura(decimal Item, decimal Loja, bool Informou);

    public static Leitura Ler(JsonElement pedido)
    {
        decimal item = 0;
        decimal loja = 0;
        var informou = false;

        if (TryProp(pedido, "itens", out var itens) && itens.ValueKind == JsonValueKind.Array)
        {
            foreach (var linha in itens.EnumerateArray())
            {
                var unit = PrimeiroPositivo(linha, "precoCusto", "custo", "valorCusto");
                if (unit <= 0 && TryProp(linha, "produto", out var produto) && produto.ValueKind == JsonValueKind.Object)
                    unit = PrimeiroPositivo(produto, "precoCusto", "custo", "valorCusto");
                if (unit <= 0) continue;
                informou = true;
                item += unit * Quantidade(linha);
            }
        }

        if (TryProp(pedido, "taxas", out var taxas) && taxas.ValueKind == JsonValueKind.Object)
        {
            var taxa = SomarPositivos(taxas, "taxaComissao", "custoFrete", "valor");
            if (taxa > 0)
            {
                informou = true;
                loja += taxa;
            }
        }

        var outras = PrimeiroPositivo(pedido, "outrasDespesas", "valorOutrasDespesas");
        if (outras > 0)
        {
            informou = true;
            loja += outras;
        }

        return new Leitura(Round(item), Round(loja), informou);
    }

    private static decimal Quantidade(JsonElement linha)
    {
        if (!TryProp(linha, "quantidade", out var qtd)) return 1;
        if (qtd.ValueKind == JsonValueKind.Number && qtd.TryGetDecimal(out var n) && n > 0) return n;
        return 1;
    }

    private static decimal PrimeiroPositivo(JsonElement item, params string[] nomes)
    {
        foreach (var nome in nomes)
        {
            if (!TryProp(item, nome, out var valor)) continue;
            if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var n) && n > 0)
                return n;
        }
        return 0;
    }

    private static decimal SomarPositivos(JsonElement item, params string[] nomes)
    {
        decimal total = 0;
        foreach (var nome in nomes)
        {
            if (!TryProp(item, nome, out var valor)) continue;
            if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out var n) && n > 0)
                total += n;
        }
        return total;
    }

    private static bool TryProp(JsonElement item, string nome, out JsonElement valor)
    {
        if (item.ValueKind == JsonValueKind.Object)
        {
            foreach (var prop in item.EnumerateObject())
            {
                if (string.Equals(prop.Name, nome, StringComparison.OrdinalIgnoreCase))
                {
                    valor = prop.Value;
                    return true;
                }
            }
        }
        valor = default;
        return false;
    }

    private static decimal Round(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);
}
