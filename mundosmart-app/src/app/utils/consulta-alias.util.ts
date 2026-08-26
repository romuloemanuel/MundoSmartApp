/** Atalhos de balcão nas consultas: SM, MT, MI. */

export interface ConsultaMarcaAlias {
  /** Qualquer uma identifica a marca. */
  marcas: string[];
  /** Se houver, o texto precisa bater em pelo menos uma linha (ex.: Poco/Redmi). */
  linhas?: string[];
}

const ALIASES: Record<string, ConsultaMarcaAlias> = {
  sm: { marcas: ['samsung', 'galaxy'] },
  mt: { marcas: ['motorola', 'moto'] },
  mi: { marcas: ['xiaomi', 'poco', 'redmi'], linhas: ['poco', 'redmi', 'note'] },
};

export function resolverAliasConsulta(termoNormalizado: string): {
  alias?: ConsultaMarcaAlias;
  resto: string[];
} {
  const tokens = (termoNormalizado ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { resto: [] };
  const alias = ALIASES[tokens[0]];
  if (!alias) return { resto: tokens };
  return { alias, resto: tokens.slice(1) };
}

/** `hay` e `termo` já normalizados (minúsculas, sem acento). */
export function consultaTextoCombina(hay: string, termo: string): boolean {
  if (!termo) return true;
  const hayCompact = hay.replace(/\s+/g, '');
  const { alias, resto } = resolverAliasConsulta(termo);

  if (alias) {
    const marcaOk = alias.marcas.some(m => hay.includes(m) || hayCompact.includes(m));
    const linhaOk = !alias.linhas?.length
      || alias.linhas.some(l => hay.includes(l) || hayCompact.includes(l));
    if (!marcaOk || !linhaOk) return false;
    if (resto.length === 0) return true;
    return resto.every(tok => hay.includes(tok) || hayCompact.includes(tok.replace(/\s+/g, '')));
  }

  const termoCompact = termo.replace(/\s+/g, '');
  if (hay.includes(termo) || (termoCompact.length >= 2 && hayCompact.includes(termoCompact))) {
    return true;
  }
  if (resto.length > 1) {
    return resto.every(tok => hay.includes(tok) || hayCompact.includes(tok.replace(/\s+/g, '')));
  }
  return false;
}
