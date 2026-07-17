using MundoSmart.BlingAssistencia.API.Models;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Repositories;
using MundoSmart.BlingAssistencia.API.Config;
using JustificativaAtrasoLocalItem = MundoSmart.BlingAssistencia.API.Models.Mongo.JustificativaAtrasoItem;

namespace MundoSmart.BlingAssistencia.API.Services;

/// <summary>
/// Bypass local — persiste tudo no MongoDB sem chamar a API do Bling (produção).
/// </summary>
public class BlingAuthServiceLocalBypass : IBlingAuthService
{
    private BlingTokenResponse? _token;

    private static BlingTokenResponse TokenLocal() => new()
    {
        AccessToken = "local-bypass-token",
        RefreshToken = "local-bypass-refresh",
        ExpiresIn = 86400,
        TokenType = "Bearer",
        ExpiresAt = DateTime.UtcNow.AddDays(1)
    };

    public string GetAuthorizationUrl() =>
        "http://localhost:4200?modo=local-bypass";

    public Task<BlingTokenResponse> ExchangeCodeAsync(string code) =>
        Task.FromResult(_token ??= TokenLocal());

    public Task<BlingTokenResponse> RefreshTokenAsync(string refreshToken) =>
        Task.FromResult(_token ??= TokenLocal());

    public BlingTokenResponse? GetCurrentToken() => _token;

    public void SetToken(BlingTokenResponse token) => _token = token;
}

public class BlingClienteServiceLocalBypass : IBlingClienteService
{
    private readonly IClienteLocalRepository _localRepo;
    private readonly IDevSequenceRepository _sequences;
    private readonly IClienteConsultaService _consulta;

    public BlingClienteServiceLocalBypass(
        IClienteLocalRepository localRepo,
        IDevSequenceRepository sequences,
        IClienteConsultaService consulta)
    {
        _localRepo = localRepo;
        _sequences = sequences;
        _consulta = consulta;
    }

    public Task<List<BlingContato>> ListarAsync(string? nome = null) =>
        _consulta.ListarAsync(nome);

    public async Task<BlingContato> ObterAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Contato {id} não encontrado.");
        return BlingLocalMappings.ParaContato(local);
    }

    public async Task<BlingContato> CriarAsync(BlingContato contato)
    {
        await ValidarDuplicidadesAsync(contato);

        var id = await _sequences.ProximoAsync("cliente");
        var local = BlingLocalMappings.DeContato(contato, id);
        await _localRepo.SalvarAsync(local);
        return BlingLocalMappings.ParaContato(local);
    }

    public async Task<BlingContato> AtualizarAsync(long id, BlingContato contato)
    {
        await ValidarDuplicidadesAsync(contato, excluirId: id);

        var existente = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Contato {id} não encontrado.");

        var local = BlingLocalMappings.DeContato(contato, id, existente);
        await _localRepo.SalvarAsync(local);
        return BlingLocalMappings.ParaContato(local);
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

    private async Task ValidarDuplicidadesAsync(BlingContato contato, long? excluirId = null)
    {
        if (!string.IsNullOrWhiteSpace(contato.CpfCnpj))
        {
            var cpf = await VerificarCpfCnpjAsync(contato.CpfCnpj, excluirId);
            if (cpf.Existe)
            {
                var quem = string.IsNullOrWhiteSpace(cpf.ClienteNome) ? "" : $" ({cpf.ClienteNome})";
                throw new InvalidOperationException($"Já existe um cliente cadastrado com o CPF/CNPJ informado{quem}.");
            }
        }

        foreach (var tel in ClienteDuplicidadeHelper.ColetarTelefones(contato).Distinct())
        {
            var dup = await VerificarTelefoneAsync(tel, excluirId);
            if (dup.Existe)
            {
                var quem = string.IsNullOrWhiteSpace(dup.ClienteNome) ? "outro cliente" : dup.ClienteNome;
                throw new InvalidOperationException($"Telefone já cadastrado para {quem}.");
            }
        }
    }
}

public class BlingOrdemServicoServiceLocalBypass : IBlingOrdemServicoService
{
    private readonly IOsLocalRepository _localRepo;
    private readonly IDevSequenceRepository _sequences;
    private readonly IOsEstoqueBaixaService _osEstoque;
    private readonly IOsHistoricoService _historico;

