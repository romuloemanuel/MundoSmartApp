import {
  OS_PAINEL_TV_FAIXAS,
  OS_PAINEL_TV_SLA_MINUTOS,
  OS_PAINEL_TV_PRAZO_COMUM_DIAS,
  OS_PAINEL_TV_RETIRADA_MAX_DIAS,
  OsPainelTvNivel,
  OsPainelTvCategoria,
} from '../config/os-painel-tv.config';
import { osSituacaoFinalizada } from '../pages/ordens-servico/os-situacao.util';
import {
  SITUACAO_OS_AGUARDANDO_CLIENTE,
  normalizarSituacaoOs,
  osSituacaoAguardandoPeca,
  osSituacaoPreAssistencia,
} from '../config/os-situacao.config';
import { equipamentoGridLabel } from './os-grid-display.util';

export type OsUrgenciaNivel = OsPainelTvNivel | 'finalizada' | 'pre' | 'peca';

export function minutosDesdeEntrada(
  dataEntrada?: string | null,
  agora: Date = new Date(),
): number {
  if (!dataEntrada?.trim()) return 0;
  const inicio = new Date(dataEntrada);
  if (Number.isNaN(inicio.getTime())) return 0;
  return Math.max(0, Math.floor((agora.getTime() - inicio.getTime()) / 60_000));
}

export function diasDesde(
  data?: string | null,
  agora: Date = new Date(),
): number {
  return Math.floor(minutosDesdeEntrada(data, agora) / (60 * 24));
}

/** Minutos restantes até o prazo da peça (negativo = atrasado). */
export function minutosAtePrazoPeca(
  dataPrazoPeca?: string | null,
  agora: Date = new Date(),
): number | null {
  if (!dataPrazoPeca?.trim()) return null;
  const prazo = new Date(dataPrazoPeca);
  if (Number.isNaN(prazo.getTime())) return null;
  return Math.floor((prazo.getTime() - agora.getTime()) / 60_000);
}

export function osTemJustificativaAtraso(os: {
  justificativasAtraso?: { texto?: string | null }[] | null;
}): boolean {
  return (os.justificativasAtraso ?? []).some(j => !!j.texto?.trim());
}

export function textosJustificativasAtraso(os: {
  justificativasAtraso?: { texto?: string | null }[] | null;
}): string[] {
  return (os.justificativasAtraso ?? [])
    .map(j => (j.texto ?? '').trim())
    .filter(Boolean);
}

export function osAguardandoRetirada(situacao?: string | null): boolean {
  return normalizarSituacaoOs(situacao) === SITUACAO_OS_AGUARDANDO_CLIENTE;
}

/**
 * Base do SLA/urgência: só conta a partir de "Na assistência" (`dataInicioAssistencia`).
 * Aberto / Em transporte não contam. Aguardando Peça usa o prazo da peça.
 */
export function dataBaseUrgenciaOs(os: {
  dataInicioAssistencia?: string | null;
  situacao?: string | null;
}): string | null {
  if (osSituacaoPreAssistencia(os.situacao)) return null;
  if (osSituacaoAguardandoPeca(os.situacao)) return null;
  return os.dataInicioAssistencia?.trim() || null;
}

/** Data usada no rastreio de 15 dias (tempo na assistência). */
export function dataRastreioComumOs(os: {
  dataInicioAssistencia?: string | null;
}): string | null {
  return os.dataInicioAssistencia?.trim() || null;
}

export function nivelUrgenciaOs(minutos: number): OsPainelTvNivel {
  for (let i = OS_PAINEL_TV_FAIXAS.length - 1; i >= 0; i--) {
    const f = OS_PAINEL_TV_FAIXAS[i];
    if (minutos >= f.deMinutos) return f.id;
  }
  return 'branco';
}

/** Urgência pelo prazo da peça: no prazo = amarelo; ≤1 dia = laranja; atrasado = vermelho. */
export function nivelUrgenciaPrazoPeca(
  dataPrazoPeca?: string | null,
  agora: Date = new Date(),
): OsPainelTvNivel {
  const restante = minutosAtePrazoPeca(dataPrazoPeca, agora);
  if (restante == null) return 'amarelo';
  if (restante < 0) return 'vermelho';
  if (restante <= 24 * 60) return 'laranja';
  return 'amarelo';
}

