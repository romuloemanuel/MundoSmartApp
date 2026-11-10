import { inferirCategoriaPeca } from '../config/peca-categoria.config';
import {
  RelatorioContagemEstoqueBase,
  RelatorioContagemLoteItem,
  RelatorioContagemModeloItem,
  RelatorioContagemPecaItem,
} from '../models/estoque.models';
import { chaveMarcaNormalizada, mesmaMarcaNome, unificarNomesMarca } from './marca.util';

export interface FiltroRelatorioContagem {
  somenteComSaldo: boolean;
  marca: string;
  tipo: string;
}

export interface LinhaContagemEstoque {
  marca: string;
  modelo: string;
  tipo: string;
  peca: string;
  /** Custo do lote mais recente com saldo. */
  vlrUni: number | null;
  /** Média ponderada pela quantidade restante dos lotes. */
  vlrMedio: number | null;
  qtd: number;
  lotes: string;
  semLote: boolean;
}

export interface GrupoTipoContagem {
  tipo: string;
  totalQtd: number;
  linhas: LinhaContagemEstoque[];
}

export interface GrupoMarcaContagem {
  marca: string;
  totalQtd: number;
  tipos: GrupoTipoContagem[];
}

export interface RelatorioContagemMontado {
  linhas: LinhaContagemEstoque[];
  grupos: GrupoMarcaContagem[];
  agruparMarca: boolean;
  agruparTipo: boolean;
  totalLinhas: number;
  totalUnidades: number;
}

export interface ResultadoRelatorioContagem {
  relatorio: RelatorioContagemMontado;
  opcoesMarcas: string[];
  opcoesTipos: string[];
}

const SEM_MARCA = 'Sem marca';
const SEM_MODELO = '—';

interface AcumuloLote {
  marca: string;
  modelo: string;
  tipo: string;
  peca: string;
  pecaId: string;
  lotes: RelatorioContagemLoteItem[];
}

