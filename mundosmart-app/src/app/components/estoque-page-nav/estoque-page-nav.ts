import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppAuthService } from '../../services/app-auth';

export type EstoqueAbaInterna =
  | 'estoque'
  | 'pedidos'
  | 'novo-pedido'
  | 'saidas'
  | 'nova-saida'
  | 'reposicao'
  | 'financeiro'
  | 'garantia';

export type EstoqueAbaRota = 'lotes-retorno' | 'analise-retorno' | 'lotes-vencendo';

@Component({
  selector: 'app-estoque-page-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Navegação">
      <ng-container *ngIf="crumbAtual; else raiz">
        <a routerLink="/estoque">Pe&ccedil;as &amp; Estoque</a>
        <span class="breadcrumb-sep" aria-hidden="true">/</span>
        <span class="breadcrumb-atual">{{ crumbAtual }}</span>
      </ng-container>
      <ng-template #raiz>
        <span class="breadcrumb-atual">Pe&ccedil;as &amp; Estoque</span>
      </ng-template>
    </nav>

    <div class="estoque-abas">
      <ng-container *ngIf="modoInline; else abasPorRota">
        <button type="button" [class.ativa]="abaInternaAtiva('estoque')" (click)="abaInternaClick.emit('estoque')">
          Estoque
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('pedidos')" (click)="abaInternaClick.emit('pedidos')">
          Pedidos
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('novo-pedido')" (click)="abaInternaClick.emit('novo-pedido')">
          + Pedido
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('saidas')" (click)="abaInternaClick.emit('saidas')">
          Sa&iacute;das
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('nova-saida')" (click)="abaInternaClick.emit('nova-saida')">
          + Sa&iacute;da
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('reposicao')" (click)="abaInternaClick.emit('reposicao')">
          Reposi&ccedil;&atilde;o
        </button>
        <button
          *ngIf="appAuth.isAdmin()"
          type="button"
          [class.ativa]="abaInternaAtiva('financeiro')"
          (click)="abaInternaClick.emit('financeiro')"
        >
          Investimento
        </button>
        <button type="button" [class.ativa]="abaInternaAtiva('garantia')" (click)="abaInternaClick.emit('garantia')">
          Garantia
        </button>
      </ng-container>

      <ng-template #abasPorRota>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'estoque' }">Estoque</a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'pedidos' }">Pedidos</a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'novo-pedido' }">+ Pedido</a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'saidas' }">Sa&iacute;das</a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'nova-saida' }">+ Sa&iacute;da</a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'reposicao' }">Reposi&ccedil;&atilde;o</a>
        <a
          *ngIf="appAuth.isAdmin()"
          class="estoque-aba-link"
          routerLink="/estoque"
          [queryParams]="{ aba: 'financeiro' }"
        >
          Investimento
        </a>
        <a class="estoque-aba-link" routerLink="/estoque" [queryParams]="{ aba: 'garantia' }">Garantia</a>
      </ng-template>

      <a class="estoque-aba-link" routerLink="/estoque/lotes-retorno" [class.ativa]="abaRotaAtiva('lotes-retorno')">
        Baixados
      </a>
      <a class="estoque-aba-link" routerLink="/estoque/analise-retorno" [class.ativa]="abaRotaAtiva('analise-retorno')">
        An&aacute;lise
      </a>
      <a class="estoque-aba-link" routerLink="/estoque/lotes-vencendo" [class.ativa]="abaRotaAtiva('lotes-vencendo')">
        A vencer
      </a>
    </div>
  `,
  styles: [`
    .estoque-abas {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .estoque-abas button {
      padding: 8px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .estoque-abas button.ativa {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .estoque-aba-link {
      display: inline-flex;
      align-items: center;
      padding: 8px 14px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #fff;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .estoque-aba-link:hover {
      border-color: #93c5fd;
      color: #1d4ed8;
    }
    .estoque-aba-link.ativa {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .estoque-aba-link.ativa:hover {
      color: #fff;
    }
  `],
})
export class EstoquePageNav {
  @Input() crumbAtual = '';
  @Input() modoInline = false;
  @Input() abaInterna: EstoqueAbaInterna = 'estoque';
  @Input() abaRota: EstoqueAbaRota | '' = '';
  @Output() abaInternaClick = new EventEmitter<EstoqueAbaInterna>();

  readonly appAuth = inject(AppAuthService);

  abaInternaAtiva(aba: EstoqueAbaInterna): boolean {
    return this.modoInline && !this.abaRota && this.abaInterna === aba;
  }

  abaRotaAtiva(rota: EstoqueAbaRota): boolean {
    return this.abaRota === rota;
  }
}
