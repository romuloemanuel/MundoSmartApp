import { Component, EventEmitter, HostListener, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GridAcao } from '../grid-acao/grid-acao';
import { BlingOrdemServico } from '../../models/bling.models';
import { OS_IMPRESSAO_OPCOES, OsImpressaoTipo } from '../../config/os-impressao.config';
import { OsImpressaoService } from '../../services/os-impressao.service';
import { posicionarPopoverFixo } from '../../utils/popover-posicao.util';

@Component({
  selector: 'app-grid-acoes-os',
  standalone: true,
  imports: [CommonModule, GridAcao],
  template: `
    <div class="grid-acoes-os">
      <app-grid-acao tipo="ver" (acao)="ver.emit()" />
      <app-grid-acao
        tipo="editar"
        (acao)="editar.emit()"
        [disabled]="editarDesabilitado"
        [titulo]="tituloEditar"
      />

      <button
        type="button"
        class="grid-acao grid-acao-retorno"
        title="Criar retorno a partir desta OS"
        aria-label="Criar retorno a partir desta OS"
        [disabled]="!os.id"
        (click)="criarRetorno($event)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15-6.7" />
          <path d="M3 4v5h5" />
          <path d="M21 12a9 9 0 0 1-15 6.7" />
          <path d="M16 20h5v-5" />
        </svg>
      </button>

      <div class="grid-print-wrap">
        <button
          type="button"
          class="grid-acao grid-acao-imprimir"
          [class.ativo]="menuAberto"
          title="Imprimir documentos"
          aria-label="Imprimir documentos"
          (click)="toggleMenu($event)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <path d="M6 14h12v8H6z" />
          </svg>
        </button>

        <div
          class="grid-print-menu"
          *ngIf="menuAberto"
          [ngStyle]="menuStyle"
          (click)="$event.stopPropagation()"
        >
          <button
            type="button"
            class="grid-print-item"
            *ngFor="let opcao of opcoesImpressao"
            (click)="imprimir(opcao.tipo, $event)"
          >
            {{ opcao.label }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .grid-acoes-os {
      display: flex;
      align-items: center;
      gap: 2px;
      justify-content: flex-end;
      flex-wrap: nowrap;
    }

    :host ::ng-deep .grid-acao {
      width: 22px;
      height: 22px;
      border-radius: 4px !important;
    }

    :host ::ng-deep .grid-acao svg {
      width: 12px;
      height: 12px;
    }

    .grid-print-wrap {
      position: relative;
    }

    .grid-acao-imprimir.ativo,
    .grid-acao-imprimir:hover {
      background: #eff6ff !important;
      border-color: #93c5fd !important;
      color: #2563eb !important;
    }

    .grid-acao-retorno:hover {
      background: #fff7ed !important;
      border-color: #fdba74 !important;
      color: #c2410c !important;
    }

    .grid-print-menu {
      position: fixed;
      z-index: 10050;
      min-width: 220px;
      padding: 6px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16);
    }

    .grid-print-item {
      display: block;
      width: 100%;
      padding: 8px 10px !important;
      border: none !important;
      border-radius: 6px !important;
      background: transparent !important;
      color: #334155 !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      text-align: left;
      cursor: pointer;
      min-width: unset;
    }

    .grid-print-item:hover {
      background: #f1f5f9 !important;
      color: #1d4ed8 !important;
    }
  `],
})
export class GridAcoesOs implements OnDestroy {
  @Input({ required: true }) os!: BlingOrdemServico;
  @Input() editarDesabilitado = false;
  @Input() tituloEditar = 'Editar';
  @Output() ver = new EventEmitter<void>();
  @Output() editar = new EventEmitter<void>();

  readonly opcoesImpressao = OS_IMPRESSAO_OPCOES;
  menuAberto = false;
  menuStyle: Record<string, string> = {};

  private readonly onScroll = () => this.fecharMenu();

  constructor(
    private impressao: OsImpressaoService,
    private router: Router,
  ) {
    document.addEventListener('scroll', this.onScroll, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.onScroll, true);
  }

  criarRetorno(event: Event): void {
    event.stopPropagation();
    if (this.os.id == null) return;
    this.router.navigate(['/ordens-servico/nova'], {
      queryParams: { retornoDe: this.os.id },
    });
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    if (this.menuAberto) {
      this.menuAberto = false;
      return;
    }
    const btn = event.currentTarget as HTMLElement;
    this.menuAberto = true;
    // Altura estimada: ~36px por opção + padding
    const alturaEstimada = this.opcoesImpressao.length * 36 + 16;
    this.menuStyle = posicionarPopoverFixo(btn, {
      width: 220,
      height: alturaEstimada,
      align: 'end',
    });
  }

  imprimir(tipo: OsImpressaoTipo, event: Event): void {
    event.stopPropagation();
    this.menuAberto = false;
    this.impressao.imprimir(tipo, this.os);
  }

  @HostListener('document:click')
  fecharMenu(): void {
    this.menuAberto = false;
  }
}
