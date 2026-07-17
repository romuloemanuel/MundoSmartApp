using System.Text;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using JustificativaAtrasoLocalItem = MundoSmart.BlingAssistencia.API.Models.Mongo.JustificativaAtrasoItem;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingOrdemServicoService
{
    Task<OsListaPaginada<BlingOrdemServico>> ListarAsync(OsListarFiltros? filtros = null);
    Task<BlingOrdemServico> ObterAsync(long id);
    Task<BlingOrdemServico> CriarAsync(BlingOrdemServico os);
    Task<BlingOrdemServico> AtualizarAsync(long id, BlingOrdemServico os);
    Task AlterarSituacaoAsync(long id, string situacao, string? motivoCancelamento = null, DateTime? dataPrazoPeca = null, string? tecnicoNome = null);
    Task JustificarAtrasoAsync(long id, string justificativaAtraso);
    Task ExcluirAsync(long id);
}

public class BlingOrdemServicoService : IBlingOrdemServicoService
{
    private readonly IBlingApiClientFactory _blingClient;
    private readonly IOsLocalRepository _localRepo;
    private readonly IBlingIntegrationGuard _bling;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public BlingOrdemServicoService(
        IBlingApiClientFactory blingClient,
        IOsLocalRepository localRepo,
        IBlingIntegrationGuard bling)
    {
        _blingClient = blingClient;
        _localRepo = localRepo;
        _bling = bling;
    }

    public async Task<OsListaPaginada<BlingOrdemServico>> ListarAsync(OsListarFiltros? filtros = null)
    {
        if (!_bling.IsEnabled || !_blingClient.TemToken)
            return new OsListaPaginada<BlingOrdemServico>();

        var http = _blingClient.CreateClient();
        var url = "https://www.bling.com.br/Api/v3/ordens-servicos?pagina=1&limite=100";
        if (!string.IsNullOrWhiteSpace(filtros?.Situacao))
            url += $"&situacao={Uri.EscapeDataString(filtros.Situacao)}";

        var response = await http.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingListResponse<BlingOrdemServico>>(json, JsonOptions);
        var dados = result?.Data ?? [];

        // Enriquece com dados locais do MongoDB em lote
        if (dados.Count > 0)
        {
            var blingIds = dados.Where(o => o.Id.HasValue).Select(o => o.Id!.Value);
            var locais = await _localRepo.ObterPorBlingIdsAsync(blingIds);
            var localMap = locais.ToDictionary(l => l.BlingId);
            foreach (var os in dados)
                if (os.Id.HasValue && localMap.TryGetValue(os.Id.Value, out var local))
                    AplicarDadosLocais(os, local);
        }

        // Filtros aplicados localmente (campos não suportados pela API do Bling)
        if (filtros is not null)
            dados = AplicarFiltrosLocais(dados, filtros);

        return OsListarOrdenacao.PaginarEmMemoria(dados, filtros);
    }

