/**
 * Lojas de origem do aparelho.
 * Só Mococa possui assistência técnica; as demais criam OS e enviam para Mococa.
 */
export interface LojaOs {
  codigo: string;
  nome: string;
  /** Abreviação curta para a grid. */
  sigla: string;
}

export const LOJA_OS_MOCOCA = 'MCC';
/** Padrão / assistência técnica = Mococa. */
export const LOJA_OS_PADRAO = LOJA_OS_MOCOCA;

export const LOJAS_OS: LojaOs[] = [
  { codigo: 'MCC', nome: 'Mococa (assistência)', sigla: 'MCC' },
  { codigo: 'ARCE', nome: 'Arceburgo', sigla: 'ARCE' },
  { codigo: 'SJ', nome: 'São José', sigla: 'SJ' },
  { codigo: 'CJR', nome: 'Cajuru', sigla: 'CJR' },
];

export const LOJAS_OS_FILTRO: { value: string; label: string }[] = [
  { value: '', label: 'Todas as lojas' },
  ...LOJAS_OS.map(l => ({ value: l.codigo, label: `${l.sigla} · ${l.nome}` })),
];

export function normalizarLojaOs(codigo?: string | null): string {
  const raw = (codigo || '').trim().toUpperCase();
  if (!raw) return LOJA_OS_PADRAO;
  // Legado AST / “Assistência” → Mococa (única assistência técnica).
  if (raw === 'AST' || raw === 'ASS' || raw === 'ASSISTENCIA' || raw === 'ASSISTÊNCIA') {
    return LOJA_OS_MOCOCA;
  }
  const hit = LOJAS_OS.find(
    l => l.codigo === raw || l.sigla === raw || l.nome.toUpperCase() === raw,
  );
  return hit?.codigo ?? raw;
}

export function labelLojaOs(codigo?: string | null): string {
  const cod = normalizarLojaOs(codigo);
  return LOJAS_OS.find(l => l.codigo === cod)?.nome ?? cod;
}

export function siglaLojaOs(codigo?: string | null): string {
  const cod = normalizarLojaOs(codigo);
  return LOJAS_OS.find(l => l.codigo === cod)?.sigla ?? cod;
}

/** True se a loja é a assistência técnica (Mococa). */
export function lojaEhAssistenciaTecnica(codigo?: string | null): boolean {
  return normalizarLojaOs(codigo) === LOJA_OS_MOCOCA;
}
