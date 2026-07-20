using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Models.Mongo;
using MundoSmart.BlingAssistencia.API.Services;
using JustificativaAtrasoDto = MundoSmart.BlingAssistencia.API.Models.Bling.JustificativaAtrasoItem;
using JustificativaAtrasoLocal = MundoSmart.BlingAssistencia.API.Models.Mongo.JustificativaAtrasoItem;

namespace MundoSmart.BlingAssistencia.API.Services;

internal static class BlingLocalMappings
{
    public static BlingContato ParaContato(ClienteLocalData local) => new()
    {
        Id = local.BlingId,
        Nome = local.Nome,
        Email = local.Email,
        Telefone = local.Telefone,
        Celular = local.Celular,
        CpfCnpj = local.CpfCnpj,
        Ie = local.Ie,
        Rg = local.Rg,
        Fantasia = local.Fantasia,
        Tipo = local.Tipo,
        Endereco = local.Endereco,
        Telefone2 = local.Telefone2,
        Contatos = local.Contatos.Select(c => new ContatoPrincipalDto
        {
            Nome = c.Nome,
            Telefone = c.Telefone,
            Celular = c.Celular,
            Parentesco = c.Parentesco
        }).ToList()
    };

    public static ClienteLocalData DeContato(BlingContato contato, long blingId, ClienteLocalData? existente = null)
    {
        var local = existente ?? new ClienteLocalData { BlingId = blingId, CriadoEm = DateTime.UtcNow };
        local.BlingId = blingId;
        local.Nome = contato.Nome;
        local.Email = contato.Email;
        local.Telefone = contato.Telefone;
        local.Celular = contato.Celular;
        local.CpfCnpj = contato.CpfCnpj;
        local.Ie = contato.Ie;
        local.Rg = contato.Rg;
        local.Fantasia = contato.Fantasia;
        local.Tipo = contato.Tipo;
        local.Endereco = contato.Endereco;
        local.Telefone2 = contato.Telefone2;
        local.Contatos = (contato.Contatos ?? []).Take(2).Select(c => new ContatoPrincipalLocal
        {
            Nome = c.Nome,
            Telefone = c.Telefone,
            Celular = c.Celular,
            Parentesco = c.Parentesco
        }).ToList();
        return local;
    }

