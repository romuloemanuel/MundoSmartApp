import { MarcaAparelho } from '../models/bling.models';

export function chaveMarcaNormalizada(nome?: string | null): string {
  return (nome ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

export function mesmaMarcaNome(a?: string | null, b?: string | null): boolean {
  const chaveA = chaveMarcaNormalizada(a);
  const chaveB = chaveMarcaNormalizada(b);
  return !!chaveA && chaveA === chaveB;
}

function pontuarNomeMarca(nome: string): number {
  const upper = nome === nome.toLocaleUpperCase('pt-BR');
  const lower = nome === nome.toLocaleLowerCase('pt-BR');
  if (!upper && !lower) return 2;
  if (lower) return 1;
  return 0;
}

function preferirNomeMarca(candidato: string, atual: string): boolean {
  const scoreCandidato = pontuarNomeMarca(candidato);
  const scoreAtual = pontuarNomeMarca(atual);
  if (scoreCandidato !== scoreAtual) return scoreCandidato > scoreAtual;
  return candidato.localeCompare(atual, 'pt-BR') < 0;
}

/** Agrupa MOTOROLA / Motorola / motorola em um único item, preferindo a grafia mista. */
export function unificarMarcas(marcas: MarcaAparelho[] | null | undefined): MarcaAparelho[] {
  const grupos = new Map<string, MarcaAparelho>();
  for (const marca of marcas ?? []) {
    const nome = (marca.nome ?? '').trim().replace(/\s+/g, ' ');
    if (!nome) continue;
    const chave = chaveMarcaNormalizada(nome);
    const atual = grupos.get(chave);
    if (!atual || preferirNomeMarca(nome, atual.nome)) {
      grupos.set(chave, { ...marca, nome });
    }
  }
  return [...grupos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function unificarNomesMarca(nomes: Array<string | null | undefined>): string[] {
  return unificarMarcas(nomes.map(nome => ({ nome: nome ?? '' }))).map(m => m.nome);
}
