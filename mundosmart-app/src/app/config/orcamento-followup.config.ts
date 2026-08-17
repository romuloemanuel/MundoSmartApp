import { adicionarDiasUteisBrasil, agoraDataBrasil } from '../utils/horario-brasil.util';

/** Colaboradores que fazem / registram orçamento e follow-up. */
export const ORCAMENTO_RESPONSAVEIS = [
  'Gabriela',
  'Wesley',
  'Liniker',
  'Rômulo',
  'Pedro',
] as const;

export type OrcamentoResponsavel = (typeof ORCAMENTO_RESPONSAVEIS)[number];

/** Ciclo de follow-ups: ao completar o 3º, orçamento vira "Não realizado". */
export const ORCAMENTO_FOLLOWUP_CICLO = 3;

export const ORCAMENTO_SITUACAO_ABERTO = 'Em aberto';
export const ORCAMENTO_SITUACAO_CONVERTIDO = 'Convertido';
export const ORCAMENTO_SITUACAO_NAO_REALIZADO = 'Não realizado';
export const ORCAMENTO_SITUACAO_DESISTENCIA = 'Desistência';

export function orcamentoNaoRealizado(situacao?: string | null): boolean {
  const s = (situacao ?? '').trim().toLowerCase();
  return s === 'não realizado' || s === 'nao realizado';
}

export function orcamentoDesistencia(situacao?: string | null): boolean {
  const s = (situacao ?? '').trim().toLowerCase();
  return s === 'desistência' || s === 'desistencia';
}

export function orcamentoConvertido(o: {
  situacao?: string | null;
  osGeradaBlingId?: number | null;
}): boolean {
  return !!o.osGeradaBlingId || (o.situacao ?? '').trim() === ORCAMENTO_SITUACAO_CONVERTIDO;
}

export function orcamentoEncerrado(o: {
  situacao?: string | null;
  osGeradaBlingId?: number | null;
}): boolean {
  return orcamentoConvertido(o)
    || orcamentoNaoRealizado(o.situacao)
    || orcamentoDesistencia(o.situacao);
}

export function orcamentoEmAberto(o: {
  situacao?: string | null;
  osGeradaBlingId?: number | null;
}): boolean {
  return !orcamentoEncerrado(o);
}

/** Dias úteis sugeridos para a próxima data após N follow-ups concluídos. */
export function diasUteisProximoFollowUp(vezesAposRegistro: number): number {
  if (vezesAposRegistro <= 1) return 3;
  if (vezesAposRegistro === 2) return 5;
  return 7;
}

/** Sugere a próxima data de follow-up (dias úteis a partir de hoje). */
export function sugerirDataFollowUp(vezesAposRegistro: number, base = agoraDataBrasil()): string {
  return adicionarDiasUteisBrasil(diasUteisProximoFollowUp(vezesAposRegistro), base);
}

export type StatusFollowUpOrcamento = 'em-dia' | 'proximo' | 'atrasado' | 'sem-data';

/**
 * Verde = em dia (mais de 2 dias).
 * Laranja = prestes a vencer (1–2 dias).
 * Vermelho = no dia ou já passou.
 */
export function statusFollowUpOrcamento(dataFollowUp?: string | null): StatusFollowUpOrcamento {
  const raw = (dataFollowUp ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'sem-data';

  const hoje = agoraDataBrasil();
  if (raw < hoje || raw === hoje) return 'atrasado';

  const [y, m, d] = raw.split('-').map(Number);
  const [hy, hm, hd] = hoje.split('-').map(Number);
  const diffMs = Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd);
  const dias = Math.round(diffMs / 86_400_000);
  if (dias <= 2) return 'proximo';
  return 'em-dia';
}

export function labelStatusFollowUp(status: StatusFollowUpOrcamento): string {
  switch (status) {
    case 'em-dia':
      return 'Em dia';
    case 'proximo':
      return 'Prestes a vencer';
    case 'atrasado':
      return 'Follow-up hoje / atrasado';
    default:
      return 'Sem data';
  }
}
