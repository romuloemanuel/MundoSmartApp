import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PecasService } from '../../services/pecas';
import { AparelhosService } from '../../services/aparelhos';
import { ModeloAparelho, PecaEstoque } from '../../models/bling.models';
import { GridPaginator } from '../../components/grid-paginator/grid-paginator';
import { GridPaginationState } from '../../utils/grid-pagination.state';
import {
  ehCategoriaTela,
  categoriaExpandeCoberturaPorCompatibilidade,
  inferirCategoriaPeca,
  indiceCategoriaPeca,
  modeloElegivelParaCategoriaPeca,
} from '../../config/peca-categoria.config';
import {
  expandirIdsPorCompatibilidadeDePeca,
  MODELO_LIMITE_LISTA,
} from '../../config/aparelhos.config';

export interface ConsultaTelaItem {
  categoria: string;
  nome: string;
  quantidade: number;
  preco?: number;
}

export interface ConsultaTelaGrupo {
  marca: string;
  modelo: string;
  modeloId: string;
  saldoTotal: number;
  telas: ConsultaTelaItem[];
}

type FiltroTipoTela = 'todas' | 'oled' | 'incell';

@Component({
  selector: 'app-consulta-telas',
  standalone: true,
  imports: [CommonModule, FormsModule, GridPaginator],
  templateUrl: './consulta-telas.html',
  styleUrl: './consulta-telas.scss',
})
export class ConsultaTelasPage implements OnInit {
  readonly tipos: Array<{ id: FiltroTipoTela; label: string }> = [
    { id: 'todas', label: 'Todas' },
    { id: 'oled', label: 'OLED' },
    { id: 'incell', label: 'Incell' },
  ];

  tipo: FiltroTipoTela = 'todas';
  termo = '';
  incluirZerados = false;
  carregando = false;
  erro = '';
  grupos: ConsultaTelaGrupo[] = [];
  buscou = false;
  readonly grid = new GridPaginationState();

  private catalogo: ConsultaTelaGrupo[] = [];

  constructor(
    private pecas: PecasService,
    private aparelhos: AparelhosService,
  ) {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
    this.grid.pageSize = mobile ? 10 : 20;
  }

  ngOnInit(): void {
    this.carregar();
  }

  get hint(): string {
    return 'Digite o aparelho ou a marca (ex.: G84, A54, iPhone 15)';
  }

  get gruposPaginados(): ConsultaTelaGrupo[] {
    return this.grid.paginate(this.grupos);
  }

  get linhasPaginadas(): Array<
    | { kind: 'marca'; label: string }
    | { kind: 'item'; grupo: ConsultaTelaGrupo }
  > {
    const linhas: Array<
      | { kind: 'marca'; label: string }
      | { kind: 'item'; grupo: ConsultaTelaGrupo }
    > = [];
    let marcaAtual = '';
    for (const g of this.gruposPaginados) {
      const marca = (g.marca || 'Outras').trim();
      if (marca.toLowerCase() !== marcaAtual.toLowerCase()) {
        marcaAtual = marca;
        linhas.push({ kind: 'marca', label: marca });
      }
      linhas.push({ kind: 'item', grupo: g });
    }
    return linhas;
  }

  selecionarTipo(tipo: FiltroTipoTela): void {
    if (this.tipo === tipo) return;
    this.tipo = tipo;
    this.aplicarFiltro();
  }

  onTermoChange(): void {
    this.aplicarFiltro();
  }

  buscar(): void {
    this.aplicarFiltro();
    this.rolarResultados();
  }

  limparBusca(): void {
    this.termo = '';
    this.aplicarFiltro();
  }

  toggleZerados(): void {
    this.incluirZerados = !this.incluirZerados;
    this.aplicarFiltro();
  }

  onPaginaChange(page: number): void {
    this.grid.onPageChange(page);
    this.rolarResultados();
  }

  onTamanhoPaginaChange(size: number): void {
    this.grid.onPageSizeChange(size);
    this.rolarResultados();
  }

