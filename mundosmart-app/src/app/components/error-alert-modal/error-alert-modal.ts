import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ErrorAlertPayload, ErrorAlertService } from '../../services/error-alert.service';

@Component({
  selector: 'app-error-alert-modal',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="ea-backdrop"
      *ngIf="payload as p"
      (click)="fechar()"
      role="presentation"
    >
      <div
        class="ea-box"
        [class.ea-box--aviso]="p.kind === 'aviso'"
        [class.ea-box--info]="p.kind === 'info'"
        role="alertdialog"
        aria-modal="true"
        [attr.aria-labelledby]="'ea-titulo'"
        [attr.aria-describedby]="'ea-msg'"
        (click)="$event.stopPropagation()"
      >
        <div class="ea-accent" aria-hidden="true"></div>

        <div class="ea-icon-wrap" aria-hidden="true">
          <svg *ngIf="p.kind === 'erro'" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>
            <path d="M24 14v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="34" r="2.2" fill="currentColor"/>
          </svg>
          <svg *ngIf="p.kind === 'aviso'" viewBox="0 0 48 48" fill="none">
            <path d="M24 6 L44 40 H4 Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"/>
            <path d="M24 18v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            <circle cx="24" cy="35" r="2" fill="currentColor"/>
          </svg>
          <svg *ngIf="p.kind === 'info'" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>
            <circle cx="24" cy="15" r="2.2" fill="currentColor"/>
            <path d="M24 22v12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>

        <h3 class="ea-titulo" id="ea-titulo">{{ p.titulo }}</h3>
        <p class="ea-msg" id="ea-msg">{{ p.mensagem }}</p>
        <p class="ea-detalhe" *ngIf="p.detalhe">{{ p.detalhe }}</p>

        <button type="button" class="ea-ok" (click)="fechar()">
          Entendi
        </button>
      </div>
    </div>
  `,
  styles: `
    .ea-backdrop {
      position: fixed;
      inset: 0;
      z-index: 120000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background:
        radial-gradient(ellipse at 50% 40%, rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.72));
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: ea-fade-in 160ms ease-out;
    }

    .ea-box {
      position: relative;
      width: min(420px, 100%);
      background: #fff;
      border-radius: 18px;
      padding: 28px 26px 22px;
      text-align: center;
      box-shadow:
        0 4px 6px rgba(15, 23, 42, 0.04),
        0 24px 48px rgba(15, 23, 42, 0.22);
      overflow: hidden;
      animation: ea-pop 200ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .ea-accent {
      position: absolute;
      left: 0; right: 0; top: 0;
      height: 4px;
      background: linear-gradient(90deg, #b91c1c, #ef4444 55%, #fb7185);
    }
    .ea-box--aviso .ea-accent {
      background: linear-gradient(90deg, #b45309, #f59e0b 55%, #fbbf24);
    }
    .ea-box--info .ea-accent {
      background: linear-gradient(90deg, #1d4ed8, #3b82f6 55%, #60a5fa);
    }

    .ea-icon-wrap {
      width: 64px;
      height: 64px;
      margin: 8px auto 14px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      color: #b91c1c;
      background: radial-gradient(circle at 30% 30%, #fee2e2, #fecaca 70%);
    }
    .ea-box--aviso .ea-icon-wrap {
      color: #b45309;
      background: radial-gradient(circle at 30% 30%, #fef3c7, #fde68a 70%);
    }
    .ea-box--info .ea-icon-wrap {
      color: #1d4ed8;
      background: radial-gradient(circle at 30% 30%, #dbeafe, #bfdbfe 70%);
    }
    .ea-icon-wrap svg {
      width: 40px;
      height: 40px;
    }

    .ea-titulo {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 750;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .ea-msg {
      margin: 0 0 6px;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .ea-detalhe {
      margin: 0 0 16px;
      font-size: 12px;
      color: #94a3b8;
    }

    .ea-ok {
      margin-top: 10px;
      min-width: 140px;
      padding: 11px 22px !important;
      border-radius: 10px !important;
      border: none !important;
      background: #0f172a !important;
      color: #fff !important;
      font-weight: 700 !important;
      font-size: 14px !important;
      cursor: pointer;
      transition: transform 0.12s ease, background 0.15s ease;
    }
    .ea-ok:hover { background: #1e293b !important; }
    .ea-ok:active { transform: scale(0.98); }
    .ea-box--aviso .ea-ok { background: #b45309 !important; }
    .ea-box--aviso .ea-ok:hover { background: #92400e !important; }
    .ea-box--info .ea-ok { background: #1d4ed8 !important; }
    .ea-box--info .ea-ok:hover { background: #1e40af !important; }

    @keyframes ea-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes ea-pop {
      from { opacity: 0; transform: translateY(10px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `,
})
export class ErrorAlertModal implements OnInit, OnDestroy {
  payload: ErrorAlertPayload | null = null;
  private sub?: Subscription;

  constructor(
    private alerts: ErrorAlertService,
    private host: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    if (typeof document !== 'undefined' && this.host.nativeElement.parentElement !== document.body) {
      document.body.appendChild(this.host.nativeElement);
    }
    this.sub = this.alerts.aberto$.subscribe(p => {
      this.payload = p;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    const el = this.host.nativeElement;
    el.parentElement?.removeChild(el);
  }

  fechar(): void {
    this.alerts.fechar();
  }

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.payload) this.fechar();
  }
}
