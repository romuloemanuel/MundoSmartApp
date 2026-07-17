using MongoDB.Bson;
using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using System.Text.RegularExpressions;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IClienteLocalRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task<ClienteLocalData?> ObterPorBlingIdAsync(long blingId);
    Task<ClienteLocalData?> ObterPorCpfCnpjAsync(string cpfCnpj, long? excluirBlingId = null);
    Task<ClienteLocalData?> ObterPorTelefoneAsync(string telefone, long? excluirBlingId = null);
    /// <summary>
    /// Busca nome sugerido para contato alternativo: prioriza cliente principal,
    /// depois nome de outro contato alternativo com o mesmo telefone.
    /// </summary>
    Task<(string? Nome, long? ClienteId, bool EClientePrincipal)?> SugerirContatoAltPorTelefoneAsync(string telefone);
    Task<List<ClienteLocalData>> ListarAsync(string? termo = null);
    Task SalvarAsync(ClienteLocalData dados);
    Task CorrigirIndiceCpfCnpjAsync();
}

public class ClienteLocalRepository : IClienteLocalRepository
{
    private readonly IMongoCollection<ClienteLocalData> _collection;
    private int _indexesReady;

    public ClienteLocalRepository(MongoDbService mongo)
    {
        _collection = mongo.GetCollection<ClienteLocalData>("cliente_local_data");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        if (Interlocked.CompareExchange(ref _indexesReady, 1, 0) != 0)
            return;

        var models = new[]
        {
            new CreateIndexModel<ClienteLocalData>(
                Builders<ClienteLocalData>.IndexKeys.Ascending(x => x.BlingId),
                new CreateIndexOptions { Unique = true }),
            new CreateIndexModel<ClienteLocalData>(
                Builders<ClienteLocalData>.IndexKeys.Ascending(x => x.CpfCnpj),
                new CreateIndexOptions { Unique = true, Sparse = true }),
            new CreateIndexModel<ClienteLocalData>(
                Builders<ClienteLocalData>.IndexKeys.Ascending(x => x.Nome)),
            new CreateIndexModel<ClienteLocalData>(
                Builders<ClienteLocalData>.IndexKeys.Descending(x => x.AtualizadoEm)),
        };

        await _collection.Indexes.CreateManyAsync(models, cancellationToken);
        await CorrigirIndiceCpfCnpjAsync();
    }

    public async Task CorrigirIndiceCpfCnpjAsync()
    {
        var semCpf = Builders<ClienteLocalData>.Filter.Or(
            Builders<ClienteLocalData>.Filter.Eq(x => x.CpfCnpj, null),
            Builders<ClienteLocalData>.Filter.Eq(x => x.CpfCnpj, string.Empty));
        await _collection.UpdateManyAsync(semCpf, Builders<ClienteLocalData>.Update.Unset("cpfCnpj"));
    }

    public async Task<ClienteLocalData?> ObterPorBlingIdAsync(long blingId) =>
        await _collection.Find(x => x.BlingId == blingId).FirstOrDefaultAsync();

    public async Task<ClienteLocalData?> ObterPorCpfCnpjAsync(string cpfCnpj, long? excluirBlingId = null)
    {
        var digitos = ApenasDigitos(cpfCnpj);
        var filtro = Builders<ClienteLocalData>.Filter.Eq(x => x.CpfCnpj, digitos);
        if (excluirBlingId.HasValue)
            filtro &= Builders<ClienteLocalData>.Filter.Ne(x => x.BlingId, excluirBlingId.Value);
        return await _collection.Find(filtro).FirstOrDefaultAsync();
    }

    public async Task<ClienteLocalData?> ObterPorTelefoneAsync(string telefone, long? excluirBlingId = null)
    {
        var digitos = ApenasDigitos(telefone);
        if (digitos.Length < 10) return null;

        // Unicidade só nos telefones do cadastro principal do cliente.
        var filtro = Builders<ClienteLocalData>.Filter.Or(
            Builders<ClienteLocalData>.Filter.Eq(x => x.Celular, digitos),
            Builders<ClienteLocalData>.Filter.Eq(x => x.Telefone, digitos),
            Builders<ClienteLocalData>.Filter.Eq(x => x.Telefone2, digitos));

        if (excluirBlingId.HasValue)
            filtro &= Builders<ClienteLocalData>.Filter.Ne(x => x.BlingId, excluirBlingId.Value);

        return await _collection.Find(filtro).FirstOrDefaultAsync();
    }

