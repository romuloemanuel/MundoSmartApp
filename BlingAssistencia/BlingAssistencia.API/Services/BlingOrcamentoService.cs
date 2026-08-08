using System.Text;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Models.Bling;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingOrcamentoService
{
    Task<List<BlingOrcamento>> ListarAsync(string? situacao = null);
    Task<BlingOrcamento> ObterAsync(long id);
    Task<BlingOrcamento> CriarAsync(BlingOrcamento orcamento);
    Task<BlingOrcamento> AtualizarAsync(long id, BlingOrcamento orcamento);
    Task<BlingOrdemServico> ConverterEmOsAsync(long id, string? lojaOrigem = null);
    /// <summary>Marca o orçamento como convertido após a OS ser criada na tela de inclusão.</summary>
    Task VincularOsAsync(long id, long osBlingId, string? osNumero = null);
    /// <summary>Registra um follow-up com anotação (conta +1 contato) e agenda a próxima data.</summary>
    Task<BlingOrcamento> RegistrarFollowUpAsync(long id, RegistrarFollowUpOrcamentoRequest request);
}

public class BlingOrcamentoService : IBlingOrcamentoService
{
    private readonly IBlingApiClientFactory _blingClient;
    private readonly IBlingIntegrationGuard _bling;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public BlingOrcamentoService(IBlingApiClientFactory blingClient, IBlingIntegrationGuard bling)
    {
        _blingClient = blingClient;
        _bling = bling;
    }

    public async Task<List<BlingOrcamento>> ListarAsync(string? situacao = null)
    {
        if (!_bling.IsEnabled || !_blingClient.TemToken)
            return [];

        var http = _blingClient.CreateClient();
        var url = "https://www.bling.com.br/Api/v3/orcamentos?pagina=1&limite=100";
        if (!string.IsNullOrWhiteSpace(situacao))
            url += $"&situacao={Uri.EscapeDataString(situacao)}";

        var response = await http.GetAsync(url);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingListResponse<BlingOrcamento>>(json, JsonOptions);
        return result?.Data ?? [];
    }

    public async Task<BlingOrcamento> ObterAsync(long id)
    {
        _bling.EnsureEnabled();
        var http = _blingClient.CreateClient();
        var response = await http.GetAsync($"https://www.bling.com.br/Api/v3/orcamentos/{id}");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrcamento>>(json, JsonOptions);
        return result?.Data ?? throw new KeyNotFoundException($"Orçamento {id} não encontrado.");
    }

    public async Task<BlingOrcamento> CriarAsync(BlingOrcamento orcamento)
    {
        _bling.EnsureEnabled();
        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(orcamento);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PostAsync("https://www.bling.com.br/Api/v3/orcamentos", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrcamento>>(json, JsonOptions);
        return result?.Data ?? throw new InvalidOperationException("Erro ao criar orçamento no Bling.");
    }

    public async Task<BlingOrcamento> AtualizarAsync(long id, BlingOrcamento orcamento)
    {
        _bling.EnsureEnabled();
        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(orcamento);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PutAsync($"https://www.bling.com.br/Api/v3/orcamentos/{id}", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingOrcamento>>(json, JsonOptions);
        return result?.Data ?? throw new InvalidOperationException("Erro ao atualizar orçamento no Bling.");
    }

    public Task<BlingOrdemServico> ConverterEmOsAsync(long id, string? lojaOrigem = null) =>
        throw new InvalidOperationException("Conversão de orçamento em OS disponível apenas no modo local.");

    public Task VincularOsAsync(long id, long osBlingId, string? osNumero = null) =>
        throw new InvalidOperationException("Vínculo de orçamento com OS disponível apenas no modo local.");

    public Task<BlingOrcamento> RegistrarFollowUpAsync(long id, RegistrarFollowUpOrcamentoRequest request) =>
        throw new InvalidOperationException("Follow-up de orçamento disponível apenas no modo local.");
}
