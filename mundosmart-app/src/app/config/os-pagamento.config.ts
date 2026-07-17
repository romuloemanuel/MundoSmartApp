export interface FormaPagamentoOs {
  id: string;
  label: string;
  permiteParcelas?: boolean;
}

export type FormaPagamentoAcordada = '' | 'avista' | 'parcelado';

export const FORMAS_PAGAMENTO_ACORDADO: FormaPagamentoOs[] = [
  { id: 'avista', label: 'À vista' },
  { id: 'parcelado', label: 'Parcelado', permiteParcelas: true },
];

/** @deprecated use FORMAS_PAGAMENTO_ACORDADO */
export const FORMAS_PAGAMENTO_OS = FORMAS_PAGAMENTO_ACORDADO;

const LEGADO_AVISTA = new Set([
  'dinheiro',
  'pix',
  'debito',
  'credito_vista',
  'na_retirada',
  'a_combinar',
]);

export function normalizarFormaPagamentoOs(id?: string | null): FormaPagamentoAcordada {
  const valor = id?.trim();
  if (!valor) return '';
  if (valor === 'parcelado' || valor === 'credito_parcelado') return 'parcelado';
  if (valor === 'avista' || LEGADO_AVISTA.has(valor)) return 'avista';
  return '';
}

export function labelFormaPagamentoOs(id?: string): string {
  const forma = normalizarFormaPagamentoOs(id);
  if (!forma) return '—';
  return FORMAS_PAGAMENTO_ACORDADO.find(f => f.id === forma)?.label ?? forma;
}

export function formaPagamentoPermiteParcelas(id?: string): boolean {
  return normalizarFormaPagamentoOs(id) === 'parcelado';
}

export function labelPagamentoAcordadoOs(os: {
  formaPagamento?: string;
  parcelasPagamento?: number | null;
  valorTotalAcordado?: number | null;
  valorTotal?: number | null;
}): string {
  const forma = normalizarFormaPagamentoOs(os.formaPagamento);
  if (!forma) return '—';

  const total = os.valorTotalAcordado ?? os.valorTotal;
  const totalFmt = total != null
    ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : null;

  if (forma === 'parcelado') {
    const parc = os.parcelasPagamento;
    if (parc && parc >= 2 && total != null) {
      const valorParc = (total / parc).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return `Parcelado em ${parc}x de ${valorParc}${totalFmt ? ` (total ${totalFmt})` : ''}`;
    }
    return parc && parc >= 2 ? `Parcelado em ${parc}x` : 'Parcelado';
  }

  return totalFmt ? `À vista — ${totalFmt}` : 'À vista';
}

/** Texto de opções à vista / a prazo no pré-orçamento (cliente ainda escolhe). */
export function labelOpcoesPagamentoOrcamento(o: {
  valorAVista?: number | null;
  valorAPrazo?: number | null;
  valorTotalAcordado?: number | null;
  valorTotal?: number | null;
  parcelasPagamento?: number | null;
}): string {
  const combinado = o.valorTotalAcordado ?? o.valorTotal;
  const aVista = o.valorAVista ?? combinado;
  const aPrazo = o.valorAPrazo ?? combinado;
  const fmt = (v?: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  const partes = [`À vista ${fmt(aVista)}`, `A prazo ${fmt(aPrazo)}`];
  const parc = o.parcelasPagamento;
  if (parc && parc >= 2 && aPrazo != null) {
    const valorParc = (aPrazo / parc).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    partes[1] = `A prazo ${fmt(aPrazo)} em ${parc}x de ${valorParc}`;
  }
  return partes.join(' · ');
}
