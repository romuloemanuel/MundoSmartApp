using MundoSmart.BlingAssistencia.API.Config;
using MundoSmart.BlingAssistencia.API.Models.Bling;
using MundoSmart.BlingAssistencia.API.Repositories;

namespace MundoSmart.BlingAssistencia.API.Services;

public static class OsOrdemValidacao
{
    public static void Validar(BlingOrdemServico os)
    {
        if (os.Contato?.Id is null or <= 0)
            throw new ArgumentException("Informe o cliente.");

        if (string.IsNullOrWhiteSpace(os.ModeloId))
            throw new ArgumentException("Informe o modelo do aparelho.");

        if (string.IsNullOrWhiteSpace(os.EstadoTela))
            throw new ArgumentException("Informe o estado da tela.");

        if (string.IsNullOrWhiteSpace(os.CondicoesAparelho))
            throw new ArgumentException("Informe as condições gerais do aparelho.");

        if (string.IsNullOrWhiteSpace(os.Defeito))
            throw new ArgumentException("Informe o defeito relatado pelo cliente.");

        if (string.IsNullOrWhiteSpace(os.TipoServico))
            throw new ArgumentException("Informe o tipo de serviço.");

        ValidarSenhaDispositivo(os);

        os.Situacao = OsSituacaoHelper.AjustarParaLoja(os.Situacao, os.LojaOrigem);
        OsSituacaoHelper.ValidarMotivoCancelamento(os.Situacao, os.MotivoCancelamento);
        OsSituacaoHelper.ValidarSituacaoPorLoja(os.Situacao, os.LojaOrigem);

        if (OsSituacaoHelper.EhAguardandoPeca(os.Situacao)
            && !OsSituacaoHelper.DataUtilValida(os.DataPrazoPeca))
        {
            os.DataPrazoPeca = HorarioBrasil.Agora.AddDays(OsSituacaoHelper.PrazoAguardandoPecaDiasPadrao);
        }

        OsSituacaoHelper.ValidarPrazoPeca(os.Situacao, os.DataPrazoPeca);
    }

    private static void ValidarSenhaDispositivo(BlingOrdemServico os)
    {
        var tipo = os.SenhaDispositivoTipo?.Trim();
        if (string.IsNullOrWhiteSpace(tipo))
            throw new ArgumentException("Informe o tipo de senha do aparelho.");

        // Legado: "sem senha" era gravado como tipo vazio — aceita sem_senha explícito.
        if (tipo is "sem_senha" or "nao_deixou")
            return;

        if (tipo is not ("numerica" or "desenho"))
            throw new ArgumentException("Tipo de senha inválido. Escolha senha, desenho, sem senha ou cliente não deixou.");

        if (string.IsNullOrWhiteSpace(os.SenhaDispositivo)
            || string.Equals(os.SenhaDispositivo.Trim(), "nao_deixou", StringComparison.OrdinalIgnoreCase)
            || string.Equals(os.SenhaDispositivo.Trim(), "sem_senha", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException(
                tipo == "desenho"
                    ? "Registre o desenho de desbloqueio do aparelho."
                    : "Informe a senha do aparelho.");
        }
    }

    /// <summary>
    /// Exige técnico cadastrado e ativo em: Aguardando Cliente Retirar, Concluído e Cancelado.
    /// </summary>
    public static async Task ValidarTecnicoAsync(
        string? situacao,
        string? tecnicoNome,
        ITecnicoRepository tecnicos)
    {
        if (!OsSituacaoHelper.ExigeTecnico(situacao)) return;

        if (string.IsNullOrWhiteSpace(tecnicoNome))
            throw new ArgumentException("Informe o técnico responsável.");

        var tecnico = await tecnicos.ObterPorNomeAtivoAsync(tecnicoNome.Trim());
        if (tecnico is null)
            throw new ArgumentException("O técnico responsável deve ser um técnico cadastrado e ativo.");
    }
}
