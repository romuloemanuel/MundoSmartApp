using MundoSmart.BlingAssistencia.API.Settings;
using Microsoft.Extensions.Options;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IEstoqueNivelService
{
    string CalcularNivel(int quantidade);
    bool EhAlerta(int quantidade);
    EstoqueLimitesResponse ObterLimites();
}

public class EstoqueLimitesResponse
{
    public int LimiteLaranja { get; set; }
    public int LimiteAmarelo { get; set; }
}

public class EstoqueNivelService : IEstoqueNivelService
{
    private readonly EstoqueSettings _cfg;

    public EstoqueNivelService(IOptions<EstoqueSettings> options) => _cfg = options.Value;

    public string CalcularNivel(int quantidade)
    {
        if (quantidade <= 0) return "vermelho";
        if (quantidade < _cfg.LimiteLaranja) return "laranja";
        if (quantidade < _cfg.LimiteAmarelo) return "amarelo";
        return "verde";
    }

    public bool EhAlerta(int quantidade) => CalcularNivel(quantidade) != "verde";

    public EstoqueLimitesResponse ObterLimites() => new()
    {
        LimiteLaranja = _cfg.LimiteLaranja,
        LimiteAmarelo = _cfg.LimiteAmarelo,
    };
}
