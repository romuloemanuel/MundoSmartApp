using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace MundoSmart.BlingAssistencia.API.Models.Mongo;

public static class AppRoles
{
    public const string Root = "Root";
    public const string Admin = "Admin";
    public const string Operador = "Operador";

    public static readonly string[] Todas = [Root, Admin, Operador];
    /// <summary>Para [Authorize(Roles = …)] — Root herda privilégios de Admin.</summary>
    public const string AdminOuRoot = $"{Root},{Admin}";
    public const string SomenteRoot = Root;

    public static bool EhValida(string? role) =>
        !string.IsNullOrWhiteSpace(role)
        && Todas.Contains(role.Trim(), StringComparer.OrdinalIgnoreCase);

    /// <summary>Roles atribuíveis na tela de usuários (Root só via seed).</summary>
    public static bool EhAtribuivel(string? role)
    {
        var r = (role ?? "").Trim();
        return string.Equals(r, Admin, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r, Operador, StringComparison.OrdinalIgnoreCase);
    }

    public static string Normalizar(string? role)
    {
        var r = (role ?? "").Trim();
        if (string.Equals(r, Root, StringComparison.OrdinalIgnoreCase)) return Root;
        if (string.Equals(r, Admin, StringComparison.OrdinalIgnoreCase)) return Admin;
        return Operador;
    }

    public static bool EhRoot(string? role) =>
        string.Equals(role?.Trim(), Root, StringComparison.OrdinalIgnoreCase);

    public static bool EhAdminOuRoot(string? role) =>
        EhRoot(role) || string.Equals(role?.Trim(), Admin, StringComparison.OrdinalIgnoreCase);
}

public class UsuarioData
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("usuario")]
    public string Usuario { get; set; } = string.Empty;

    [BsonElement("nome")]
    public string Nome { get; set; } = string.Empty;

    [BsonElement("senhaHash")]
    public string SenhaHash { get; set; } = string.Empty;

    [BsonElement("role")]
    public string Role { get; set; } = AppRoles.Operador;

    [BsonElement("ativo")]
    public bool Ativo { get; set; } = true;

    /// <summary>Opcional — vincula ao cadastro de técnicos para comissão.</summary>
    [BsonElement("tecnicoId")]
    public string? TecnicoId { get; set; }

    /// <summary>
    /// Se preenchida, o usuário só pode criar OS dessa loja.
    /// Continua podendo listar/ver OS de todas as lojas (ex.: fila do dia).
    /// Root/Admin normalmente ficam sem loja (sem restrição).
    /// </summary>
    [BsonElement("lojaOrigem")]
    public string? LojaOrigem { get; set; }

    [BsonElement("tentativasLoginFalhas")]
    public int TentativasLoginFalhas { get; set; }

    [BsonElement("bloqueadoAte")]
    public DateTime? BloqueadoAte { get; set; }

    [BsonElement("ultimoLoginEm")]
    public DateTime? UltimoLoginEm { get; set; }

    [BsonElement("criadoEm")]
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    [BsonElement("atualizadoEm")]
    public DateTime? AtualizadoEm { get; set; }

    [BsonElement("deveTrocarSenha")]
    public bool DeveTrocarSenha { get; set; }
}
