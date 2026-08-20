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
  { valor: 'Compartilhado', label: 'Compartilhado — tela/bateria/conector em comum' },
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

/** Compatibilidade que indica peça física em comum entre modelos (tela/aro/bateria). */
export function ehCompatibilidadeQueExpandePeca(tipo?: string | null): boolean {
  const t = (tipo ?? '').trim().toLowerCase();
  // Familia: G10/G20/G30, A52/A53/A54 — mesma linha com mesma tela/aro
  // Compartilhado: peça compartilhada entre modelos distintos
  return t === 'compartilhado' || t === 'familia';
}

/** @deprecated Use ehCompatibilidadeQueExpandePeca */
export function ehCompatibilidadeCompartilhada(tipo?: string | null): boolean {
  return ehCompatibilidadeQueExpandePeca(tipo);
}

/**
 * Expande IDs cobertos via grafo bidirecional (Família + Compartilhado).
 * Ex.: tela/aro no G10 cobre G20 e G30; A52 cobre A53/A54.
 */
export function expandirIdsPorCompatibilidadeDePeca(
  idsDiretos: Iterable<string>,
  modelos: Array<{ id?: string; aparelhosCompativeis?: Array<{ modeloId?: string; tipoCompatibilidade?: string }> }>,
): Set<string> {
  const cobertos = new Set<string>();
  for (const id of idsDiretos) {
    const t = id?.trim();
    if (t) cobertos.add(t);
  }
  if (cobertos.size === 0) return cobertos;

  const vizinhos = new Map<string, Set<string>>();
  const addAresta = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!vizinhos.has(a)) vizinhos.set(a, new Set());
    if (!vizinhos.has(b)) vizinhos.set(b, new Set());
    vizinhos.get(a)!.add(b);
    vizinhos.get(b)!.add(a);
  };

  for (const modelo of modelos) {
    const id = modelo.id?.trim();
    if (!id) continue;
    for (const c of modelo.aparelhosCompativeis ?? []) {
      if (!ehCompatibilidadeQueExpandePeca(c.tipoCompatibilidade)) continue;
      const outro = c.modeloId?.trim();
      if (outro) addAresta(id, outro);
    }
  }

  const fila = [...cobertos];
  while (fila.length) {
    const atual = fila.pop()!;
    for (const n of vizinhos.get(atual) ?? []) {
      if (cobertos.has(n)) continue;
      cobertos.add(n);
      fila.push(n);
    }
  }

  return cobertos;
}

/** Alias mantido para imports existentes. */
export const expandirIdsPorCompatibilidadeCompartilhada = expandirIdsPorCompatibilidadeDePeca;

/** Limites de exibição na consulta de modelos */
export const MODELO_LIMITE_LISTA = 500;
export const MODELO_LIMITE_AUTOCOMPLETE_API = 25;
export const MODELO_LIMITE_AUTOCOMPLETE_UI = 12;
