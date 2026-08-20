import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/** Modal anexada ao body — lista de lotes do pedido / formulários internos. */
@Component({
  selector: 'app-item-pedido-lote-modal',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="iplm-backdrop"
      *ngIf="aberto"
      (click)="fechar.emit()"
      role="presentation"
    >
      <div
        class="iplm-box"
        [class.iplm-box-wide]="largo"
        role="dialog"
        aria-modal="true"
        (click)="$event.stopPropagation()"
      >
        <div class="iplm-header">
          <h3>{{ titulo }}</h3>
          <button
            type="button"
            class="iplm-close"
            (click)="fechar.emit()"
            [disabled]="salvando"
            aria-label="Fechar"
          >✕</button>
        </div>
        <div class="iplm-body">
          <ng-content />
        </div>
        <div class="iplm-footer" *ngIf="mostrarRodape">
          <button type="button" class="btn-limpar" (click)="fechar.emit()" [disabled]="salvando">
            Cancelar
          </button>
          <button type="button" (click)="salvar.emit()" [disabled]="salvando">
            {{ labelSalvar }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .iplm-backdrop {
      position: fixed !important;
      inset: 0 !important;
      z-index: 9990 !important;
      background: rgba(0, 0, 0, 0.55) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px !important;
      box-sizing: border-box !important;
    }
    .iplm-box {
      background: #fff;
      border-radius: 12px;
      width: 100%;
      max-width: 980px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }
    .iplm-box.iplm-box-wide {
      max-width: 1100px;
    }
    .iplm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #0d0d0d;
      flex-shrink: 0;
    }
    .iplm-header h3 {
      margin: 0;
      font-size: 16px;
      color: #fff;
    }
    .iplm-close {
      background: transparent !important;
      border: none !important;
      color: #fff !important;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px !important;
    }
    .iplm-close:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .iplm-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
    }
    .iplm-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 20px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
  `,
})
export class ItemPedidoLoteModal implements OnInit, OnDestroy {
  @Input() aberto = false;
  @Input() titulo = '';
  @Input() labelSalvar = 'Salvar';
  @Input() salvando = false;
  @Input() mostrarRodape = false;
  @Input() largo = true;

  @Output() fechar = new EventEmitter<void>();
  @Output() salvar = new EventEmitter<void>();

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined' && this.host.nativeElement.parentElement !== document.body) {
      document.body.appendChild(this.host.nativeElement);
    }
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    el.parentElement?.removeChild(el);
  }
}
