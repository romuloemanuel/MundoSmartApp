import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PecasService } from '../../../services/pecas';
import { AparelhosService } from '../../../services/aparelhos';
import { PecaEstoque } from '../../../models/bling.models';
import {
  CATEGORIAS_PECA,
  inferirCategoriaPeca,
  indiceCategoriaPeca,
} from '../../../config/peca-categoria.config';
import {
  calcularNivelEstoque,
  ESTOQUE_NIVEL_CLASSES,
  getEstoqueConfig,
  NivelEstoque,
  opcoesFiltroNivelEstoque as montarOpcoesFiltroNivelEstoque,
} from '../../../config/estoque.config';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';
import { GridAcao } from '../../../components/grid-acao/grid-acao';
import { GridPaginationState } from '../../../utils/grid-pagination.state';

type PecaOrdenacaoCampo = 'peca' | 'categoria' | 'modelo' | 'preco' | 'estoque';

@Component({
  selector: 'app-pecas-lista',
  imports: [CommonModule, FormsModule, RouterLink, GridPaginator, GridAcao],
  templateUrl: './lista.html',
  styles: [`
    .pecas-filtro-select { min-width: 160px; }
    .pecas-filtro-nivel { min-width: 160px; }
    .pecas-estoque-qtd { font-weight: 600; }
  `],
})
export class PecasLista implements OnInit {
  pecas: PecaEstoque[] = [];
  busca = '';
  /** '' | vermelho | laranja | amarelo | verde */
  filtroNivel: '' | NivelEstoque = '';
  filtroMarca = '';
  filtroCategoria = '';
  ordenacao: { campo: PecaOrdenacaoCampo; direcao: 'asc' | 'desc' } = {
    campo: 'categoria',
    direcao: 'asc',
  };
  readonly categoriasFiltro = CATEGORIAS_PECA;
  marcasCatalogo: string[] = [];
  carregando = false;
  erro = '';
  readonly grid = new GridPaginationState();
  readonly nivelClasses = ESTOQUE_NIVEL_CLASSES;

  constructor(
    private service: PecasService,
    private aparelhosService: AparelhosService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.carregarMarcasCatalogo();
    this.carregar();
  }

  get limitesEstoque() {
    return getEstoqueConfig();
  }

  get opcoesFiltroNivel(): Array<{ id: '' | NivelEstoque; label: string }> {
    return montarOpcoesFiltroNivelEstoque();
  }

