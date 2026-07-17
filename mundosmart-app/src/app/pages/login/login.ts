import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AppAuthService } from '../../services/app-auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-brand">
          <div class="login-brand-name">Mundo Smart</div>
          <div class="login-brand-sub">Assistência Técnica</div>
        </div>

        <h1>Entrar</h1>
        <p class="login-hint">Use seu usuário da oficina para acessar o sistema.</p>

        <form (ngSubmit)="enviar()" autocomplete="on">
          <label for="usuario">Usuário</label>
          <input
            id="usuario"
            name="usuario"
            [(ngModel)]="usuario"
            autocomplete="username"
            autofocus
            [disabled]="carregando"
          />

          <label for="senha">Senha</label>
          <div class="campo-senha">
            <input
              id="senha"
              name="senha"
              [type]="mostrarSenha ? 'text' : 'password'"
              [(ngModel)]="senha"
              autocomplete="current-password"
              [disabled]="carregando"
            />
            <button
              type="button"
              class="btn-olho"
              (click)="mostrarSenha = !mostrarSenha"
              [attr.aria-label]="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
              [attr.title]="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
              [disabled]="carregando"
            >
              <svg *ngIf="!mostrarSenha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg *ngIf="mostrarSenha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>

          <p class="login-erro" *ngIf="erro">{{ erro }}</p>

          <button type="submit" class="btn-entrar" [disabled]="carregando || !usuario.trim() || !senha">
            {{ carregando ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(ellipse 80% 60% at 20% 10%, rgba(37, 99, 235, 0.18), transparent),
        radial-gradient(ellipse 70% 50% at 90% 80%, rgba(15, 23, 42, 0.12), transparent),
        linear-gradient(160deg, #0f172a 0%, #1e293b 45%, #0f172a 100%);
    }
    .login-card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 16px;
      padding: 28px 26px 24px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
    }
    .login-brand { margin-bottom: 22px; }
    .login-brand-name {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }
    .login-brand-sub {
      margin-top: 2px;
      font-size: 13px;
      color: #64748b;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 20px;
      color: #0f172a;
    }
    .login-hint {
      margin: 0 0 18px;
      font-size: 13px;
      color: #64748b;
      line-height: 1.4;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin: 12px 0 6px;
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 11px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 14px;
      color: #0f172a;
    }
    .campo-senha {
      position: relative;
    }
    .campo-senha input {
      padding-right: 44px;
    }
    .btn-olho {
      position: absolute;
      top: 50%;
      right: 8px;
      transform: translateY(-50%);
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .btn-olho:hover:not(:disabled) { color: #0f172a; background: #f1f5f9; }
    .btn-olho:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-olho svg { width: 18px; height: 18px; }
    input:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .login-erro {
      margin: 14px 0 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 13px;
    }
    .btn-entrar {
      margin-top: 18px;
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 8px;
      background: #0f172a;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-entrar:hover:not(:disabled) { background: #1e293b; }
    .btn-entrar:disabled { opacity: 0.55; cursor: not-allowed; }
  `],
})
export class LoginPage {
  usuario = '';
  senha = '';
  mostrarSenha = false;
  erro = '';
  carregando = false;

  constructor(
    private auth: AppAuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  enviar(): void {
    this.erro = '';
    this.carregando = true;
    this.auth.login(this.usuario.trim(), this.senha).subscribe({
      next: (res) => {
        this.carregando = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/ordens-servico';
        if (res.usuario.deveTrocarSenha) {
          void this.router.navigate(['/conta/senha'], { queryParams: { returnUrl } });
          return;
        }
        void this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.carregando = false;
        this.erro = err?.error?.erro || 'Não foi possível entrar. Verifique usuário e senha.';
      },
    });
  }
}