  rolarParaTopo(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saldoClass(saldo: number): string {
    if (saldo <= 0) return 'zerado';
    if (saldo <= 2) return 'baixo';
    return 'ok';
  }

  private carregar(): void {
    this.carregando = true;
    this.erro = '';
    forkJoin({
      pecas: this.pecas.buscar(),
      marcas: this.aparelhos.listarMarcas(),
    }).subscribe({
      next: ({ pecas, marcas }) => {
        const reqs = (marcas?.length ? marcas : [{ nome: '' }]).map(m =>
          this.aparelhos.listarModelos({
            marcaNome: m.nome || undefined,
            limite: MODELO_LIMITE_LISTA,
          }),
        );
        forkJoin(reqs).subscribe({
          next: listas => {
            const porId = new Map<string, ModeloAparelho>();
            for (const lista of listas) {
              for (const m of lista ?? []) {
                if (m.id) porId.set(m.id, m);
              }
            }
            this.catalogo = this.montarGrupos(pecas ?? [], [...porId.values()]);
            this.carregando = false;
            this.buscou = true;
            this.aplicarFiltro();
          },
          error: err => this.falhou(err),
        });
      },
      error: err => this.falhou(err),
    });
  }

  private falhou(err: unknown): void {
    console.error(err);
    this.carregando = false;
    this.buscou = true;
    this.catalogo = [];
    this.grupos = [];
    this.grid.reset();
    this.erro = 'Não foi possível carregar as telas do estoque.';
  }

  private montarGrupos(pecas: PecaEstoque[], modelos: ModeloAparelho[]): ConsultaTelaGrupo[] {
    const telas = pecas.filter(p => ehCategoriaTela(p.nome, p.categoria));
    const mapa = new Map<string, ConsultaTelaGrupo>();

    for (const peca of telas) {
      const categoria = inferirCategoriaPeca(peca.nome, peca.categoria);
      const idsDiretos = (peca.modelosCompativeis ?? [])
        .map(mc => mc.modeloId)
        .filter(id => !!id);
      const cobertos = categoriaExpandeCoberturaPorCompatibilidade(categoria)
        ? expandirIdsPorCompatibilidadeDePeca(idsDiretos, modelos)
        : new Set(idsDiretos);

      if (cobertos.size === 0) {
        // Peça sem modelo cadastrado: ainda aparece como "Sem aparelho".
        this.adicionarTela(mapa, {
          modeloId: peca.id || peca.nome,
          modelo: 'Sem aparelho',
          marca: 'Outras',
        }, peca, categoria);
        continue;
      }

      for (const modeloId of cobertos) {
        const modelo = modelos.find(m => m.id === modeloId);
        const direto = peca.modelosCompativeis?.find(mc => mc.modeloId === modeloId);
        if (modelo && !modeloElegivelParaCategoriaPeca(modelo.tipoTela, categoria)) continue;
        this.adicionarTela(mapa, {
          modeloId,
          modelo: modelo?.nome || direto?.modeloNome || 'Sem aparelho',
          marca: modelo?.marcaNome || direto?.marcaNome || 'Outras',
        }, peca, categoria, direto?.valorSugeridoTroca);
      }
    }

    return [...mapa.values()].sort((a, b) => {
      const marca = a.marca.localeCompare(b.marca, 'pt-BR');
      if (marca !== 0) return marca;
      return a.modelo.localeCompare(b.modelo, 'pt-BR');
    });
  }

  private adicionarTela(
    mapa: Map<string, ConsultaTelaGrupo>,
    chave: { modeloId: string; modelo: string; marca: string },
    peca: PecaEstoque,
    categoria: string,
    precoModelo?: number,
  ): void {
    const id = chave.modeloId;
    if (!mapa.has(id)) {
      mapa.set(id, {
        marca: chave.marca,
        modelo: chave.modelo,
        modeloId: id,
        saldoTotal: 0,
        telas: [],
      });
    }
    const grupo = mapa.get(id)!;
    const qtd = Math.max(0, Number(peca.quantidadeEstoque) || 0);
    const preco = precoModelo ?? peca.valorSugeridoTroca;
    const existente = grupo.telas.find(t => t.categoria === categoria);
    if (existente) {
      existente.quantidade += qtd;
      if (preco && (!existente.preco || preco < existente.preco)) existente.preco = preco;
    } else {
      grupo.telas.push({
        categoria,
        nome: peca.nome,
        quantidade: qtd,
        preco: preco && preco > 0 ? preco : undefined,
      });
    }
    grupo.telas.sort((a, b) => indiceCategoriaPeca(a.categoria) - indiceCategoriaPeca(b.categoria));
    grupo.saldoTotal = grupo.telas.reduce((s, t) => s + t.quantidade, 0);
  }

  private aplicarFiltro(): void {
    const t = this.normalizar(this.termo);
    this.grupos = this.catalogo
      .map(g => ({
        ...g,
        telas: g.telas.filter(tela => this.bateTipo(tela.categoria)),
      }))
      .filter(g => g.telas.length > 0)
      .map(g => ({
        ...g,
        saldoTotal: g.telas.reduce((s, tela) => s + tela.quantidade, 0),
      }))
      .filter(g => this.incluirZerados || g.saldoTotal > 0)
      .filter(g => {
        if (!t) return true;
        const hay = this.normalizar(`${g.marca} ${g.modelo} ${g.telas.map(x => x.categoria).join(' ')}`);
        return hay.includes(t) || t.split(/\s+/).every(p => hay.includes(p));
      });
    this.grid.reset();
  }

  private bateTipo(categoria: string): boolean {
    const n = categoria.toLowerCase();
    if (this.tipo === 'oled') return n.includes('oled');
    if (this.tipo === 'incell') return n.includes('incell') || n.includes('lcd');
    return true;
  }

  private normalizar(s: string): string {
    return (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private rolarResultados(): void {
    document.getElementById('consulta-telas-resultados')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