  get marcasDisponiveis(): string[] {
    if (this.marcasCatalogo.length > 0) return this.marcasCatalogo;

    const set = new Set<string>();
    for (const p of this.pecas) {
      for (const mc of p.modelosCompativeis ?? []) {
        const m = mc.marcaNome?.trim();
        if (m) set.add(m);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  carregarMarcasCatalogo(): void {
    this.aparelhosService.listarMarcas().subscribe({
      next: marcas => {
        this.marcasCatalogo = marcas
          .map(m => m.nome?.trim())
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      },
      error: () => { this.marcasCatalogo = []; },
    });
  }

  get pecasFiltradas(): PecaEstoque[] {
    return this.pecas.filter(p => {
      if (this.filtroNivel && calcularNivelEstoque(p.quantidadeEstoque ?? 0) !== this.filtroNivel) {
        return false;
      }
      if (this.filtroMarca && !this.pecaCompativelComMarcaAparelho(p, this.filtroMarca)) {
        return false;
      }
      if (this.filtroCategoria) {
        const cat = inferirCategoriaPeca(p.nome, p.categoria);
        if (cat !== this.filtroCategoria) return false;
      }
      return true;
    });
  }

  get pecasOrdenadas(): PecaEstoque[] {
    const copia = [...this.pecasFiltradas];
    copia.sort((a, b) => this.compararPecas(a, b));
    return copia;
  }

  get pecasPaginadas(): PecaEstoque[] {
    return this.grid.paginate(this.pecasOrdenadas);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.buscar(this.busca.trim() || undefined).subscribe({
      next: dados => {
        this.pecas = dados;
        this.grid.reset();
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao carregar peças.';
        this.carregando = false;
      },
    });
  }

  onFiltroNivelChange(): void {
    this.grid.reset();
  }

  onFiltroLocalChange(): void {
    this.grid.reset();
  }

  ordenar(campo: PecaOrdenacaoCampo): void {
    if (this.ordenacao.campo === campo) {
      this.ordenacao = {
        campo,
        direcao: this.ordenacao.direcao === 'asc' ? 'desc' : 'asc',
      };
    } else {
      this.ordenacao = { campo, direcao: 'asc' };
    }
    this.grid.reset();
  }

  iconeOrdenacao(campo: PecaOrdenacaoCampo): string {
    if (this.ordenacao.campo !== campo) return '↕';
    return this.ordenacao.direcao === 'asc' ? '↑' : '↓';
  }

  colunaOrdenada(campo: PecaOrdenacaoCampo): boolean {
    return this.ordenacao.campo === campo;
  }

  limparFiltros(): void {
    this.busca = '';
    this.filtroNivel = '';
    this.filtroMarca = '';
    this.filtroCategoria = '';
    this.carregar();
  }

  get filtrosAtivos(): boolean {
    return !!this.busca.trim() || !!this.filtroNivel || !!this.filtroMarca || !!this.filtroCategoria;
  }

  private compararPecas(a: PecaEstoque, b: PecaEstoque): number {
    const dir = this.ordenacao.direcao === 'asc' ? 1 : -1;
    let cmp = 0;

    switch (this.ordenacao.campo) {
      case 'peca':
        cmp = a.nome.localeCompare(b.nome, 'pt-BR');
        break;
      case 'categoria': {
        const catA = inferirCategoriaPeca(a.nome, a.categoria);
        const catB = inferirCategoriaPeca(b.nome, b.categoria);
        const diff = indiceCategoriaPeca(catA) - indiceCategoriaPeca(catB);
        cmp = diff !== 0 ? diff : catA.localeCompare(catB, 'pt-BR');
        if (cmp === 0) cmp = a.nome.localeCompare(b.nome, 'pt-BR');
        break;
      }
      case 'modelo':
        cmp = this.chaveOrdenacaoModelo(a).localeCompare(this.chaveOrdenacaoModelo(b), 'pt-BR');
        break;
      case 'preco':
        cmp = (a.valorSugeridoTroca ?? 0) - (b.valorSugeridoTroca ?? 0);
        break;
      case 'estoque':
        cmp = (a.quantidadeEstoque ?? 0) - (b.quantidadeEstoque ?? 0);
        break;
    }

    if (cmp === 0 && this.ordenacao.campo !== 'peca' && this.ordenacao.campo !== 'categoria') {
      cmp = a.nome.localeCompare(b.nome, 'pt-BR');
    }

    return cmp * dir;
  }

  nivelDaPeca(p: PecaEstoque): NivelEstoque {
    return calcularNivelEstoque(p.quantidadeEstoque ?? 0);
  }

  novo(): void {
    this.router.navigate(['/pecas/novo']);
  }

  editar(id: string): void {
    this.router.navigate(['/pecas', id]);
  }

  modelosDaPeca(p: PecaEstoque): string[] {
    const nomes = (p.modelosCompativeis ?? [])
      .map(mc => (mc.modeloNome ?? mc.modeloId).trim())
      .filter(Boolean);

    return [...new Set(nomes)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  tooltipModelosCompativeis(p: PecaEstoque): string {
    const modelos = (p.modelosCompativeis ?? [])
      .map(mc => {
        const nome = (mc.modeloNome ?? mc.modeloId).trim();
        if (!nome) return '';
        return mc.marcaNome ? `${mc.marcaNome} ${nome}` : nome;
      })
      .filter(Boolean);

    return modelos.length ? [...new Set(modelos)].join(', ') : '—';
  }

  temPrecoPorModelo(p: PecaEstoque): boolean {
    return (p.modelosCompativeis ?? []).some(
      m => m.valorSugeridoTroca != null || m.valorSugeridoMinimo != null,
    );
  }

  formatarMoeda(v?: number): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  inferirCategoria(p: PecaEstoque): string {
    return inferirCategoriaPeca(p.nome, p.categoria);
  }

  private pecaCompativelComMarcaAparelho(peca: PecaEstoque, marca: string): boolean {
    return (peca.modelosCompativeis ?? []).some(mc =>
      this.mesmaMarca(mc.marcaNome, marca),
    );
  }

  private mesmaMarca(a?: string, b?: string): boolean {
    return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
  }

  /** Primeiro modelo (marca + nome) em ordem alfabética — chave de ordenação da coluna Modelos. */
  private chaveOrdenacaoModelo(p: PecaEstoque): string {
    const rotulos = (p.modelosCompativeis ?? [])
      .map(mc => {
        const nome = (mc.modeloNome ?? mc.modeloId).trim();
        if (!nome) return '';
        const marca = mc.marcaNome?.trim();
        return marca ? `${marca} ${nome}` : nome;
      })
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return rotulos[0] ?? '';
  }
}
