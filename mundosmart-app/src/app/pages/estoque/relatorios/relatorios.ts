import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { EstoquePageNav } from '../../../components/estoque-page-nav/estoque-page-nav';
import { RelatorioContagemEstoqueBase } from '../../../models/estoque.models';
import { CategoriasPecaService } from '../../../services/categorias-peca';
import { EstoqueService } from '../../../services/estoque';
import { baixarExcelContagem } from '../../../utils/estoque-contagem-excel.util';
import {
  montarRelatorioContagem,
  RelatorioContagemMontado,
} from '../../../utils/estoque-contagem-relatorio.util';
import { mesmaMarcaNome } from '../../../utils/marca.util';

@Component({
  selector: 'app-estoque-relatorios',
  standalone: true,
  imports: [CommonModule, FormsModule, EstoquePageNav],
  templateUrl: './relatorios.html',
  styles: [`
    .page { max-width: 100%; }
    .page-header { align-items: flex-start; gap: 16px; }
    .intro { max-width: 760px; margin: 6px 0 0; line-height: 1.45; }
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .filtros .form-group { margin: 0; min-width: 180px; }
    .filtros select { width: 100%; }
    .resumo {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #475569;
    }
    .resumo strong { color: #0f172a; }
    .tabela-scroll { overflow: auto; max-height: calc(100vh - 280px); }
    table { min-width: 980px; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      background: #e8eaf6;
    }
    td { vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .lotes { font-size: 12px; line-height: 1.4; min-width: 240px; }
    .sem-lote { color: #b45309; font-weight: 600; }
    .grupo-marca td,
    .grupo-marca:hover td {
      background: #1e3a8a;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
    }
    .grupo-tipo td,
    .grupo-tipo:hover td {
      background: #dbeafe;
      color: #1e3a8a;
      font-weight: 700;
    }
    .total td,
    .total:hover td {
      background: #f1f5f9;
      font-weight: 700;
    }
    .vazio { color: #64748b; font-size: 13px; }
  `],
})
export class RelatoriosEstoquePage implements OnInit {
  filtroSaldo: 'com-saldo' | 'todas' = 'com-saldo';
  filtroMarca = '';
  filtroTipo = '';

  carregando = false;
  baixando = false;
  erro = '';
  opcoesMarcas: string[] = [];
  opcoesTipos: string[] = [];
  relatorio: RelatorioContagemMontado | null = null;

  private base: RelatorioContagemEstoqueBase | null = null;
  private ordemTipos: string[] = [];

  constructor(
    private estoque: EstoqueService,
    private categorias: CategoriasPecaService,
  ) {}

  ngOnInit(): void {
    this.carregar();
  }

  get temSemLote(): boolean {
    return !!this.relatorio?.linhas.some(linha => linha.semLote && linha.qtd > 0);
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    forkJoin({
      base: this.estoque.obterBaseRelatorioContagem(),
      tipos: this.categorias.nomes(),
    }).subscribe({
      next: ({ base, tipos }) => {
        this.base = base;
        this.ordemTipos = tipos;
        this.carregando = false;
        this.atualizar();
      },
      error: err => {
        this.carregando = false;
        this.base = null;
        this.relatorio = null;
        this.erro = err?.error?.erro ?? 'Não foi possível carregar o estoque para o relatório.';
      },
    });
  }

  atualizar(): void {
    if (!this.base) return;
    let resultado = this.calcular();
    let ajustou = false;
    if (this.filtroMarca && !resultado.opcoesMarcas.some(marca => mesmaMarcaNome(marca, this.filtroMarca) || marca === this.filtroMarca)) {
      this.filtroMarca = '';
      ajustou = true;
    }
    if (this.filtroTipo && !resultado.opcoesTipos.some(tipo => tipo.toLocaleLowerCase('pt-BR') === this.filtroTipo.toLocaleLowerCase('pt-BR'))) {
      this.filtroTipo = '';
      ajustou = true;
    }
    if (ajustou) resultado = this.calcular();
    this.opcoesMarcas = resultado.opcoesMarcas;
    this.opcoesTipos = resultado.opcoesTipos;
    this.relatorio = resultado.relatorio;
  }

  async baixar(): Promise<void> {
    if (!this.relatorio?.linhas.length || this.baixando) return;
    this.baixando = true;
    this.erro = '';
    try {
      const gerado = this.base?.geradoEm ? new Date(this.base.geradoEm) : new Date();
      await baixarExcelContagem({
        relatorio: this.relatorio,
        geradoEm: Number.isNaN(gerado.getTime()) ? new Date() : gerado,
        saldoLabel: this.filtroSaldo === 'com-saldo' ? 'Com saldo' : 'Todas as peças',
        marcaLabel: this.filtroMarca || 'Todas',
        tipoLabel: this.filtroTipo || 'Todos',
      });
    } catch {
      this.erro = 'Não foi possível gerar o Excel.';
    } finally {
      this.baixando = false;
    }
  }

  textoMoeda(valor: number | null): string {
    if (valor === null || Number.isNaN(valor)) return '—';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private calcular() {
    return montarRelatorioContagem(this.base!, {
      somenteComSaldo: this.filtroSaldo === 'com-saldo',
      marca: this.filtroMarca,
      tipo: this.filtroTipo,
    }, this.ordemTipos);
  }
}