    private static List<BlingOrdemServico> AplicarFiltrosLocais(List<BlingOrdemServico> lista, OsListarFiltros f)
    {
        if (!string.IsNullOrWhiteSpace(f.Nome))
        {
            var termo = f.Nome.Trim().ToLower();
            lista = lista.Where(o =>
                (o.Numero?.Contains(termo, StringComparison.OrdinalIgnoreCase) ?? false) ||
                o.Id.ToString().Contains(termo) ||
                (o.Contato?.Nome?.ToLower().Contains(termo) ?? false) ||
                (o.ContatoAviso?.Nome?.ToLower().Contains(termo) ?? false) ||
                (o.Equipamento?.ToLower().Contains(termo) ?? false) ||
                (o.MarcaNome?.ToLower().Contains(termo) ?? false) ||
                (o.ModeloNome?.ToLower().Contains(termo) ?? false)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(f.Telefone))
        {
            var digitos = new string(f.Telefone.Where(char.IsDigit).ToArray());
            lista = lista.Where(o =>
            {
                var contatoTel = new string((o.Contato?.Telefone ?? "").Where(char.IsDigit).ToArray());
                var contatoCel = new string((o.Contato?.Celular ?? "").Where(char.IsDigit).ToArray());
                var avisoTel = new string((o.ContatoAviso?.Telefone ?? "").Where(char.IsDigit).ToArray());
                var avisoCel = new string((o.ContatoAviso?.Celular ?? "").Where(char.IsDigit).ToArray());
                return contatoTel.Contains(digitos) || contatoCel.Contains(digitos) ||
                       avisoTel.Contains(digitos) || avisoCel.Contains(digitos);
            }).ToList();
        }

        if (!string.IsNullOrWhiteSpace(f.Imei))
            lista = lista.Where(o => o.Imei?.Contains(f.Imei.Trim(), StringComparison.OrdinalIgnoreCase) ?? false).ToList();

        if (!string.IsNullOrWhiteSpace(f.CpfCnpj))
        {
            var digitos = new string(f.CpfCnpj.Where(char.IsDigit).ToArray());
            lista = lista.Where(o => new string((o.CpfCnpj ?? "").Where(char.IsDigit).ToArray()).Contains(digitos)).ToList();
        }

        if (f.DataCadastroInicio.HasValue)
            lista = lista.Where(o => o.Data >= f.DataCadastroInicio).ToList();
        if (f.DataCadastroFim.HasValue)
            lista = lista.Where(o => o.Data <= f.DataCadastroFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (f.DataAtualizacaoInicio.HasValue)
            lista = lista.Where(o => o.DataAtualizacao >= f.DataAtualizacaoInicio).ToList();
        if (f.DataAtualizacaoFim.HasValue)
            lista = lista.Where(o => o.DataAtualizacao <= f.DataAtualizacaoFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (f.DataConclusaoInicio.HasValue)
            lista = lista.Where(o => o.DataConclusao >= f.DataConclusaoInicio).ToList();
        if (f.DataConclusaoFim.HasValue)
            lista = lista.Where(o => o.DataConclusao <= f.DataConclusaoFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (f.Retorno.HasValue)
            lista = lista.Where(o => o.Retorno == f.Retorno).ToList();

        if (!string.IsNullOrWhiteSpace(f.TecnicoNome))
        {
            var tecnico = f.TecnicoNome.Trim();
            lista = lista.Where(o =>
                string.Equals(o.TecnicoNome?.Trim(), tecnico, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return lista;
    }

    public async Task<BlingOrdemServico> ObterAsync(long id)
    {
        _bling.EnsureEnabled();
        var http = _blingClient.CreateClient();
        var response = await http.GetAsync($"https://www.bling.com.br/Api/v3/ordens-servicos/{id}");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrdemServico>>(json, JsonOptions);
        var os = result?.Data ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");

        var local = await _localRepo.ObterPorBlingIdAsync(id);
        if (local is not null)
            AplicarDadosLocais(os, local);

        return os;
    }

    public async Task<BlingOrdemServico> CriarAsync(BlingOrdemServico os)
    {
        _bling.EnsureEnabled();
        var local = ExtrairDadosLocais(os);

        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(os);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PostAsync("https://www.bling.com.br/Api/v3/ordens-servicos", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrdemServico>>(json, JsonOptions);
        var criado = result?.Data ?? throw new InvalidOperationException("Erro ao criar OS no Bling.");

        if (criado.Id.HasValue)
        {
            local.BlingId = criado.Id.Value;
            local.OsNumero = criado.Numero;
            local.Situacao = criado.Situacao;
            await _localRepo.SalvarAsync(local);
            AplicarDadosLocais(criado, local);
        }

        return criado;
    }

    public async Task<BlingOrdemServico> AtualizarAsync(long id, BlingOrdemServico os)
    {
        _bling.EnsureEnabled();
        var local = ExtrairDadosLocais(os);
        local.BlingId = id;

        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(os);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PutAsync($"https://www.bling.com.br/Api/v3/ordens-servicos/{id}", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrdemServico>>(json, JsonOptions);
        var atualizado = result?.Data ?? throw new InvalidOperationException("Erro ao atualizar OS no Bling.");

        var existente = await _localRepo.ObterPorBlingIdAsync(id);
        local.MongoId = existente?.MongoId;
        local.CriadoEm = existente?.CriadoEm ?? DateTime.UtcNow;
        await _localRepo.SalvarAsync(local);
        AplicarDadosLocais(atualizado, local);

        return atualizado;
    }

    public async Task AlterarSituacaoAsync(long id, string situacao, string? motivoCancelamento = null, DateTime? dataPrazoPeca = null, string? tecnicoNome = null)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id);
        situacao = OsSituacaoHelper.AjustarParaLoja(situacao, local?.LojaOrigem);
        OsSituacaoHelper.ValidarMotivoCancelamento(situacao, motivoCancelamento);
        OsSituacaoHelper.ValidarSituacaoPorLoja(situacao, local?.LojaOrigem);

        _bling.EnsureEnabled();
        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(new { situacao });
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PatchAsync($"https://www.bling.com.br/Api/v3/ordens-servicos/{id}/situacoes", content);
        response.EnsureSuccessStatusCode();

        if (local is not null)
        {
            var situacaoAnterior = local.Situacao;
            local.Situacao = situacao;
            if (!string.IsNullOrWhiteSpace(tecnicoNome))
                local.TecnicoNome = tecnicoNome.Trim();
            local.MotivoCancelamento = OsSituacaoHelper.EhCancelada(situacao)
                ? motivoCancelamento?.Trim()
                : null;
            if (OsSituacaoHelper.EhAguardandoPeca(situacao) && OsSituacaoHelper.DataUtilValida(dataPrazoPeca))
                local.DataPrazoPeca = dataPrazoPeca;
            OsSituacaoHelper.AplicarDatasPorSituacao(local, situacaoAnterior);
            OsSituacaoHelper.ValidarPrazoPeca(local.Situacao, local.DataPrazoPeca);
            await _localRepo.SalvarAsync(local);
        }
    }

    public Task ExcluirAsync(long id) =>
        throw new InvalidOperationException("Exclusão de OS disponível apenas no modo local.");

    public async Task JustificarAtrasoAsync(long id, string justificativaAtraso)
    {
        OsSituacaoHelper.ValidarJustificativaAtraso(justificativaAtraso);

        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");

        if (OsSituacaoHelper.EhFinalizada(local.Situacao))
            throw new InvalidOperationException("Não é possível justificar atraso em OS concluída ou cancelada.");

        local.JustificativasAtraso ??= [];
        if (local.JustificativasAtraso.Count == 0 && !string.IsNullOrWhiteSpace(local.JustificativaAtrasoLegado))
        {
            local.JustificativasAtraso.Add(new JustificativaAtrasoLocalItem
            {
                Texto = local.JustificativaAtrasoLegado.Trim(),
                CriadoEm = local.DataAtualizacao ?? HorarioBrasil.Agora
            });
            local.JustificativaAtrasoLegado = null;
        }

        local.JustificativasAtraso.Add(new JustificativaAtrasoLocalItem
        {
            Texto = justificativaAtraso.Trim(),
            CriadoEm = HorarioBrasil.Agora
        });
        local.JustificativaAtrasoLegado = null;
        local.DataAtualizacao = HorarioBrasil.Agora;
        await _localRepo.SalvarAsync(local);
    }

    private static void AplicarDadosLocais(BlingOrdemServico os, OsLocalData local)
    {
        if (local.ContatoAviso is not null)
            os.ContatoAviso = new BlingContatoRef
            {
                Id = 0,
                Nome = local.ContatoAviso.Nome,
                Telefone = local.ContatoAviso.Telefone,
                Celular = local.ContatoAviso.Celular,
                Parentesco = local.ContatoAviso.Parentesco,
                AutorizadoRetirada = local.ContatoAviso.AutorizadoRetirada
            };
        os.Imei = local.Imei;
        os.CpfCnpj = local.CpfCnpj;
        os.Retorno = local.Retorno;
        os.DataConclusao = local.DataConclusao;
        os.ObservacoesInternas = local.ObservacoesInternas;
        os.MarcaId = local.MarcaId;
        os.MarcaNome = local.MarcaNome;
        os.ModeloId = local.ModeloId;
        os.ModeloNome = local.ModeloNome;
        os.DataEntrada = local.DataEntrada;
        os.DataPrevistaTermino = local.DataPrevistaTermino;
        os.DataAtualizacao = local.DataAtualizacao;
        os.DataSaida = local.DataSaida;
        os.EstadoTela = local.EstadoTela;
        os.CondicoesAparelho = local.CondicoesAparelho;
        os.Acessorios = local.Acessorios;
        os.TecnicoNome = local.TecnicoNome;
        os.TecnicoObservacoes = local.TecnicoObservacoes;
        os.OsOriginalNumero = local.OsOriginalNumero;
        os.OsOriginalBlingId = local.OsOriginalBlingId;
        os.TipoPecaProblemaId = local.TipoPecaProblemaId;
        os.TipoPecaProblemaNome = local.TipoPecaProblemaNome;
        os.TipoServico = local.TipoServico;
        os.TesteEntrada = local.TesteEntrada;
        os.TesteSaida = local.TesteSaida;
        os.TesteEntradaRealizado = local.TesteEntradaRealizado;
        os.TesteSaidaRealizado = local.TesteSaidaRealizado;
        os.ContatoPrincipalIndice = local.ContatoPrincipalIndice;
        os.PreferenciaContatoSelecionado = local.PreferenciaContatoSelecionado;
        if (string.IsNullOrWhiteSpace(os.Defeito) && !string.IsNullOrWhiteSpace(local.Defeito))
            os.Defeito = local.Defeito;
    }

    private static OsLocalData ExtrairDadosLocais(BlingOrdemServico os)
    {
        var local = new OsLocalData
        {
            Imei = os.Imei,
            CpfCnpj = os.CpfCnpj,
            Retorno = os.Retorno ?? false,
            DataConclusao = os.DataConclusao,
            ObservacoesInternas = os.ObservacoesInternas,
            MarcaId = os.MarcaId,
            MarcaNome = os.MarcaNome,
            ModeloId = os.ModeloId,
            ModeloNome = os.ModeloNome,
            DataEntrada = os.DataEntrada,
            DataPrevistaTermino = os.DataPrevistaTermino,
            DataAtualizacao = os.DataAtualizacao,
            DataSaida = os.DataSaida,
            EstadoTela = os.EstadoTela,
            CondicoesAparelho = os.CondicoesAparelho,
            Acessorios = os.Acessorios ?? [],
            TecnicoNome = os.TecnicoNome,
            TecnicoObservacoes = os.TecnicoObservacoes,
            OsOriginalNumero = os.OsOriginalNumero,
            OsOriginalBlingId = os.OsOriginalBlingId,
            TipoPecaProblemaId = os.TipoPecaProblemaId,
            TipoPecaProblemaNome = os.TipoPecaProblemaNome,
            TipoServico = os.TipoServico,
            TesteEntrada = os.TesteEntrada,
            TesteSaida = os.TesteSaida,
            TesteEntradaRealizado = os.TesteEntradaRealizado,
            TesteSaidaRealizado = os.TesteSaidaRealizado,
            Defeito = os.Defeito,
            ContatoPrincipalIndice = os.ContatoPrincipalIndice,
            PreferenciaContatoSelecionado = os.PreferenciaContatoSelecionado,
            Situacao = os.Situacao
        };
        if (os.ContatoAviso is not null)
            local.ContatoAviso = new ContatoAvisoLocal
            {
                Nome = os.ContatoAviso.Nome,
                Telefone = os.ContatoAviso.Telefone,
                Celular = os.ContatoAviso.Celular,
                Parentesco = os.ContatoAviso.Parentesco,
                AutorizadoRetirada = os.ContatoAviso.AutorizadoRetirada ?? true
            };
        else
            local.ContatoAviso = null;
        return local;
    }
}

public class OsListarFiltros
{
    public string? Situacao { get; set; }
    public string? Nome { get; set; }
    public string? Telefone { get; set; }
    public string? Imei { get; set; }
    public string? CpfCnpj { get; set; }
    public DateTime? DataCadastroInicio { get; set; }
    public DateTime? DataCadastroFim { get; set; }
    public DateTime? DataAtualizacaoInicio { get; set; }
    public DateTime? DataAtualizacaoFim { get; set; }
    public DateTime? DataConclusaoInicio { get; set; }
    public DateTime? DataConclusaoFim { get; set; }
    public bool? Retorno { get; set; }
    public int Pagina { get; set; } = 1;
    public int TamanhoPagina { get; set; } = 20;
    public string? OrdenarPor { get; set; }
    public string? Direcao { get; set; }
    /// <summary>MCC (assistência) | ARCE | SJ | CJR</summary>
    public string? LojaOrigem { get; set; }
    /// <summary>Nome do técnico responsável (ex.: comissão).</summary>
    public string? TecnicoNome { get; set; }
}