export function montarRelatorioContagem(
  base: RelatorioContagemEstoqueBase,
  filtros: FiltroRelatorioContagem,
  ordemTipos: string[],
): ResultadoRelatorioContagem {
  const pecas = base.pecas ?? [];
  const lotes = base.lotes ?? [];
  const pecaPorId = new Map<string, RelatorioContagemPecaItem>();
  for (const peca of pecas) {
    if (peca.id) pecaPorId.set(peca.id, peca);
  }

  const grafias = new Map<string, string[]>();
  const registrarMarca = (nome?: string | null) => {
    const limpo = limpar(nome);
    if (!limpo || limpo === SEM_MARCA) return;
    const chave = chaveMarcaNormalizada(limpo);
    const lista = grafias.get(chave) ?? [];
    lista.push(limpo);
    grafias.set(chave, lista);
  };

  for (const peca of pecas) {
    for (const modelo of peca.modelos ?? []) registrarMarca(modelo.marcaNome);
  }

  const gruposLote = new Map<string, AcumuloLote>();
  const pecasComLote = new Set<string>();

  for (const lote of lotes) {
    if ((lote.quantidadeRestante ?? 0) <= 0) continue;
    const peca = pecaPorId.get(lote.pecaId);
    const nomePeca = limpar(peca?.nome) || limpar(lote.pecaNome) || 'Peça';
    const tipo = inferirCategoriaPeca(nomePeca, peca?.categoria);
    const modelo = resolverModelo(peca, lote);
    const marca = resolverMarca(peca, lote, modelo);
    registrarMarca(marca);
    const pecaId = lote.pecaId || peca?.id || nomePeca;
    if (lote.pecaId) pecasComLote.add(lote.pecaId);
    const chave = `${chaveMarcaNormalizada(marca) || SEM_MARCA}|${normalizar(modelo)}|${pecaId}`;
    const atual = gruposLote.get(chave);
    if (atual) atual.lotes.push(lote);
    else gruposLote.set(chave, { marca, modelo, tipo, peca: nomePeca, pecaId, lotes: [lote] });
  }

  const preferidas = new Map<string, string>();
  for (const nome of unificarNomesMarca([...grafias.values()].flat())) {
    preferidas.set(chaveMarcaNormalizada(nome), nome);
  }
  const canon = (marca: string) => {
    if (!marca || marca === SEM_MARCA) return SEM_MARCA;
    return preferidas.get(chaveMarcaNormalizada(marca)) || marca;
  };

  const linhasBase: LinhaContagemEstoque[] = [];
  for (const acumulo of gruposLote.values()) {
    const qtd = acumulo.lotes.reduce((soma, lote) => soma + (lote.quantidadeRestante || 0), 0);
    if (qtd <= 0) continue;
    const custo = acumulo.lotes.reduce(
      (soma, lote) => soma + (lote.quantidadeRestante || 0) * (Number(lote.custoUnitario) || 0),
      0,
    );
    const ultimo = [...acumulo.lotes].sort((a, b) => dataMs(b.dataEntrada) - dataMs(a.dataEntrada))[0];
    const custoUni = Number(ultimo?.custoUnitario);
    linhasBase.push({
      marca: canon(acumulo.marca),
      modelo: acumulo.modelo,
      tipo: acumulo.tipo,
      peca: acumulo.peca,
      vlrUni: Number.isFinite(custoUni) ? custoUni : 0,
      vlrMedio: custo / qtd,
      qtd,
      lotes: textoLotes(acumulo.lotes),
      semLote: false,
    });
  }

  for (const peca of pecas) {
    if (peca.id && pecasComLote.has(peca.id)) continue;
    const qtd = peca.quantidadeEstoque ?? 0;
    if (filtros.somenteComSaldo && qtd <= 0) continue;
    const nomePeca = limpar(peca.nome) || 'Peça';
    const modelos = peca.modelos ?? [];
    const marcas = nomesUnicos(modelos.map(m => limpar(m.marcaNome)).filter(Boolean));
    const marca = marcas.length === 0
      ? SEM_MARCA
      : marcas.length === 1
        ? canon(marcas[0])
        : marcas.map(canon).join(' / ');
    linhasBase.push({
      marca,
      modelo: juntarModelos(modelos),
      tipo: inferirCategoriaPeca(nomePeca, peca.categoria),
      peca: nomePeca,
      vlrUni: null,
      vlrMedio: null,
      qtd,
      lotes: qtd > 0 ? 'Sem lote' : '',
      semLote: true,
    });
  }

  const elegiveis = filtros.somenteComSaldo ? linhasBase.filter(linha => linha.qtd > 0) : linhasBase;
  const opcoesMarcas = nomesUnicos(elegiveis.map(linha => linha.marca))
    .sort(compararMarca);
  const opcoesTipos = ordenarTipos(nomesUnicos(elegiveis.map(linha => linha.tipo)), ordemTipos);

  const filtradas = elegiveis.filter(linha => {
    if (filtros.marca && !marcaBateFiltro(linha.marca, filtros.marca)) return false;
    if (filtros.tipo && normalizar(linha.tipo) !== normalizar(filtros.tipo)) return false;
    return true;
  });

  filtradas.sort((a, b) =>
    compararMarca(a.marca, b.marca)
    || indiceTipo(a.tipo, ordemTipos) - indiceTipo(b.tipo, ordemTipos)
    || a.tipo.localeCompare(b.tipo, 'pt-BR')
    || compararModelo(a.modelo, b.modelo)
    || a.peca.localeCompare(b.peca, 'pt-BR'),
  );

  return {
    opcoesMarcas,
    opcoesTipos,
    relatorio: agrupar(filtradas),
  };
}

export function textoLotes(lotes: RelatorioContagemLoteItem[]): string {
  return [...lotes]
    .sort((a, b) =>
      (a.numeroPedido || '').localeCompare(b.numeroPedido || '', 'pt-BR', { numeric: true })
      || dataMs(a.dataEntrada) - dataMs(b.dataEntrada),
    )
    .map(lote => `Lote ${limpar(lote.numeroPedido) || 's/n'} QTD ${lote.quantidadeRestante}`)
    .join(' / ');
}

