export type OsOrdenacaoDirecao = 'asc' | 'desc';

export type OsOrdenacaoCampo =
  | 'urgencia'
  | 'numero'
  | 'cliente'
  | 'contatoAviso'
  | 'equipamento'
  | 'imei'
  | 'situacao'
  | 'retorno'
  | 'loja'
  | 'data'
  | 'valor';

export interface OsOrdenacao {
  campo: OsOrdenacaoCampo;
  direcao: OsOrdenacaoDirecao;
}

/** Padrão: mais urgente (vermelho / mais tempo na assistência) primeiro. */
export const OS_ORDENACAO_PADRAO: OsOrdenacao = {
  campo: 'urgencia',
  direcao: 'asc',
};

export const OS_COLUNAS_ORDENAVEIS: { campo: OsOrdenacaoCampo; label: string }[] = [
  { campo: 'urgencia', label: 'Urgência' },
  { campo: 'numero', label: 'Número' },
  { campo: 'cliente', label: 'Cliente' },
  { campo: 'contatoAviso', label: 'Autorizado retirar' },
  { campo: 'equipamento', label: 'Equipamento' },
  { campo: 'imei', label: 'IMEI' },
  { campo: 'situacao', label: 'Situação' },
  { campo: 'retorno', label: 'Retorno' },
  { campo: 'loja', label: 'Loja' },
  { campo: 'data', label: 'Data de entrada' },
  { campo: 'valor', label: 'Valor' },
];