    public static BlingOrdemServico ParaOrdemServico(OsLocalData local)
    {
        var os = new BlingOrdemServico
        {
            Id = local.BlingId,
            Numero = local.OsNumero,
            Situacao = OsSituacaoHelper.AjustarParaLoja(local.Situacao, local.LojaOrigem),
            MotivoCancelamento = local.MotivoCancelamento,
            Data = local.Data ?? local.DataEntrada,
            DataPrevista = local.DataPrevista ?? local.DataPrevistaTermino,
            DataAtualizacao = local.DataAtualizacao,
            DataConclusao = local.DataConclusao,
            Descricao = local.Descricao,
            Equipamento = local.Equipamento,
            Imei = local.Imei,
            CpfCnpj = local.CpfCnpj,
            Defeito = local.Defeito,
            TemRisco = local.TemRisco,
            RiscoAcordado = local.RiscoAcordado,
            Observacoes = local.Observacoes,
            ValorTotal = local.ValorTotalAcordado ?? local.ValorTotal,
            ValorTotalAcordado = local.ValorTotalAcordado ?? local.ValorTotal,
            FormaPagamento = local.FormaPagamento,
            ParcelasPagamento = local.ParcelasPagamento,
            Juros = local.Juros,
            Retorno = local.Retorno,
            MotivoRetorno = local.MotivoRetorno,
            ObservacoesInternas = local.ObservacoesInternas,
            LojaOrigem = OsLojaHelper.Normalizar(local.LojaOrigem),
            Itens = local.Itens,
            MarcaId = local.MarcaId,
            MarcaNome = local.MarcaNome,
            ModeloId = local.ModeloId,
            ModeloNome = local.ModeloNome,
            DataEntrada = local.DataEntrada,
            DataInicioAssistencia = local.DataInicioAssistencia,
            DataPrazoPeca = local.DataPrazoPeca,
            DataUltimaAlteracaoSituacao = local.DataUltimaAlteracaoSituacao,
            JustificativasAtraso = MapJustificativasAtraso(local),
            DataPrevistaTermino = local.DataPrevistaTermino,
            DataSaida = local.DataSaida,
            EstadoTela = local.EstadoTela,
            CondicoesAparelho = local.CondicoesAparelho,
            Acessorios = local.Acessorios,
            TecnicoNome = local.TecnicoNome,
            TecnicoObservacoes = local.TecnicoObservacoes,
            OsOriginalNumero = local.OsOriginalNumero,
            OsOriginalBlingId = local.OsOriginalBlingId,
            TipoPecaProblemaId = local.TipoPecaProblemaId,
            TipoPecaProblemaNome = local.TipoPecaProblemaNome,
            TipoServico = local.TipoServico,
            TesteEntrada = local.TesteEntrada,
            TesteSaida = local.TesteSaida,
            TesteEntradaRealizado = local.TesteEntradaRealizado,
            TesteSaidaRealizado = local.TesteSaidaRealizado,
            ContatoPrincipalIndice = local.ContatoPrincipalIndice,
            PreferenciaContatoSelecionado = local.PreferenciaContatoSelecionado,
            SenhaDispositivoTipo = local.SenhaDispositivoTipo,
            SenhaDispositivo = local.SenhaDispositivo,
            GarantiaDias = local.GarantiaDias,
            FotosAparelho = local.FotosAparelho?.Select(f => new OsFotoAparelhoInfo
            {
                Id = f.Id,
                NomeArquivo = f.NomeArquivo,
                Url = f.Url,
                CriadoEm = f.CriadoEm,
                Categoria = f.Categoria,
                DescricaoFoco = f.DescricaoFoco
            }).ToList()
        };

        if (local.ContatoId.HasValue || !string.IsNullOrWhiteSpace(local.ContatoNome))
        {
            os.Contato = new BlingContatoRef
            {
                Id = local.ContatoId ?? 0,
                Nome = local.ContatoNome,
                Telefone = local.ContatoTelefone,
                Celular = local.ContatoCelular
            };
        }

        if (local.ContatoAviso is not null)
        {
            os.ContatoAviso = new BlingContatoRef
            {
                Id = 0,
                Nome = local.ContatoAviso.Nome,
                Telefone = local.ContatoAviso.Telefone,
                Celular = local.ContatoAviso.Celular,
                Parentesco = local.ContatoAviso.Parentesco,
                AutorizadoRetirada = local.ContatoAviso.AutorizadoRetirada
            };
        }

        return os;
    }

    /// <summary>Mapeamento enxuto para listagem (sem senha, fotos, itens).</summary>
    public static BlingOrdemServico ParaOrdemServicoLista(OsLocalData local)
    {
        var os = new BlingOrdemServico
        {
            Id = local.BlingId,
            Numero = local.OsNumero,
            Situacao = local.Situacao,
            Data = local.Data ?? local.DataEntrada,
            DataEntrada = local.DataEntrada ?? local.Data,
            DataInicioAssistencia = local.DataInicioAssistencia,
            DataPrazoPeca = local.DataPrazoPeca,
            DataUltimaAlteracaoSituacao = local.DataUltimaAlteracaoSituacao,
            JustificativasAtraso = MapJustificativasAtraso(local),
            DataAtualizacao = local.DataAtualizacao,
            DataConclusao = local.DataConclusao,
            Equipamento = local.Equipamento,
            Imei = local.Imei,
            CpfCnpj = local.CpfCnpj,
            ValorTotal = local.ValorTotalAcordado ?? local.ValorTotal,
            ValorTotalAcordado = local.ValorTotalAcordado ?? local.ValorTotal,
            FormaPagamento = local.FormaPagamento,
            ParcelasPagamento = local.ParcelasPagamento,
            Juros = local.Juros,
            Retorno = local.Retorno,
            TecnicoNome = local.TecnicoNome,
            MarcaNome = local.MarcaNome,
            ModeloNome = local.ModeloNome,
            Defeito = local.Defeito,
            TemRisco = local.TemRisco,
            RiscoAcordado = local.RiscoAcordado,
            TipoPecaProblemaNome = local.TipoPecaProblemaNome,
            PreferenciaContatoSelecionado = local.PreferenciaContatoSelecionado,
            LojaOrigem = OsLojaHelper.Normalizar(local.LojaOrigem),
        };

        if (local.ContatoId.HasValue || !string.IsNullOrWhiteSpace(local.ContatoNome))
        {
            os.Contato = new BlingContatoRef
            {
                Id = local.ContatoId ?? 0,
                Nome = local.ContatoNome,
                Telefone = local.ContatoTelefone,
                Celular = local.ContatoCelular,
            };
        }

        if (local.ContatoAviso is not null)
        {
            os.ContatoAviso = new BlingContatoRef
            {
                Id = 0,
                Nome = local.ContatoAviso.Nome,
                Telefone = local.ContatoAviso.Telefone,
                Celular = local.ContatoAviso.Celular,
                Parentesco = local.ContatoAviso.Parentesco,
                AutorizadoRetirada = local.ContatoAviso.AutorizadoRetirada,
            };
        }

        return os;
    }

