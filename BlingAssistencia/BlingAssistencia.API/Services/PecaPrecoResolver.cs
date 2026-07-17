using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

public static class PecaPrecoResolver
{
    public static (decimal? Troca, decimal? Minimo) Resolver(PecaEstoque peca, string? modeloId)
    {
        if (!string.IsNullOrWhiteSpace(modeloId))
        {
            var compat = peca.ModelosCompativeis
                .FirstOrDefault(m => m.ModeloId == modeloId);

            if (compat is not null)
            {
                return (
                    compat.ValorSugeridoTroca ?? peca.ValorSugeridoTroca,
                    compat.ValorSugeridoMinimo ?? peca.ValorSugeridoMinimo);
            }
        }

        return (peca.ValorSugeridoTroca, peca.ValorSugeridoMinimo);
    }
}
