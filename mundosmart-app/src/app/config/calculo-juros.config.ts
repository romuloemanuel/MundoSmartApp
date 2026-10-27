/**
 * Parcelamento mensal — taxa da maquininha sobre o valor cobrado.
 * Para receber o valor desejado: cobrar = valor / (1 − taxa efetiva).
 * A taxa efetiva é a da tabela com 5% a mais, só sobre o percentual.
 */

export interface CalculoJurosConfig {
  /** Rótulo 1x (crédito à vista). */
  taxa1xPct: number;
  /** Rótulo a partir da 2ª (como na maquininha). */
  taxaMensalPct: number;
  maxParcelas: number;
}

export const CALCULO_JUROS_DEFAULT: CalculoJurosConfig = {
  taxa1xPct: 3.15,
  taxaMensalPct: 0,
  maxParcelas: 18,
};

/** 5% a mais somente sobre o percentual da taxa. */
export const ACRESCIMO_TAXA_PARCELAMENTO = 1.05;

/** Taxa da maquininha (%) por quantidade de parcelas. 1x = crédito à vista. */
export const TAXA_MAQUININHA_PARCELAMENTO_PCT: Readonly<Record<number, number>> = {
  1: 3.00,
  2: 4.98,
  3: 5.81,
  4: 6.61,
  5: 7.40,
  6: 8.19,
  7: 8.97,
  8: 9.74,
  9: 10.50,
  10: 11.25,
  11: 11.99,
  12: 12.73,
  13: 13.95,
  14: 14.67,
  15: 15.38,
  16: 16.09,
  17: 16.78,
  18: 17.47,
};

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

/** Taxa da tabela para n parcelas (1 a 18). */
export function taxaMaquininhaPct(n: number): number {
  const k = Math.max(1, Math.min(18, Math.round(n)));
  return TAXA_MAQUININHA_PARCELAMENTO_PCT[k] ?? TAXA_MAQUININHA_PARCELAMENTO_PCT[18];
}

/** Taxa usada no parcelamento: tabela + 5% somente sobre o percentual. */
export function taxaEfetivaParcelamentoPct(n: number): number {
  return taxaMaquininhaPct(n) * ACRESCIMO_TAXA_PARCELAMENTO;
}

export function fatorParaParcelas(n: number): number {
  const taxa = taxaEfetivaParcelamentoPct(n) / 100;
  if (taxa <= 0) return 1;
  if (taxa >= 1) return 1;
  return 1 / (1 - taxa);
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
      taxaExibidaPct: taxaEfetivaParcelamentoPct(n),
    });
  }

  return opcoes;
}

/** Valor cobrado → líquido (divide pelo fator da qtd. de parcelas). */
export function calcularLiquido(
  valorVenda: number,
  parcelas: number,
  _cfg: CalculoJurosConfig,
): ResultadoLiquido {
  const total = Math.max(0, valorVenda);
  const n = Math.max(1, Math.min(18, Math.round(parcelas)));
  const fator = fatorParaParcelas(n);
  const liquido = fator > 0 ? round2(total / fator) : round2(total);

  return {
    valorVenda: round2(total),
    parcelas: n,
    valorParcela: round2(total / n),
    taxaExibidaPct: taxaEfetivaParcelamentoPct(n),
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
