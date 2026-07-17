import { BlingOrdemServico } from '../models/bling.models';

interface LinhaPadrao {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function esc(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function padraoIndices(valor: string): number[] {
  if (!valor?.trim()) return [];
  return valor
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => !Number.isNaN(n) && n >= 0 && n <= 8);
}

function centroX(indice: number): number {
  return (indice % 3) * 52 + 21;
}

function centroY(indice: number): number {
  return Math.floor(indice / 3) * 52 + 21;
}

function linhasPadrao(valor: string): LinhaPadrao[] {
  const pts = padraoIndices(valor);
  const linhas: LinhaPadrao[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    linhas.push({
      x1: centroX(a),
      y1: centroY(a),
      x2: centroX(b),
      y2: centroY(b),
    });
  }
  return linhas;
}

function svgPadraoDesenho(valor: string, larguraPx = 72): string {
  const pts = padraoIndices(valor);
  if (!pts.length) return '';

  const alturaPx = Math.round(larguraPx * (146 / 156));
  const ordemPorIndice = new Map<number, number>();
  pts.forEach((indice, ordem) => {
    if (!ordemPorIndice.has(indice)) ordemPorIndice.set(indice, ordem + 1);
  });

  const linhas = linhasPadrao(valor)
    .map(l => `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" />`)
    .join('');

  // Grade completa 3×3: pontos não usados ficam visíveis (como na tela), facilita conferir o desenho.
  const pontos = Array.from({ length: 9 }, (_, indice) => {
    const cx = centroX(indice);
    const cy = centroY(indice);
    const ordem = ordemPorIndice.get(indice);
    if (ordem != null) {
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="18" class="senha-ponto senha-ponto-ativo" />
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="senha-ponto-num">${ordem}</text>
      </g>`;
    }
    return `<g>
      <circle cx="${cx}" cy="${cy}" r="18" class="senha-ponto senha-ponto-inativo" />
    </g>`;
  }).join('');

  return `<svg class="senha-impressao-svg" viewBox="0 0 156 146" width="${larguraPx}" height="${alturaPx}" aria-hidden="true">
    ${linhas}
    ${pontos}
  </svg>`;
}

/** HTML do campo senha para impressão (inclui desenho visual quando aplicável). */
export function htmlSenhaDispositivoImpressao(os: BlingOrdemServico, compacto = false): string {
  const tipo = os.senhaDispositivoTipo;
  const valor = os.senhaDispositivo?.trim();

  if (!tipo) return '<span>—</span>';
  if (tipo === 'nao_deixou') return '<span>Cliente não deixou senha</span>';
  if (tipo === 'sem_senha') return '<span>Sem senha</span>';
  if (tipo === 'numerica') return `<span>${esc(valor || '—')}</span>`;

  if (tipo === 'desenho') {
    if (!valor) return '<span>—</span>';
    const svg = svgPadraoDesenho(valor, compacto ? 68 : 84);
    return `<div class="senha-impressao-desenho">
      <span class="senha-impressao-rotulo">Desenho</span>
      ${svg}
    </div>`;
  }

  return '<span>—</span>';
}
