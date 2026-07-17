using System.Security.Claims;

namespace MundoSmart.BlingAssistencia.API.Config;

/// <summary>
/// Restrição de <b>criação/edição</b> por loja via claim JWT <c>lojaOrigem</c>.
/// Sem claim (Admin/Root) → cria em qualquer loja; com claim → só a loja vinculada.
/// Leitura da lista/detalhe de OS é aberta (ver ocupação da assistência / prazos).
/// Só Mococa tem assistência técnica; demais lojas criam OS e enviam para lá.
/// </summary>
public static class LojaAcessoHelper
{
    public const string ClaimName = "lojaOrigem";

    /// <summary>Loja vinculada do usuário, ou null se pode operar em todas.</summary>
    public static string? ObterLojaRestrita(ClaimsPrincipal? user)
    {
        var raw = user?.FindFirstValue(ClaimName);
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return OsLojaHelper.Normalizar(raw);
    }

    public static bool TemRestricao(ClaimsPrincipal? user) =>
        ObterLojaRestrita(user) != null;

    /// <summary>
    /// Na criação: força a loja do usuário se restrito; senão normaliza (vazio → padrão MCC).
    /// </summary>
    public static string AplicarNaCriacao(ClaimsPrincipal? user, string? lojaEnviada)
    {
        var restrita = ObterLojaRestrita(user);
        if (restrita is null)
            return OsLojaHelper.Normalizar(lojaEnviada);

        var enviada = string.IsNullOrWhiteSpace(lojaEnviada)
            ? restrita
            : OsLojaHelper.Normalizar(lojaEnviada);

        if (!string.Equals(enviada, restrita, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException(
                $"Seu usuário só pode cadastrar na loja {restrita}.");
        }

        return restrita;
    }

    /// <summary>Garante que a entidade pertence à assistência do usuário (leitura/edição).</summary>
    public static void GarantirAcesso(ClaimsPrincipal? user, string? lojaEntidade, string recurso = "este registro")
    {
        var restrita = ObterLojaRestrita(user);
        if (restrita is null) return;

        var loja = OsLojaHelper.Normalizar(lojaEntidade);
        if (!string.Equals(loja, restrita, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException(
                $"Sem permissão para acessar {recurso} de outra loja.");
        }
    }

    /// <summary>
    /// Se o usuário é restrito, o filtro de loja é forçado para a dele.
    /// Senão, mantém o filtro opcional enviado pelo cliente.
    /// </summary>
    public static string? ForcarFiltroLista(ClaimsPrincipal? user, string? filtroCliente)
    {
        var restrita = ObterLojaRestrita(user);
        return restrita ?? (string.IsNullOrWhiteSpace(filtroCliente)
            ? null
            : OsLojaHelper.Normalizar(filtroCliente));
    }

    public static bool PertenceALoja(string? lojaEntidade, string lojaPermitida)
    {
        return string.Equals(
            OsLojaHelper.Normalizar(lojaEntidade),
            OsLojaHelper.Normalizar(lojaPermitida),
            StringComparison.OrdinalIgnoreCase);
    }
}
