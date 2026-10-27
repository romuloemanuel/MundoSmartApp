import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppAuthService } from '../../services/app-auth';
import { PaymobiVendasService } from '../../services/paymobi-vendas.service';

@Component({
  selector: 'app-atalho-cobranca-paymobi',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a *ngIf="visivel" routerLink="/paymobi/cobranca" class="cobranca-bar">
      <span class="cobranca-tag">COBRANÇA</span>
      <span class="cobranca-texto">
        Gerenciamento de cobrança PayMobi
        <strong *ngIf="acaoHoje > 0">({{ acaoHoje }} hoje)</strong>
      </span>
    </a>
  `,
  styles: [`
    :host { display: block; }
    .cobranca-bar {
      width: 100%;
      margin: 0 0 14px;
      padding: 12px 16px;
      border: 1px solid #93c5fd;
      border-radius: 10px;
      background: #eff6ff;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      font-family: inherit;
    }
    .cobranca-bar:hover { background: #dbeafe; }
    .cobranca-tag {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: #1d4ed8;
      color: #fff;
      border-radius: 999px;
      padding: 4px 10px;
    }
    .cobranca-texto { font-size: 13px; font-weight: 600; line-height: 1.35; }
    .cobranca-texto strong { font-weight: 800; }
  `],
})
export class AtalhoCobrancaPaymobi implements OnInit {
  visivel = false;
  acaoHoje = 0;

  constructor(
    private appAuth: AppAuthService,
    private api: PaymobiVendasService,
  ) {}

  ngOnInit(): void {
    if (!this.appAuth.isAdmin()) return;
    this.visivel = true;
    this.api.cobrancaResumo().subscribe({
      next: r => { this.acaoHoje = r.acaoHoje ?? 0; },
      error: () => { this.acaoHoje = 0; },
    });
  }
}