    public static OsLocalData DeOrdemServico(BlingOrdemServico os, OsLocalData? existente = null)
    {
        var local = existente ?? new OsLocalData { CriadoEm = DateTime.UtcNow };
        if (os.Contato is not null)
        {
            local.ContatoId = os.Contato.Id > 0 ? os.Contato.Id : local.ContatoId;
            local.ContatoNome = os.Contato.Nome;
            local.ContatoTelefone = os.Contato.Telefone;
            local.ContatoCelular = os.Contato.Celular;
        }

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

        local.Imei = os.Imei;
        local.CpfCnpj = os.CpfCnpj;
        local.Retorno = os.Retorno ?? false;
        local.MotivoRetorno = string.IsNullOrWhiteSpace(os.MotivoRetorno) ? null : os.MotivoRetorno.Trim();
        local.ObservacoesInternas = os.ObservacoesInternas;
        local.LojaOrigem = OsLojaHelper.Normalizar(os.LojaOrigem);
        local.MarcaId = os.MarcaId;
        local.MarcaNome = os.MarcaNome;
        local.ModeloId = os.ModeloId;
        local.ModeloNome = os.ModeloNome;
        local.DataEntrada = HorarioBrasil.ComoUtcParede(os.DataEntrada ?? os.Data);
        local.DataInicioAssistencia = OsSituacaoHelper.DataUtilValida(existente?.DataInicioAssistencia)
            ? existente!.DataInicioAssistencia
            : (OsSituacaoHelper.DataUtilValida(os.DataInicioAssistencia)
                ? HorarioBrasil.ComoUtcParede(os.DataInicioAssistencia)
                : null);
        local.DataPrazoPeca = OsSituacaoHelper.DataUtilValida(os.DataPrazoPeca)
            ? HorarioBrasil.ComoUtcParede(os.DataPrazoPeca)
            : existente?.DataPrazoPeca;
        local.DataUltimaAlteracaoSituacao = OsSituacaoHelper.DataUtilValida(existente?.DataUltimaAlteracaoSituacao)
            ? existente!.DataUltimaAlteracaoSituacao
            : (OsSituacaoHelper.DataUtilValida(os.DataUltimaAlteracaoSituacao)
                ? HorarioBrasil.ComoUtcParede(os.DataUltimaAlteracaoSituacao)
                : null);
        local.JustificativasAtraso = (os.JustificativasAtraso ?? [])
            .Where(j => !string.IsNullOrWhiteSpace(j.Texto))
            .Select(j => new JustificativaAtrasoLocal
            {
                Texto = j.Texto.Trim(),
                CriadoEm = HorarioBrasil.ComoUtcParede(j.CriadoEm) ?? HorarioBrasil.Agora
            })
            .ToList();
        local.JustificativaAtrasoLegado = null;
        local.DataPrevistaTermino = HorarioBrasil.ComoUtcParede(os.DataPrevistaTermino ?? os.DataPrevista);
        local.DataAtualizacao = HorarioBrasil.ComoUtcParede(os.DataAtualizacao) ?? HorarioBrasil.Agora;
        local.DataConclusao = OsSituacaoHelper.DataUtilValida(os.DataConclusao)
            ? HorarioBrasil.ComoUtcParede(os.DataConclusao)
            : existente?.DataConclusao;
        local.DataSaida = OsSituacaoHelper.DataUtilValida(os.DataSaida)
            ? HorarioBrasil.ComoUtcParede(os.DataSaida)
            : existente?.DataSaida;
        local.Data = HorarioBrasil.ComoUtcParede(os.Data) ?? local.DataEntrada;
        local.DataPrevista = HorarioBrasil.ComoUtcParede(os.DataPrevista) ?? local.DataPrevistaTermino;
        local.EstadoTela = os.EstadoTela;
        local.CondicoesAparelho = os.CondicoesAparelho;
        local.Acessorios = os.Acessorios ?? [];
        local.TecnicoNome = os.TecnicoNome;
        local.TecnicoObservacoes = os.TecnicoObservacoes;
        local.OsOriginalNumero = os.OsOriginalNumero;
        local.OsOriginalBlingId = os.OsOriginalBlingId;
        local.TipoPecaProblemaId = os.TipoPecaProblemaId;
        local.TipoPecaProblemaNome = os.TipoPecaProblemaNome;
        local.TipoServico = os.TipoServico;
        local.TesteEntrada = os.TesteEntrada;
        local.TesteSaida = os.TesteSaida;
        local.TesteEntradaRealizado = os.TesteEntradaRealizado;
        local.TesteSaidaRealizado = os.TesteSaidaRealizado;
        local.Defeito = os.Defeito;
        local.TemRisco = os.TemRisco;
        local.RiscoAcordado = os.TemRisco
            ? (string.IsNullOrWhiteSpace(os.RiscoAcordado) ? null : os.RiscoAcordado.Trim())
            : null;
        local.ContatoPrincipalIndice = os.ContatoPrincipalIndice;
        local.PreferenciaContatoSelecionado = os.PreferenciaContatoSelecionado;
        local.SenhaDispositivoTipo = string.IsNullOrWhiteSpace(os.SenhaDispositivoTipo) ? null : os.SenhaDispositivoTipo;
        local.SenhaDispositivo = string.IsNullOrWhiteSpace(os.SenhaDispositivo) ? null : os.SenhaDispositivo.Trim();
        local.Situacao = OsSituacaoHelper.AjustarParaLoja(os.Situacao, local.LojaOrigem);
        local.MotivoCancelamento = OsSituacaoHelper.EhCancelada(local.Situacao)
            ? (string.IsNullOrWhiteSpace(os.MotivoCancelamento) ? null : os.MotivoCancelamento.Trim())
            : null;
        local.Descricao = os.Descricao;
        local.Equipamento = os.Equipamento;
        local.Observacoes = os.Observacoes;
        local.ValorTotal = os.ValorTotalAcordado ?? os.ValorTotal;
        local.ValorTotalAcordado = os.ValorTotalAcordado ?? os.ValorTotal;
        local.FormaPagamento = string.IsNullOrWhiteSpace(os.FormaPagamento) ? null : os.FormaPagamento.Trim();
        local.ParcelasPagamento = os.ParcelasPagamento;
        local.Juros = os.Juros is < 0 ? 0 : os.Juros;
        local.GarantiaDias = os.GarantiaDias > 0 ? os.GarantiaDias : existente?.GarantiaDias;
        local.Itens = os.Itens ?? [];
        local.OsNumero = os.Numero ?? local.OsNumero;
        // Fotos / token de intake: só via endpoints dedicados — não apagar no PUT da OS.
        if (existente is not null)
        {
            local.FotosAparelho = existente.FotosAparelho ?? [];
            local.IntakeToken = existente.IntakeToken;
            local.IntakeTokenExpiraEm = existente.IntakeTokenExpiraEm;
        }
        return local;
    }