    public BlingOrdemServicoServiceLocalBypass(
        IOsLocalRepository localRepo,
        IDevSequenceRepository sequences,
        IOsEstoqueBaixaService osEstoque,
        IOsHistoricoService historico)
    {
        _localRepo = localRepo;
        _sequences = sequences;
        _osEstoque = osEstoque;
        _historico = historico;
    }

    public async Task<OsListaPaginada<BlingOrdemServico>> ListarAsync(OsListarFiltros? filtros = null)
    {
        var paginado = await _localRepo.ListarParaListaAsync(filtros);
        return new OsListaPaginada<BlingOrdemServico>
        {
            Itens = paginado.Itens.Select(BlingLocalMappings.ParaOrdemServicoLista).ToList(),
            Total = paginado.Total,
            Pagina = paginado.Pagina,
            TamanhoPagina = paginado.TamanhoPagina,
        };
    }

    public async Task<BlingOrdemServico> ObterAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");

        if (local.ExcluidoEm.HasValue)
            throw new KeyNotFoundException($"Ordem de Serviço {id} foi excluída.");

        if (OsSituacaoHelper.EhConcluida(local.Situacao)
            && (!OsSituacaoHelper.DataUtilValida(local.DataSaida) || !OsSituacaoHelper.DataUtilValida(local.DataConclusao)))
        {
            OsSituacaoHelper.AplicarDatasPorSituacao(local, local.Situacao);
            await _localRepo.SalvarAsync(local);
        }

