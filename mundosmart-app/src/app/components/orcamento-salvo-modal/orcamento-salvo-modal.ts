import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { BlingOrcamento } from '../../models/bling.models';

@Component({
  selector: 'app-orcamento-salvo-modal',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  template: `
    <div class="backdrop" (click)="fecharLista()">
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="orc-salvo-titulo" (click)="$event.stopPropagation()">
        <header class="card-head">
          <div class="check" aria-hidden="true">✓</div>
          <h3 id="orc-salvo-titulo">Orçamento salvo</h3>
          <p class="sub" *ngIf="orcamento as o">
            Pré-orçamento <strong>#{{ o.numero || o.id }}</strong>
            · {{ o.contato?.nome || 'Cliente' }}
            · {{ valor(o) | currency:'BRL' }}
          </p>
        </header>

        <section class="bloco">
          <p class="pergunta">Deseja imprimir o pré-orçamento agora?</p>
          <button type="button" class="btn-print" (click)="imprimir.emit()" [disabled]="imprimindo">
            {{ imprimindo ? 'Abrindo impressão…' : 'Imprimir pré-orçamento' }}
          </button>
          <p class="hint">
            O documento deixa claro que o valor é especulativo e que o aparelho não foi aberto.
          </p>
        </section>

        <section class="bloco destaque">
          <p class="pergunta">Deseja incluir um novo orçamento?</p>
          <div class="acoes-duplas">
            <button type="button" class="btn-pri" (click)="novo.emit()">Sim, novo orçamento</button>
            <button type="button" class="btn-sec" (click)="fecharLista()">Não, ir para a lista</button>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1200;
      background: rgba(15, 23, 42, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      backdrop-filter: blur(2px);
    }
    .card {
      width: min(440px, 100%);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
      overflow: hidden;
    }
    .card-head {
      padding: 24px 22px 16px;
      text-align: center;
      background: linear-gradient(160deg, #ecfdf5 0%, #fff 65%);
      border-bottom: 1px solid #e2e8f0;
    }
    .check {
      width: 44px;
      height: 44px;
      margin: 0 auto 10px;
      border-radius: 999px;
      background: #059669;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 700;
    }
    h3 {
      margin: 0 0 8px;
      font-size: 1.25rem;
      color: #0f172a;
    }
    .sub {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .bloco {
      padding: 18px 22px;
    }
    .bloco.destaque {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .pergunta {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .hint {
      margin: 10px 0 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
    }
    .btn-print, .btn-pri, .btn-sec {
      width: 100%;
      border-radius: 8px;
      padding: 11px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
    }
    .btn-print {
      background: #fff;
      border: 1px solid #2563eb;
      color: #1d4ed8;
    }
    .btn-print:disabled { opacity: 0.6; cursor: not-allowed; }
    .acoes-duplas {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-pri { background: #2563eb; color: #fff; }
    .btn-sec {
      background: #fff;
      border: 1px solid #cbd5e1;
      color: #334155;
    }
  `],
})
export class OrcamentoSalvoModal {
  @Input({ required: true }) orcamento!: BlingOrcamento;
  @Input() imprimindo = false;
  @Output() imprimir = new EventEmitter<void>();
  @Output() novo = new EventEmitter<void>();
  @Output() lista = new EventEmitter<void>();

  valor(o: BlingOrcamento): number {
    return o.valorTotalAcordado ?? o.valorTotal ?? 0;
  }

  fecharLista(): void {
    this.lista.emit();
  }
}
