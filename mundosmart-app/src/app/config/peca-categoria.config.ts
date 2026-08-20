import { familiaTipoTela } from './aparelhos.config';

export const CATEGORIAS_PECA = [
  'Bateria',
  'Tela Incell com Aro',
  'Tela Incell',
  'Tela OLED com Aro',
  'Tela OLED',
  'Tampa traseira',
  'Vidro Traseiro',
  'Vidro para Display',
  'Conector de carga',
  'Placa conectora',
  'Lentes',
  'Câmeras',
  'Flex',
  'Tags',
  'Outros',
] as const;

export type CategoriaPeca = (typeof CATEGORIAS_PECA)[number];

const CATEGORIAS_COM_CORES_PADRAO = new Set<string>(['Tampa traseira', 'Vidro Traseiro']);

let ordemCategorias: string[] = [...CATEGORIAS_PECA];
let categoriasComCores = new Set<string>(CATEGORIAS_COM_CORES_PADRAO);

/** Atualiza a ordem e as categorias com estoque por cor a partir do cadastro. */
export function aplicarCategoriasPecaCadastro(
  categorias: Array<{ nome: string; usaCoresPorModelo?: boolean }>,
): void {
  if (!categorias.length) return;
  ordemCategorias = categorias.map(c => c.nome);
  categoriasComCores = new Set(
    categorias.filter(c => c.usaCoresPorModelo).map(c => c.nome),
  );
  if (categoriasComCores.size === 0) {
    categoriasComCores = new Set(CATEGORIAS_COM_CORES_PADRAO);
  }
}

export function nomesCategoriasPeca(): string[] {
  return ordemCategorias.length ? [...ordemCategorias] : [...CATEGORIAS_PECA];
}

function normalizarTextoPeca(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function inferirCategoriaPeca(nome: string, categoria?: string): string {
  const cat = categoria?.trim();
  if (cat) return cat;

  const n = normalizarTextoPeca(nome);

  if (n.includes('oled') && (n.includes('com aro') || n.includes('c/ aro') || n.includes('c aro'))) {
    return 'Tela OLED com Aro';
  }
  if (n.includes('oled')) return 'Tela OLED';

  if ((n.includes('incell') || n.includes('in cell')) &&
      (n.includes('com aro') || n.includes('c/ aro') || n.includes('c aro'))) {
    return 'Tela Incell com Aro';
  }
  if (n.includes('incell') || n.includes('in cell')) return 'Tela Incell';

  if (n.includes('placa conectora') || n.includes('placa do conector')) return 'Placa conectora';
  if (n.includes('conector') && (n.includes('carga') || n.includes('carreg'))) return 'Conector de carga';
  if (n.includes('dock') || n.includes('entrada de carga')) return 'Conector de carga';

  if (n.includes('vidro') && (n.includes('display') || n.includes('tela') || n.includes('frontal'))) {
    return 'Vidro para Display';
  }
  if (n.includes('vidro traseiro') || n.includes('back glass')) return 'Vidro Traseiro';
  if (n.includes('tampa') || n.includes('back cover')) return 'Tampa traseira';
  if (n.includes('lente')) return 'Lentes';
  if (n.includes('camera') || n.includes('cam ')) return 'Câmeras';
  if (n.includes('flex')) return 'Flex';
  if (n.includes('tag') || n.includes('nfc tag')) return 'Tags';
  if (n.includes('bateria')) return 'Bateria';

  if (n.includes('tela') || n.includes('display') || n.includes('lcd')) return 'Tela Incell';

  return 'Outros';
}

/** Tela OLED só cabe em aparelho OLED. Tela Incell/LCD cabe em LCD e também em OLED (opção mais barata). */
export function modeloElegivelParaCategoriaPeca(tipoTela: string | undefined, categoria: string): boolean {
  const n = normalizarTextoPeca(categoria);
  if (!n.includes('oled')) return true;
  return familiaTipoTela(tipoTela) === 'OLED';
}

/**
 * Categorias em que um cadastro cobre modelos Família/Compartilhado no catálogo.
 * Mesma lógica para: Conector, Bateria, Tela OLED (±aro), Tela Incell (±aro).
 * Ex.: G10/G20/G30 ou A52/A53/A54 com a mesma peça.
 */
export function categoriaExpandeCoberturaPorCompatibilidade(categoria: string): boolean {
  const n = normalizarTextoPeca(categoria);
  if (!n) return false;
  return (
    n.includes('tela')
    || n.includes('incell')
    || n.includes('oled')
    || n.includes('bateria')
    || n.includes('conector')
    || n.includes('vidro para display')
    || n.includes('aro')
  );
}

/** Categorias que controlam estoque por cor dentro de cada modelo. */
export function categoriaUsaCoresPorModelo(categoria?: string): boolean {
  const cat = (categoria ?? '').trim();
  return !!cat && categoriasComCores.has(cat);
}

export function indiceCategoriaPeca(categoria?: string): number {
  const cat = categoria?.trim();
  if (!cat) return 999;
  const idx = ordemCategorias.indexOf(cat);
  return idx >= 0 ? idx : 998;
}

export function agruparPecasPorCategoria<T extends { nome: string; categoria?: string }>(
  pecas: T[],
): { categoria: string; pecas: T[] }[] {
  const map = new Map<string, T[]>();
  for (const p of pecas) {
    const cat = inferirCategoriaPeca(p.nome, p.categoria);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
  }

  const grupos = Array.from(map.entries()).map(([categoria, itens]) => ({ categoria, pecas: itens }));
  grupos.sort((a, b) => {
    const diff = indiceCategoriaPeca(a.categoria) - indiceCategoriaPeca(b.categoria);
    if (diff !== 0) return diff;
    return a.categoria.localeCompare(b.categoria, 'pt-BR');
  });
  for (const g of grupos) {
    g.pecas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return grupos;
}

export function labelPecaCatalogo(
  nome: string,
  categoria?: string,
  marcaPeca?: string,
  extras?: { estoque?: number; variacoes?: number },
): string {
  const cat = inferirCategoriaPeca(nome, categoria);
  const partes: string[] = [];
  if (nome.trim() && nome.trim().toLowerCase() !== cat.toLowerCase()) {
    partes.push(nome.trim());
  } else {
    partes.push(cat);
  }
  if (marcaPeca?.trim()) partes.push(marcaPeca.trim());
  if (extras?.estoque != null) {
    const vars = extras.variacoes ? ` · ${extras.variacoes} var.` : '';
    partes.push(`(${extras.estoque} est.${vars})`);
  }
  return partes.join(' · ');
}
