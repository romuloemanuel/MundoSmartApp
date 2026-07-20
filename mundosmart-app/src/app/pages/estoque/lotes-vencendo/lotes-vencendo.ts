import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EstoqueService } from '../../../services/estoque';
import { LoteGarantiaItem } from '../../../models/estoque.models';

@Component({
  selector: 'app-lotes-vencendo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lotes-vencendo.html',
  styles: [`
    .filtros {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .filtros .form-group { margin: 0; min-width: 160px; }
    .filtros select, .filtros input { width: 100%; }
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
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 14px;
      font-size: 13px;
      color: #475569;
    }
    .resumo strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .vazio { color: #64748b; font-size: 13px; margin-top: 12px; }
    .urgencia-critica { color: #b91c1c; font-weight: 600; }
    .urgencia-alta { color: #c2410c; font-weight: 600; }
    .urgencia-media { color: #a16207; }
    tr.linha-critica { background: #fef2f2; }
    tr.linha-alta { background: #fff7ed; }
  `],
})
export class LotesVencendoPage implements OnInit {
  lotes: LoteGarantiaItem[] = [];
  carregando = false;
  erro = '';
  filtroDias = 30;
  filtroFornecedor = '';
  filtroBusca = '';

  readonly opcoesDias = [7, 15, 30, 60, 90];

  constructor(private service: EstoqueService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listarLotesPrestesAVencer({
      dias: this.filtroDias,
      fornecedor: this.filtroFornecedor || undefined,
      busca: this.filtroBusca || undefined,
    }).subscribe({
      next: lotes => {
        this.lotes = lotes;
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = err?.error?.erro ?? 'Erro ao carregar lotes prestes a vencer.';
      },
    });
  }

  limpar(): void {
    this.filtroDias = 30;
    this.filtroFornecedor = '';
    this.filtroBusca = '';
    this.carregar();
  }

  get totalUnidades(): number {
    return this.lotes.reduce((s, l) => s + (l.quantidadeRestante || 0), 0);
  }

  get totalCriticos(): number {
    return this.lotes.filter(l => (l.diasGarantiaRestantes ?? 0) <= 7).length;
  }

  classeUrgencia(lote: LoteGarantiaItem): string {
    const dias = lote.diasGarantiaRestantes ?? 0;
    if (dias <= 7) return 'urgencia-critica';
    if (dias <= 15) return 'urgencia-alta';
    if (dias <= 30) return 'urgencia-media';
    return '';
  }

  classeLinha(lote: LoteGarantiaItem): string {
    const dias = lote.diasGarantiaRestantes ?? 0;
    if (dias <= 7) return 'linha-critica';
    if (dias <= 15) return 'linha-alta';
    return '';
  }

  labelDiasRestantes(lote: LoteGarantiaItem): string {
    const dias = lote.diasGarantiaRestantes ?? 0;
    if (dias <= 0) return 'Vence hoje';
    if (dias === 1) return '1 dia';
    return `${dias} dias`;
  }

  formatarDia(valor?: string): string {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
}
