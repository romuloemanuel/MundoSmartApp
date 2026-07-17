import { environment } from '../../environments/environment';

/**
 * Limites de cores do estoque — padrão em environment; sincronizado com a API em runtime.
 *
 * Vermelho (0): sem estoque
 * Laranja (1 … limiteLaranja-1): estoque abaixo do mínimo — padrão: abaixo de 3
 * Amarelo (limiteLaranja … limiteAmarelo-1): estoque mínimo — padrão: abaixo de 5
 * Verde (limiteAmarelo+): estoque normal — padrão: a partir de 5
 */
export interface EstoqueLimites {
  limiteLaranja: number;
  limiteAmarelo: number;
}

const padrao: EstoqueLimites = {
  limiteLaranja: environment.estoque.limiteLaranja,
  limiteAmarelo: environment.estoque.limiteAmarelo,
};

let _config: EstoqueLimites = { ...padrao };

export function aplicarConfigEstoque(cfg: Partial<EstoqueLimites>): void {
  if (cfg.limiteLaranja != null && cfg.limiteLaranja > 0) {
    _config.limiteLaranja = cfg.limiteLaranja;
  }
  if (cfg.limiteAmarelo != null && cfg.limiteAmarelo > 0) {
    _config.limiteAmarelo = cfg.limiteAmarelo;
  }
  if (_config.limiteAmarelo <= _config.limiteLaranja) {
    _config.limiteAmarelo = _config.limiteLaranja + 1;
  }
}

export function getEstoqueConfig(): Readonly<EstoqueLimites> {
  return _config;
}

export type NivelEstoque = 'verde' | 'amarelo' | 'laranja' | 'vermelho';

export function calcularNivelEstoque(quantidade: number): NivelEstoque {
  const { limiteLaranja, limiteAmarelo } = _config;
  if (quantidade <= 0) return 'vermelho';
  if (quantidade < limiteLaranja) return 'laranja';
  if (quantidade < limiteAmarelo) return 'amarelo';
  return 'verde';
}

export function estoqueEhAlerta(quantidade: number): boolean {
  return calcularNivelEstoque(quantidade) !== 'verde';
}

export function normalizarNivelApi(nivel?: string): NivelEstoque | undefined {
  if (!nivel) return undefined;
  if (nivel === 'vinho') return 'vermelho';
  if (nivel in ESTOQUE_NIVEL_CLASSES) return nivel as NivelEstoque;
  return undefined;
}

export const ESTOQUE_NIVEL_CLASSES: Record<NivelEstoque, string> = {
  verde: 'estoque-nivel-verde',
  amarelo: 'estoque-nivel-amarelo',
  laranja: 'estoque-nivel-laranja',
  vermelho: 'estoque-nivel-vermelho',
};

/** Rótulos sem o limiar numérico. */
export const ESTOQUE_NIVEL_LABELS: Record<NivelEstoque, string> = {
  verde: 'Estoque normal',
  amarelo: 'Estoque mínimo',
  laranja: 'Estoque abaixo do mínimo',
  vermelho: 'Sem estoque',
};

/**
 * Rótulo com o valor limiar na frente (configurável).
 * Ex.: "0 Sem estoque", "3 Estoque abaixo do mínimo", "5 Estoque mínimo", "5 Estoque normal".
 */
export function labelNivelEstoque(nivel: NivelEstoque): string {
  const { limiteLaranja, limiteAmarelo } = _config;
  switch (nivel) {
    case 'vermelho':
      return `0 ${ESTOQUE_NIVEL_LABELS.vermelho}`;
    case 'laranja':
      return `${limiteLaranja} ${ESTOQUE_NIVEL_LABELS.laranja}`;
    case 'amarelo':
      return `${limiteAmarelo} ${ESTOQUE_NIVEL_LABELS.amarelo}`;
    case 'verde':
      return `${limiteAmarelo} ${ESTOQUE_NIVEL_LABELS.verde}`;
  }
}

/** Opções de filtro (Todos + 4 níveis). */
export function opcoesFiltroNivelEstoque(): Array<{ id: '' | NivelEstoque; label: string }> {
  return [
    { id: '', label: 'Todos os níveis' },
    { id: 'vermelho', label: labelNivelEstoque('vermelho') },
    { id: 'laranja', label: labelNivelEstoque('laranja') },
    { id: 'amarelo', label: labelNivelEstoque('amarelo') },
    { id: 'verde', label: labelNivelEstoque('verde') },
  ];
}

export function nivelEstoqueDeQuantidade(quantidade: number, nivelApi?: string): NivelEstoque {
  return normalizarNivelApi(nivelApi) ?? calcularNivelEstoque(quantidade);
}

export function classeCardPorNivel(nivel: NivelEstoque): string {
  return `estoque-card-${nivel}`;
}
