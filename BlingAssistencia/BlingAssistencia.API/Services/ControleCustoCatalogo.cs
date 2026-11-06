namespace MundoSmart.BlingAssistencia.API.Services;

public static class ControleCustoCatalogo
{
    public const string Faturamento = "faturamento";
    public const string Custo = "custo";
    public const string Reinvestimento = "reinvestimento";

    public const string CategoriaColaborador = "colaborador";
    public const string CategoriaEnergia = "energia";
    public const string CategoriaAgua = "agua";
    public const string CategoriaAluguel = "aluguel";
    public const string CategoriaTrafegoPago = "trafego-pago";
    public const string CategoriaInfraestrutura = "infraestrutura";
    public const string CategoriaOutro = "outro";

    public const string RecorrenciaUnico = "unico";
    public const string RecorrenciaFixo = "fixo";
    public const string RecorrenciaMensal = "mensal";
    public const string RecorrenciaParcelado = "parcelado";
    public const string RecorrenciaAnual = "anual";

    public static readonly string[] Recorrencias =
    [
        RecorrenciaUnico, RecorrenciaFixo, RecorrenciaMensal, RecorrenciaParcelado, RecorrenciaAnual,
    ];

    public static readonly (string Id, string Nome)[] Setores =
    [
        ("brindes-online", "Brindes/Online"),
        ("loja", "Loja"),
        ("assistencia", "Assistência"),
        ("smartphones", "Venda/Troca Smartphones"),
    ];

    public static readonly string[] Categorias =
    [
        CategoriaColaborador, CategoriaEnergia, CategoriaAgua, CategoriaAluguel,
        CategoriaTrafegoPago, CategoriaInfraestrutura, CategoriaOutro,
    ];

    public static bool SetorValido(string? id) =>
        Setores.Any(s => s.Id == id);

    public static string NomeSetor(string id) =>
        Setores.FirstOrDefault(s => s.Id == id).Nome ?? id;

    public static string NomeCategoria(string? id) => id switch
    {
        CategoriaColaborador => "Colaborador",
        CategoriaEnergia => "Energia",
        CategoriaAgua => "Água",
        CategoriaAluguel => "Aluguel",
        CategoriaTrafegoPago => "Tráfego pago",
        CategoriaInfraestrutura => "Infraestrutura",
        CategoriaOutro => "Outro",
        _ => id ?? "",
    };
}
