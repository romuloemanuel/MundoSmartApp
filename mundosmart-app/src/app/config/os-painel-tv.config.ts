/** Meta de permanência do aparelho na assistência (SLA de urgência no card). */
export const OS_PAINEL_TV_SLA_MINUTOS = 4 * 60;

/** Rastreio comum: após este prazo a OS vai para a coluna Especial. */
export const OS_PAINEL_TV_PRAZO_COMUM_DIAS = 15;

/** Aguardando retirada: some do painel após este prazo. */
export const OS_PAINEL_TV_RETIRADA_MAX_DIAS = 30;

/**
 * Faixas de urgência até a meta de 4h (desde a chegada em Na assistência).
 * Branco → Amarelo → Laranja → Vermelho (≥ 4h).
 */
export type OsPainelTvNivel = 'branco' | 'amarelo' | 'laranja' | 'vermelho';

export type OsPainelTvCategoria = 'comum' | 'especial' | 'retirada';

export interface OsPainelTvFaixa {
  id: OsPainelTvNivel;
  label: string;
  /** Minutos decorridos desde Na assistência (inclusivo). */
  deMinutos: number;
  /** Exclusivo; null = sem limite superior. */
  ateMinutos: number | null;
  descricao: string;
}

export interface OsPainelTvColuna {
  id: OsPainelTvCategoria;
  titulo: string;
  /** Fração do layout (30 / 30 / 20). */
  fracao: number;
}

export const OS_PAINEL_TV_FAIXAS: OsPainelTvFaixa[] = [
  {
    id: 'branco',
    label: 'No prazo',
    deMinutos: 0,
    ateMinutos: 60,
    descricao: 'Até 1h',
  },
  {
    id: 'amarelo',
    label: 'Atenção',
    deMinutos: 60,
    ateMinutos: 120,
    descricao: '1h – 2h',
  },
  {
    id: 'laranja',
    label: 'Urgente',
    deMinutos: 120,
    ateMinutos: OS_PAINEL_TV_SLA_MINUTOS,
    descricao: '2h – 4h',
  },
  {
    id: 'vermelho',
    label: 'Estourou / Avisar cliente',
    deMinutos: OS_PAINEL_TV_SLA_MINUTOS,
    ateMinutos: null,
    descricao: 'Acima de 4h na assistência, ou atraso justificado',
  },
];

export const OS_PAINEL_TV_COLUNAS: OsPainelTvColuna[] = [
  { id: 'comum', titulo: 'Ordem Serviço', fracao: 30 },
  { id: 'especial', titulo: 'Ordem Serviço Especial', fracao: 30 },
  { id: 'retirada', titulo: 'Aguardando Retirada', fracao: 20 },
];

export const OS_PAINEL_TV_REFRESH_MS = 30_000;
export const OS_PAINEL_TV_TICK_MS = 15_000;