        return BlingLocalMappings.ParaOrdemServico(local);
    }

    public async Task<BlingOrdemServico> CriarAsync(BlingOrdemServico os)
    {
        ValidarRetorno(os);
        var id = await _sequences.ProximoAsync("os", 1);
        var local = BlingLocalMappings.DeOrdemServico(os);
        local.BlingId = id;
        local.OsNumero ??= id.ToString();
        local.Situacao ??= OsSituacaoHelper.Aberto;
        local.DataEntrada ??= HorarioBrasil.Agora;
        local.Data ??= local.DataEntrada;
        OsSituacaoHelper.AplicarDatasPorSituacao(local, null);
        await _osEstoque.AplicarBaixasAsync(local);
        await _localRepo.SalvarAsync(local);
        await _historico.RegistrarAsync(local, OsHistoricoAcoes.Criar);
        return BlingLocalMappings.ParaOrdemServico(local);
    }

    public async Task<BlingOrdemServico> AtualizarAsync(long id, BlingOrdemServico os)
    {
        ValidarRetorno(os);
        var existente = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");
        if (existente.ExcluidoEm.HasValue)
            throw new KeyNotFoundException($"Ordem de Serviço {id} foi excluída.");

        // DeOrdemServico reutiliza `existente` e sobrescreve Itens — snapshot antes do mapeamento
        // para o estorno conseguir comparar peça removida/reduzida.
        var osAnterior = ClonarOsParaComparacaoEstoque(existente);
        var situacaoAnterior = existente.Situacao;
        var local = BlingLocalMappings.DeOrdemServico(os, existente);
        local.BlingId = id;
        local.MongoId = existente.MongoId;
        local.CriadoEm = existente.CriadoEm;
        // Mobile pode ter anexado fotos enquanto a OS era editada no balcão.
        var fresco = await _localRepo.ObterPorBlingIdAsync(id);
        local.FotosAparelho = fresco?.FotosAparelho?.ToList()
            ?? existente.FotosAparelho?.ToList()
            ?? [];
        local.IntakeToken = fresco?.IntakeToken ?? existente.IntakeToken;
        local.IntakeTokenExpiraEm = fresco?.IntakeTokenExpiraEm ?? existente.IntakeTokenExpiraEm;
        OsSituacaoHelper.AplicarDatasPorSituacao(local, situacaoAnterior);
        await _osEstoque.AplicarBaixasAsync(local, osAnterior);
        // Último merge antes do ReplaceOne: foto/token do celular podem ter entrado durante baixas.
        var frescoFinal = await _localRepo.ObterPorBlingIdAsync(id);
        if (frescoFinal is not null)
        {
            local.FotosAparelho = frescoFinal.FotosAparelho?.ToList() ?? [];
            local.IntakeToken = frescoFinal.IntakeToken;
            local.IntakeTokenExpiraEm = frescoFinal.IntakeTokenExpiraEm;
            // Senha preenchida no celular prevalece se o balcão não enviou valor.
            if (string.IsNullOrWhiteSpace(local.SenhaDispositivo)
                && !string.IsNullOrWhiteSpace(frescoFinal.SenhaDispositivo))
            {
                local.SenhaDispositivo = frescoFinal.SenhaDispositivo;
                local.SenhaDispositivoTipo = frescoFinal.SenhaDispositivoTipo;
            }
        }
        local.ExcluidoEm = existente.ExcluidoEm;
        local.ExcluidoPor = existente.ExcluidoPor;
        await _localRepo.SalvarAsync(local);
        await _historico.RegistrarAsync(
            local,
            OsHistoricoAcoes.Atualizar,
            $"Atualização — situação {local.Situacao}");
        return BlingLocalMappings.ParaOrdemServico(local);
    }

    /// <summary>
    /// Cópia leve da OS anterior (itens/baixa) — evita perder o estado ao mapear o PUT em cima do mesmo objeto.
    /// </summary>
    private static OsLocalData ClonarOsParaComparacaoEstoque(OsLocalData origem) => new()
    {
        BlingId = origem.BlingId,
        OsNumero = origem.OsNumero,
        Situacao = origem.Situacao,
        ModeloId = origem.ModeloId,
        ModeloNome = origem.ModeloNome,
        Itens = (origem.Itens ?? []).Select(i => new BlingOrdemServicoItem
        {
            Id = i.Id,
            Descricao = i.Descricao,
            Quantidade = i.Quantidade,
            TipoItem = i.TipoItem,
            PecaId = i.PecaId,
            QuantidadeEstoqueBaixada = i.QuantidadeEstoqueBaixada,
            Cor = i.Cor,
            CustoPeca = i.CustoPeca,
            OrigemPeca = i.OrigemPeca,
            EstoqueInsuficiente = i.EstoqueInsuficiente,
        }).ToList(),
    };

    public async Task AlterarSituacaoAsync(long id, string situacao, string? motivoCancelamento = null, DateTime? dataPrazoPeca = null, string? tecnicoNome = null)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");
        if (local.ExcluidoEm.HasValue)
            throw new KeyNotFoundException($"Ordem de Serviço {id} foi excluída.");

        situacao = OsSituacaoHelper.AjustarParaLoja(situacao, local.LojaOrigem);
        OsSituacaoHelper.ValidarMotivoCancelamento(situacao, motivoCancelamento);
        OsSituacaoHelper.ValidarSituacaoPorLoja(situacao, local.LojaOrigem);

        var situacaoAnterior = local.Situacao;

        if (OsSituacaoHelper.EhFinalizada(situacaoAnterior))
            throw new InvalidOperationException("Não é possível alterar a situação de uma OS concluída ou cancelada.");

        local.Situacao = situacao;
        if (!string.IsNullOrWhiteSpace(tecnicoNome))
            local.TecnicoNome = tecnicoNome.Trim();
        local.MotivoCancelamento = OsSituacaoHelper.EhCancelada(situacao)
            ? motivoCancelamento?.Trim()
            : null;

        if (OsSituacaoHelper.EhAguardandoPeca(situacao))
        {
            if (OsSituacaoHelper.DataUtilValida(dataPrazoPeca))
                local.DataPrazoPeca = dataPrazoPeca;
        }

        OsSituacaoHelper.AplicarDatasPorSituacao(local, situacaoAnterior);
        OsSituacaoHelper.ValidarPrazoPeca(local.Situacao, local.DataPrazoPeca);

        if (OsSituacaoHelper.EhCancelada(situacao) && !OsSituacaoHelper.EhCancelada(situacaoAnterior))
            await _osEstoque.EstornarBaixasAsync(local);

        await _localRepo.SalvarAsync(local);
        await _historico.RegistrarAsync(
            local,
            OsHistoricoAcoes.Situacao,
            $"Situação: {situacaoAnterior} → {local.Situacao}");
    }

    public async Task ExcluirAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Ordem de Serviço {id} não encontrada.");

        if (local.ExcluidoEm.HasValue)
            throw new InvalidOperationException("Esta OS já está excluída.");

        local.ExcluidoEm = DateTime.UtcNow;
        local.ExcluidoPor = "usuario";
        await _localRepo.SalvarAsync(local);
        await _historico.RegistrarAsync(local, OsHistoricoAcoes.Excluir);
    }

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

    private static void ValidarRetorno(BlingOrdemServico os)
    {
        if (os.Retorno != true) return;

        if (string.IsNullOrWhiteSpace(os.MotivoRetorno))
            throw new ArgumentException("Informe o motivo do retorno.");

        if (!os.OsOriginalBlingId.HasValue && string.IsNullOrWhiteSpace(os.OsOriginalNumero))
            throw new ArgumentException("Selecione a OS original do retorno.");
    }
}

