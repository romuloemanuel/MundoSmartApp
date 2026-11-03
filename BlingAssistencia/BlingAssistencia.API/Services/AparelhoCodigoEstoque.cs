using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IAparelhoCodigoEstoque
{
    Task AtribuirNaEntradaAsync(IReadOnlyList<AparelhoLojaData> novos, CancellationToken cancellationToken = default);
    Task CompletarFaltantesAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Código de estoque (N1, U1…) gerado só pelo sistema na entrada. Não aceita código informado.
/// </summary>
public sealed class AparelhoCodigoEstoque : IAparelhoCodigoEstoque
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private readonly IAparelhoLojaRepository _repo;

    public AparelhoCodigoEstoque(IAparelhoLojaRepository repo) => _repo = repo;

    public async Task CompletarFaltantesAsync(CancellationToken cancellationToken = default)
    {
        await Gate.WaitAsync(cancellationToken);
        try
        {
            await CompletarSemTravaAsync(cancellationToken);
        }
        finally
        {
            Gate.Release();
        }
    }

    public async Task AtribuirNaEntradaAsync(
        IReadOnlyList<AparelhoLojaData> novos,
        CancellationToken cancellationToken = default)
    {
        if (novos.Count == 0) return;
        await Gate.WaitAsync(cancellationToken);
        try
        {
            var todos = await CompletarSemTravaAsync(cancellationToken);
            var max = Maximos(todos);
            foreach (var aparelho in novos)
            {
                var letra = Letra(aparelho.Condicao);
                var numero = max[letra] + 1;
                max[letra] = numero;
                aparelho.Codigo = $"{letra}{numero}";
            }
        }
        finally
        {
            Gate.Release();
        }
    }

    private async Task<List<AparelhoLojaData>> CompletarSemTravaAsync(CancellationToken cancellationToken)
    {
        var todos = await _repo.ListarTodosAsync(cancellationToken);
        var max = Maximos(todos);
        var faltantes = todos
            .Where(a => EstaNaLoja(a.Status) && !TryLer(a.Codigo, out _, out _))
            .OrderBy(a => a.DataEntrada)
            .ThenBy(a => a.Id, StringComparer.Ordinal)
            .ToList();
        foreach (var aparelho in faltantes)
        {
            var letra = Letra(aparelho.Condicao);
            var numero = max[letra] + 1;
            max[letra] = numero;
            aparelho.Codigo = $"{letra}{numero}";
            await _repo.SalvarAparelhoAsync(aparelho, cancellationToken);
        }

        return todos;
    }

    private static Dictionary<char, int> Maximos(IEnumerable<AparelhoLojaData> aparelhos)
    {
        var max = new Dictionary<char, int> { ['N'] = 0, ['U'] = 0 };
        foreach (var aparelho in aparelhos)
        {
            if (!TryLer(aparelho.Codigo, out var letra, out var numero)) continue;
            if (numero > max[letra]) max[letra] = numero;
        }

        return max;
    }

    private static bool TryLer(string? codigo, out char letra, out int numero)
    {
        letra = 'U';
        numero = 0;
        if (string.IsNullOrWhiteSpace(codigo)) return false;
        var texto = codigo.Trim().ToUpperInvariant();
        if (texto.Length < 2 || (texto[0] != 'N' && texto[0] != 'U') || texto[1] == '0') return false;
        for (var i = 1; i < texto.Length; i++)
        {
            if (!char.IsDigit(texto[i])) return false;
        }

        if (!int.TryParse(texto.AsSpan(1), out numero) || numero < 1) return false;
        letra = texto[0];
        return true;
    }

    private static char Letra(string? condicao) =>
        string.Equals(condicao, AparelhoCondicao.Novo, StringComparison.OrdinalIgnoreCase) ? 'N' : 'U';

    private static bool EstaNaLoja(string status) =>
        status is AparelhoLojaStatus.EmEstoque or AparelhoLojaStatus.EmAssistencia;
}
