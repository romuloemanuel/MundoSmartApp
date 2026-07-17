/** Canal pelo qual o pré-orçamento foi feito. */
export type OrcamentoTipoContato = 'whatsapp_internet' | 'atendimento_local';

export const ORCAMENTO_TIPOS_CONTATO: Array<{ id: OrcamentoTipoContato; label: string }> = [
  { id: 'whatsapp_internet', label: 'WhatsApp / Internet' },
  { id: 'atendimento_local', label: 'Atendimento local' },
];

export function labelTipoContatoOrcamento(tipo?: string | null): string {
  const t = (tipo ?? '').trim().toLowerCase();
  const found = ORCAMENTO_TIPOS_CONTATO.find(x => x.id === t);
  if (found) return found.label;
  if (t === 'whatsapp' || t === 'internet') return 'WhatsApp / Internet';
  if (t === 'local') return 'Atendimento local';
  return '—';
}

export function normalizarTipoContatoOrcamento(tipo?: string | null): OrcamentoTipoContato {
  const t = (tipo ?? '').trim().toLowerCase();
  if (t === 'atendimento_local' || t === 'local') return 'atendimento_local';
  return 'whatsapp_internet';
}
