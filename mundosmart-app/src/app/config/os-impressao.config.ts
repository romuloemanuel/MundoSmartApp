export type OsImpressaoTipoHtml =
  | 'comprovante'
  | 'os'
  | 'os-com-teste'
  | 'teste'
  | 'garantia';

export type OsImpressaoTipoTermico = 'comprovante-loja-termico' | 'garantia-termico';

export type OsImpressaoTipo = OsImpressaoTipoHtml | OsImpressaoTipoTermico;

/** Tipo A4 padrão ao finalizar cadastro da OS. */
export const OS_IMPRESSAO_PADRAO_POS_CADASTRO: OsImpressaoTipoHtml = 'os-com-teste';

export interface OsImpressaoOpcao {
  tipo: OsImpressaoTipo;
  label: string;
  termico?: boolean;
}

export const LOJA_IMPRESSAO_NOME = 'MundoSmart Assistência';

export const OS_IMPRESSAO_OPCOES: OsImpressaoOpcao[] = [
  { tipo: 'comprovante-loja-termico', label: 'Deixado na loja (térmica)', termico: true },
  { tipo: 'garantia-termico', label: 'Garantia (térmica)', termico: true },
  { tipo: 'comprovante', label: 'Comprovante (A4)' },
  { tipo: 'os', label: 'Ordem de serviço (A4)' },
  { tipo: 'os-com-teste', label: 'Ordem de serviço com teste (A4)' },
  { tipo: 'teste', label: 'Folha de teste (A4)' },
  { tipo: 'garantia', label: 'Garantia (A4)' },
];

/** Opções A4 do fluxo pós-cadastro (com pré-seleção). */
export const OS_IMPRESSAO_OPCOES_POS_CADASTRO: Array<{
  tipo: OsImpressaoTipoHtml | 'nenhuma';
  label: string;
}> = [
  { tipo: 'os-com-teste', label: 'Ordem de serviço com teste (A4)' },
  { tipo: 'os', label: 'Ordem de serviço (A4)' },
  { tipo: 'teste', label: 'Folha de teste (A4)' },
  { tipo: 'nenhuma', label: 'Não imprimir' },
];

export function isImpressaoTermica(tipo: OsImpressaoTipo): tipo is OsImpressaoTipoTermico {
  return tipo === 'comprovante-loja-termico' || tipo === 'garantia-termico';
}

export function tituloImpressaoOs(tipo: OsImpressaoTipo, numero?: string | number | null): string {
  const n = numero ? ` #${numero}` : '';
  switch (tipo) {
    case 'comprovante':
    case 'comprovante-loja-termico':
      return `Deixado na loja${n}`;
    case 'os':
      return `Ordem de serviço${n}`;
    case 'os-com-teste':
      return `Ordem de serviço com teste${n}`;
    case 'teste':
      return `Folha de teste${n}`;
    case 'garantia':
    case 'garantia-termico':
      return `Termo de garantia${n}`;
  }
}

export function nomeArquivoImpressaoOs(tipo: OsImpressaoTipo, numero?: string | number | null): string {
  const id = numero ?? 'sem-numero';
  switch (tipo) {
    case 'comprovante':
    case 'comprovante-loja-termico':
      return `OS-${id}-comprovante.pdf`;
    case 'os':
      return `OS-${id}-ordem-servico.pdf`;
    case 'os-com-teste':
      return `OS-${id}-com-teste.pdf`;
    case 'teste':
      return `OS-${id}-teste.pdf`;
    case 'garantia':
    case 'garantia-termico':
      return `OS-${id}-garantia.pdf`;
  }
}
