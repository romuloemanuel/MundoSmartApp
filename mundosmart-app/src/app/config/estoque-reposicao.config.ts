export type PeriodoReposicao = '2dias' | 'semanal' | 'mensal' | 'personalizado';

export interface OpcaoPeriodoReposicao {
  id: PeriodoReposicao;
  label: string;
  dias: number;
}

export const PERIODOS_REPOSICAO: OpcaoPeriodoReposicao[] = [
  { id: '2dias', label: 'Últimos 2 dias', dias: 2 },
  { id: 'semanal', label: 'Semanal (7 dias)', dias: 7 },
  { id: 'mensal', label: 'Mensal (30 dias)', dias: 30 },
  { id: 'personalizado', label: 'Personalizado', dias: 0 },
];

const STORAGE_KEY = 'mundosmart.estoque.periodoReposicao';

export function carregarPeriodoReposicaoSalvo(): PeriodoReposicao {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY) as PeriodoReposicao | null;
    if (salvo && PERIODOS_REPOSICAO.some(p => p.id === salvo)) return salvo;
  } catch { /* ignore */ }
  return 'semanal';
}

export function salvarPeriodoReposicao(periodo: PeriodoReposicao): void {
  try {
    localStorage.setItem(STORAGE_KEY, periodo);
  } catch { /* ignore */ }
}

export function labelPeriodoReposicao(periodo?: string): string {
  const op = PERIODOS_REPOSICAO.find(p => p.id === periodo);
  return op?.label ?? 'Período';
}

export type RelatorioReposicaoStatusFiltro = '' | 'nao_concluido' | 'parcial' | 'concluido';

export const RELATORIO_REPOSICAO_STATUS: Array<{
  id: 'nao_concluido' | 'parcial' | 'concluido';
  label: string;
}> = [
  { id: 'nao_concluido', label: 'Não' },
  { id: 'parcial', label: 'Concluído parcialmente' },
  { id: 'concluido', label: 'Concluído' },
];

export const RELATORIO_REPOSICAO_HISTORICO_LIMITE = 10;

export function normalizarStatusRelatorioReposicao(
  status?: string | null,
): 'nao_concluido' | 'parcial' | 'concluido' {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'concluido' || s === 'concluído') return 'concluido';
  if (s === 'parcial' || s === 'concluido_parcialmente' || s === 'concluído_parcialmente') {
    return 'parcial';
  }
  return 'nao_concluido';
}
