using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IOsEstoqueBaixaService
{
    Task AplicarBaixasAsync(OsLocalData os, OsLocalData? osAnterior = null);
    Task EstornarBaixasAsync(OsLocalData os);
}

public class OsEstoqueBaixaService : IOsEstoqueBaixaService
{
    private readonly IEstoqueLoteService _estoque;
    private readonly IPecaEstoqueRepository _pecas;

    public OsEstoqueBaixaService(IEstoqueLoteService estoque, IPecaEstoqueRepository pecas)
    {
        _estoque = estoque;
        _pecas = pecas;
    }

    public async Task AplicarBaixasAsync(OsLocalData os, OsLocalData? osAnterior = null)
    {
        var cancelouAgora = OsSituacaoHelper.EhCancelada(os.Situacao)
            && !OsSituacaoHelper.EhCancelada(osAnterior?.Situacao);

        if (cancelouAgora)
            await EstornarBaixasAsync(os);

        if (OsSituacaoHelper.EhCancelada(os.Situacao))
            return;

        // Remoção/redução de peça na edição → devolver ao estoque.
        await EstornarItensRemovidosOuReduzidosAsync(os, osAnterior);

        // Pré-orçamento / serviço livre pode trazer pecaId só como referência de valor —
        // baixa só ocorre em item de peça (tipoItem = peca).
        foreach (var item in os.Itens.Where(DeveBaixarEstoque))
        {
            item.EstoqueInsuficiente = false;

            if (EhFornecedorExterno(item))
            {
                item.QuantidadeEstoqueBaixada = 0;
                continue;
            }

            var quantidade = (int)Math.Max(1, Math.Floor(item.Quantidade));
            var jaBaixada = (int)Math.Floor(item.QuantidadeEstoqueBaixada);
            var aBaixar = quantidade - jaBaixada;
            if (aBaixar <= 0) continue;

            var peca = await _pecas.ObterPorIdAsync(item.PecaId!);
            var exigeCor = PecaExigeCor(peca, os.ModeloId);
            if (exigeCor && string.IsNullOrWhiteSpace(item.Cor))
            {
                item.EstoqueInsuficiente = true;
                continue;
            }

            try
            {
                var saidas = await _estoque.RegistrarSaidaAsync(new RegistrarSaidaEstoqueRequest
                {
                    PecaId = item.PecaId!,
                    Quantidade = aBaixar,
                    ModeloId = os.ModeloId,
                    ModeloNome = os.ModeloNome,
                    Cor = item.Cor,
                    OsBlingId = os.BlingId > 0 ? os.BlingId : null,
                    OsNumero = os.OsNumero,
                    Observacao = MontarObservacaoBaixa(os, item),
                });

                item.QuantidadeEstoqueBaixada = jaBaixada + aBaixar;
                item.CustoPeca = CalcularCustoPecaMedio(saidas);
            }
            catch (InvalidOperationException)
            {
                // Serviço segue mesmo sem estoque local — não bloqueia a OS.
                item.EstoqueInsuficiente = true;
            }
        }

        await AtualizarTipoPecaProblemaAsync(os, osAnterior);
    }

