import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastAlertService, ToastItem } from '../../services/toast-alert.service';

@Component({
  selector: 'app-toast-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-relevant="additions">
      <div
        class="toast"
        *ngFor="let t of itens; trackBy: trackId"
        [class.toast--erro]="t.kind === 'erro'"
        [class.toast--aviso]="t.kind === 'aviso'"
        [class.toast--sucesso]="t.kind === 'sucesso'"
        [class.toast--info]="t.kind === 'info'"
        role="status"
      >
        <div class="toast-accent" aria-hidden="true"></div>
        <div class="toast-body">
          <div class="toast-top">
            <strong class="toast-titulo">{{ t.titulo }}</strong>
            <button type="button" class="toast-close" (click)="fechar(t.id)" aria-label="Fechar">✕</button>
          </div>
          <p class="toast-msg">{{ t.mensagem }}</p>
          <div class="toast-bar" aria-hidden="true">
            <span class="toast-bar-fill" [style.animation-duration.ms]="t.ttlMs"></span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .toast-stack {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 110000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: min(380px, calc(100vw - 24px));
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      display: flex;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow:
        0 4px 6px rgba(15, 23, 42, 0.06),
        0 16px 32px rgba(15, 23, 42, 0.16);
      border: 1px solid #e2e8f0;
      animation: toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .toast-accent {
      width: 5px;
      flex-shrink: 0;
      background: #dc2626;
    }
    .toast--aviso .toast-accent { background: #f59e0b; }
    .toast--sucesso .toast-accent { background: #16a34a; }
    .toast--info .toast-accent { background: #2563eb; }

    .toast-body {
      flex: 1;
      padding: 12px 12px 10px 14px;
      min-width: 0;
    }
    .toast-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .toast-titulo {
      font-size: 13px;
      font-weight: 750;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .toast-close {
      border: none !important;
      background: transparent !important;
      color: #94a3b8 !important;
      padding: 0 2px !important;
      font-size: 14px !important;
      line-height: 1 !important;
      cursor: pointer;
      flex-shrink: 0;
    }
    .toast-close:hover { color: #475569 !important; }
    .toast-msg {
      margin: 4px 0 10px;
      font-size: 13px;
      line-height: 1.45;
      color: #334155;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .toast-bar {
      height: 3px;
      background: #f1f5f9;
      border-radius: 999px;
      overflow: hidden;
    }
    .toast-bar-fill {
      display: block;
      height: 100%;
      width: 100%;
      transform-origin: left center;
      background: #dc2626;
      animation: toast-shrink linear forwards;
    }
    .toast--aviso .toast-bar-fill { background: #f59e0b; }
    .toast--sucesso .toast-bar-fill { background: #16a34a; }
    .toast--info .toast-bar-fill { background: #2563eb; }

    @keyframes toast-in {
      from { opacity: 0; transform: translateX(18px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes toast-shrink {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    @media (max-width: 520px) {
      .toast-stack {
        top: 12px;
        right: 12px;
        left: 12px;
        width: auto;
      }
    }
  `,
})
export class ToastAlertComponent implements OnInit, OnDestroy {
  itens: ToastItem[] = [];
  private sub?: Subscription;

  constructor(private toasts: ToastAlertService) {}

  ngOnInit(): void {
    this.sub = this.toasts.itens$.subscribe(lista => {
      this.itens = lista;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  trackId(_i: number, t: ToastItem): number {
    return t.id;
  }

  fechar(id: number): void {
    this.toasts.dismiss(id);
  }
}