    public async Task<(string? Nome, long? ClienteId, bool EClientePrincipal)?> SugerirContatoAltPorTelefoneAsync(
        string telefone)
    {
        var digitos = ApenasDigitos(telefone);
        if (digitos.Length < 10) return null;

        var clientePrincipal = await ObterPorTelefoneAsync(digitos);
        if (clientePrincipal is not null && !string.IsNullOrWhiteSpace(clientePrincipal.Nome))
            return (clientePrincipal.Nome, clientePrincipal.BlingId, true);

        // Aceita máscara residual / 9º dígito / DDD semelhante (mesma busca flexível da lista).
        var flex = new BsonRegularExpression(RegexDigitosFlexivel(digitos));
        var filtroPrincipalFlex = Builders<ClienteLocalData>.Filter.Or(
            Builders<ClienteLocalData>.Filter.Regex(x => x.Celular, flex),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone, flex),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone2, flex));
        var porFlex = await _collection.Find(filtroPrincipalFlex).FirstOrDefaultAsync();
        if (porFlex is not null && !string.IsNullOrWhiteSpace(porFlex.Nome))
            return (porFlex.Nome, porFlex.BlingId, true);

        var filtroAlt = Builders<ClienteLocalData>.Filter.ElemMatch(
            x => x.Contatos,
            c => c.Celular == digitos || c.Telefone == digitos);

        var comAlt = await _collection.Find(filtroAlt).FirstOrDefaultAsync();
        if (comAlt is null)
        {
            // Fallback: percorre poucos candidatos da busca por telefone e olha contatos alt.
            var candidatos = await BuscarPorTelefoneAsync(digitos.Length >= 8 ? digitos[^8..] : digitos);
            foreach (var cand in candidatos)
            {
                var altFlex = cand.Contatos.FirstOrDefault(c =>
                    TelefoneCoincide(c.Celular, digitos) || TelefoneCoincide(c.Telefone, digitos));
                if (!string.IsNullOrWhiteSpace(altFlex?.Nome))
                    return (altFlex!.Nome, cand.BlingId, false);
            }
            return null;
        }

        var alt = comAlt.Contatos.FirstOrDefault(c =>
            TelefoneCoincide(c.Celular, digitos) || TelefoneCoincide(c.Telefone, digitos));

        var nome = alt?.Nome;
        if (string.IsNullOrWhiteSpace(nome)) return null;
        return (nome, comAlt.BlingId, false);
    }

    private static bool TelefoneCoincide(string? salvo, string digitado)
    {
        var a = ApenasDigitos(salvo ?? "");
        var b = ApenasDigitos(digitado);
        if (a.Length < 8 || b.Length < 8) return false;
        if (a == b) return true;
        // Compara os últimos 8 dígitos (ignora DDD/9º dígito divergente).
        return a[^8..] == b[^8..];
    }

    public async Task<List<ClienteLocalData>> ListarAsync(string? termo = null)
    {
        if (string.IsNullOrWhiteSpace(termo))
            return await _collection.Find(_ => true)
                .SortByDescending(x => x.AtualizadoEm)
                .Limit(50)
                .ToListAsync();

        var t = termo.Trim();
        var digitos = ApenasDigitos(t);
        var buscaNumerica = digitos.Length >= 3 && digitos.Length >= Math.Max(3, (int)(t.Length * 0.55));

        if (!buscaNumerica)
        {
            var porNome = await BuscarPorNomePrefixoAsync(t);
            if (porNome.Count > 0)
                return porNome;
        }

        if (digitos.Length >= 3)
        {
            var porDocumento = await BuscarPorCpfCnpjAsync(digitos);
            if (porDocumento.Count > 0)
                return porDocumento;

            var porTelefone = await BuscarPorTelefoneAsync(digitos);
            if (porTelefone.Count > 0)
                return porTelefone;
        }

        if (buscaNumerica)
        {
            var porNome = await BuscarPorNomePrefixoAsync(t);
            if (porNome.Count > 0)
                return porNome;
        }

        return await BuscarAmplaAsync(t, digitos);
    }

    private async Task<List<ClienteLocalData>> BuscarPorNomePrefixoAsync(string termo)
    {
        var prefixo = new BsonRegularExpression($"^{Regex.Escape(termo)}", "i");
        return await _collection.Find(
                Builders<ClienteLocalData>.Filter.Regex(x => x.Nome, prefixo))
            .Limit(20)
            .ToListAsync();
    }

    private async Task<List<ClienteLocalData>> BuscarPorCpfCnpjAsync(string digitos)
    {
        var prefixoDoc = new BsonRegularExpression($"^{Regex.Escape(digitos)}");
        return await _collection.Find(
                Builders<ClienteLocalData>.Filter.Regex(x => x.CpfCnpj, prefixoDoc))
            .Limit(20)
            .ToListAsync();
    }

    private async Task<List<ClienteLocalData>> BuscarPorTelefoneAsync(string digitos)
    {
        var flex = new BsonRegularExpression(RegexDigitosFlexivel(digitos));
        var filtro = Builders<ClienteLocalData>.Filter.Or(
            Builders<ClienteLocalData>.Filter.Regex(x => x.Celular, flex),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone, flex),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone2, flex));

        return await _collection.Find(filtro).Limit(20).ToListAsync();
    }

    private async Task<List<ClienteLocalData>> BuscarAmplaAsync(string termo, string digitos)
    {
        var regexTexto = new BsonRegularExpression(Regex.Escape(termo), "i");
        var filtros = new List<FilterDefinition<ClienteLocalData>>
        {
            Builders<ClienteLocalData>.Filter.Regex(x => x.Fantasia, regexTexto),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Email, regexTexto),
            Builders<ClienteLocalData>.Filter.Regex(x => x.Nome, regexTexto),
        };

        if (digitos.Length >= 3)
        {
            var prefixoDoc = new BsonRegularExpression($"^{Regex.Escape(digitos)}");
            var flex = new BsonRegularExpression(RegexDigitosFlexivel(digitos));
            filtros.Add(Builders<ClienteLocalData>.Filter.Regex(x => x.CpfCnpj, prefixoDoc));
            filtros.Add(Builders<ClienteLocalData>.Filter.Regex(x => x.Celular, flex));
            filtros.Add(Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone, flex));
            filtros.Add(Builders<ClienteLocalData>.Filter.Regex(x => x.Telefone2, flex));
        }

        return await _collection.Find(Builders<ClienteLocalData>.Filter.Or(filtros))
            .SortByDescending(x => x.AtualizadoEm)
            .Limit(20)
            .ToListAsync();
    }

    public async Task SalvarAsync(ClienteLocalData dados)
    {
        dados.AtualizadoEm = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(dados.CpfCnpj))
            dados.CpfCnpj = ApenasDigitos(dados.CpfCnpj);
        else
            dados.CpfCnpj = null;

        dados.Celular = NormalizarTelefone(dados.Celular);
        dados.Telefone = NormalizarTelefone(dados.Telefone);
        dados.Telefone2 = NormalizarTelefone(dados.Telefone2);
        foreach (var c in dados.Contatos)
        {
            c.Celular = NormalizarTelefone(c.Celular);
            c.Telefone = NormalizarTelefone(c.Telefone);
        }

        if (string.IsNullOrWhiteSpace(dados.MongoId))
        {
            var existente = await ObterPorBlingIdAsync(dados.BlingId);
            if (!string.IsNullOrWhiteSpace(existente?.MongoId))
                dados.MongoId = existente.MongoId;
            else if (existente is not null)
                dados.CriadoEm = existente.CriadoEm == default ? DateTime.UtcNow : existente.CriadoEm;
        }

        if (string.IsNullOrWhiteSpace(dados.MongoId))
        {
            dados.MongoId = ObjectId.GenerateNewId().ToString();
            if (dados.CriadoEm == default)
                dados.CriadoEm = DateTime.UtcNow;
            await _collection.InsertOneAsync(dados);
            return;
        }

        var filtro = Builders<ClienteLocalData>.Filter.Eq(x => x.MongoId, dados.MongoId);
        var atualizado = await _collection.ReplaceOneAsync(filtro, dados, new ReplaceOptions { IsUpsert = true });
        if (atualizado.MatchedCount == 0)
        {
            await _collection.ReplaceOneAsync(
                Builders<ClienteLocalData>.Filter.Eq(x => x.BlingId, dados.BlingId),
                dados,
                new ReplaceOptions { IsUpsert = true });
        }
    }

    /// <summary>Ex.: "11999" encontra "(11) 99999-0000".</summary>
    private static string RegexDigitosFlexivel(string digitos) =>
        string.Join(@"\D*", digitos.Select(c => Regex.Escape(c.ToString())));

    private static string ApenasDigitos(string valor) =>
        Regex.Replace(valor, @"\D", "");

    private static string? NormalizarTelefone(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor)) return null;
        var d = ApenasDigitos(valor);
        return d.Length > 0 ? d : null;
    }
}