    /// <summary>
    /// Compara itens anteriores vs atuais: peça removida ou quantidade reduzida
    /// gera estorno da diferença já baixada.
    /// </summary>
    private async Task EstornarItensRemovidosOuReduzidosAsync(OsLocalData os, OsLocalData? osAnterior)
    {
        if (osAnterior?.Itens is null || osAnterior.Itens.Count == 0)
            return;

        var anteriores = osAnterior.Itens
            .Where(i => DeveBaixarEstoque(i)
                && !EhFornecedorExterno(i)
                && (int)Math.Floor(i.QuantidadeEstoqueBaixada) > 0)
            .Select((item, idx) => new ItemBaixadoSnapshot(item, idx))
            .ToList();

        if (anteriores.Count == 0) return;

        var usados = new HashSet<int>();

        foreach (var atual in os.Itens)
        {
            if (!DeveBaixarEstoque(atual) || EhFornecedorExterno(atual))
                continue;

            var matchIdx = EncontrarAnteriorCorrespondente(anteriores, usados, atual);
            if (matchIdx < 0) continue;

            usados.Add(matchIdx);
            var anterior = anteriores[matchIdx].Item;
            var baixadaAnterior = (int)Math.Floor(anterior.QuantidadeEstoqueBaixada);
            var baixadaAtual = (int)Math.Floor(atual.QuantidadeEstoqueBaixada);
            // Mantém o maior histórico conhecido (FE pode zerar o campo ao trocar origem).
            var baixadaEfetiva = Math.Max(baixadaAtual, baixadaAnterior);
            var quantidadeDesejada = (int)Math.Max(1, Math.Floor(atual.Quantidade));

            // Peça/cor mudou em relação ao que estava baixado → devolve tudo e zera.
            if (!MesmaPecaEstoque(anterior, atual))
            {
                await EstornarQuantidadeAsync(os, anterior, baixadaEfetiva);
                atual.QuantidadeEstoqueBaixada = 0;
                atual.CustoPeca = null;
                continue;
            }

            if (baixadaEfetiva > quantidadeDesejada)
            {
                await EstornarQuantidadeAsync(os, atual, baixadaEfetiva - quantidadeDesejada);
                atual.QuantidadeEstoqueBaixada = quantidadeDesejada;
            }
            else
            {
                atual.QuantidadeEstoqueBaixada = baixadaEfetiva;
            }
        }

        // Itens removidos da OS (não casaram com nenhum atual).
        for (var i = 0; i < anteriores.Count; i++)
        {
            if (usados.Contains(i)) continue;
            var removido = anteriores[i].Item;
            var qtd = (int)Math.Floor(removido.QuantidadeEstoqueBaixada);
            if (qtd <= 0) continue;
            await EstornarQuantidadeAsync(os, removido, qtd);
        }
    }

    private static int EncontrarAnteriorCorrespondente(
        List<ItemBaixadoSnapshot> anteriores,
        HashSet<int> usados,
        BlingOrdemServicoItem atual)
    {
        // 1) Mesmo Id de linha (quando existir).
        if (atual.Id is > 0)
        {
            for (var i = 0; i < anteriores.Count; i++)
            {
                if (usados.Contains(i)) continue;
                if (anteriores[i].Item.Id == atual.Id) return i;
            }
        }

        // 2) Mesma peça + cor.
        for (var i = 0; i < anteriores.Count; i++)
        {
            if (usados.Contains(i)) continue;
            if (MesmaPecaEstoque(anteriores[i].Item, atual)) return i;
        }

        return -1;
    }

    private static bool MesmaPecaEstoque(BlingOrdemServicoItem a, BlingOrdemServicoItem b)
    {
        if (!string.Equals(a.PecaId?.Trim(), b.PecaId?.Trim(), StringComparison.OrdinalIgnoreCase))
            return false;

        var corA = (a.Cor ?? "").Trim();
        var corB = (b.Cor ?? "").Trim();
        return string.Equals(corA, corB, StringComparison.OrdinalIgnoreCase);
    }

    private async Task EstornarQuantidadeAsync(OsLocalData os, BlingOrdemServicoItem item, int quantidade)
    {
        if (quantidade <= 0 || string.IsNullOrWhiteSpace(item.PecaId)) return;

        await _estoque.RegistrarEstornoOsAsync(new RegistrarEstornoOsRequest
        {
            PecaId = item.PecaId!,
            Quantidade = quantidade,
            OsBlingId = os.BlingId > 0 ? os.BlingId : null,
            OsNumero = os.OsNumero,
            ModeloId = os.ModeloId,
            ModeloNome = os.ModeloNome,
            Cor = item.Cor,
        });
    }

