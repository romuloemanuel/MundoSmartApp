import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EstoqueService } from '../../../services/estoque';
import {
  LoteDevolucaoGarantiaDocumento,
  LoteRetornoGarantiaHistorico,
} from '../../../models/estoque.models';
import {
  abrirJanelaLoteDevolucaoGarantia,
  montarHtmlLoteDevolucaoGarantia,
} from '../../../utils/garantia-devolucao-pdf.util';

@Component({
  selector: 'app-lotes-retorno',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './lotes-retorno.html',
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
    .lote-detalhe {
      margin-top: 8px;
      padding: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .lote-detalhe table { margin-top: 6px; font-size: 12px; }
    .acoes { display: flex; flex-wrap: wrap; gap: 6px; }
    .acoes button { font-size: 12px; padding: 4px 10px; }
    .vazio { color: #64748b; font-size: 13px; margin-top: 12px; }
  `],
})
export class LotesRetornoPage implements OnInit {
  lotes: LoteRetornoGarantiaHistorico[] = [];
  carregando = false;
  erro = '';
  filtroFornecedor = '';
  filtroDe = '';
  filtroAte = '';
  expandidoId = '';

  constructor(private service: EstoqueService) {}

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.service.listarLotesRetornoHistorico({
      fornecedor: this.filtroFornecedor || undefined,
      de: this.filtroDe || undefined,
      ate: this.filtroAte || undefined,
      limite: 200,
    }).subscribe({
      next: lotes => {
        this.lotes = lotes;
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = err?.error?.erro ?? 'Erro ao carregar lotes baixados.';
      },
    });
  }

  limpar(): void {
    this.filtroFornecedor = '';
    this.filtroDe = '';
    this.filtroAte = '';
    this.expandidoId = '';
    this.carregar();
  }

  get totalUnidades(): number {
    return this.lotes.reduce((s, l) => s + (l.totalUnidades || 0), 0);
  }

  toggleDetalhe(id?: string): void {
    if (!id) return;
    this.expandidoId = this.expandidoId === id ? '' : id;
  }

  reimprimir(lote: LoteRetornoGarantiaHistorico): void {
    const doc: LoteDevolucaoGarantiaDocumento = {
      id: lote.id ?? '',
      geradoEm: lote.geradoEm,
      fornecedor: lote.fornecedor,
      motivo: lote.motivo,
      totalUnidades: lote.totalUnidades,
      dataVencimentoMaisProxima: lote.dataVencimentoMaisProxima,
      dataPrazoMaximoEnvio: lote.dataPrazoMaximoEnvio,
      itens: lote.itens ?? [],
    };
    abrirJanelaLoteDevolucaoGarantia(montarHtmlLoteDevolucaoGarantia(doc));
  }

  formatarData(valor?: string): string {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  formatarDia(valor?: string): string {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR');
  }
}
