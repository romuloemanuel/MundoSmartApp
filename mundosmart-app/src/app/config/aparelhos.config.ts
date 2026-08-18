export const TIPOS_DISPOSITIVO = [
  'Celular',
  'Tablet',
  'Smartwatch',
  'Notebook',
  'Console',
  'Outro',
] as const;

export const TIPOS_COMPATIBILIDADE = [
  { valor: 'Exato', label: 'Exato — mesmo modelo' },
  { valor: 'Familia', label: 'Família — variantes da mesma linha' },
  { valor: 'Compartilhado', label: 'Compartilhado — tela/bateria em comum' },
] as const;

export const TIPOS_TELA = [
  { valor: '', label: 'Não informado' },
  { valor: 'OLED', label: 'OLED (todas as variações)' },
  { valor: 'LCD', label: 'LCD (todas as variações)' },
] as const;

export type TipoDispositivo = (typeof TIPOS_DISPOSITIVO)[number];
export type TipoCompatibilidade = (typeof TIPOS_COMPATIBILIDADE)[number]['valor'];
export type TipoTela = (typeof TIPOS_TELA)[number]['valor'];
export type FamiliaTela = 'OLED' | 'LCD' | '';

/** Família da tela (arquitetura), ignorando variação: OLED(AMOLED), OLED(P-OLED), LCD(IPS), LCD(TFT). */
export function familiaTipoTela(tipoTela?: string | null): FamiliaTela {
  const valor = (tipoTela ?? '').trim().toUpperCase().replace(/[\s_\-()]+/g, '');
  if (!valor) return '';
  if (valor.startsWith('OLED') || valor.includes('OLED') || valor.includes('AMOLED') || valor.includes('POLED')) {
    return 'OLED';
  }
  if (
    valor.startsWith('LCD')
    || valor.includes('LCD')
    || valor.includes('IPS')
    || valor.includes('TFT')
    || valor.includes('PLS')
    || valor.includes('LTPS')
    || valor.includes('INCELL')
  ) {
    return 'LCD';
  }
  return '';
}

export function mesmoTipoTelaArquitetura(a?: string | null, b?: string | null): boolean {
  const familiaA = familiaTipoTela(a);
  const familiaB = familiaTipoTela(b);
  return !!familiaA && !!familiaB && familiaA === familiaB;
}

/** Limites de exibição na consulta de modelos */
export const MODELO_LIMITE_LISTA = 500;
export const MODELO_LIMITE_AUTOCOMPLETE_API = 25;
export const MODELO_LIMITE_AUTOCOMPLETE_UI = 12;