    private static bool PecaExigeCor(PecaEstoque? peca, string? modeloId)
    {
        if (peca is null) return false;
        var cat = (peca.Categoria ?? "").Trim();
        if (cat is "Tampa traseira" or "Vidro Traseiro")
            return true;

        if (string.IsNullOrWhiteSpace(modeloId)) return false;
        return peca.ModelosCompativeis
            .Where(m => string.Equals(m.ModeloId, modeloId, StringComparison.OrdinalIgnoreCase))
            .SelectMany(m => m.Cores ?? [])
            .Any(c => !string.IsNullOrWhiteSpace(c.Cor));
    }

    public async Task EstornarBaixasAsync(OsLocalData os)
    {
        foreach (var item in os.Itens.Where(i => !string.IsNullOrWhiteSpace(i.PecaId)))
        {
            if (EhFornecedorExterno(item)) continue;

            var quantidade = (int)Math.Floor(item.QuantidadeEstoqueBaixada);
            if (quantidade <= 0) continue;

            await EstornarQuantidadeAsync(os, item, quantidade);

            item.QuantidadeEstoqueBaixada = 0;
            item.EstoqueInsuficiente = false;
            item.CustoPeca = null;
        }
    }

    private static decimal? CalcularCustoPecaMedio(List<MovimentacaoEstoque> saidas)
    {
        if (saidas.Count == 0) return null;

        decimal custo = 0;
        var qtd = 0;
        foreach (var s in saidas)
        {
            custo += (s.CustoUnitario ?? 0) * s.Quantidade;
            qtd += s.Quantidade;
        }

        return qtd > 0 ? custo / qtd : saidas[0].CustoUnitario;
    }

    private async Task AtualizarTipoPecaProblemaAsync(OsLocalData os, OsLocalData? osAnterior)
    {
        var primeiraPeca = os.Itens.FirstOrDefault(i => !string.IsNullOrWhiteSpace(i.PecaId));
        if (primeiraPeca is not null)
        {
            os.TipoPecaProblemaId = primeiraPeca.PecaId;
            if (!string.IsNullOrWhiteSpace(primeiraPeca.Descricao))
            {
                os.TipoPecaProblemaNome = primeiraPeca.Descricao;
            }
            else
            {
                var peca = await _pecas.ObterPorIdAsync(primeiraPeca.PecaId!);
                os.TipoPecaProblemaNome = peca?.Nome;
            }
        }
        else if (osAnterior is null || !os.Itens.Any(i => !string.IsNullOrWhiteSpace(i.PecaId)))
        {
            os.TipoPecaProblemaId = null;
            os.TipoPecaProblemaNome = null;
        }
    }

    private static bool EhFornecedorExterno(BlingOrdemServicoItem item)
        => string.Equals(item.OrigemPeca, "externo", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Item com pecaId de catálogo usado só como serviço (orçamento/pré-orçamento)
    /// não reserva estoque. Reserva apenas quando tipoItem = peca.
    /// </summary>
    private static bool DeveBaixarEstoque(BlingOrdemServicoItem item)
    {
        if (string.IsNullOrWhiteSpace(item.PecaId)) return false;
        if (string.Equals(item.TipoItem, "servico", StringComparison.OrdinalIgnoreCase))
            return false;
        // Legado: pecaId sem tipo → trata como peça.
        return string.IsNullOrWhiteSpace(item.TipoItem)
            || string.Equals(item.TipoItem, "peca", StringComparison.OrdinalIgnoreCase);
    }

    private static string MontarObservacaoBaixa(OsLocalData os, BlingOrdemServicoItem item)
    {
        var baseObs = $"Baixa automática OS #{os.OsNumero ?? os.BlingId.ToString()}";
        if (!string.IsNullOrWhiteSpace(item.Cor))
            baseObs += $" — cor {item.Cor.Trim()}";

        if (!EhFornecedorExterno(item)) return baseObs;

        var partes = new List<string> { baseObs, $"Fornecedor: {item.FornecedorExterno}" };
        if (!string.IsNullOrWhiteSpace(item.CodigoRastreio))
            partes.Add($"Rastreio: {item.CodigoRastreio.Trim()}");
        return string.Join(" | ", partes);
    }

    private sealed record ItemBaixadoSnapshot(BlingOrdemServicoItem Item, int Indice);
}
