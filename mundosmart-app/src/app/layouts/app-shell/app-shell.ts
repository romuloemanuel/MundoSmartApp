import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BlingAuthService } from '../../services/bling-auth';
import { AppAuthService } from '../../services/app-auth';
import { CategoriasPecaService } from '../../services/categorias-peca';
import { TecnicoSelectModal } from '../../components/tecnico-select-modal/tecnico-select-modal';
import { OsSituacaoModal } from '../../components/os-situacao-modal/os-situacao-modal';

const SIDEBAR_LS_KEY = 'mundosmart.sidebarAberta';
/** Notebooks ~14" e menores: menu começa fechado. */
const SIDEBAR_AUTO_FECHAR_ATE = 1400;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, TecnicoSelectModal, OsSituacaoModal],
  template: `
    <div class="app-layout" [class.sidebar-fechada]="!menuAberto">
      <aside class="sidebar" [attr.aria-hidden]="!menuAberto">
        <div class="sidebar-brand">
          <div class="brand-name">Mundo Smart</div>
          <div class="brand-divider"></div>
          <div class="brand-sub">Assist&ecirc;ncia &amp; Eletr&ocirc;nicos</div>
        </div>
        <nav>
          <a routerLink="/ordens-servico" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Ordens de Servi&ccedil;o</a>
          <a *ngIf="appAuth.isAdmin()" routerLink="/comissoes" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Comiss&otilde;es</a>
          <a routerLink="/painel-tv" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" (click)="fecharMenuSeEstreito()">Painel TV</a>
          <a routerLink="/estoque" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Pe&ccedil;as &amp; Estoque</a>
          <a routerLink="/orcamentos" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Or&ccedil;amentos</a>
          <a routerLink="/consulta-produtos" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Consulta estoque</a>
          <a routerLink="/calculo-juros" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Cálculo de juros</a>
          <a routerLink="/clientes" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Clientes</a>
          <a *ngIf="appAuth.isAdmin()" routerLink="/historico-alteracoes" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Hist&oacute;rico de altera&ccedil;&otilde;es</a>
          <div class="nav-section-label">Cadastros</div>
          <a routerLink="/pecas" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Pe&ccedil;as</a>
          <a routerLink="/categorias-peca" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Categorias de pe&ccedil;as</a>
          <a routerLink="/modelos" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Modelos</a>
          <a *ngIf="appAuth.isAdmin()" routerLink="/tecnicos" routerLinkActive="active" (click)="fecharMenuSeEstreito()">T&eacute;cnicos</a>
          <a *ngIf="appAuth.isAdmin()" routerLink="/usuarios" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Usu&aacute;rios</a>
          <div class="nav-section-label" *ngIf="appAuth.isAdmin()">Configura&ccedil;&otilde;es</div>
          <a *ngIf="appAuth.isAdmin()" routerLink="/configuracoes/impressao-os" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Impress&atilde;o da OS</a>
          <a *ngIf="appAuth.isAdmin()" routerLink="/configuracoes/acrescimo-estoque" routerLinkActive="active" (click)="fecharMenuSeEstreito()">Acr&eacute;scimo estoque</a>
        </nav>
      </aside>

      <button
        *ngIf="menuAberto"
        type="button"
        class="sidebar-backdrop"
        aria-label="Fechar menu"
        (click)="fecharMenu()"
      ></button>

      <div class="main-area">
        <header class="topbar">
          <div class="topbar-esquerda">
            <button
              type="button"
              class="btn-menu"
              (click)="alternarMenu()"
              [attr.aria-expanded]="menuAberto"
              [attr.aria-label]="menuAberto ? 'Fechar menu' : 'Abrir menu'"
            >
              <span class="btn-menu-barras" aria-hidden="true"></span>
            </button>
            <span class="topbar-title">Mundo Smart &mdash; Assist&ecirc;ncia T&eacute;cnica</span>
          </div>
          <div class="topbar-auth">
            <span class="auth-user" *ngIf="appAuth.usuario() as u">
              {{ u.nome }} · {{ u.role }}
            </span>
            <a routerLink="/conta/senha" class="btn-link">Senha</a>
            <ng-container *ngIf="blingAuth.isAuthenticated(); else blingOff">
              <span class="auth-status">Bling capinhas OK</span>
            </ng-container>
            <ng-template #blingOff>
              <button type="button" (click)="conectarBling()" class="btn-login" *ngIf="appAuth.isAdmin()">
                Conectar Bling (capinhas)
              </button>
            </ng-template>
            <button type="button" (click)="sair()" class="btn-logout">Sair</button>
          </div>
        </header>
        <main>
          <router-outlet />
        </main>
      </div>
    </div>
    <app-tecnico-select-modal />
    <app-os-situacao-modal />
  `,
  styles: [`
    .auth-user { font-size: 12px; color: #64748b; margin-right: 8px; }
    .btn-link {
      color: #64748b; font-size: 12px; text-decoration: none; margin-right: 8px;
    }
    .btn-link:hover { color: #0d0d0d; }

    .topbar-esquerda {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .btn-menu {
      flex-shrink: 0;
      width: 36px;
      height: 36px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .btn-menu:hover { background: #f8fafc; border-color: #cbd5e1; }

    .btn-menu-barras,
    .btn-menu-barras::before,
    .btn-menu-barras::after {
      display: block;
      width: 16px;
      height: 2px;
      background: #0d0d0d;
      border-radius: 1px;
      position: relative;
    }
    .btn-menu-barras::before,
    .btn-menu-barras::after {
      content: '';
      position: absolute;
      left: 0;
    }
    .btn-menu-barras::before { top: -5px; }
    .btn-menu-barras::after { top: 5px; }
  `],
})
export class AppShell implements OnInit {
  menuAberto = true;

  constructor(
    public blingAuth: BlingAuthService,
    public appAuth: AppAuthService,
    private categoriasPeca: CategoriasPecaService,
  ) {}

  ngOnInit(): void {
    this.menuAberto = this.lerPreferenciaInicial();
    this.categoriasPeca.listar().subscribe();
  }

  alternarMenu(): void {
    this.menuAberto = !this.menuAberto;
    this.salvarPreferencia(this.menuAberto);
  }

  fecharMenu(): void {
    if (!this.menuAberto) return;
    this.menuAberto = false;
    this.salvarPreferencia(false);
  }

  fecharMenuSeEstreito(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= SIDEBAR_AUTO_FECHAR_ATE) {
      this.fecharMenu();
    }
  }

  conectarBling(): void {
    this.blingAuth.getAuthorizationUrl().subscribe(({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    });
  }

  sair(): void {
    this.blingAuth.logout();
    this.appAuth.logout();
  }

  private lerPreferenciaInicial(): boolean {
    try {
      const salva = localStorage.getItem(SIDEBAR_LS_KEY);
      if (salva === '1') return true;
      if (salva === '0') return false;
    } catch {
      /* ignore */
    }
    return typeof window === 'undefined' || window.innerWidth > SIDEBAR_AUTO_FECHAR_ATE;
  }

  private salvarPreferencia(aberto: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_LS_KEY, aberto ? '1' : '0');
    } catch {
      /* ignore */
    }
  }
}