public class BlingOrcamentoServiceLocalBypass : IBlingOrcamentoService
{
    public const int ValidadeDiasUteisPadrao = 7;

    private readonly IOrcamentoLocalRepository _localRepo;
    private readonly IDevSequenceRepository _sequences;
    private readonly IBlingOrdemServicoService _osService;
    private readonly IPecaEstoqueRepository _pecas;

    public BlingOrcamentoServiceLocalBypass(
        IOrcamentoLocalRepository localRepo,
        IDevSequenceRepository sequences,
        IBlingOrdemServicoService osService,
        IPecaEstoqueRepository pecas)
    {
        _localRepo = localRepo;
        _sequences = sequences;
        _osService = osService;
        _pecas = pecas;
    }

    public async Task<List<BlingOrcamento>> ListarAsync(string? situacao = null)
    {
        var locais = await _localRepo.ListarAsync(situacao);
        return locais.Select(BlingLocalMappings.ParaOrcamento).ToList();
    }

    public async Task<BlingOrcamento> ObterAsync(long id)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Orçamento {id} não encontrado.");
        return BlingLocalMappings.ParaOrcamento(local);
    }

    public async Task<BlingOrcamento> CriarAsync(BlingOrcamento orcamento)
    {
        AplicarPadroes(orcamento);
        var id = await _sequences.ProximoAsync("orcamento");
        var local = BlingLocalMappings.DeOrcamento(orcamento);
        local.BlingId = id;
        local.Numero ??= $"O{id}";
        local.Situacao ??= "Em aberto";
        local.Data ??= HorarioBrasil.Agora;
        local.Validade ??= HorarioBrasil.AdicionarDiasUteis(ValidadeDiasUteisPadrao, local.Data);
        await _localRepo.SalvarAsync(local);
        return BlingLocalMappings.ParaOrcamento(local);
    }

    public async Task<BlingOrcamento> AtualizarAsync(long id, BlingOrcamento orcamento)
    {
        var existente = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        if (existente.OsGeradaBlingId.HasValue)
            throw new InvalidOperationException("Orçamento já convertido em OS — não pode ser editado.");

        AplicarPadroes(orcamento);
        var local = BlingLocalMappings.DeOrcamento(orcamento, existente);
        local.BlingId = id;
        local.MongoId = existente.MongoId;
        local.CriadoEm = existente.CriadoEm;
        local.Validade ??= HorarioBrasil.AdicionarDiasUteis(ValidadeDiasUteisPadrao, local.Data);
        await _localRepo.SalvarAsync(local);
        return BlingLocalMappings.ParaOrcamento(local);
    }

    public async Task<BlingOrdemServico> ConverterEmOsAsync(long id, string? lojaOrigem = null)
    {
        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        if (local.OsGeradaBlingId.HasValue)
            throw new InvalidOperationException(
                $"Orçamento já convertido na OS #{local.OsGeradaNumero ?? local.OsGeradaBlingId.ToString()}.");

        if (local.Contato is null || local.Contato.Id <= 0)
            throw new ArgumentException("Orçamento sem cliente — informe o cliente antes de converter.");

        if (string.IsNullOrWhiteSpace(local.ModeloId))
            throw new ArgumentException("Informe o modelo do aparelho no orçamento antes de converter.");

        if (local.Validade is { } validade && validade.Date < HorarioBrasil.Agora.Date)
            throw new InvalidOperationException("Orçamento vencido. Renove a validade antes de converter em OS.");

        // Catálogo do modelo: se houver estoque, vira peça e a criação da OS debita.
        var catalogo = await _pecas.ConsultarServicosValoresAsync(local.ModeloId!);
        var pecasPorId = catalogo.Pecas
            .Where(p => !string.IsNullOrWhiteSpace(p.PecaId))
            .GroupBy(p => p.PecaId, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var itens = new List<BlingOrdemServicoItem>();
        foreach (var i in local.Itens ?? [])
        {
            if (string.IsNullOrWhiteSpace(i.Descricao) && (i.ValorAcontado ?? i.ValorUnitario) <= 0)
                continue;

            var valor = i.ValorAcontado ?? i.ValorUnitario;
            var qtd = i.Quantidade <= 0 ? 1 : i.Quantidade;
            var qtdNecessaria = (int)Math.Max(1, Math.Ceiling(qtd));

            var item = new BlingOrdemServicoItem
            {
                Descricao = string.IsNullOrWhiteSpace(i.Descricao) ? "Serviço" : i.Descricao.Trim(),
                Quantidade = qtd,
                ValorUnitario = valor,
                ValorAcontado = valor,
                TipoItem = "servico",
                PecaId = i.PecaId,
                VariacaoRotulo = i.VariacaoRotulo,
                ValorSugeridoMinimo = i.ValorSugeridoMinimo,
                ValorSugeridoTroca = i.ValorSugeridoTroca,
                ValorOutraAssistencia = i.ValorOutraAssistencia,
                AcrescimoOutraAssistenciaTipo = i.AcrescimoOutraAssistenciaTipo,
                AcrescimoOutraAssistenciaValor = i.AcrescimoOutraAssistenciaValor,
            };

            if (!string.IsNullOrWhiteSpace(i.PecaId)
                && pecasPorId.TryGetValue(i.PecaId, out var peca)
                && peca.QuantidadeEstoque >= qtdNecessaria)
            {
                item.TipoItem = "peca";
                item.OrigemPeca = "estoque";
                item.MarcaPeca = peca.MarcaPeca;
                item.Parcelamento = peca.Parcelamento;

                var coresComEstoque = (peca.Cores ?? [])
                    .Where(c => !string.IsNullOrWhiteSpace(c.Cor) && c.Quantidade > 0)
                    .ToList();
                if (coresComEstoque.Count == 1)
                    item.Cor = coresComEstoque[0].Cor.Trim();

                if (string.IsNullOrWhiteSpace(item.Descricao) || item.Descricao == "Serviço")
                {
                    item.Descricao = string.IsNullOrWhiteSpace(i.VariacaoRotulo)
                        ? peca.Nome
                        : $"{peca.Nome} — {i.VariacaoRotulo}";
                    if (!string.IsNullOrWhiteSpace(item.Cor))
                        item.Descricao += $" ({item.Cor})";
                }
            }

            itens.Add(item);
        }

        if (itens.Count == 0)
            throw new ArgumentException("Inclua ao menos um serviço/valor no orçamento antes de converter.");

        var valorAcordado = local.ValorAVista
            ?? local.ValorTotalAcordado
            ?? local.ValorTotal
            ?? itens.Sum(i => (i.ValorAcontado ?? i.ValorUnitario) * i.Quantidade);

        var os = new BlingOrdemServico
        {
            Contato = local.Contato,
            Situacao = OsSituacaoHelper.Aberto,
            LojaOrigem = OsLojaHelper.Normalizar(
                !string.IsNullOrWhiteSpace(lojaOrigem) ? lojaOrigem : local.LojaOrigem),
            TipoServico = "orcamento",
            MarcaId = local.MarcaId,
            MarcaNome = local.MarcaNome,
            ModeloId = local.ModeloId,
            ModeloNome = local.ModeloNome,
            Equipamento = local.Equipamento
                ?? string.Join(' ', new[] { local.MarcaNome, local.ModeloNome }.Where(s => !string.IsNullOrWhiteSpace(s))),
            EstadoTela = "A avaliar",
            CondicoesAparelho = "Conforme orçamento",
            Defeito = string.IsNullOrWhiteSpace(local.Observacoes)
                ? $"Serviço conforme orçamento {local.Numero}"
                : local.Observacoes.Trim(),
            Observacoes = $"Convertido do orçamento {local.Numero}"
                + (local.ValorAVista is > 0 || local.ValorAPrazo is > 0
                    ? $" · Opções: à vista {local.ValorAVista:C} / a prazo {local.ValorAPrazo:C}"
                      + (local.ParcelasPagamento is > 1 ? $" em {local.ParcelasPagamento}x" : "")
                    : ""),
            ObservacoesInternas = $"Origem: orçamento {local.Numero} (id {local.BlingId})",
            ValorTotalAcordado = valorAcordado,
            ValorTotal = valorAcordado,
            FormaPagamento = null,
            ParcelasPagamento = local.ParcelasPagamento is >= 2 ? local.ParcelasPagamento : null,
            Itens = itens,
            DataEntrada = HorarioBrasil.Agora,
            Data = HorarioBrasil.Agora,
        };

        OsOrdemValidacao.Validar(os);
        var criada = await _osService.CriarAsync(os);

        local.OsGeradaBlingId = criada.Id;
        local.OsGeradaNumero = criada.Numero;
        local.Situacao = "Convertido";
        local.AtualizadoEm = DateTime.UtcNow;
        await _localRepo.SalvarAsync(local);

        return criada;
    }

    public async Task VincularOsAsync(long id, long osBlingId, string? osNumero = null)
    {
        if (osBlingId <= 0)
            throw new ArgumentException("Informe a OS gerada.");

        var local = await _localRepo.ObterPorBlingIdAsync(id)
            ?? throw new KeyNotFoundException($"Orçamento {id} não encontrado.");

        if (local.OsGeradaBlingId is long ja && ja > 0 && ja != osBlingId)
            throw new InvalidOperationException(
                $"Orçamento já vinculado à OS #{local.OsGeradaNumero ?? local.OsGeradaBlingId.ToString()}.");

        local.OsGeradaBlingId = osBlingId;
        local.OsGeradaNumero = string.IsNullOrWhiteSpace(osNumero) ? local.OsGeradaNumero : osNumero.Trim();
        local.Situacao = "Convertido";
        local.AtualizadoEm = DateTime.UtcNow;
        await _localRepo.SalvarAsync(local);
    }

    private static void AplicarPadroes(BlingOrcamento orcamento)
    {
        if (orcamento.Contato is null || orcamento.Contato.Id <= 0)
            throw new ArgumentException("Informe o cliente.");

        orcamento.LojaOrigem = OsLojaHelper.Normalizar(orcamento.LojaOrigem);

        var somaItens = (orcamento.Itens ?? []).Sum(i =>
        {
            var unit = i.ValorAcontado ?? i.ValorUnitario;
            var qtd = i.Quantidade <= 0 ? 1 : i.Quantidade;
            var desc = Math.Clamp(i.Desconto ?? 0, 0, 100);
            return qtd * unit * (1 - desc / 100m);
        });

        // Valor combinado = soma dos valores desejados dos itens inclusos.
        orcamento.ValorTotalAcordado = somaItens;
        orcamento.ValorTotal = somaItens;

        if (orcamento.ValorAVista is null or <= 0)
            orcamento.ValorAVista = somaItens;
        if (orcamento.ValorAPrazo is null or <= 0)
            orcamento.ValorAPrazo = somaItens;

        if (orcamento.ParcelasPagamento is null or < 2)
            orcamento.ParcelasPagamento = 2;

        orcamento.TipoContato = string.IsNullOrWhiteSpace(orcamento.TipoContato)
            ? "whatsapp_internet"
            : orcamento.TipoContato.Trim().ToLowerInvariant() switch
            {
                "atendimento_local" or "local" => "atendimento_local",
                _ => "whatsapp_internet",
            };

        orcamento.JustificativaAguardo = string.IsNullOrWhiteSpace(orcamento.JustificativaAguardo)
            ? null
            : orcamento.JustificativaAguardo.Trim();

        // Sem justificativa, não mantém data de retorno.
        if (string.IsNullOrWhiteSpace(orcamento.JustificativaAguardo))
            orcamento.DataRetornoMensagem = null;
        else if (orcamento.DataRetornoMensagem is { } d)
            orcamento.DataRetornoMensagem = d.Date;
    }
}
