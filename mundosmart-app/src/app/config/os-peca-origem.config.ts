export type OrigemPecaOs = 'estoque' | 'externo';

export interface FornecedorExternoPeca {
  id: string;
  label: string;
  permiteRastreio?: boolean;
}

export const FORNECEDORES_EXTERNOS_PECA: FornecedorExternoPeca[] = [
  { id: 'carlos', label: 'Carlos' },
  { id: 'paulo', label: 'Paulo' },
  { id: 'vic', label: 'Vic' },
  { id: 'mercado_livre', label: 'Mercado Livre', permiteRastreio: true },
  { id: 'shopee', label: 'Shopee', permiteRastreio: true },
];

/** Fornecedores de compra de estoque (pedido) — opções fixas do select. */
export const FORNECEDORES_ESTOQUE_PRECADASTRO = [
  'Baba',
  'Skytech',
  'Vic',
  'Carlos',
  'Paulo',
  'Shopee',
  'Mercado Livre',
  'Aliexpress',
] as const;

export const ORIGENS_PECA_OS: { id: OrigemPecaOs; label: string }[] = [
  { id: 'estoque', label: 'Estoque local' },
  { id: 'externo', label: 'Fornecedor externo' },
];

export function labelFornecedorExterno(id?: string): string {
  if (!id?.trim()) return '—';
  return FORNECEDORES_EXTERNOS_PECA.find(f => f.id === id)?.label ?? id;
}

export function fornecedorPermiteRastreio(id?: string): boolean {
  return FORNECEDORES_EXTERNOS_PECA.some(f => f.id === id && f.permiteRastreio);
}

export function labelOrigemPeca(item: {
  origemPeca?: OrigemPecaOs;
  fornecedorExterno?: string;
  codigoRastreio?: string;
  quantidadeEstoqueBaixada?: number;
  estoqueInsuficiente?: boolean;
}): string {
  if (item.origemPeca === 'externo') {
    const nome = labelFornecedorExterno(item.fornecedorExterno);
    const rastreio = item.codigoRastreio?.trim();
    if (rastreio) return `Externo: ${nome} — ${rastreio}`;
    return nome !== '—' ? `Externo: ${nome}` : 'Fornecedor externo';
  }
  if ((item.quantidadeEstoqueBaixada ?? 0) > 0) {
    return `Estoque baixado (${item.quantidadeEstoqueBaixada})`;
  }
  if (item.estoqueInsuficiente) return 'Estoque insuficiente';
  return 'Baixa estoque ao salvar';
}