export function formatarTempoDecorrido(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatarPrazoPecaRestante(
  dataPrazoPeca?: string | null,
  agora: Date = new Date(),
): string {
  const restante = minutosAtePrazoPeca(dataPrazoPeca, agora);
  if (restante == null) return 'Sem prazo';
  if (restante < 0) return `Atrasado ${formatarTempoDecorrido(-restante)}`;
  return `Prazo em ${formatarTempoDecorrido(restante)}`;
}

export function percentualSla(minutos: number): number {
  if (OS_PAINEL_TV_SLA_MINUTOS <= 0) return 100;
  return Math.min(100, Math.round((minutos / OS_PAINEL_TV_SLA_MINUTOS) * 100));
}

export function nivelUrgenciaDaOs(
  os: {
    dataInicioAssistencia?: string | null;
    dataPrazoPeca?: string | null;
    situacao?: string | null;
    justificativasAtraso?: { texto?: string | null }[] | null;
  },
  agora: Date = new Date(),
): OsUrgenciaNivel {
  if (osSituacaoFinalizada(os.situacao)) return 'finalizada';
  if (osTemJustificativaAtraso(os)) return 'vermelho';
  if (osSituacaoPreAssistencia(os.situacao)) return 'pre';
  if (osSituacaoAguardandoPeca(os.situacao)) {
    return nivelUrgenciaPrazoPeca(os.dataPrazoPeca, agora);
  }
  const base = dataBaseUrgenciaOs(os);
  if (!base) return 'pre';
  return nivelUrgenciaOs(minutosDesdeEntrada(base, agora));
}

export function ordemUrgenciaNivel(nivel: OsUrgenciaNivel): number {
  switch (nivel) {
    case 'vermelho': return 0;
    case 'laranja': return 1;
    case 'amarelo': return 2;
    case 'branco': return 3;
    case 'pre': return 4;
    case 'peca': return 4;
    default: return 5;
  }
}

export function labelUrgenciaNivel(nivel: OsUrgenciaNivel): string {
  if (nivel === 'finalizada') return 'Finalizada';
  if (nivel === 'pre') return 'Em trânsito / aberta';
  if (nivel === 'peca') return 'Aguardando peça';
  return OS_PAINEL_TV_FAIXAS.find(f => f.id === nivel)?.label ?? nivel;
}

export function osAbertaNoPainel(situacao?: string | null): boolean {
  return !osSituacaoFinalizada(situacao) && !osSituacaoPreAssistencia(situacao);
}

export function resumirProblemaOs(
  os: {
    defeito?: string | null;
    tipoPecaProblemaNome?: string | null;
    tipoServico?: string | null;
  },
  max = 72,
): string {
  const raw = (os.defeito || os.tipoPecaProblemaNome || os.tipoServico || '').trim();
  if (!raw) return 'Sem descrição';
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max - 1).trimEnd()}…`;
}

export function modeloAparelhoOs(os: {
  equipamento?: string | null;
  marcaNome?: string | null;
  modeloNome?: string | null;
}): string {
  return equipamentoGridLabel(os) || 'Aparelho';
}

/**
 * Classifica a OS nas colunas do painel.
 * - retirada: Aguardando Cliente Retirar (some após 30 dias)
 * - especial: > 15 dias na assistência ou justificativa de atraso
 * - comum: demais OS abertas no prazo de 15 dias
 * Retorna null se não deve aparecer.
 */
export function categoriaPainelTvOs(
  os: {
    situacao?: string | null;
    justificativasAtraso?: { texto?: string | null }[] | null;
    dataUltimaAlteracaoSituacao?: string | null;
    dataAtualizacao?: string | null;
    dataInicioAssistencia?: string | null;
    dataEntrada?: string | null;
    data?: string | null;
  },
  agora: Date = new Date(),
): OsPainelTvCategoria | null {
  if (!osAbertaNoPainel(os.situacao)) return null;

  if (osAguardandoRetirada(os.situacao)) {
    const baseRetirada =
      os.dataUltimaAlteracaoSituacao || os.dataAtualizacao || os.dataInicioAssistencia || os.dataEntrada || os.data;
    if (diasDesde(baseRetirada, agora) > OS_PAINEL_TV_RETIRADA_MAX_DIAS) return null;
    return 'retirada';
  }

  if (osTemJustificativaAtraso(os)) return 'especial';

  const dias = diasDesde(dataRastreioComumOs(os), agora);
  if (dias > OS_PAINEL_TV_PRAZO_COMUM_DIAS) return 'especial';
  return 'comum';
}
