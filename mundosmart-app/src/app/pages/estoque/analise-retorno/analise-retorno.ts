import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EstoqueService } from '../../../services/estoque';
import {
  AnaliseRetornoFornecedorItem,
  AnaliseRetornoGarantiaResponse,
} from '../../../models/estoque.models';

@Component({
  selector: 'app-analise-retorno',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './analise-retorno.html',
  styles: [`
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .filtros .form-group { margin: 0; min-width: 160px; }
    .filtros input { width: 100%; }
    .links-secundarios {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 16px;
      font-size: 13px;
    }
    .links-secundarios a { color: #1d4ed8; text-decoration: none; }
    .links-secundarios a:hover { text-decoration: underline; }
    .resumo {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .resumo-card {
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .resumo-card .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .resumo-card .valor { font-size: 22px; font-weight: 700; color: #0f172a; }
    .colunas {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    @media (min-width: 960px) {
      .colunas { grid-template-columns: 1fr 1fr; }
    }
    h3 { margin: 0 0 10px; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .barra {
      height: 6px;
      background: #e2e8f0;
      border-radius: 4px;
      margin-top: 6px;
      overflow: hidden;
    }
    .barra > span {
      display: block;
      height: 100%;
      background: #2563eb;
      border-radius: 4px;
    }
    .barra.peca > span { background: #0d9488; }
    .detalhe-forn {
      margin-top: 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 6px;
      font-size: 12px;
    }
    .detalhe-forn ul { margin: 4px 0 0; padding-left: 18px; }
    .vazio { color: #64748b; font-size: 13px; }
  `],
})
export class AnaliseRetornoPage implements OnInit {
  analise?: AnaliseRetornoGarantiaResponse;
  carregando = false;
  erro = '';
  filtroDe = '';
  filtroAte = '';
  filtroFornecedor = '';
  expandidoFornecedor = '';

  constructor(private service: EstoqueService) {}

  ngOnInit(): void {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.filtroDe = this.toInputDate(ini);
    this.filtroAte = this.toInputDate(hoje);
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.analisarRetornoGarantia({
      de: this.filtroDe || undefined,
      ate: this.filtroAte || undefined,
      fornecedor: this.filtroFornecedor || undefined,
    }).subscribe({
      next: res => {
        this.analise = res;
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = err?.error?.erro ?? 'Erro ao carregar análise de retorno.';
      },
    });
  }

  limpar(): void {
    this.filtroDe = '';
    this.filtroAte = '';
    this.filtroFornecedor = '';
    this.expandidoFornecedor = '';
    this.carregar();
  }

  toggleFornecedor(nome: string): void {
    this.expandidoFornecedor = this.expandidoFornecedor === nome ? '' : nome;
  }

  pctFornecedor(f: AnaliseRetornoFornecedorItem): number {
    const total = this.analise?.totalUnidades ?? 0;
    if (total <= 0) return 0;
    return Math.round((f.totalUnidades / total) * 100);
  }

  pctPeca(qtd: number): number {
    const total = this.analise?.totalUnidades ?? 0;
    if (total <= 0) return 0;
    return Math.round((qtd / total) * 100);
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
