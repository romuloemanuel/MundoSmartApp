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

export type TipoDispositivo = (typeof TIPOS_DISPOSITIVO)[number];
export type TipoCompatibilidade = (typeof TIPOS_COMPATIBILIDADE)[number]['valor'];

/** Limites de exibição na consulta de modelos */
export const MODELO_LIMITE_LISTA = 500;
export const MODELO_LIMITE_AUTOCOMPLETE_API = 25;
export const MODELO_LIMITE_AUTOCOMPLETE_UI = 12;
