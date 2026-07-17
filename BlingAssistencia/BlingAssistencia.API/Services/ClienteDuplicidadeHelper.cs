using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

internal static class ClienteDuplicidadeHelper
{
    public static ClienteDuplicadoVerificacao Para(ClienteLocalData? cliente) =>
        cliente is null
            ? new ClienteDuplicadoVerificacao { Existe = false }
            : new ClienteDuplicadoVerificacao
            {
                Existe = true,
                ClienteId = cliente.BlingId,
                ClienteNome = cliente.Nome
            };

    /// <summary>
    /// Telefones do cadastro principal (celular / telefone / telefone2).
    /// Contatos alternativos ficam de fora da unicidade — podem se repetir.
    /// </summary>
    public static IEnumerable<string> ColetarTelefones(BlingContato contato)
    {
        foreach (var tel in new[] { contato.Celular, contato.Telefone, contato.Telefone2 })
        {
            var d = ApenasDigitos(tel);
            if (d.Length >= 10) yield return d;
        }
    }

    public static ContatoAltSugestao SugestaoVazia { get; } = new() { Encontrado = false };

    public static ContatoAltSugestao ParaSugestaoAlt(
        string? nome,
        long? clienteId,
        bool eClientePrincipal) =>
        string.IsNullOrWhiteSpace(nome)
            ? SugestaoVazia
            : new ContatoAltSugestao
            {
                Encontrado = true,
                Nome = nome.Trim(),
                ClienteId = clienteId,
                EClientePrincipal = eClientePrincipal,
            };

    public static string ApenasDigitos(string? valor) =>
        string.IsNullOrWhiteSpace(valor) ? string.Empty : Regex.Replace(valor, @"\D", "");
}
