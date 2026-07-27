import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Params, Router } from '@angular/router';

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
    </button>
  `,
  styles: [`
    :host .grid-acao-excluir:hover:not(:disabled) {
      background: #fef2f2 !important;
      border-color: #fca5a5 !important;
      color: #dc2626 !important;
    }
  `],
})
export class GridAcao {
  @Input({ required: true }) tipo!: 'ver' | 'editar' | 'imprimir' | 'excluir';
  @Input() disabled = false;
  @Input() titulo?: string;
  /** Rota para abrir em nova aba com Shift+clique (ou Ctrl/Cmd+clique). */
  @Input() rotaNovaAba?: readonly unknown[] | null;
  @Input() queryParamsNovaAba?: Params | null;
  @Output() acao = new EventEmitter<void>();

  constructor(private router: Router) {}

  get tituloEfetivo(): string {
    if (this.titulo) return this.comDicaNovaAba(this.titulo);
    if (this.tipo === 'ver') return this.comDicaNovaAba('Visualizar');
    if (this.tipo === 'imprimir') return 'Imprimir';
    if (this.tipo === 'excluir') return this.titulo ?? 'Excluir';
    return this.comDicaNovaAba('Editar');
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
    if (!this.rotaNovaAba?.length || this.tipo === 'imprimir' || this.tipo === 'excluir') return texto;
    return `${texto} (Shift+clique: nova aba)`;
  }
}
