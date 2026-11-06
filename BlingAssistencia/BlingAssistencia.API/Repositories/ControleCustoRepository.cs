using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Infrastructure;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;

namespace MundoSmart.BlingAssistencia.API.Repositories;

public interface IControleCustoRepository
{
    Task EnsureIndexesAsync(CancellationToken cancellationToken = default);
    Task GarantirColaboradoresAsync(
        IReadOnlyList<(string Nome, string[] Setores, string? Cargo)> sementes,
        CancellationToken cancellationToken = default);
    Task<int> GarantirCustosIniciaisAsync(
        IReadOnlyList<ControleCustoModeloInicial.Custo> custos,
        CancellationToken cancellationToken = default);
    Task<List<ControleCustoColaboradorData>> ListarColaboradoresAsync(CancellationToken cancellationToken = default);
    Task<ControleCustoColaboradorData?> ObterColaboradorAsync(string id, CancellationToken cancellationToken = default);
    Task<ControleCustoColaboradorData> InserirColaboradorAsync(ControleCustoColaboradorData doc, CancellationToken cancellationToken = default);
    Task<ControleCustoColaboradorData?> AtualizarColaboradorAsync(ControleCustoColaboradorData doc, CancellationToken cancellationToken = default);
    Task<bool> ExcluirColaboradorAsync(string id, CancellationToken cancellationToken = default);
    Task<List<ControleCustoLancamentoData>> ListarLancamentosAsync(string competencia, CancellationToken cancellationToken = default);
    Task<List<ControleCustoLancamentoData>> ListarTodosAsync(CancellationToken cancellationToken = default);
    Task<ControleCustoLancamentoData> InserirLancamentoAsync(ControleCustoLancamentoData doc, CancellationToken cancellationToken = default);
    Task<bool> AtualizarLancamentoAsync(ControleCustoLancamentoData doc, CancellationToken cancellationToken = default);
    Task<ControleCustoLancamentoData?> ObterLancamentoAsync(string id, CancellationToken cancellationToken = default);
    Task SubstituirFaturamentoAsync(ControleCustoLancamentoData doc, CancellationToken cancellationToken = default);
    Task<bool> ExcluirLancamentoAsync(string id, CancellationToken cancellationToken = default);
}

public class ControleCustoRepository : IControleCustoRepository
{
    private readonly IMongoCollection<ControleCustoColaboradorData> _colaboradores;
    private readonly IMongoCollection<ControleCustoLancamentoData> _lancamentos;

    public ControleCustoRepository(MongoDbService mongo)
    {
        _colaboradores = mongo.GetCollection<ControleCustoColaboradorData>("controleCustoColaboradores");
        _lancamentos = mongo.GetCollection<ControleCustoLancamentoData>("controleCustoLancamentos");
    }

    public async Task EnsureIndexesAsync(CancellationToken cancellationToken = default)
    {
        await _colaboradores.Indexes.CreateOneAsync(
            new CreateIndexModel<ControleCustoColaboradorData>(
                Builders<ControleCustoColaboradorData>.IndexKeys.Ascending(x => x.Nome)),
            cancellationToken: cancellationToken);
        await _lancamentos.Indexes.CreateOneAsync(
            new CreateIndexModel<ControleCustoLancamentoData>(
                Builders<ControleCustoLancamentoData>.IndexKeys
                    .Ascending(x => x.Competencia)
                    .Ascending(x => x.Tipo)),
            cancellationToken: cancellationToken);
    }

    public async Task GarantirColaboradoresAsync(
        IReadOnlyList<(string Nome, string[] Setores, string? Cargo)> sementes,
        CancellationToken cancellationToken = default)
    {
        var existentes = await ListarColaboradoresAsync(cancellationToken);
        foreach (var (nome, setores, cargo) in sementes)
        {
            var funcao = string.IsNullOrWhiteSpace(cargo) ? null : cargo.Trim();
            var atual = existentes.FirstOrDefault(x => string.Equals(x.Nome, nome, StringComparison.OrdinalIgnoreCase));
            if (atual is null)
            {
                var doc = new ControleCustoColaboradorData
                {
                    Nome = nome,
                    Cargo = funcao,
                    Setores = setores.ToList(),
                    Ativo = true,
                    CriadoEm = DateTime.UtcNow,
                };
                await _colaboradores.InsertOneAsync(doc, cancellationToken: cancellationToken);
                existentes.Add(doc);
                continue;
            }

            if (string.IsNullOrWhiteSpace(atual.Cargo) && funcao is not null)
            {
                atual.Cargo = funcao;
                await AtualizarColaboradorAsync(atual, cancellationToken);
            }
        }
    }

