import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

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
    </button>
  `,
})
export class GridAcao {
  @Input({ required: true }) tipo!: 'ver' | 'editar' | 'imprimir';
  @Input() disabled = false;
  @Input() titulo?: string;
  @Output() acao = new EventEmitter<void>();

  get tituloEfetivo(): string {
    if (this.titulo) return this.titulo;
    if (this.tipo === 'ver') return 'Visualizar';
    if (this.tipo === 'imprimir') return 'Imprimir';
    return 'Editar';
  }

  onClick(event: Event): void {
    event.stopPropagation();
    if (!this.disabled) this.acao.emit();
  }
}
