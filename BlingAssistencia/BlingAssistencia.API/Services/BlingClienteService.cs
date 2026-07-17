using System.Text;
using System.Text.Json;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public interface IBlingClienteService
{
    Task<List<BlingContato>> ListarAsync(string? nome = null);
    Task<BlingContato> ObterAsync(long id);
    Task<BlingContato> CriarAsync(BlingContato contato);
    Task<BlingContato> AtualizarAsync(long id, BlingContato contato);
    Task<bool> CpfCnpjExisteAsync(string cpfCnpj, long? excluirId = null);
    Task<ClienteDuplicadoVerificacao> VerificarCpfCnpjAsync(string cpfCnpj, long? excluirId = null);
    Task<ClienteDuplicadoVerificacao> VerificarTelefoneAsync(string telefone, long? excluirId = null);
    Task<ContatoAltSugestao> SugerirContatoAltAsync(string telefone);
}

public class BlingClienteService : IBlingClienteService
{
    private readonly IBlingApiClientFactory _blingClient;
    private readonly IClienteLocalRepository _localRepo;
    private readonly IBlingIntegrationGuard _bling;
    private readonly IClienteConsultaService _consulta;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public BlingClienteService(
        IBlingApiClientFactory blingClient,
        IClienteLocalRepository localRepo,
        IBlingIntegrationGuard bling,
        IClienteConsultaService consulta)
    {
        _blingClient = blingClient;
        _localRepo = localRepo;
        _bling = bling;
        _consulta = consulta;
    }

    public Task<List<BlingContato>> ListarAsync(string? nome = null) =>
        _consulta.ListarAsync(nome);

    public async Task<BlingContato> ObterAsync(long id)
    {
        var localContato = await _consulta.ObterLocalAsync(id);
        if (localContato is not null)
            return localContato;

        _bling.EnsureEnabled();
        if (!_blingClient.TemToken)
            throw new KeyNotFoundException($"Contato {id} não encontrado.");

        var http = _blingClient.CreateClient();
        var response = await http.GetAsync($"https://www.bling.com.br/Api/v3/contatos/{id}");
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingContato>>(json, JsonOptions);
        var contato = result?.Data ?? throw new KeyNotFoundException($"Contato {id} não encontrado.");
        contato.Origem = "bling";

        var dadosLocais = await _localRepo.ObterPorBlingIdAsync(id);
        if (dadosLocais is not null)
            AplicarDadosLocais(contato, dadosLocais);

        return contato;
    }

    public async Task<BlingContato> CriarAsync(BlingContato contato)
    {
        _bling.EnsureEnabled();
        if (!string.IsNullOrWhiteSpace(contato.CpfCnpj))
        {
            var existe = await CpfCnpjExisteAsync(contato.CpfCnpj);
            if (existe)
                throw new InvalidOperationException($"Já existe um cliente cadastrado com o CPF/CNPJ informado.");
        }

        var local = ExtrairDadosLocais(contato);

        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(contato);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PostAsync("https://www.bling.com.br/Api/v3/contatos", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingContato>>(json, JsonOptions);
        var criado = result?.Data ?? throw new InvalidOperationException("Erro ao criar contato no Bling.");

        if (criado.Id.HasValue)
        {
            local.BlingId = criado.Id.Value;
            if (!string.IsNullOrWhiteSpace(contato.CpfCnpj))
                local.CpfCnpj = contato.CpfCnpj;
            await _localRepo.SalvarAsync(local);
            AplicarDadosLocais(criado, local);
        }

        return criado;
    }

    public async Task<BlingContato> AtualizarAsync(long id, BlingContato contato)
    {
        _bling.EnsureEnabled();
        if (!string.IsNullOrWhiteSpace(contato.CpfCnpj))
        {
            var existe = await CpfCnpjExisteAsync(contato.CpfCnpj, excluirId: id);
            if (existe)
                throw new InvalidOperationException($"Já existe outro cliente cadastrado com o CPF/CNPJ informado.");
        }

        var local = ExtrairDadosLocais(contato);
        local.BlingId = id;
        if (!string.IsNullOrWhiteSpace(contato.CpfCnpj))
            local.CpfCnpj = contato.CpfCnpj;

        var http = _blingClient.CreateClient();
        var body = JsonSerializer.Serialize(contato);
        var content = new StringContent(body, Encoding.UTF8, "application/json");
        var response = await http.PutAsync($"https://www.bling.com.br/Api/v3/contatos/{id}", content);
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<BlingItemResponse<BlingContato>>(json, JsonOptions);
        var atualizado = result?.Data ?? throw new InvalidOperationException("Erro ao atualizar contato no Bling.");

        var existente = await _localRepo.ObterPorBlingIdAsync(id);
        local.MongoId = existente?.MongoId;
        local.CriadoEm = existente?.CriadoEm ?? DateTime.UtcNow;
        await _localRepo.SalvarAsync(local);
        AplicarDadosLocais(atualizado, local);

        return atualizado;
    }

    public async Task<bool> CpfCnpjExisteAsync(string cpfCnpj, long? excluirId = null)
    {
        var r = await VerificarCpfCnpjAsync(cpfCnpj, excluirId);
        return r.Existe;
    }

    public async Task<ClienteDuplicadoVerificacao> VerificarCpfCnpjAsync(string cpfCnpj, long? excluirId = null)
    {
        var encontrado = await _localRepo.ObterPorCpfCnpjAsync(cpfCnpj, excluirId);
        return ClienteDuplicidadeHelper.Para(encontrado);
    }

    public async Task<ClienteDuplicadoVerificacao> VerificarTelefoneAsync(string telefone, long? excluirId = null)
    {
        var encontrado = await _localRepo.ObterPorTelefoneAsync(telefone, excluirId);
        return ClienteDuplicidadeHelper.Para(encontrado);
    }

    public async Task<ContatoAltSugestao> SugerirContatoAltAsync(string telefone)
    {
        var hit = await _localRepo.SugerirContatoAltPorTelefoneAsync(telefone);
        if (hit is null) return ClienteDuplicidadeHelper.SugestaoVazia;
        var (nome, clienteId, eCliente) = hit.Value;
        return ClienteDuplicidadeHelper.ParaSugestaoAlt(nome, clienteId, eCliente);
    }

    private static void AplicarDadosLocais(BlingContato contato, ClienteLocalData local)
    {
        contato.Telefone2 = local.Telefone2;
        contato.Contatos = local.Contatos
            .Select(c => new ContatoPrincipalDto
            {
                Nome = c.Nome,
                Telefone = c.Telefone,
                Celular = c.Celular,
                Parentesco = c.Parentesco
            }).ToList();
    }

    private static ClienteLocalData ExtrairDadosLocais(BlingContato contato)
    {
        var local = new ClienteLocalData
        {
            Telefone2 = contato.Telefone2,
            Contatos = (contato.Contatos ?? [])
                .Take(2)
                .Select(c => new ContatoPrincipalLocal
                {
                    Nome = c.Nome,
                    Telefone = c.Telefone,
                    Celular = c.Celular,
                    Parentesco = c.Parentesco
                }).ToList()
        };
        return local;
    }
}

