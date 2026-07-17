using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Settings;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Busca clientes na base local primeiro; complementa com Bling quando a integração estiver ativa.
/// </summary>
public interface IClienteConsultaService
{
    Task<List<BlingContato>> ListarAsync(string? termo = null);
    Task<BlingContato?> ObterLocalAsync(long id);
}

public class ClienteConsultaService : IClienteConsultaService
{
    private readonly IClienteLocalRepository _localRepo;
    private readonly BlingSettings _settings;
    private readonly IBlingApiClientFactory? _blingClient;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ClienteConsultaService(
        IClienteLocalRepository localRepo,
        IOptions<BlingSettings> settings,
        IServiceProvider serviceProvider)
    {
        _localRepo = localRepo;
        _settings = settings.Value;
        _blingClient = serviceProvider.GetService<IBlingApiClientFactory>();
    }

    public async Task<List<BlingContato>> ListarAsync(string? termo = null)
    {
        var locais = (await _localRepo.ListarAsync(termo))
            .Select(l =>
            {
                var c = BlingLocalMappings.ParaContato(l);
                c.Origem = "local";
                return c;
            })
            .ToList();

        if (!PodeConsultarBling())
            return locais;

        var bling = await ListarNoBlingAsync(termo);
        return Mesclar(locais, bling);
    }

    public async Task<BlingContato?> ObterLocalAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id);
        if (local is null) return null;
        var contato = BlingLocalMappings.ParaContato(local);
        contato.Origem = "local";
        return contato;
    }

    private bool PodeConsultarBling() =>
        !_settings.ModoLocal
        && _settings.Habilitado
        && _blingClient is not null
        && _blingClient.TemToken;

    private async Task<List<BlingContato>> ListarNoBlingAsync(string? termo)
    {
        if (_blingClient is null) return [];

        try
        {
            var http = _blingClient.CreateClient();
            var url = "https://www.bling.com.br/Api/v3/contatos?pagina=1&limite=100";
            if (!string.IsNullOrWhiteSpace(termo))
                url += $"&pesquisa={Uri.EscapeDataString(termo)}";

            var response = await http.GetAsync(url);
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<BlingListResponse<BlingContato>>(json, JsonOptions);
            return (result?.Data ?? [])
                .Select(c => { c.Origem = "bling"; return c; })
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    private static List<BlingContato> Mesclar(List<BlingContato> local, List<BlingContato> bling)
    {
        var ids = local.Where(c => c.Id.HasValue).Select(c => c.Id!.Value).ToHashSet();
        var cpfs = local
            .Where(c => !string.IsNullOrWhiteSpace(c.CpfCnpj))
            .Select(c => ApenasDigitos(c.CpfCnpj!))
            .Where(d => d.Length > 0)
            .ToHashSet();

        var resultado = new List<BlingContato>(local);
        foreach (var contato in bling)
        {
            if (contato.Id.HasValue && ids.Contains(contato.Id.Value))
                continue;

            var cpf = string.IsNullOrWhiteSpace(contato.CpfCnpj) ? "" : ApenasDigitos(contato.CpfCnpj);
            if (cpf.Length > 0 && cpfs.Contains(cpf))
                continue;

            resultado.Add(contato);
        }

        return resultado;
    }

    private static string ApenasDigitos(string valor) =>
        Regex.Replace(valor, @"\D", "");
}
