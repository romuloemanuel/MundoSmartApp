import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Params, Router } from '@angular/router';

export type GridAcaoTipo =
  | 'ver'
  | 'editar'
  | 'imprimir'
  | 'excluir'
  | 'os'
  | 'followup'
  | 'abrir-os'
  | 'desistencia';

@Component({
  selector: 'app-grid-acao',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      class="grid-acao"
      [class.grid-acao-ver]="tipo === 'ver'"
      [class.grid-acao-editar]="tipo === 'editar'"
      [class.grid-acao-imprimir]="tipo === 'imprimir'"
      [class.grid-acao-excluir]="tipo === 'excluir'"
      [class.grid-acao-os]="tipo === 'os'"
      [class.grid-acao-followup]="tipo === 'followup'"
      [class.grid-acao-abrir-os]="tipo === 'abrir-os'"
      [class.grid-acao-desistencia]="tipo === 'desistencia'"
      [disabled]="disabled"
      [title]="tituloEfetivo"
      [attr.aria-label]="tituloEfetivo"
      (click)="onClick($event)"
    >
      <svg
        *ngIf="tipo === 'ver'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <svg
        *ngIf="tipo === 'editar'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
      <svg
        *ngIf="tipo === 'imprimir'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
      <svg
        *ngIf="tipo === 'excluir'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
      <svg
        *ngIf="tipo === 'os'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M12 18v-6" />
        <path d="M9 15h6" />
      </svg>
      <svg
        *ngIf="tipo === 'followup'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <svg
        *ngIf="tipo === 'abrir-os'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      <svg
        *ngIf="tipo === 'desistencia'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    </button>
  `,
  styles: [`
    :host .grid-acao-excluir:hover:not(:disabled) {
      background: #fef2f2 !important;
      border-color: #fca5a5 !important;
      color: #dc2626 !important;
    }
    :host .grid-acao-os:hover:not(:disabled) {
      background: #eff6ff !important;
      border-color: #93c5fd !important;
      color: #1d4ed8 !important;
    }
    :host .grid-acao-followup:hover:not(:disabled) {
      background: #ecfdf5 !important;
      border-color: #6ee7b7 !important;
      color: #047857 !important;
    }
    :host .grid-acao-abrir-os:hover:not(:disabled) {
      background: #ecfdf5 !important;
      border-color: #6ee7b7 !important;
      color: #047857 !important;
    }
    :host .grid-acao-desistencia:hover:not(:disabled) {
      background: #fffbeb !important;
      border-color: #fcd34d !important;
      color: #b45309 !important;
    }
  `],
})
export class GridAcao {
  @Input({ required: true }) tipo!: GridAcaoTipo;
  @Input() disabled = false;
  @Input() titulo?: string;
  /** Rota para abrir em nova aba com Shift+clique (ou Ctrl/Cmd+clique). */
  @Input() rotaNovaAba?: readonly unknown[] | null;
  @Input() queryParamsNovaAba?: Params | null;
  @Output() acao = new EventEmitter<void>();

  constructor(private router: Router) {}

  get tituloEfetivo(): string {
    if (this.titulo) return this.comDicaNovaAba(this.titulo);
    switch (this.tipo) {
      case 'ver':
        return this.comDicaNovaAba('Visualizar');
      case 'imprimir':
        return 'Imprimir';
      case 'excluir':
        return 'Excluir';
      case 'os':
        return 'Transformar em Ordem de Serviço';
      case 'followup':
        return 'Registrar follow-up';
      case 'abrir-os':
        return this.comDicaNovaAba('Abrir Ordem de Serviço');
      case 'desistencia':
        return 'Desistência do cliente';
      default:
        return this.comDicaNovaAba('Editar');
    }
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;

    if (this.rotaNovaAba?.length && this.deveAbrirNovaAba(event)) {
      event.preventDefault();
      const tree = this.router.createUrlTree([...this.rotaNovaAba], {
        queryParams: this.queryParamsNovaAba ?? undefined,
      });
      window.open(this.router.serializeUrl(tree), '_blank', 'noopener,noreferrer');
      return;
    }

    this.acao.emit();
  }

  private deveAbrirNovaAba(event: MouseEvent): boolean {
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  private comDicaNovaAba(texto: string): string {
    if (!this.rotaNovaAba?.length) return texto;
    if (
      this.tipo === 'imprimir' ||
      this.tipo === 'excluir' ||
      this.tipo === 'os' ||
      this.tipo === 'followup'
    ) {
      return texto;
    }
    return `${texto} (Shift+clique: nova aba)`;
  }
}