function agrupar(linhas: LinhaContagemEstoque[]): RelatorioContagemMontado {
  const marcas = nomesUnicos(linhas.map(linha => linha.marca));
  const tipos = nomesUnicos(linhas.map(linha => linha.tipo));
  const porMarca = new Map<string, LinhaContagemEstoque[]>();
  for (const linha of linhas) {
    const lista = porMarca.get(linha.marca) ?? [];
    lista.push(linha);
    porMarca.set(linha.marca, lista);
  }

  const grupos: GrupoMarcaContagem[] = [...porMarca.entries()].map(([marca, doMarca]) => {
    const porTipo = new Map<string, LinhaContagemEstoque[]>();
    for (const linha of doMarca) {
      const lista = porTipo.get(linha.tipo) ?? [];
      lista.push(linha);
      porTipo.set(linha.tipo, lista);
    }
    const tiposGrupo: GrupoTipoContagem[] = [...porTipo.entries()].map(([tipo, doTipo]) => ({
      tipo,
      linhas: doTipo,
      totalQtd: doTipo.reduce((soma, linha) => soma + linha.qtd, 0),
    }));
    return {
      marca,
      tipos: tiposGrupo,
      totalQtd: doMarca.reduce((soma, linha) => soma + linha.qtd, 0),
    };
  });

  return {
    linhas,
    grupos,
    agruparMarca: marcas.length > 1,
    agruparTipo: tipos.length > 1 && marcas.length > 1,
    totalLinhas: linhas.length,
    totalUnidades: linhas.reduce((soma, linha) => soma + linha.qtd, 0),
  };
}

function resolverModelo(
  peca: RelatorioContagemPecaItem | undefined,
  lote: RelatorioContagemLoteItem,
): string {
  const direto = limpar(lote.modeloNome);
  if (direto) return direto;
  const compativel = (peca?.modelos ?? []).find(modelo => modelo.modeloId && modelo.modeloId === lote.modeloId);
  return limpar(compativel?.modeloNome) || SEM_MODELO;
}

function resolverMarca(
  peca: RelatorioContagemPecaItem | undefined,
  lote: RelatorioContagemLoteItem,
  modelo: string,
): string {
  const compativeis = peca?.modelos ?? [];
  if (lote.modeloId) {
    const porId = compativeis.find(item => item.modeloId === lote.modeloId && limpar(item.marcaNome));
    const marca = limpar(porId?.marcaNome);
    if (marca) return marca;
  }
  if (modelo !== SEM_MODELO) {
    const porNome = compativeis.find(item =>
      normalizar(item.modeloNome) === normalizar(modelo) && limpar(item.marcaNome));
    const marca = limpar(porNome?.marcaNome);
    if (marca) return marca;
  }
  const marcas = nomesUnicos(compativeis.map(item => limpar(item.marcaNome)).filter(Boolean));
  return marcas.length === 1 ? marcas[0] : SEM_MARCA;
}

function marcaBateFiltro(marcaLinha: string, filtro: string): boolean {
  if (mesmaMarcaNome(marcaLinha, filtro)) return true;
  return marcaLinha.split('/').some(parte => mesmaMarcaNome(parte, filtro));
}

function juntarModelos(modelos: RelatorioContagemModeloItem[]): string {
  const nomes = nomesUnicos(modelos.map(modelo => limpar(modelo.modeloNome)).filter(Boolean))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  return nomes.length ? nomes.join(', ') : SEM_MODELO;
}

function ordenarTipos(tipos: string[], ordem: string[]): string[] {
  return [...tipos].sort((a, b) =>
    indiceTipo(a, ordem) - indiceTipo(b, ordem) || a.localeCompare(b, 'pt-BR'));
}

function indiceTipo(tipo: string, ordem: string[]): number {
  const alvo = normalizar(tipo);
  const indice = ordem.findIndex(item => normalizar(item) === alvo);
  return indice === -1 ? ordem.length + 1 : indice;
}

function compararMarca(a: string, b: string): number {
  if (a === SEM_MARCA && b !== SEM_MARCA) return 1;
  if (b === SEM_MARCA && a !== SEM_MARCA) return -1;
  return a.localeCompare(b, 'pt-BR');
}

function compararModelo(a: string, b: string): number {
  if (a === SEM_MODELO && b !== SEM_MODELO) return 1;
  if (b === SEM_MODELO && a !== SEM_MODELO) return -1;
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

function nomesUnicos(nomes: string[]): string[] {
  const vistos = new Set<string>();
  const lista: string[] = [];
  for (const nome of nomes) {
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    lista.push(nome);
  }
  return lista;
}

function limpar(valor?: string | null): string {
  return (valor ?? '').trim().replace(/\s+/g, ' ');
}

function normalizar(valor?: string | null): string {
  return limpar(valor).toLocaleLowerCase('pt-BR');
}

function dataMs(valor?: string): number {
  const tempo = valor ? Date.parse(valor) : NaN;
  return Number.isNaN(tempo) ? 0 : tempo;
}