    public static BlingOrcamento ParaOrcamento(OrcamentoLocalData local) => new()
    {
        Id = local.BlingId,
        Numero = local.Numero,
        Situacao = local.Situacao,
        Data = local.Data,
        Validade = local.Validade,
        Contato = local.Contato,
        LojaOrigem = OsLojaHelper.Normalizar(local.LojaOrigem),
        TipoContato = local.TipoContato,
        JustificativaAguardo = local.JustificativaAguardo,
        DataRetornoMensagem = local.DataRetornoMensagem,
        Observacoes = local.Observacoes,
        ValorTotal = local.ValorTotal,
        ValorTotalAcordado = local.ValorTotalAcordado,
        ValorAVista = local.ValorAVista,
        ValorAPrazo = local.ValorAPrazo,
        FormaPagamento = local.FormaPagamento,
        ParcelasPagamento = local.ParcelasPagamento,
        MarcaId = local.MarcaId,
        MarcaNome = local.MarcaNome,
        ModeloId = local.ModeloId,
        ModeloNome = local.ModeloNome,
        Equipamento = local.Equipamento,
        OsGeradaBlingId = local.OsGeradaBlingId,
        OsGeradaNumero = local.OsGeradaNumero,
        Itens = local.Itens
    };

    public static OrcamentoLocalData DeOrcamento(BlingOrcamento orcamento, OrcamentoLocalData? existente = null)
    {
        var local = existente ?? new OrcamentoLocalData { CriadoEm = DateTime.UtcNow };
        local.Numero = orcamento.Numero ?? local.Numero;
        local.Situacao = orcamento.Situacao;
        local.Data = orcamento.Data ?? HorarioBrasil.Agora;
        local.Validade = orcamento.Validade;
        local.Contato = orcamento.Contato;
        local.LojaOrigem = OsLojaHelper.Normalizar(orcamento.LojaOrigem);
        local.TipoContato = NormalizarTipoContatoOrcamento(orcamento.TipoContato);
        local.JustificativaAguardo = string.IsNullOrWhiteSpace(orcamento.JustificativaAguardo)
            ? null
            : orcamento.JustificativaAguardo.Trim();
        local.DataRetornoMensagem = orcamento.DataRetornoMensagem?.Date;
        local.Observacoes = orcamento.Observacoes;
        local.ValorTotal = orcamento.ValorTotal;
        local.ValorTotalAcordado = orcamento.ValorTotalAcordado;
        local.ValorAVista = orcamento.ValorAVista;
        local.ValorAPrazo = orcamento.ValorAPrazo;
        local.FormaPagamento = orcamento.FormaPagamento;
        local.ParcelasPagamento = orcamento.ParcelasPagamento;
        local.MarcaId = orcamento.MarcaId;
        local.MarcaNome = orcamento.MarcaNome;
        local.ModeloId = orcamento.ModeloId;
        local.ModeloNome = orcamento.ModeloNome;
        local.Equipamento = orcamento.Equipamento
            ?? string.Join(' ', new[] { orcamento.MarcaNome, orcamento.ModeloNome }.Where(s => !string.IsNullOrWhiteSpace(s)));
        local.OsGeradaBlingId = orcamento.OsGeradaBlingId ?? local.OsGeradaBlingId;
        local.OsGeradaNumero = orcamento.OsGeradaNumero ?? local.OsGeradaNumero;
        local.Itens = orcamento.Itens ?? [];
        local.AtualizadoEm = DateTime.UtcNow;
        return local;
    }

