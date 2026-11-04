import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type OrigemAparelho = 'todos' | 'loja' | 'cliente';

interface OpcaoOrigem {
  id: OrigemAparelho;
  nome: string;
  dica: string;
}

/** Atalho compacto Loja / TODOS / Cliente, com a quantidade de cada recorte. */
@Component({
  selector: 'app-filtro-origem-aparelho',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grupo" role="group" aria-label="De quem é a ordem">
      <button
        type="button"
        *ngFor="let op of opcoes"
        [class]="'op-' + op.id"
        [class.ativa]="valor === op.id"
        [attr.aria-pressed]="valor === op.id"
        [title]="rotulo(op)"
        [attr.aria-label]="rotulo(op)"
        (click)="escolher(op.id)"
      >
        <span class="nome">{{ op.nome }}</span>
        <span class="qtd">{{ texto(op.id) }}</span>
      </button>
    </div>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; }
    .grupo {
      display: inline-flex;
      height: 34px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 100%;
      margin: 0;
      padding: 0 9px;
      border: 0;
      border-right: 1px solid #e2e8f0;
      background: transparent;
      color: #334155;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      cursor: pointer;
      white-space: nowrap;
    }
    button:last-child { border-right: 0; }
    button:hover { background: #f8fafc; }
    .qtd {
      min-width: 16px;
      padding: 1px 5px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
      text-align: center;
      line-height: 1.4;
    }
    button.ativa.op-loja { background: #d8b4fe; color: #4c1d95; }
    button.ativa.op-todos { background: #0f172a; color: #fff; }
    button.ativa.op-cliente { background: #dbeafe; color: #1e3a8a; }
    button.ativa.op-loja .qtd { background: #f3e8ff; color: #6b21a8; }
    button.ativa.op-todos .qtd { background: #334155; color: #fff; }
    button.ativa.op-cliente .qtd { background: #eff6ff; color: #1d4ed8; }
    button.ativa:hover { filter: brightness(0.97); }
  `],
})
export class FiltroOrigemAparelho {
  readonly opcoes: OpcaoOrigem[] = [
    { id: 'loja', nome: 'Loja', dica: 'Ordem da Mundo Smart' },
    { id: 'todos', nome: 'TODOS', dica: 'Ordem da loja e do cliente' },
    { id: 'cliente', nome: 'Cliente', dica: 'Ordem de cliente' },
  ];

  @Input() valor: OrigemAparelho = 'todos';
  @Input() contagens: Record<OrigemAparelho, number | null> = {
    todos: null,
    loja: null,
    cliente: null,
  };
  @Output() escolheu = new EventEmitter<OrigemAparelho>();

  escolher(qual: OrigemAparelho): void {
    if (qual !== this.valor) this.escolheu.emit(qual);
  }

  texto(qual: OrigemAparelho): string {
    const n = this.contagens?.[qual];
    return n === null || n === undefined ? '–' : String(n);
  }

  rotulo(op: OpcaoOrigem): string {
    const n = this.contagens?.[op.id];
    const qtd = n === null || n === undefined ? '' : n === 1 ? ' · 1 ordem' : ` · ${n} ordens`;
    return `${op.nome}: ${op.dica}${qtd}`;
  }
}
