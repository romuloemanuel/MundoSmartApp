using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IControleCustoService
{
    Task<ControleCustoPainel> PainelAsync(string? competencia, CancellationToken cancellationToken = default);
    Task<ControleCustoComparativo> ComparativoAsync(string? ate, int quantidade = 6, CancellationToken cancellationToken = default);
    Task<List<ControleCustoLancamentoData>> ListarContasFixasAsync(CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> SalvarColaboradorAsync(string? id, string? nome, string? cargo, IEnumerable<string>? setores, string? competencia, CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> ExcluirColaboradorAsync(string id, string? competencia, CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> SalvarFaturamentoAsync(string? competencia, string? setor, decimal valor, CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> LancarCustoAsync(CustoControleRequest req, CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> AtualizarCustoAsync(string id, CustoControleRequest req, string? competenciaVista, CancellationToken cancellationToken = default);
    Task<int> ReclassificarTrafegoPagoAsync(CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> LancarReinvestimentoAsync(ReinvestimentoControleRequest req, CancellationToken cancellationToken = default);
    Task<ControleCustoPainel> ExcluirLancamentoAsync(string id, string? competencia, CancellationToken cancellationToken = default);
}

public class CustoControleRequest
{
    public string? Competencia { get; set; }
    public string? Categoria { get; set; }
    public string? ColaboradorId { get; set; }
    public string? Descricao { get; set; }
    public decimal Valor { get; set; }
    public string? Recorrencia { get; set; }
    public int? Meses { get; set; }
    public List<ControleCustoRateio>? Rateio { get; set; }
}

public class ReinvestimentoControleRequest
{
    public string? Competencia { get; set; }
    public string? Setor { get; set; }
    public string? Descricao { get; set; }
    public decimal Valor { get; set; }
    public string? Recorrencia { get; set; }
    public int? Meses { get; set; }
}

public class ControleCustoService : IControleCustoService
{
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");
    private readonly IControleCustoRepository _repo;
    private readonly IOsLocalRepository _os;
    private readonly IEstoqueLoteService _estoque;
    private readonly IComissaoOrigemService _comissao;

    public ControleCustoService(
        IControleCustoRepository repo,
        IOsLocalRepository os,
        IEstoqueLoteService estoque,
        IComissaoOrigemService comissao)
    {
        _repo = repo;
        _os = os;
        _estoque = estoque;
        _comissao = comissao;
    }

    public Task<ControleCustoPainel> PainelAsync(string? competencia, CancellationToken cancellationToken = default)
    {
        var mes = ExigirCompetencia(competencia);
        return MontarPainelAsync(mes, cancellationToken);
    }

    public async Task<ControleCustoComparativo> ComparativoAsync(
        string? ate, int quantidade = 6, CancellationToken cancellationToken = default)
    {
        var fim = string.IsNullOrWhiteSpace(ate) ? MesAtual() : ExigirCompetencia(ate);
        if (string.CompareOrdinal(fim, MesAtual()) > 0)
            throw new ArgumentException("A comparação vai até o mês atual.");
        if (quantidade < 2) quantidade = 2;
        if (quantidade > 12) quantidade = 12;

        var meses = new List<string>(quantidade);
        for (var i = quantidade - 1; i >= 0; i--)
            meses.Add(RetrocederMes(fim, i));

        var todos = await _repo.ListarTodosAsync(cancellationToken);
        var custos = new decimal[quantidade];
        var reinvestimento = new decimal[quantidade];
        var porCategoria = ControleCustoCatalogo.Categorias.ToDictionary(c => c, _ => new decimal[quantidade]);
        var porSetor = ControleCustoCatalogo.Setores.ToDictionary(s => s.Id, _ => new decimal[quantidade]);

        for (var i = 0; i < meses.Count; i++)
        {
            foreach (var item in AplicarNoMes(todos, meses[i]))
            {
                if (item.Tipo == ControleCustoCatalogo.Reinvestimento)
                {
                    reinvestimento[i] = Dinheiro(reinvestimento[i] + item.ValorNoMes);
                    continue;
                }
                if (item.Tipo != ControleCustoCatalogo.Custo) continue;
                var valor = item.ValorNoMes;
                custos[i] = Dinheiro(custos[i] + valor);
                var categoria = porCategoria.ContainsKey(item.Categoria ?? "")
                    ? item.Categoria!
                    : ControleCustoCatalogo.CategoriaOutro;
                porCategoria[categoria][i] = Dinheiro(porCategoria[categoria][i] + valor);
                foreach (var (setor, parte) in Alocar(valor, item.Rateio))
                {
                    if (porSetor.ContainsKey(setor))
                        porSetor[setor][i] = Dinheiro(porSetor[setor][i] + parte);
                }
            }
        }

        var linhas = new List<ControleCustoComparativoLinha>
        {
            LinhaComparativo("custos", "Custos", "total", custos),
            LinhaComparativo("reinvestimento", "Reinvestimento", "total", reinvestimento),
        };
        foreach (var categoria in ControleCustoCatalogo.Categorias)
        {
            if (porCategoria[categoria].All(v => v == 0)) continue;
            linhas.Add(LinhaComparativo(categoria, ControleCustoCatalogo.NomeCategoria(categoria), "categoria", porCategoria[categoria]));
        }
        foreach (var (id, nome) in ControleCustoCatalogo.Setores)
            linhas.Add(LinhaComparativo(id, nome, "setor", porSetor[id]));

        return new ControleCustoComparativo { Ate = fim, Meses = meses, Linhas = linhas };
    }

    public async Task<List<ControleCustoLancamentoData>> ListarContasFixasAsync(CancellationToken cancellationToken = default)
    {
        var todos = await _repo.ListarTodosAsync(cancellationToken);
        return todos
            .Where(x => x.Tipo == ControleCustoCatalogo.Custo
                && x.Recorrencia == ControleCustoCatalogo.RecorrenciaFixo)
            .OrderBy(x => x.Descricao)
            .ToList();
    }

    public async Task<ControleCustoPainel> SalvarColaboradorAsync(
        string? id, string? nome, string? cargo, IEnumerable<string>? setores, string? competencia, CancellationToken cancellationToken = default)
    {
        var n = (nome ?? "").Trim();
        if (n.Length < 2) throw new ArgumentException("Informe o nome do colaborador.");
        var funcao = (cargo ?? "").Trim();
        if (funcao.Length > 40) throw new ArgumentException("O cargo pode ter no máximo 40 caracteres.");
        var lista = NormalizarSetores(setores);
        if (lista.Count == 0) throw new ArgumentException("Escolha ao menos um setor.");

        var todos = await _repo.ListarColaboradoresAsync(cancellationToken);
        if (todos.Any(x => x.Id != id && string.Equals(x.Nome, n, StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Já existe um colaborador com este nome.");

        if (string.IsNullOrWhiteSpace(id))
        {
            await _repo.InserirColaboradorAsync(new ControleCustoColaboradorData
            {
                Nome = n,
                Cargo = funcao.Length == 0 ? null : funcao,
                Setores = lista,
                Ativo = true,
                CriadoEm = DateTime.UtcNow,
            }, cancellationToken);
        }
        else
        {
            var atual = await _repo.ObterColaboradorAsync(id, cancellationToken)
                ?? throw new KeyNotFoundException("Colaborador não encontrado.");
            atual.Nome = n;
            atual.Cargo = funcao.Length == 0 ? null : funcao;
            atual.Setores = lista;
            atual.Ativo = true;
            await _repo.AtualizarColaboradorAsync(atual, cancellationToken);
        }

        var mes = string.IsNullOrWhiteSpace(competencia) ? MesAtual() : ExigirCompetencia(competencia);
        return await MontarPainelAsync(mes, cancellationToken);
    }

    public async Task<ControleCustoPainel> ExcluirColaboradorAsync(
        string id, string? competencia, CancellationToken cancellationToken = default)
    {
        if (!await _repo.ExcluirColaboradorAsync(id, cancellationToken))
            throw new KeyNotFoundException("Colaborador não encontrado.");
        return await MontarPainelAsync(ExigirCompetencia(competencia), cancellationToken);
    }

    public Task<ControleCustoPainel> SalvarFaturamentoAsync(
        string? competencia, string? setor, decimal valor, CancellationToken cancellationToken = default)
    {
        ExigirCompetencia(competencia);
        ExigirSetor(setor);
        _ = valor;
        _ = cancellationToken;
        throw new ArgumentException("O lucro líquido vem do cenário do setor e não é digitado.");
    }

    public async Task<ControleCustoPainel> LancarCustoAsync(CustoControleRequest req, CancellationToken cancellationToken = default)
    {
        var novo = await PrepararCustoAsync(req, cancellationToken);
        var todos = await _repo.ListarTodosAsync(cancellationToken);
        await ValidarContraReinvestimentoAsync(novo, todos, cancellationToken);
        await _repo.InserirLancamentoAsync(novo, cancellationToken);
        return await MontarPainelAsync(novo.Competencia, cancellationToken);
    }

    public async Task<ControleCustoPainel> AtualizarCustoAsync(
        string id, CustoControleRequest req, string? competenciaVista, CancellationToken cancellationToken = default)
    {
        var atual = await _repo.ObterLancamentoAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Custo não encontrado.");
        if (atual.Tipo != ControleCustoCatalogo.Custo)
            throw new ArgumentException("Só é possível editar um custo.");

        var novo = await PrepararCustoAsync(req, cancellationToken);
        novo.Id = atual.Id;
        novo.CriadoEm = atual.CriadoEm;
        var todos = await _repo.ListarTodosAsync(cancellationToken);
        await ValidarContraReinvestimentoAsync(novo, todos, cancellationToken);
        if (!await _repo.AtualizarLancamentoAsync(novo, cancellationToken))
            throw new KeyNotFoundException("Custo não encontrado.");

        var mes = string.IsNullOrWhiteSpace(competenciaVista) ? novo.Competencia : ExigirCompetencia(competenciaVista);
        return await MontarPainelAsync(mes, cancellationToken);
    }

    public async Task<int> ReclassificarTrafegoPagoAsync(CancellationToken cancellationToken = default)
    {
        var ajustados = 0;
        foreach (var doc in await _repo.ListarTodosAsync(cancellationToken))
        {
            if (doc.Tipo != ControleCustoCatalogo.Custo) continue;
            if (doc.Categoria == ControleCustoCatalogo.CategoriaTrafegoPago) continue;
            if (doc.Categoria is not (null or "" or ControleCustoCatalogo.CategoriaOutro)) continue;
            if (!DescricaoEhTrafegoPago(doc.Descricao)) continue;
            doc.Categoria = ControleCustoCatalogo.CategoriaTrafegoPago;
            doc.Descricao = "Tráfego pago";
            if (await _repo.AtualizarLancamentoAsync(doc, cancellationToken))
                ajustados++;
        }
        return ajustados;
    }

    private async Task<ControleCustoLancamentoData> PrepararCustoAsync(CustoControleRequest req, CancellationToken cancellationToken)
    {
        var mes = ExigirMesLancavel(req.Competencia);
        var categoria = (req.Categoria ?? "").Trim().ToLowerInvariant();
        if (!ControleCustoCatalogo.Categorias.Contains(categoria))
            throw new ArgumentException("Escolha o tipo de custo.");
        var valor = Dinheiro(req.Valor);
        if (valor <= 0) throw new ArgumentException("Informe o valor do custo.");

        string? colaboradorId = null;
        string? colaboradorNome = null;
        if (categoria == ControleCustoCatalogo.CategoriaColaborador)
        {
            if (string.IsNullOrWhiteSpace(req.ColaboradorId))
                throw new ArgumentException("Escolha o colaborador.");
            var pessoa = await _repo.ObterColaboradorAsync(req.ColaboradorId, cancellationToken)
                ?? throw new ArgumentException("Colaborador não encontrado.");
            colaboradorId = pessoa.Id;
            colaboradorNome = pessoa.Nome;
        }

        var recorrencia = ControleCustoRecorrencia.Normalizar(req.Recorrencia, req.Meses, out var quantidade);
        var descricao = (req.Descricao ?? "").Trim();
        if (string.IsNullOrEmpty(descricao))
            descricao = colaboradorNome ?? ControleCustoCatalogo.NomeCategoria(categoria);

        return new ControleCustoLancamentoData
        {
            Competencia = mes,
            Tipo = ControleCustoCatalogo.Custo,
            Categoria = categoria,
            ColaboradorId = colaboradorId,
            ColaboradorNome = colaboradorNome,
            Descricao = descricao,
            Valor = valor,
            Recorrencia = recorrencia,
            Meses = quantidade > 0 ? quantidade : null,
            Rateio = NormalizarRateio(req.Rateio),
            CriadoEm = DateTime.UtcNow,
        };
    }

    private async Task ValidarContraReinvestimentoAsync(
        ControleCustoLancamentoData custo,
        IEnumerable<ControleCustoLancamentoData> existentes,
        CancellationToken cancellationToken)
    {
        var baseLista = existentes.Where(x => x.Id != custo.Id).ToList();
        var cenarios = new Dictionary<string, Dictionary<string, decimal>>(StringComparer.Ordinal);
        foreach (var mesAtingido in ControleCustoRecorrencia.MesesDaSerie(custo.Competencia, custo.Recorrencia, custo.Meses ?? 0))
        {
            var doMes = AplicarNoMes(baseLista, mesAtingido);
            ControleCustoRecorrencia.PreencherExibicao(custo, mesAtingido);
            var comNovo = doMes.Append(custo).ToList();
            foreach (var (setor, _) in Alocar(custo.ValorNoMes, custo.Rateio))
            {
                var lucroDepois = await ResultadoDoSetorAsync(comNovo, mesAtingido, setor, cenarios, cancellationToken);
                var reinvestido = Soma(comNovo, ControleCustoCatalogo.Reinvestimento, setor);
                if (reinvestido > 0 && lucroDepois + 0.009m < reinvestido)
                {
                    throw new ArgumentException(
                        $"Esse custo deixa o resultado de {ControleCustoCatalogo.NomeSetor(setor)} em {mesAtingido} ({Moeda(lucroDepois)}) abaixo do reinvestimento já lançado ({Moeda(reinvestido)}).");
                }
            }
        }
    }

    private static bool DescricaoEhTrafegoPago(string? descricao)
    {
        var texto = NormalizarTexto(descricao);
        return texto is "trafego" or "tragego" or "trafego pago";
    }

    private static string NormalizarTexto(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return "";
        var semAcento = texto.Trim().Normalize(NormalizationForm.FormD);
        var limpo = new string(semAcento.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray());
        return limpo.ToLowerInvariant();
    }

    public async Task<ControleCustoPainel> LancarReinvestimentoAsync(
        ReinvestimentoControleRequest req, CancellationToken cancellationToken = default)
    {
        var mes = ExigirMesLancavel(req.Competencia);
        var setor = ExigirSetor(req.Setor);
        var valor = Dinheiro(req.Valor);
        if (valor <= 0) throw new ArgumentException("Informe o valor do reinvestimento.");
        var descricao = (req.Descricao ?? "").Trim();
        if (descricao.Length < 2) throw new ArgumentException("Descreva em que o valor foi reinvestido.");

        var plano = string.Equals(req.Recorrencia, ControleCustoCatalogo.RecorrenciaMensal, StringComparison.OrdinalIgnoreCase);
        int? meses = null;
        if (plano)
        {
            if (req.Meses is not (>= 1 and <= 60))
                throw new ArgumentException("Informe de 1 a 60 meses para o plano.");
            meses = req.Meses;
        }

        var lancamentos = await CarregarMesAsync(mes, cancellationToken);
        if (!plano)
        {
            var cenarios = new Dictionary<string, Dictionary<string, decimal>>(StringComparer.Ordinal);
            var disponivel = await ResultadoDoSetorAsync(lancamentos, mes, setor, cenarios, cancellationToken)
                - Soma(lancamentos, ControleCustoCatalogo.Reinvestimento, setor);
            if (valor > disponivel + 0.009m)
            {
                throw new ArgumentException(
                    $"O reinvestimento passa do lucro disponível de {ControleCustoCatalogo.NomeSetor(setor)} ({Moeda(Math.Max(0, disponivel))}).");
            }
        }

        await _repo.InserirLancamentoAsync(new ControleCustoLancamentoData
        {
            Competencia = mes,
            Tipo = ControleCustoCatalogo.Reinvestimento,
            Setor = setor,
            Descricao = descricao,
            Valor = valor,
            Recorrencia = plano ? ControleCustoCatalogo.RecorrenciaMensal : ControleCustoCatalogo.RecorrenciaUnico,
            Meses = meses,
            CriadoEm = DateTime.UtcNow,
        }, cancellationToken);

        return await MontarPainelAsync(mes, cancellationToken);
    }

    public async Task<ControleCustoPainel> ExcluirLancamentoAsync(
        string id, string? competencia, CancellationToken cancellationToken = default)
    {
        var doc = await _repo.ObterLancamentoAsync(id, cancellationToken)
            ?? throw new KeyNotFoundException("Lançamento não encontrado.");
        if (doc.Tipo == ControleCustoCatalogo.Faturamento)
            throw new ArgumentException("O faturamento se altera no card do setor.");
        if (!await _repo.ExcluirLancamentoAsync(id, cancellationToken))
            throw new KeyNotFoundException("Lançamento não encontrado.");
        var mes = string.IsNullOrWhiteSpace(competencia) ? doc.Competencia : ExigirCompetencia(competencia);
        return await MontarPainelAsync(mes, cancellationToken);
    }

    private async Task<ControleCustoPainel> MontarPainelAsync(string mes, CancellationToken cancellationToken)
    {
        var colaboradores = await _repo.ListarColaboradoresAsync(cancellationToken);
        var lancamentos = await CarregarMesAsync(mes, cancellationToken);
        var custosPorSetor = CustosPorSetor(lancamentos);
        var cenarios = await LucrosDoCenarioAsync(mes, cancellationToken);

        var setores = ControleCustoCatalogo.Setores.Select(s =>
        {
            var faturamento = cenarios.GetValueOrDefault(s.Id);
            var custos = custosPorSetor.GetValueOrDefault(s.Id);
            var reinvestimento = Soma(lancamentos, ControleCustoCatalogo.Reinvestimento, s.Id);
            var lucro = Dinheiro(faturamento - custos);
            return new ControleCustoSetorResumo
            {
                Id = s.Id,
                Nome = s.Nome,
                Origem = OrigemDoCenario(s.Id),
                Faturamento = faturamento,
                Custos = custos,
                Lucro = lucro,
                Reinvestimento = reinvestimento,
                Disponivel = Dinheiro(lucro - reinvestimento),
            };
        }).ToList();

        return new ControleCustoPainel
        {
            Competencia = mes,
            Setores = setores,
            Colaboradores = colaboradores.Where(c => c.Ativo).OrderBy(c => c.Nome).ToList(),
            Custos = lancamentos.Where(l => l.Tipo == ControleCustoCatalogo.Custo).ToList(),
            Reinvestimentos = lancamentos.Where(l => l.Tipo == ControleCustoCatalogo.Reinvestimento).ToList(),
            Faturamento = Dinheiro(setores.Sum(s => s.Faturamento)),
            CustosTotal = Dinheiro(setores.Sum(s => s.Custos)),
            Lucro = Dinheiro(setores.Sum(s => s.Lucro)),
            Reinvestimento = Dinheiro(setores.Sum(s => s.Reinvestimento)),
            Disponivel = Dinheiro(setores.Sum(s => s.Disponivel)),
        };
    }

    private async Task<List<ControleCustoLancamentoData>> CarregarMesAsync(string mes, CancellationToken cancellationToken)
    {
        var todos = await _repo.ListarTodosAsync(cancellationToken);
        return AplicarNoMes(todos, mes);
    }

    private static List<ControleCustoLancamentoData> AplicarNoMes(
        IEnumerable<ControleCustoLancamentoData> todos, string mes)
    {
        var lista = new List<ControleCustoLancamentoData>();
        foreach (var item in todos)
        {
            if (item.Tipo != ControleCustoCatalogo.Custo)
            {
                if (!ControleCustoRecorrencia.Vigente(item, mes)) continue;
                if (item.Tipo == ControleCustoCatalogo.Reinvestimento)
                    ControleCustoRecorrencia.PreencherExibicao(item, mes);
                lista.Add(item);
                continue;
            }
            if (!ControleCustoRecorrencia.Vigente(item, mes)) continue;
            ControleCustoRecorrencia.PreencherExibicao(item, mes);
            lista.Add(item);
        }
        return lista;
    }

    private static Dictionary<string, decimal> CustosPorSetor(IEnumerable<ControleCustoLancamentoData> lancamentos)
    {
        var mapa = ControleCustoCatalogo.Setores.ToDictionary(s => s.Id, _ => 0m);
        foreach (var custo in lancamentos.Where(l => l.Tipo == ControleCustoCatalogo.Custo))
        {
            foreach (var (setor, parte) in Alocar(custo.ValorNoMes, custo.Rateio))
            {
                if (mapa.ContainsKey(setor)) mapa[setor] = Dinheiro(mapa[setor] + parte);
            }
        }
        return mapa;
    }

    private async Task<decimal> ResultadoDoSetorAsync(
        IEnumerable<ControleCustoLancamentoData> lancamentos,
        string mes,
        string setor,
        Dictionary<string, Dictionary<string, decimal>> cache,
        CancellationToken cancellationToken)
    {
        if (!cache.TryGetValue(mes, out var doMes))
        {
            doMes = await LucrosDoCenarioAsync(mes, cancellationToken);
            cache[mes] = doMes;
        }

        var custos = CustosPorSetor(lancamentos).GetValueOrDefault(setor);
        return Dinheiro(doMes.GetValueOrDefault(setor) - custos);
    }

    private async Task<Dictionary<string, decimal>> LucrosDoCenarioAsync(string mes, CancellationToken cancellationToken)
    {
        var (inicio, fim) = Intervalo(mes);
        var de = inicio.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var ate = fim.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

        var assistencia = await LucroAssistenciaAsync(inicio, fim, cancellationToken);
        var celulares = await _comissao.SmartphonesAsync(de, ate, cancellationToken);
        var loja = await _comissao.LojaAsync(de, ate, cancellationToken);

        return new Dictionary<string, decimal>(StringComparer.Ordinal)
        {
            ["assistencia"] = assistencia,
            ["smartphones"] = Dinheiro(celulares.Liquido),
            ["loja"] = Dinheiro(loja.Liquido),
            ["brindes-online"] = 0,
        };
    }

    private async Task<decimal> LucroAssistenciaAsync(DateTime inicio, DateTime fim, CancellationToken cancellationToken)
    {
        var lista = await _os.ListarParaComissaoAsync(inicio, fim, null, true, null);
        var ids = lista
            .SelectMany(os => os.Itens ?? [])
            .Where(ItemEhPeca)
            .Where(i => i.CustoPeca is not > 0 && !string.IsNullOrWhiteSpace(i.PecaId))
            .Select(i => i.PecaId!);
        var custosRef = await _estoque.ObterCustosReferenciaPecasAsync(ids);

        decimal total = 0;
        foreach (var os in lista)
        {
            var venda = PrimeiroValorPositivo(os.ValorAVista, os.ValorTotalAcordado, os.ValorTotal);
            total += venda - CustoPecas(os.Itens, custosRef);
        }
        return Dinheiro(total);
    }

    private static decimal PrimeiroValorPositivo(params decimal?[] valores)
    {
        foreach (var valor in valores)
        {
            if (valor is > 0) return valor.Value;
        }
        return 0;
    }

    private static bool ItemEhPeca(BlingOrdemServicoItem item)
    {
        if (string.Equals(item.TipoItem, "servico", StringComparison.OrdinalIgnoreCase))
            return false;
        return string.Equals(item.TipoItem, "peca", StringComparison.OrdinalIgnoreCase)
            || !string.IsNullOrWhiteSpace(item.PecaId);
    }

    private static decimal CustoPecas(List<BlingOrdemServicoItem>? itens, IReadOnlyDictionary<string, decimal> custosRef)
    {
        if (itens is null || itens.Count == 0) return 0;
        decimal total = 0;
        foreach (var item in itens)
        {
            if (!ItemEhPeca(item)) continue;
            var qtd = item.Quantidade <= 0 ? 1 : item.Quantidade;
            var unit = item.CustoPeca is > 0 ? item.CustoPeca.Value : 0;
            if (unit <= 0
                && !string.IsNullOrWhiteSpace(item.PecaId)
                && custosRef.TryGetValue(item.PecaId.Trim(), out var referencia))
            {
                unit = referencia;
            }
            if (unit <= 0) continue;
            total += unit * qtd;
        }
        return total;
    }

    private static (DateTime Inicio, DateTime Fim) Intervalo(string mes)
    {
        var partes = mes.Split('-');
        var inicio = new DateTime(int.Parse(partes[0], CultureInfo.InvariantCulture), int.Parse(partes[1], CultureInfo.InvariantCulture), 1);
        return (inicio, inicio.AddMonths(1).AddDays(-1));
    }

    private static string OrigemDoCenario(string id) => id switch
    {
        "assistencia" => "OS concluídas no mês: valor cobrado menos o custo das peças.",
        "smartphones" => "Vendas e trocas: valor recebido menos o custo do aparelho.",
        "loja" => "Pedidos da loja no Bling: valor da venda menos o custo do produto.",
        _ => "Brindes no Bling ainda não entram neste controle.",
    };

    private static decimal Soma(IEnumerable<ControleCustoLancamentoData> lancamentos, string tipo, string setor) =>
        Dinheiro(lancamentos
            .Where(l => l.Tipo == tipo && l.Setor == setor)
            .Sum(l => l.Valor));

    public static List<(string Setor, decimal Parte)> Alocar(decimal valor, IReadOnlyList<ControleCustoRateio> rateio)
    {
        var partes = new List<(string Setor, decimal Parte)>();
        decimal acumulado = 0;
        for (var i = 0; i < rateio.Count; i++)
        {
            var parte = i == rateio.Count - 1
                ? Dinheiro(valor - acumulado)
                : Dinheiro(valor * rateio[i].Percentual / 100m);
            acumulado += parte;
            partes.Add((rateio[i].Setor, parte));
        }
        return partes;
    }

    private static List<ControleCustoRateio> NormalizarRateio(IEnumerable<ControleCustoRateio>? rateio)
    {
        var itens = (rateio ?? [])
            .Where(r => r.Percentual > 0)
            .Select(r => new ControleCustoRateio
            {
                Setor = (r.Setor ?? "").Trim(),
                Percentual = Dinheiro(r.Percentual),
            })
            .ToList();
        if (itens.Count == 0) throw new ArgumentException("Distribua o custo entre os setores.");
        if (itens.Any(r => !ControleCustoCatalogo.SetorValido(r.Setor)))
            throw new ArgumentException("Há um setor inválido no rateio.");
        if (itens.Select(r => r.Setor).Distinct().Count() != itens.Count)
            throw new ArgumentException("O mesmo setor não pode aparecer duas vezes no rateio.");
        var soma = itens.Sum(r => r.Percentual);
        if (Math.Abs(soma - 100m) > 0.05m)
            throw new ArgumentException("A soma do rateio precisa fechar em 100%.");
        return itens;
    }

    private static List<string> NormalizarSetores(IEnumerable<string>? setores)
    {
        var lista = (setores ?? [])
            .Select(s => (s ?? "").Trim())
            .Where(ControleCustoCatalogo.SetorValido)
            .Distinct()
            .ToList();
        return ControleCustoCatalogo.Setores.Select(s => s.Id).Where(lista.Contains).ToList();
    }

    private static string ExigirCompetencia(string? competencia)
    {
        var mes = (competencia ?? "").Trim();
        if (!Regex.IsMatch(mes, @"^\d{4}-(0[1-9]|1[0-2])$"))
            throw new ArgumentException("Informe o mês no formato AAAA-MM.");
        return mes;
    }

    private static string ExigirMesLancavel(string? competencia)
    {
        var mes = ExigirCompetencia(competencia);
        if (string.CompareOrdinal(mes, MesAtual()) > 0)
            throw new ArgumentException("O lançamento só pode ser no mês atual ou em um mês passado.");
        return mes;
    }

    private static ControleCustoComparativoLinha LinhaComparativo(string id, string nome, string grupo, decimal[] valores) =>
        new() { Id = id, Nome = nome, Grupo = grupo, Valores = valores.ToList() };

    private static string RetrocederMes(string competencia, int meses)
    {
        var atual = competencia;
        for (var i = 0; i < meses; i++)
        {
            var partes = atual.Split('-');
            var ano = int.Parse(partes[0], CultureInfo.InvariantCulture);
            var mes = int.Parse(partes[1], CultureInfo.InvariantCulture);
            atual = mes == 1 ? $"{ano - 1:0000}-12" : $"{ano:0000}-{mes - 1:00}";
        }
        return atual;
    }

    private static string ExigirSetor(string? setor)
    {
        var id = (setor ?? "").Trim();
        if (!ControleCustoCatalogo.SetorValido(id))
            throw new ArgumentException("Escolha o setor.");
        return id;
    }

    private static string MesAtual()
    {
        var agora = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, Brasil());
        return $"{agora:yyyy-MM}";
    }

    private static TimeZoneInfo Brasil()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("E. South America Standard Time"); }
    }

    private static decimal Dinheiro(decimal valor) =>
        Math.Round(valor, 2, MidpointRounding.AwayFromZero);

    private static string Moeda(decimal valor) =>
        valor.ToString("C", PtBr);
}
