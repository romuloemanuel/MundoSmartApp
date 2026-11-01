import { BlingContatoEndereco } from '../models/bling.models';

const CHAVE = 'mundosmart.contrato-rascunho';

export interface RascunhoContrato {
  codigo: string;
  valores: Record<string, string>;
  enderecoChave?: string;
  endereco?: BlingContatoEndereco | null;
  formaPagamento?: string;
  financiadoraNome?: string;
  entrada?: string;
  repasse?: string;
  complemento?: string;
}

export function guardarRascunhoContrato(rascunho: RascunhoContrato): void {
  sessionStorage.setItem(CHAVE, JSON.stringify(rascunho));
}

export function lerRascunhoContrato(): RascunhoContrato | null {
  const raw = sessionStorage.getItem(CHAVE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RascunhoContrato;
    if (!parsed?.codigo || !parsed.valores) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function limparRascunhoContrato(): void {
  sessionStorage.removeItem(CHAVE);
}

export function moedaContrato(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
