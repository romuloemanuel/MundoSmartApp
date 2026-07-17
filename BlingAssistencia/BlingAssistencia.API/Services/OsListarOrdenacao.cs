using MongoDB.Driver;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;

namespace MundoSmart.BlingAssistencia.API.Services;

public static class OsListarOrdenacao
{
    public static (int Pagina, int TamanhoPagina) NormalizarPaginacao(OsListarFiltros? filtros)
    {
        var pagina = Math.Max(1, filtros?.Pagina ?? 1);
        var tamanho = Math.Clamp(filtros?.TamanhoPagina ?? 20, 1, 100);
        return (pagina, tamanho);
    }

    public static bool OrdemDescendente(OsListarFiltros? filtros) =>
        !string.Equals(filtros?.Direcao, "asc", StringComparison.OrdinalIgnoreCase);

    public static SortDefinition<OsLocalData> MontarSortMongo(OsListarFiltros? filtros)
    {
        var desc = OrdemDescendente(filtros);
        var campo = filtros?.OrdenarPor?.Trim().ToLowerInvariant() ?? "dataentrada";

        return campo switch
        {
            "numero" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.BlingId)
                : Builders<OsLocalData>.Sort.Ascending(x => x.BlingId),
            "cliente" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.ContatoNome)
                : Builders<OsLocalData>.Sort.Ascending(x => x.ContatoNome),
            "contatoaviso" => desc
                ? Builders<OsLocalData>.Sort.Descending("contatoAviso.nome")
                : Builders<OsLocalData>.Sort.Ascending("contatoAviso.nome"),
            "equipamento" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.Equipamento).Descending(x => x.MarcaNome).Descending(x => x.ModeloNome)
                : Builders<OsLocalData>.Sort.Ascending(x => x.Equipamento).Ascending(x => x.MarcaNome).Ascending(x => x.ModeloNome),
            "imei" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.Imei)
                : Builders<OsLocalData>.Sort.Ascending(x => x.Imei),
            "situacao" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.Situacao)
                : Builders<OsLocalData>.Sort.Ascending(x => x.Situacao),
            "retorno" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.Retorno)
                : Builders<OsLocalData>.Sort.Ascending(x => x.Retorno),
            "loja" or "lojaorigem" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.LojaOrigem)
                : Builders<OsLocalData>.Sort.Ascending(x => x.LojaOrigem),
            "data" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.DataEntrada).Descending(x => x.Data)
                : Builders<OsLocalData>.Sort.Ascending(x => x.DataEntrada).Ascending(x => x.Data),
            // Urgência ≈ tempo desde a última alteração de status/OS.
            "urgencia" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.DataUltimaAlteracaoSituacao).Descending(x => x.DataAtualizacao)
                : Builders<OsLocalData>.Sort.Ascending(x => x.DataUltimaAlteracaoSituacao).Ascending(x => x.DataAtualizacao),
            "valor" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.ValorTotal)
                : Builders<OsLocalData>.Sort.Ascending(x => x.ValorTotal),
            "dataatualizacao" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.DataAtualizacao)
                : Builders<OsLocalData>.Sort.Ascending(x => x.DataAtualizacao),
            "dataconclusao" => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.DataConclusao)
                : Builders<OsLocalData>.Sort.Ascending(x => x.DataConclusao),
            _ => desc
                ? Builders<OsLocalData>.Sort.Descending(x => x.DataEntrada).Descending(x => x.BlingId)
                : Builders<OsLocalData>.Sort.Ascending(x => x.DataEntrada).Ascending(x => x.BlingId),
        };
    }

    public static List<BlingOrdemServico> OrdenarEmMemoria(List<BlingOrdemServico> lista, OsListarFiltros? filtros)
    {
        var desc = OrdemDescendente(filtros);
        var campo = filtros?.OrdenarPor?.Trim().ToLowerInvariant() ?? "dataentrada";

        IEnumerable<BlingOrdemServico> ordenada = campo switch
        {
            "numero" => desc ? lista.OrderByDescending(o => o.Id) : lista.OrderBy(o => o.Id),
            "cliente" => desc ? lista.OrderByDescending(o => o.Contato?.Nome) : lista.OrderBy(o => o.Contato?.Nome),
            "contatoaviso" => desc ? lista.OrderByDescending(o => o.ContatoAviso?.Nome) : lista.OrderBy(o => o.ContatoAviso?.Nome),
            "equipamento" => desc
                ? lista.OrderByDescending(o => o.Equipamento).ThenByDescending(o => o.MarcaNome).ThenByDescending(o => o.ModeloNome)
                : lista.OrderBy(o => o.Equipamento).ThenBy(o => o.MarcaNome).ThenBy(o => o.ModeloNome),
            "imei" => desc ? lista.OrderByDescending(o => o.Imei) : lista.OrderBy(o => o.Imei),
            "situacao" => desc ? lista.OrderByDescending(o => o.Situacao) : lista.OrderBy(o => o.Situacao),
            "retorno" => desc ? lista.OrderByDescending(o => o.Retorno) : lista.OrderBy(o => o.Retorno),
            "loja" or "lojaorigem" => desc
                ? lista.OrderByDescending(o => o.LojaOrigem)
                : lista.OrderBy(o => o.LojaOrigem),
            "data" => desc ? lista.OrderByDescending(o => o.DataEntrada ?? o.Data) : lista.OrderBy(o => o.DataEntrada ?? o.Data),
            "urgencia" => desc
                ? lista.OrderByDescending(o => o.DataUltimaAlteracaoSituacao ?? o.DataAtualizacao ?? DateTime.MaxValue)
                    .ThenByDescending(o => o.DataEntrada ?? o.Data)
                : lista.OrderBy(o => o.DataUltimaAlteracaoSituacao ?? o.DataAtualizacao ?? DateTime.MaxValue)
                    .ThenBy(o => o.DataEntrada ?? o.Data),
            "valor" => desc ? lista.OrderByDescending(o => o.ValorTotal) : lista.OrderBy(o => o.ValorTotal),
            "dataatualizacao" => desc ? lista.OrderByDescending(o => o.DataAtualizacao) : lista.OrderBy(o => o.DataAtualizacao),
            "dataconclusao" => desc ? lista.OrderByDescending(o => o.DataConclusao) : lista.OrderBy(o => o.DataConclusao),
            _ => desc
                ? lista.OrderByDescending(o => o.DataEntrada).ThenByDescending(o => o.Id)
                : lista.OrderBy(o => o.DataEntrada).ThenBy(o => o.Id),
        };

        return ordenada.ToList();
    }

    public static OsListaPaginada<BlingOrdemServico> PaginarEmMemoria(List<BlingOrdemServico> lista, OsListarFiltros? filtros)
    {
        var (pagina, tamanho) = NormalizarPaginacao(filtros);
        var ordenada = OrdenarEmMemoria(lista, filtros);
        var total = ordenada.Count;
        var itens = ordenada.Skip((pagina - 1) * tamanho).Take(tamanho).ToList();

        return new OsListaPaginada<BlingOrdemServico>
        {
            Itens = itens,
            Total = total,
            Pagina = pagina,
            TamanhoPagina = tamanho,
        };
    }
}
