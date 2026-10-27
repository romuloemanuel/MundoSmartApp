import { LOJA_OS_MOCOCA, normalizarLojaOs } from './os-loja.config';
import { agoraDatetimeLocalBrasil } from '../utils/horario-brasil.util';

export const SITUACAO_OS_ABERTO = 'Aberto';
export const SITUACAO_OS_EM_TRANSPORTE = 'Em transporte';
/** Aparelho na oficina — a partir daqui o tempo de urgência/SLA começa. */
export const SITUACAO_OS_NA_ASSISTENCIA = 'Na assistência';
/** @deprecated use SITUACAO_OS_NA_ASSISTENCIA */
export const SITUACAO_OS_EM_ANDAMENTO = SITUACAO_OS_NA_ASSISTENCIA;
/** Serviço em teste / QA — exige técnico responsável. */
export const SITUACAO_OS_EM_TESTE = 'Em teste';
/** Aguardando peça externa chegar — exige prazo. */
export const SITUACAO_OS_AGUARDANDO_PECA = 'Aguardando Peça';
/** Aguardando o cliente aprovar orçamento / serviço. */
export const SITUACAO_OS_AGUARDANDO_APROVACAO = 'Aguardando aprovação do cliente';
/** Aparelho pronto indo/aguardando retorno à loja de origem — exige técnico. */
export const SITUACAO_OS_AGUARDANDO_RETORNO_LOJA = 'Aguardando Retorno a Loja';
/** Serviço pronto — aguardando o cliente retirar o aparelho. */
export const SITUACAO_OS_AGUARDANDO_CLIENTE = 'Aguardando Cliente Retirar';
/** Cliente já retirou o aparelho e o pagamento ainda está pendente. */
export const SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO = 'Retirado aguardando pagamento';
/**
 * Reparo especializado de placa.
 * Fica fora do filtro padrão da lista e é atribuído ao técnico Rômulo.
 */
export const SITUACAO_OS_REPARO_AVANCADO_PLACA = 'Reparo avançado em placa';
export const TECNICO_OS_REPARO_AVANCADO_PLACA = 'Rômulo';
/**
 * Aparelho da própria loja, sem prioridade de conserto.
 * Fora do filtro padrão da lista e do painel.
 */
export const SITUACAO_OS_CELULAR_DA_LOJA = 'Celular da loja';
export const SITUACAO_OS_CANCELADO = 'Cancelado';
export const SITUACAO_OS_CONCLUIDO = 'Concluído';

/** Valor do filtro de lista: em andamento, sem Concluído, Cancelado, placa e celular da loja. */
export const SITUACAO_OS_FILTRO_EXCETO_CONCLUIDO = '__exceto_concluido__';

/** Padrão para nova OS (todas as lojas). */
export const SITUACAO_OS_PADRAO = SITUACAO_OS_ABERTO;

/** Dias padrão do prazo ao entrar em Aguardando Peça. */
export const PRAZO_AGUARDANDO_PECA_DIAS_PADRAO = 3;

/** Aberto / Em transporte — SLA ainda não inicia. */
export const SITUACOES_OS_PRE_ASSISTENCIA: string[] = [
  SITUACAO_OS_ABERTO,
  SITUACAO_OS_EM_TRANSPORTE,
];

export const SITUACOES_OS: string[] = [
  SITUACAO_OS_ABERTO,
  SITUACAO_OS_EM_TRANSPORTE,
  SITUACAO_OS_NA_ASSISTENCIA,
  SITUACAO_OS_EM_TESTE,
  SITUACAO_OS_AGUARDANDO_PECA,
  SITUACAO_OS_AGUARDANDO_APROVACAO,
  SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  SITUACAO_OS_AGUARDANDO_CLIENTE,
  SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO,
  SITUACAO_OS_REPARO_AVANCADO_PLACA,
  SITUACAO_OS_CELULAR_DA_LOJA,
  SITUACAO_OS_CANCELADO,
  SITUACAO_OS_CONCLUIDO,
];

export const SITUACOES_OS_FILTRO: { value: string; label: string }[] = [
  { value: SITUACAO_OS_FILTRO_EXCETO_CONCLUIDO, label: 'Todas (exceto Concluído, Cancelado, placa e celular da loja)' },
  { value: '', label: 'Todas' },
  ...SITUACOES_OS.map(s => ({ value: s, label: s })),
];