    public async Task<int> GarantirCustosIniciaisAsync(
        IReadOnlyList<ControleCustoModeloInicial.Custo> custos,
        CancellationToken cancellationToken = default)
    {
        var filtroCusto = Builders<ControleCustoLancamentoData>.Filter.Eq(x => x.Tipo, ControleCustoCatalogo.Custo);
        if (await _lancamentos.CountDocumentsAsync(filtroCusto, cancellationToken: cancellationToken) > 0)
            return 0;

        var pessoas = await ListarColaboradoresAsync(cancellationToken);
        var inseridos = 0;
        foreach (var custo in custos)
        {
            var pessoa = string.IsNullOrWhiteSpace(custo.Colaborador)
                ? null
                : pessoas.FirstOrDefault(p => string.Equals(p.Nome, custo.Colaborador, StringComparison.OrdinalIgnoreCase));
            await _lancamentos.InsertOneAsync(new ControleCustoLancamentoData
            {
                Competencia = custo.Competencia,
                Tipo = ControleCustoCatalogo.Custo,
                Categoria = custo.Categoria,
                ColaboradorId = pessoa?.Id,
                ColaboradorNome = pessoa?.Nome,
                Descricao = custo.Descricao,
                Valor = custo.Valor,
                Recorrencia = custo.Recorrencia,
                Rateio = custo.Rateio.Select(r => new ControleCustoRateio
                {
                    Setor = r.Setor,
                    Percentual = r.Percentual,
                }).ToList(),
                CriadoEm = DateTime.UtcNow,
            }, cancellationToken: cancellationToken);
            inseridos++;
        }
        return inseridos;
    }

    public async Task<List<ControleCustoColaboradorData>> ListarColaboradoresAsync(CancellationToken cancellationToken = default)
    {
        return await _colaboradores.Find(FilterDefinition<ControleCustoColaboradorData>.Empty)
            .SortBy(x => x.Nome)
            .ToListAsync(cancellationToken);
    }

    public Task<ControleCustoColaboradorData?> ObterColaboradorAsync(string id, CancellationToken cancellationToken = default) =>
        _colaboradores.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task<ControleCustoColaboradorData> InserirColaboradorAsync(
        ControleCustoColaboradorData doc, CancellationToken cancellationToken = default)
    {
        await _colaboradores.InsertOneAsync(doc, cancellationToken: cancellationToken);
        return doc;
    }

    public async Task<ControleCustoColaboradorData?> AtualizarColaboradorAsync(
        ControleCustoColaboradorData doc, CancellationToken cancellationToken = default)
    {
        var result = await _colaboradores.ReplaceOneAsync(
            x => x.Id == doc.Id, doc, cancellationToken: cancellationToken);
        return result.MatchedCount == 0 ? null : doc;
    }

    public async Task<bool> ExcluirColaboradorAsync(string id, CancellationToken cancellationToken = default)
    {
        var result = await _colaboradores.DeleteOneAsync(x => x.Id == id, cancellationToken);
        return result.DeletedCount > 0;
    }

    public Task<List<ControleCustoLancamentoData>> ListarLancamentosAsync(
        string competencia, CancellationToken cancellationToken = default) =>
        _lancamentos.Find(x => x.Competencia == competencia)
            .SortByDescending(x => x.CriadoEm)
            .ToListAsync(cancellationToken);

    public Task<List<ControleCustoLancamentoData>> ListarTodosAsync(CancellationToken cancellationToken = default) =>
        _lancamentos.Find(FilterDefinition<ControleCustoLancamentoData>.Empty)
            .ToListAsync(cancellationToken);

    public async Task<ControleCustoLancamentoData> InserirLancamentoAsync(
        ControleCustoLancamentoData doc, CancellationToken cancellationToken = default)
    {
        await _lancamentos.InsertOneAsync(doc, cancellationToken: cancellationToken);
        return doc;
    }

    public async Task<bool> AtualizarLancamentoAsync(ControleCustoLancamentoData doc, CancellationToken cancellationToken = default)
    {
        var result = await _lancamentos.ReplaceOneAsync(x => x.Id == doc.Id, doc, cancellationToken: cancellationToken);
        return result.MatchedCount > 0;
    }

    public Task<ControleCustoLancamentoData?> ObterLancamentoAsync(string id, CancellationToken cancellationToken = default) =>
        _lancamentos.Find(x => x.Id == id).FirstOrDefaultAsync(cancellationToken)!;

    public async Task SubstituirFaturamentoAsync(ControleCustoLancamentoData doc, CancellationToken cancellationToken = default)
    {
        var filtro = Builders<ControleCustoLancamentoData>.Filter.Eq(x => x.Competencia, doc.Competencia)
            & Builders<ControleCustoLancamentoData>.Filter.Eq(x => x.Tipo, doc.Tipo)
            & Builders<ControleCustoLancamentoData>.Filter.Eq(x => x.Setor, doc.Setor);
        var existente = await _lancamentos.Find(filtro).FirstOrDefaultAsync(cancellationToken);
        if (existente is null)
        {
            await _lancamentos.InsertOneAsync(doc, cancellationToken: cancellationToken);
            return;
        }
        existente.Valor = doc.Valor;
        existente.Descricao = doc.Descricao;
        await _lancamentos.ReplaceOneAsync(x => x.Id == existente.Id, existente, cancellationToken: cancellationToken);
    }

    public async Task<bool> ExcluirLancamentoAsync(string id, CancellationToken cancellationToken = default)
    {
        var result = await _lancamentos.DeleteOneAsync(x => x.Id == id, cancellationToken);
        return result.DeletedCount > 0;
    }
}
