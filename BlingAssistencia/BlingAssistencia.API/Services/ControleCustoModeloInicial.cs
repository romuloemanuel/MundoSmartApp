namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Foto do controle de custo usada para começar um ambiente vazio, inclusive produção.
/// </summary>
public static class ControleCustoModeloInicial
{
    public readonly record struct Rateio(string Setor, decimal Percentual);

    public readonly record struct Custo(
        string Competencia,
        string Categoria,
        string? Colaborador,
        string Descricao,
        decimal Valor,
        string Recorrencia,
        Rateio[] Rateio);

    public static readonly (string Nome, string[] Setores, string? Cargo)[] Colaboradores =
    [
        ("Liniker", ["assistencia"], null),
        ("Wesley", ["assistencia"], null),
        ("Pedrinho", ["brindes-online"], null),
        ("Yago", ["brindes-online", "smartphones"], null),
        ("Gabriela", ["loja"], "Gerente da loja"),
        ("Rômulo", ["loja"], "Diretor"),
    ];

    public static readonly Custo[] Custos =
    [
        new("2026-11", "aluguel", null, "Aluguel", 2200m, "fixo",
        [
            new("loja", 45m), new("assistencia", 45m), new("smartphones", 10m),
        ]),
        new("2026-11", "energia", null, "Energia", 400m, "fixo",
        [
            new("loja", 50m), new("assistencia", 50m),
        ]),
        new("2026-11", "agua", null, "Água", 150m, "unico",
        [
            new("loja", 50m), new("assistencia", 50m),
        ]),
        new("2026-11", "colaborador", "Yago", "Yago", 2000m, "fixo",
        [
            new("smartphones", 100m),
        ]),
        new("2026-11", "colaborador", "Liniker", "Liniker", 3400m, "fixo",
        [
            new("assistencia", 100m),
        ]),
        new("2026-11", "colaborador", "Pedrinho", "Pedrinho", 700m, "unico",
        [
            new("loja", 50m), new("assistencia", 50m),
        ]),
        new("2026-11", "colaborador", "Wesley", "Wesley", 2500m, "unico",
        [
            new("loja", 60m), new("assistencia", 40m),
        ]),
        new("2026-11", "trafego-pago", null, "Tráfego pago", 1500m, "fixo",
        [
            new("assistencia", 100m),
        ]),
        new("2026-11", "trafego-pago", null, "Tráfego pago", 600m, "fixo",
        [
            new("smartphones", 100m),
        ]),
        new("2026-11", "trafego-pago", null, "Tráfego pago", 600m, "fixo",
        [
            new("loja", 100m),
        ]),
        new("2026-11", "colaborador", "Gabriela", "Gerente da loja", 2000m, "unico",
        [
            new("loja", 100m),
        ]),
        new("2026-11", "colaborador", "Rômulo", "Rômulo", 6000m, "unico",
        [
            new("loja", 30m), new("assistencia", 30m), new("smartphones", 40m),
        ]),
    ];
}