const ALIASES: Record<string, string> = {
  'em aberto': SITUACAO_OS_ABERTO,
  aberto: SITUACAO_OS_ABERTO,
  'em transporte': SITUACAO_OS_EM_TRANSPORTE,
  transporte: SITUACAO_OS_EM_TRANSPORTE,
  'em andamento': SITUACAO_OS_NA_ASSISTENCIA,
  'na assistencia': SITUACAO_OS_NA_ASSISTENCIA,
  'na assistência': SITUACAO_OS_NA_ASSISTENCIA,
  assistencia: SITUACAO_OS_NA_ASSISTENCIA,
  assistência: SITUACAO_OS_NA_ASSISTENCIA,
  'em teste': SITUACAO_OS_EM_TESTE,
  teste: SITUACAO_OS_EM_TESTE,
  'aguardando peca': SITUACAO_OS_AGUARDANDO_PECA,
  'aguardando peça': SITUACAO_OS_AGUARDANDO_PECA,
  'aguardando aprovacao do cliente': SITUACAO_OS_AGUARDANDO_APROVACAO,
  'aguardando aprovação do cliente': SITUACAO_OS_AGUARDANDO_APROVACAO,
  'aguardando retorno a loja': SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  'aguardando retorno à loja': SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  'aguardando retorno loja': SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  'retorno a loja': SITUACAO_OS_AGUARDANDO_RETORNO_LOJA,
  'aguardando cliente': SITUACAO_OS_AGUARDANDO_CLIENTE,
  'aguardando cliente retirar': SITUACAO_OS_AGUARDANDO_CLIENTE,
  'aguardando retirada': SITUACAO_OS_AGUARDANDO_CLIENTE,
  'retirado aguardando pagamento': SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO,
  'retirado aguardando pagto': SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO,
  'reparo avançado em placa': SITUACAO_OS_REPARO_AVANCADO_PLACA,
  'reparo avancado em placa': SITUACAO_OS_REPARO_AVANCADO_PLACA,
  'reparo em placa': SITUACAO_OS_REPARO_AVANCADO_PLACA,
  'celular da loja': SITUACAO_OS_CELULAR_DA_LOJA,
  'celular loja': SITUACAO_OS_CELULAR_DA_LOJA,
  'sem prioridade': SITUACAO_OS_CELULAR_DA_LOJA,
  cancelada: SITUACAO_OS_CANCELADO,
  cancelado: SITUACAO_OS_CANCELADO,
  concluida: SITUACAO_OS_CONCLUIDO,
  concluída: SITUACAO_OS_CONCLUIDO,
  concluido: SITUACAO_OS_CONCLUIDO,
};

export function normalizarSituacaoOs(situacao?: string | null): string {
  const raw = (situacao || '').trim();
  if (!raw) return SITUACAO_OS_PADRAO;
  const chave = raw.toLowerCase();
  if (ALIASES[chave]) return ALIASES[chave];
  if (SITUACOES_OS.includes(raw)) return raw;
  return raw;
}

export function lojaOsEhMococa(lojaOrigem?: string | null): boolean {
  return normalizarLojaOs(lojaOrigem) === LOJA_OS_MOCOCA;
}

export function situacaoPadraoPorLoja(_lojaOrigem?: string | null): string {
  return SITUACAO_OS_PADRAO;
}

export function osSituacaoPreAssistencia(situacao?: string | null): boolean {
  const s = normalizarSituacaoOs(situacao);
  return SITUACOES_OS_PRE_ASSISTENCIA.includes(s);
}

export function osSituacaoAguardandoPeca(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_AGUARDANDO_PECA;
}

export function osSituacaoAguardandoCliente(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_AGUARDANDO_CLIENTE;
}

export function osSituacaoRetiradoAguardandoPagamento(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_RETIRADO_AGUARDANDO_PAGAMENTO;
}

export function osSituacaoReparoAvancadoPlaca(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_REPARO_AVANCADO_PLACA;
}

export function osSituacaoCelularDaLoja(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_CELULAR_DA_LOJA;
}

