/**
 * Tabela calibrada na maquininha (referência R$ 1.200):
 *   1x  → 1.236,99   (~2,99% à vista)
 *   5x  → 1.283,56
 *   10x → 1.335,12
 *   15x → 1.393,25
 *   18x → 1.424,18
 *
 * Entre os pontos: interpolação linear do total de referência.
 * Para outro valor: total = valor × (totalRef / 1.200).
 *
 * Divergência vs «1x + 1,49% a.m. compostos»:
 * compostos na 1x sobem demais (18x ~1.590). A máquina usa
 * acréscimo bem menor por parcela (~R$ 10–12 no base 1.200).
 */

export interface CalculoJurosConfig {
  /** Rótulo 1x (crédito à vista). */
  taxa1xPct: number;
  /** Rótulo a partir da 2ª (como na maquininha). */
  taxaMensalPct: number;
  maxParcelas: number;
}

export const CALCULO_JUROS_DEFAULT: CalculoJurosConfig = {
  taxa1xPct: 2.99,
  taxaMensalPct: 1.49,
  maxParcelas: 18,
};

/** Valor de referência das âncoras. */
export const REF_VALOR = 1200;

/** Âncoras informadas (totais a cobrar para receber REF_VALOR). */
export const ANCORAS_TOTAL_REF: ReadonlyArray<{ n: number; total: number }> = [
  { n: 1, total: 1236.99 },
  { n: 5, total: 1283.56 },
  { n: 10, total: 1335.12 },
  { n: 15, total: 1393.25 },
  { n: 18, total: 1424.18 },
];

export const CALCULO_JUROS_STORAGE_KEY = 'mundosmart.calculo-juros.v6-ancoras';

export function carregarCalculoJurosConfig(): CalculoJurosConfig {
  try {
    const raw = localStorage.getItem(CALCULO_JUROS_STORAGE_KEY);
    if (!raw) return { ...CALCULO_JUROS_DEFAULT };
    const parsed = JSON.parse(raw) as Partial<CalculoJurosConfig>;
    return {
      taxa1xPct: Math.max(0, num(parsed.taxa1xPct, CALCULO_JUROS_DEFAULT.taxa1xPct)),
      taxaMensalPct: Math.max(0, num(parsed.taxaMensalPct, CALCULO_JUROS_DEFAULT.taxaMensalPct)),
      maxParcelas: Math.min(18, Math.max(1, Math.round(num(parsed.maxParcelas, 18)))),
    };
  } catch {
    return { ...CALCULO_JUROS_DEFAULT };
  }
}

export function salvarCalculoJurosConfig(cfg: CalculoJurosConfig): void {
  localStorage.setItem(
    CALCULO_JUROS_STORAGE_KEY,
    JSON.stringify({
      taxa1xPct: Math.max(0, Number(cfg.taxa1xPct) || 0),
      taxaMensalPct: Math.max(0, Number(cfg.taxaMensalPct) || 0),
      maxParcelas: Math.min(18, Math.max(1, Math.round(cfg.maxParcelas || 18))),
    }),
  );
}

export interface OpcaoParcela {
  parcelas: number;
  valorParcela: number;
  total: number;
  juros: number;
  taxaExibidaPct: number;
}

export interface ResultadoLiquido {
  valorVenda: number;
  parcelas: number;
  valorParcela: number;
  taxaExibidaPct: number;
  juros: number;
  valorLiquido: number;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Total de referência (base 1.200) para n parcelas — interpola âncoras. */
export function totalRefParaParcelas(n: number): number {
  const k = Math.max(1, Math.min(18, Math.round(n)));
  const anc = ANCORAS_TOTAL_REF;
  if (k <= anc[0].n) return anc[0].total;
  if (k >= anc[anc.length - 1].n) return anc[anc.length - 1].total;

  for (let i = 0; i < anc.length - 1; i++) {
    const a = anc[i];
    const b = anc[i + 1];
    if (k >= a.n && k <= b.n) {
      if (k === a.n) return a.total;
      if (k === b.n) return b.total;
      const t = (k - a.n) / (b.n - a.n);
      return a.total + (b.total - a.total) * t;
    }
  }
  return anc[anc.length - 1].total;
}

export function fatorParaParcelas(n: number): number {
  return totalRefParaParcelas(n) / REF_VALOR;
}

export function totalEmParcelas(valor: number, n: number): number {
  return round2(Math.max(0, valor) * fatorParaParcelas(n));
}

export function gerarOpcoesParcelas(
  valor: number,
  cfg: CalculoJurosConfig,
): OpcaoParcela[] {
  const base = Math.max(0, valor);
  if (base <= 0) return [];

  const max = Math.min(18, Math.max(1, Math.round(cfg.maxParcelas)));
  const opcoes: OpcaoParcela[] = [];

  for (let n = 1; n <= max; n++) {
    const total = totalEmParcelas(base, n);
    opcoes.push({
      parcelas: n,
      valorParcela: round2(total / n),
      total,
      juros: round2(total - base),
      taxaExibidaPct: n === 1 ? cfg.taxa1xPct : cfg.taxaMensalPct,
    });
  }

  return opcoes;
}

/** Valor cobrado → líquido (divide pelo fator da qtd. de parcelas). */
export function calcularLiquido(
  valorVenda: number,
  parcelas: number,
  cfg: CalculoJurosConfig,
): ResultadoLiquido {
  const total = Math.max(0, valorVenda);
  const n = Math.max(1, Math.min(18, Math.round(parcelas)));
  const fator = fatorParaParcelas(n);
  const liquido = fator > 0 ? round2(total / fator) : round2(total);

  return {
    valorVenda: round2(total),
    parcelas: n,
    valorParcela: round2(total / n),
    taxaExibidaPct: n === 1 ? cfg.taxa1xPct : cfg.taxaMensalPct,
    juros: round2(total - liquido),
    valorLiquido: liquido,
  };
}

export function formatarMoedaBr(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarTaxaPct(taxa: number): string {
  return `${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
