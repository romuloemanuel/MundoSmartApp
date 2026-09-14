import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ComissaoOsItem,
  ComissaoPorTecnico,
  ComissaoRelatorio,
  OrdensServicoService,
} from '../../services/ordens-servico';
import { TecnicosService, Tecnico } from '../../services/tecnicos';
import { LOJAS_OS_FILTRO, labelLojaOs, siglaLojaOs } from '../../config/os-loja.config';

@Component({
  selector: 'app-comissoes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './comissoes.html',
  styles: [`
    .filtros-comissao {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 16px;
      align-items: flex-end;
      margin-bottom: 16px;
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .filtros-comissao .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 140px;
    }
    .filtros-comissao label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .filtros-comissao input[type="date"],
    .filtros-comissao select {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      min-width: 180px;
    }
    .tecnicos-lista {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      max-width: 520px;
      padding: 8px 10px;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      max-height: 120px;
      overflow: auto;
    }
    .tecnicos-lista label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 13px;
      color: #0f172a;
      cursor: pointer;
    }
    .resumo-geral {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 8px;
      color: #0c4a6e;
      font-size: 13px;
    }
    .resumo-geral .destaque {
      font-weight: 700;
      font-size: 15px;
      color: #075985;
    }
    .resumo-geral .previsao {
      color: #c2410c;
      font-weight: 600;
    }
    .resumo-geral .previsao-destaque {
      font-size: 15px;
      font-weight: 700;
    }
    .resumo-geral .previsao button,
    .resumo-card .previsao-linha button {
      background: none;
      border: none;
      padding: 0;
      margin-left: 6px;
      color: inherit;
      font: inherit;
      font-weight: 700;
      text-decoration: underline;
      cursor: pointer;
    }
    .previsao-txt { color: #c2410c; }
    .previsao-cell { font-weight: 600; color: #c2410c; }
    .resumo-card .previsao-linha {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: #c2410c;
      margin-top: 6px;
    }
    .resumo-card .previsao-linha strong {
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .comissao-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(0, 0, 0, 0.55);
    }
    .comissao-modal-box {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 920px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }
    .comissao-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 20px;
      background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
    .comissao-modal-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .comissao-modal-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.75);
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
    }
    .comissao-modal-body {
      overflow: auto;
      padding: 16px 20px 20px;
    }
    .comissao-modal-body .data-grid { width: 100%; }
    .resumo-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .resumo-card {
      padding: 12px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
    }
    .resumo-card h3 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #0f172a;
    }
    .resumo-card .linha {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .resumo-card .linha strong {
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
    .resumo-card .liquido {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 13px;
      font-weight: 700;
      color: #0369a1;
      display: flex;
      justify-content: space-between;
    }
    .data-grid .col-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .data-grid .liquido-cell { font-weight: 600; color: #0369a1; }
    .formula-hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: #64748b;
    }
  `],
})
export class ComissoesPage implements OnInit {
  tecnicos: Tecnico[] = [];
  tecnicosSelecionados = new Set<string>();
  /** Mantém OS concluídas sem técnico no relatório (ex.: Liniker). */
  incluirSemTecnico = true;
  dataInicio = '';
  dataFim = '';
  /** Vazio = todas as lojas (padrão — serviço paga comissão em Mococa). */
  filtroLoja = '';
  readonly lojasFiltro = LOJAS_OS_FILTRO;
  carregando = false;
  erro = '';
  relatorio: ComissaoRelatorio | null = null;
  modalPrevisao: 'aguardando' | 'andamento' | null = null;
  modalTecnico = '';

  get rotuloModalPrevisao(): string {
    const base = this.modalPrevisao === 'aguardando'
      ? 'Pronto na loja — aguardando cliente retirar'
      : 'Com preço definido — aberto ou em teste';
    return this.modalTecnico ? `${base} · ${this.modalTecnico}` : base;
  }

  get ordensModal(): ComissaoOsItem[] {
    if (!this.relatorio || !this.modalPrevisao) return [];
    const lista = this.modalPrevisao === 'aguardando'
      ? (this.relatorio.aguardandoCliente ?? [])
      : (this.relatorio.andamentoComPreco ?? []);
    if (!this.modalTecnico) return lista;
    return lista.filter(o =>
      (o.tecnicoNome || '').toLowerCase() === this.modalTecnico.toLowerCase());
  }

  get rotuloEscopoLoja(): string {
    return this.filtroLoja
      ? labelLojaOs(this.filtroLoja)
      : 'Todas as lojas';
  }

  constructor(
    private osService: OrdensServicoService,
    private tecnicosService: TecnicosService,
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.dataFim = this.toInputDate(hoje);
    this.dataInicio = this.toInputDate(inicioMes);
    this.filtroLoja = '';

    this.tecnicosService.listar(true).subscribe({
      next: (lista) => {
        this.tecnicos = lista;
        this.gerar();
      },
      error: () => {
        this.erro = 'Erro ao carregar técnicos.';
        this.gerar();
      },
    });
  }

  isTecnicoSelecionado(nome: string): boolean {
    return this.tecnicosSelecionados.has(nome);
  }

  toggleTecnico(nome: string, checked: boolean): void {
    if (checked) this.tecnicosSelecionados.add(nome);
    else this.tecnicosSelecionados.delete(nome);
  }

  selecionarTodos(): void {
    for (const t of this.tecnicos) this.tecnicosSelecionados.add(t.nome);
  }

  limparTecnicos(): void {
    this.tecnicosSelecionados.clear();
  }

  gerar(): void {
    this.fecharModalPrevisao();
    this.carregando = true;
    this.erro = '';
    this.relatorio = null;

    const tecnicos = [...this.tecnicosSelecionados];
    this.osService.relatorioComissao({
      dataConclusaoInicio: this.dataInicio || undefined,
      dataConclusaoFim: this.dataFim || undefined,
      tecnicos: tecnicos.length ? tecnicos : undefined,
      incluirSemTecnico: this.incluirSemTecnico,
      lojaOrigem: this.filtroLoja || undefined,
    }).subscribe({
      next: (dados) => {
        this.relatorio = dados;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Erro ao gerar relatório de comissão.';
        this.carregando = false;
      },
    });
  }

  abrirPrevisao(tipo: 'aguardando' | 'andamento', tecnico = ''): void {
    this.modalPrevisao = tipo;
    this.modalTecnico = tecnico;
  }

  fecharModalPrevisao(): void {
    this.modalPrevisao = null;
    this.modalTecnico = '';
  }

  @HostListener('document:keydown.escape')
  fecharModalTecla(): void {
    if (this.modalPrevisao) this.fecharModalPrevisao();
  }

  formatarMoeda(v?: number | null): string {
    if (v == null) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatarData(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString('pt-BR');
  }

  labelLoja(codigo?: string | null): string {
    return labelLojaOs(codigo);
  }

  siglaLoja(codigo?: string | null): string {
    return siglaLojaOs(codigo);
  }

  trackTecnico(_: number, item: ComissaoPorTecnico): string {
    return item.tecnicoNome;
  }

  private toInputDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