/** Cliente da própria loja (cadastro Mundo Smart), não um cliente externo. */
export function clienteEhLojaMundoSmart(nome?: string | null): boolean {
  const n = semAcento(nome ?? '').trim();
  return n === 'mundo smart' || n === 'mundosmart' || n.startsWith('mundo smart ');
}

/** Fora do filtro padrão da lista (Concluído, Cancelado, placa e celular da loja). */
export function osSituacaoForaFiltroPadrao(situacao?: string | null): boolean {
  const s = normalizarSituacaoOs(situacao);
  return (
    s === SITUACAO_OS_CONCLUIDO
    || s === SITUACAO_OS_CANCELADO
    || s === SITUACAO_OS_REPARO_AVANCADO_PLACA
    || s === SITUACAO_OS_CELULAR_DA_LOJA
  );
}

/** Técnico já definido pela situação. Reparo em placa fica com Rômulo (aceita o nome cadastrado). */
export function tecnicoFixoDaSituacao(situacao?: string | null): string | null {
  return osSituacaoReparoAvancadoPlaca(situacao) ? TECNICO_OS_REPARO_AVANCADO_PLACA : null;
}

export function resolverTecnicoFixo(
  situacao: string | null | undefined,
  tecnicos: Array<{ nome: string }> = [],
): string | null {
  const fixo = tecnicoFixoDaSituacao(situacao);
  if (!fixo) return null;
  const alvo = semAcento(fixo);
  const encontrado = tecnicos.find(t => semAcento(t.nome) === alvo);
  return encontrado?.nome ?? fixo;
}

function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function osSituacaoEmTeste(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_EM_TESTE;
}

export function osSituacaoAguardandoRetornoLoja(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_AGUARDANDO_RETORNO_LOJA;
}

/** Situações que exigem técnico responsável cadastrado. */
export function osSituacaoExigeTecnico(situacao?: string | null): boolean {
  const s = normalizarSituacaoOs(situacao);
  return (
    s === SITUACAO_OS_EM_TESTE
    || s === SITUACAO_OS_AGUARDANDO_RETORNO_LOJA
    || s === SITUACAO_OS_AGUARDANDO_CLIENTE
    || s === SITUACAO_OS_REPARO_AVANCADO_PLACA
    || s === SITUACAO_OS_CONCLUIDO
    || s === SITUACAO_OS_CANCELADO
  );
}

/**
 * Abre o modal de técnico só se a situação exige e a OS ainda não tem técnico válido.
 */
export function osPrecisaEscolherTecnico(
  situacao?: string | null,
  tecnicoAtual?: string | null,
  tecnicosAtivos: Array<{ nome: string }> = [],
): boolean {
  if (!osSituacaoExigeTecnico(situacao)) return false;
  const nome = tecnicoAtual?.trim();
  if (!nome) return true;
  return !tecnicosAtivos.some(t => t.nome.toLowerCase() === nome.toLowerCase());
}

/** Situações permitidas (todas as lojas). */
export function situacoesDisponiveisPorLoja(_lojaOrigem?: string | null): string[] {
  return [...SITUACOES_OS];
}

/**
 * Celular da loja só entra na lista quando o cliente é a Mundo Smart,
 * ou quando a OS já está nessa situação (para poder sair dela).
 */
export function situacoesDisponiveisParaCliente(
  lojaOrigem?: string | null,
  clienteNome?: string | null,
  situacaoAtual?: string | null,
): string[] {
  const todas = situacoesDisponiveisPorLoja(lojaOrigem);
  if (clienteEhLojaMundoSmart(clienteNome) || osSituacaoCelularDaLoja(situacaoAtual)) {
    return todas;
  }
  return todas.filter(s => s !== SITUACAO_OS_CELULAR_DA_LOJA);
}

/** Normaliza a situação; padrão Aberto quando vazia. */
export function ajustarSituacaoParaLoja(
  situacao: string | null | undefined,
  _lojaOrigem?: string | null,
): string {
  return normalizarSituacaoOs(situacao || SITUACAO_OS_PADRAO);
}

/** Data/hora de Brasília (+N dias) no formato datetime-local. */
export function prazoPecaPadraoDatetimeLocal(
  dias: number = PRAZO_AGUARDANDO_PECA_DIAS_PADRAO,
  base: Date = new Date(),
): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + Math.max(1, dias));
  return agoraDatetimeLocalBrasil(d);
}
