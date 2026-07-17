export type OsFotoCategoriaId =
  | 'frente'
  | 'tras'
  | 'esquerda'
  | 'direita'
  | 'cima'
  | 'baixo'
  | 'outra';

export interface OsFotoCategoriaGuia {
  id: OsFotoCategoriaId;
  titulo: string;
  dica: string;
  icone: string;
}

/** Ângulos sugeridos — o usuário pode adicionar quantas fotos quiser em cada um. */
export const CATEGORIAS_FOTO_GUIADAS: OsFotoCategoriaGuia[] = [
  { id: 'frente', titulo: 'Tela de frente', dica: 'Mostre a tela ligada ou apagada', icone: '📱' },
  { id: 'tras', titulo: 'Parte de trás', dica: 'Câmeras, logo e carcaça', icone: '🔙' },
  { id: 'esquerda', titulo: 'Lado esquerdo', dica: 'Borda e botões deste lado', icone: '◀️' },
  { id: 'direita', titulo: 'Lado direito', dica: 'Borda e botões deste lado', icone: '▶️' },
  { id: 'cima', titulo: 'Por cima', dica: 'Topo do aparelho', icone: '⬆️' },
  { id: 'baixo', titulo: 'Por baixo', dica: 'Base, entrada e alto-falante', icone: '⬇️' },
];

export const CATEGORIA_FOTO_OUTRA: OsFotoCategoriaGuia = {
  id: 'outra',
  titulo: 'Outra foto',
  dica: 'Avaria, detalhe ou outro ângulo — quantas precisar',
  icone: '➕',
};

const ROTULOS: Record<OsFotoCategoriaId, string> = {
  frente: 'Tela de frente',
  tras: 'Parte de trás',
  esquerda: 'Lado esquerdo',
  direita: 'Lado direito',
  cima: 'Por cima',
  baixo: 'Por baixo',
  outra: 'Outra foto',
};

export function normalizarCategoriaFoto(categoria?: string | null): OsFotoCategoriaId {
  const cat = categoria?.trim().toLowerCase();
  if (cat && cat in ROTULOS) return cat as OsFotoCategoriaId;
  return 'outra';
}

export function rotuloCategoriaFoto(categoria?: string | null, descricaoFoco?: string | null): string {
  const cat = normalizarCategoriaFoto(categoria);
  if (cat === 'outra' && descricaoFoco?.trim()) return descricaoFoco.trim();
  return ROTULOS[cat];
}
