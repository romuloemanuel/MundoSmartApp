import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PecasService } from '../../../services/pecas';
import { PecaEstoque } from '../../../models/bling.models';
import { inferirCategoriaPeca } from '../../../config/peca-categoria.config';
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

@Component({
  selector: 'app-pecas-lista',
  imports: [CommonModule, FormsModule, RouterLink, GridPaginator, GridAcao],
  templateUrl: './lista.html',
  styles: [`
    .pecas-filtro-nivel { min-width: 160px; }
    .pecas-estoque-qtd { font-weight: 600; }
  `],
})
export class PecasLista implements OnInit {
  pecas: PecaEstoque[] = [];
  busca = '';
  /** '' | vermelho | laranja | amarelo | verde */
  filtroNivel: '' | NivelEstoque = '';
  carregando = false;
  erro = '';
  readonly grid = new GridPaginationState();
  readonly nivelClasses = ESTOQUE_NIVEL_CLASSES;

  constructor(private service: PecasService, private router: Router) {}

  ngOnInit(): void {
    this.carregar();
  }

  get limitesEstoque() {
    return getEstoqueConfig();
  }

  get opcoesFiltroNivel(): Array<{ id: '' | NivelEstoque; label: string }> {
    return montarOpcoesFiltroNivelEstoque();
  }

  get pecasFiltradas(): PecaEstoque[] {
    if (!this.filtroNivel) return this.pecas;
    return this.pecas.filter(p => calcularNivelEstoque(p.quantidadeEstoque ?? 0) === this.filtroNivel);
  }

  get pecasPaginadas(): PecaEstoque[] {
    return this.grid.paginate(this.pecasFiltradas);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.buscar(this.busca.trim() || undefined).subscribe({
      next: dados => {
        this.pecas = dados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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

  limparFiltros(): void {
    this.busca = '';
    this.filtroNivel = '';
    this.carregar();
  }

  get filtrosAtivos(): boolean {
    return !!this.busca.trim() || !!this.filtroNivel;
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
}
