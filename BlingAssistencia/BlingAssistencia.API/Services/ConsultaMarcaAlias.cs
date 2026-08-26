using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>Atalhos de balcão: SM → Samsung, MT → Motorola, MI → Poco/Redmi.</summary>
public static class ConsultaMarcaAlias
{
    private sealed record Alias(string[] Marcas, string[]? Linhas);

    private static readonly Dictionary<string, Alias> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["sm"] = new(["samsung", "galaxy"], null),
        ["mt"] = new(["motorola", "moto"], null),
        ["mi"] = new(["xiaomi", "poco", "redmi"], ["poco", "redmi", "note"]),
    };

    public static bool TryResolver(string? termo, out string[] marcas, out string[]? linhas, out string resto)
    {
        marcas = [];
        linhas = null;
        resto = "";
        var t = (termo ?? "").Trim();
        if (t.Length == 0) return false;

        var partes = t.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (partes.Length == 0 || !Aliases.TryGetValue(partes[0], out var alias))
            return false;

        marcas = alias.Marcas;
        linhas = alias.Linhas;
        resto = partes.Length > 1 ? string.Join(' ', partes.Skip(1)) : "";
        return true;
    }

    public static bool TextoCombina(string haystackNormalizado, string termoNormalizado)
    {
        if (string.IsNullOrEmpty(termoNormalizado)) return true;
        var hay = haystackNormalizado ?? "";
        var hayCompact = hay.Replace(" ", "");

        if (!TryResolver(termoNormalizado, out var marcas, out var linhas, out var resto))
            return false;

        if (!marcas.Any(m => hay.Contains(m, StringComparison.Ordinal) || hayCompact.Contains(m, StringComparison.Ordinal)))
            return false;

        if (linhas is { Length: > 0 }
            && !linhas.Any(l => hay.Contains(l, StringComparison.Ordinal) || hayCompact.Contains(l, StringComparison.Ordinal)))
            return false;

        if (string.IsNullOrEmpty(resto)) return true;

        var tokens = resto.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tokens.All(tok =>
            hay.Contains(tok, StringComparison.Ordinal)
            || hayCompact.Contains(tok.Replace(" ", ""), StringComparison.Ordinal));
    }

    public static FilterDefinition<ModeloAparelho> FiltroModelos(string[] marcas, string[]? linhas, string resto)
    {
        var marcaFiltro = Builders<ModeloAparelho>.Filter.Or(marcas.Select(m =>
        {
            var rx = new BsonRegularExpression(Regex.Escape(m), "i");
            return Builders<ModeloAparelho>.Filter.Or(
                Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, rx),
                Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, rx));
        }));

        var filtro = marcaFiltro;
        if (linhas is { Length: > 0 })
        {
            var linhaFiltro = Builders<ModeloAparelho>.Filter.Or(linhas.Select(l =>
            {
                var rx = new BsonRegularExpression(Regex.Escape(l), "i");
                return Builders<ModeloAparelho>.Filter.Or(
                    Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, rx),
                    Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, rx));
            }));
            filtro = Builders<ModeloAparelho>.Filter.And(filtro, linhaFiltro);
        }

        if (!string.IsNullOrWhiteSpace(resto))
        {
            var rxResto = new BsonRegularExpression(Regex.Escape(resto.Trim()), "i");
            filtro = Builders<ModeloAparelho>.Filter.And(filtro,
                Builders<ModeloAparelho>.Filter.Or(
                    Builders<ModeloAparelho>.Filter.Regex(x => x.Nome, rxResto),
                    Builders<ModeloAparelho>.Filter.Regex(x => x.MarcaNome, rxResto)));
        }

        return filtro;
    }
}
