using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>Prioriza correspondência de busca e modelos cadastrados/atualizados mais recentemente.</summary>
public static class ModeloRelevanciaOrdenacao
{
    private const int BonusPrefixoNome = 120;
    private const int BonusPrefixoMarca = 100;
    private const int BonusContemTexto = 55;
    private const int BonusMarcaModelo = 45;
    private const int BonusSemTermo = 30;
    private const int MaxBonusRecencia = 50;
    private const int MaxBonusAtualizacao = 25;

    public static List<ModeloAparelho> Ordenar(IEnumerable<ModeloAparelho> modelos, string? termo, int limite)
    {
        var lista = modelos.ToList();
        if (lista.Count <= 1) return lista;

        var termoNorm = termo?.Trim();
        var ordenada = lista
            .Select(m => (Modelo: m, Score: CalcularScore(m, termoNorm)))
            .OrderByDescending(x => x.Score)
            .ThenByDescending(x => DataReferencia(x.Modelo))
            .ThenBy(x => x.Modelo.MarcaNome, StringComparer.OrdinalIgnoreCase)
            .ThenBy(x => x.Modelo.Nome, StringComparer.OrdinalIgnoreCase)
            .Select(x => x.Modelo)
            .Take(Math.Max(limite, 1))
            .ToList();

        return ordenada;
    }

    private static int CalcularScore(ModeloAparelho modelo, string? termo)
    {
        var score = 0;

        if (!string.IsNullOrWhiteSpace(termo))
        {
            var nome = modelo.Nome ?? string.Empty;
            var marca = modelo.MarcaNome ?? string.Empty;
            var rotulo = $"{marca} {nome}".Trim();

            if (nome.StartsWith(termo, StringComparison.OrdinalIgnoreCase))
                score += BonusPrefixoNome;
            else if (marca.StartsWith(termo, StringComparison.OrdinalIgnoreCase))
                score += BonusPrefixoMarca;
            else if (rotulo.Contains(termo, StringComparison.OrdinalIgnoreCase))
                score += BonusMarcaModelo;
            else if (nome.Contains(termo, StringComparison.OrdinalIgnoreCase)
                     || marca.Contains(termo, StringComparison.OrdinalIgnoreCase))
                score += BonusContemTexto;
        }
        else
        {
            score += BonusSemTermo;
        }

        score += CalcularBonusRecencia(DataReferencia(modelo));

        if (modelo.AtualizadoEm.HasValue && modelo.AtualizadoEm.Value > modelo.CriadoEm)
        {
            var diasDesdeAtualizacao = (DateTime.UtcNow - modelo.AtualizadoEm.Value).TotalDays;
            score += Math.Max(0, MaxBonusAtualizacao - (int)(diasDesdeAtualizacao / 20));
        }

        return score;
    }

    private static int CalcularBonusRecencia(DateTime dataReferencia)
    {
        var dias = Math.Max(0, (DateTime.UtcNow - dataReferencia).TotalDays);
        // Perde ~1 ponto a cada 20 dias — modelos muito antigos somem do topo.
        return Math.Max(0, MaxBonusRecencia - (int)(dias / 20));
    }

    private static DateTime DataReferencia(ModeloAparelho modelo)
    {
        if (modelo.CriadoEm != default) return modelo.CriadoEm;
        if (modelo.AtualizadoEm.HasValue) return modelo.AtualizadoEm.Value;
        return DateTime.UtcNow.AddYears(-12);
    }
}
