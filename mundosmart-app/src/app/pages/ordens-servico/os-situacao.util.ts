import {
  SITUACAO_OS_CANCELADO,
  SITUACAO_OS_CONCLUIDO,
  normalizarSituacaoOs,
} from '../../config/os-situacao.config';

export {
  SITUACAO_OS_ABERTO,
  SITUACAO_OS_EM_TRANSPORTE,
  SITUACAO_OS_NA_ASSISTENCIA,
  SITUACAO_OS_EM_ANDAMENTO,
  SITUACAO_OS_EM_TESTE,
  SITUACAO_OS_AGUARDANDO_PECA,
  SITUACAO_OS_AGUARDANDO_APROVACAO,
  SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  SITUACAO_OS_AGUARDANDO_CLIENTE,
  SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO,
  SITUACAO_OS_REPARO_AVANCADO_PLACA,
  TECNICO_OS_REPARO_AVANCADO_PLACA,
  SITUACAO_OS_CELULAR_DA_LOJA,
  SITUACAO_OS_CANCELADO,
  SITUACAO_OS_CONCLUIDO,
  SITUACAO_OS_PADRAO,
  PRAZO_AGUARDANDO_PECA_DIAS_PADRAO,
  SITUACOES_OS,
  SITUACOES_OS_FILTRO,
  SITUACOES_OS_PRE_ASSISTENCIA,
  normalizarSituacaoOs,
  osSituacaoAguardandoCliente,
  osSituacaoRetiradoAguardandoPagamento,
  osSituacaoReparoAvancadoPlaca,
  osSituacaoCelularDaLoja,
  clienteEhLojaMundoSmart,
  osSituacaoForaFiltroPadrao,
  tecnicoFixoDaSituacao,
  resolverTecnicoFixo,
  osSituacaoAguardandoPeca,
  osSituacaoEmTeste,
  osSituacaoAguardandoRetornoLoja,
  osSituacaoExigeTecnico,
  osPrecisaEscolherTecnico,
  osSituacaoPreAssistencia,
  situacaoPadraoPorLoja,
  situacoesDisponiveisPorLoja,
  situacoesDisponiveisParaCliente,
  ajustarSituacaoParaLoja,
  lojaOsEhMococa,
  prazoPecaPadraoDatetimeLocal,
} from '../../config/os-situacao.config';

export function osSituacaoConcluida(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_CONCLUIDO;
}

export function osSituacaoCancelada(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_CANCELADO;
}

/** OS concluída ou cancelada — situação não pode mais ser alterada na grid. */
export function osSituacaoFinalizada(situacao?: string | null): boolean {
  return osSituacaoConcluida(situacao) || osSituacaoCancelada(situacao);
}