    public static List<BlingOrdemServico> FiltrarOrdens(List<BlingOrdemServico> lista, OsListarFiltros? filtros)
    {
        if (filtros is null) return lista;

        if (!string.IsNullOrWhiteSpace(filtros.Situacao))
        {
            var situacaoFiltro = OsSituacaoHelper.Normalizar(filtros.Situacao);
            lista = lista.Where(o => string.Equals(OsSituacaoHelper.Normalizar(o.Situacao), situacaoFiltro, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(filtros.Nome))
        {
            var termo = filtros.Nome.Trim().ToLower();
            lista = lista.Where(o =>
                (o.Numero?.Contains(termo, StringComparison.OrdinalIgnoreCase) ?? false) ||
                o.Id.ToString().Contains(termo) ||
                (o.Contato?.Nome?.ToLower().Contains(termo) ?? false) ||
                (o.ContatoAviso?.Nome?.ToLower().Contains(termo) ?? false) ||
                (o.Equipamento?.ToLower().Contains(termo) ?? false) ||
                (o.MarcaNome?.ToLower().Contains(termo) ?? false) ||
                (o.ModeloNome?.ToLower().Contains(termo) ?? false)).ToList();
        }
        if (!string.IsNullOrWhiteSpace(filtros.Telefone))
        {
            var digitos = new string(filtros.Telefone.Where(char.IsDigit).ToArray());
            lista = lista.Where(o =>
            {
                var contatoTel = new string((o.Contato?.Telefone ?? "").Where(char.IsDigit).ToArray());
                var contatoCel = new string((o.Contato?.Celular ?? "").Where(char.IsDigit).ToArray());
                var avisoTel = new string((o.ContatoAviso?.Telefone ?? "").Where(char.IsDigit).ToArray());
                var avisoCel = new string((o.ContatoAviso?.Celular ?? "").Where(char.IsDigit).ToArray());
                return contatoTel.Contains(digitos) || contatoCel.Contains(digitos)
                    || avisoTel.Contains(digitos) || avisoCel.Contains(digitos);
            }).ToList();
        }

        if (!string.IsNullOrWhiteSpace(filtros.Imei))
            lista = lista.Where(o => (o.Imei ?? "").Contains(filtros.Imei, StringComparison.OrdinalIgnoreCase)).ToList();

        if (!string.IsNullOrWhiteSpace(filtros.CpfCnpj))
        {
            var digitos = new string(filtros.CpfCnpj.Where(char.IsDigit).ToArray());
            lista = lista.Where(o =>
            {
                var osCpf = new string((o.CpfCnpj ?? "").Where(char.IsDigit).ToArray());
                return osCpf.Contains(digitos);
            }).ToList();
        }

        if (filtros.DataCadastroInicio.HasValue)
            lista = lista.Where(o => o.Data >= filtros.DataCadastroInicio).ToList();
        if (filtros.DataCadastroFim.HasValue)
            lista = lista.Where(o => o.Data <= filtros.DataCadastroFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (filtros.DataAtualizacaoInicio.HasValue)
            lista = lista.Where(o => o.DataAtualizacao >= filtros.DataAtualizacaoInicio).ToList();
        if (filtros.DataAtualizacaoFim.HasValue)
            lista = lista.Where(o => o.DataAtualizacao <= filtros.DataAtualizacaoFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (filtros.DataConclusaoInicio.HasValue)
            lista = lista.Where(o => o.DataConclusao >= filtros.DataConclusaoInicio).ToList();
        if (filtros.DataConclusaoFim.HasValue)
            lista = lista.Where(o => o.DataConclusao <= filtros.DataConclusaoFim.Value.AddDays(1).AddTicks(-1)).ToList();

        if (filtros.Retorno.HasValue)
            lista = lista.Where(o => o.Retorno == filtros.Retorno).ToList();

        if (!string.IsNullOrWhiteSpace(filtros.LojaOrigem))
        {
            var loja = OsLojaHelper.Normalizar(filtros.LojaOrigem);
            lista = lista.Where(o =>
                string.Equals(OsLojaHelper.Normalizar(o.LojaOrigem), loja, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        if (!string.IsNullOrWhiteSpace(filtros.TecnicoNome))
        {
            var tecnico = filtros.TecnicoNome.Trim();
            lista = lista.Where(o =>
                string.Equals(o.TecnicoNome?.Trim(), tecnico, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return lista;
    }

    private static List<JustificativaAtrasoDto> MapJustificativasAtraso(OsLocalData local)
    {
        var itens = local.JustificativasAtraso ?? [];
        if (itens.Count == 0 && !string.IsNullOrWhiteSpace(local.JustificativaAtrasoLegado))
        {
            return
            [
                new JustificativaAtrasoDto
                {
                    Texto = local.JustificativaAtrasoLegado.Trim(),
                    CriadoEm = local.DataAtualizacao ?? HorarioBrasil.Agora
                }
            ];
        }

        return itens
            .Where(j => !string.IsNullOrWhiteSpace(j.Texto))
            .Select(j => new JustificativaAtrasoDto
            {
                Texto = j.Texto.Trim(),
                CriadoEm = j.CriadoEm
            })
            .ToList();
    }

    private static string? NormalizarTipoContatoOrcamento(string? valor)
    {
        var v = (valor ?? "").Trim().ToLowerInvariant();
        return v switch
        {
            "whatsapp_internet" or "whatsapp" or "internet" => "whatsapp_internet",
            "atendimento_local" or "local" => "atendimento_local",
            _ => string.IsNullOrWhiteSpace(v) ? null : "whatsapp_internet",
        };
    }
}
