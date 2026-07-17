export interface TipoServicoOs {
  id: string;
  label: string;
  /** Mantido para compatibilidade com dados antigos da OS. */
  testeEntrada: boolean;
  testeSaida: boolean;
  hint?: string;
}

export const TIPOS_SERVICO_OS: TipoServicoOs[] = [
  {
    id: 'reparo',
    label: 'Reparo',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Serviço de reparo do aparelho.',
  },
  {
    id: 'orcamento',
    label: 'Orçamento / Diagnóstico',
    testeEntrada: true,
    testeSaida: false,
    hint: 'Análise e orçamento sem compromisso de reparo imediato.',
  },
  {
    id: 'garantia',
    label: 'Garantia',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Atendimento em garantia do serviço ou peça.',
  },
  {
    id: 'troca_peca',
    label: 'Troca de peça',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Substituição da peça indicada.',
  },
  {
    id: 'software',
    label: 'Software / Configuração',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Procedimento de software ou configuração.',
  },
  {
    id: 'limpeza',
    label: 'Limpeza / Preventiva',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Limpeza ou manutenção preventiva.',
  },
  {
    id: 'devolucao',
    label: 'Devolução sem reparo',
    testeEntrada: true,
    testeSaida: true,
    hint: 'Devolução do aparelho sem execução de reparo.',
  },
];

export function obterTipoServicoOs(id?: string): TipoServicoOs | undefined {
  if (!id) return undefined;
  return TIPOS_SERVICO_OS.find(t => t.id === id);
}

export function labelTipoServicoOs(id?: string): string {
  return obterTipoServicoOs(id)?.label ?? '';
}
