import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppAuthService } from '../../services/app-auth';

@Component({
  selector: 'app-alterar-senha',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <h1>Alterar senha</h1>
      <p class="hint" *ngIf="obrigatorio">Por segurança, troque a senha inicial antes de continuar.</p>

      <form class="card" (ngSubmit)="salvar()">
        <label for="senha-atual">Senha atual</label>
        <div class="campo-senha">
          <input
            id="senha-atual"
            [type]="mostrarAtual ? 'text' : 'password'"
            [(ngModel)]="atual"
            name="atual"
            autocomplete="current-password"
          />
          <button
            type="button"
            class="btn-olho"
            (click)="mostrarAtual = !mostrarAtual"
            [attr.aria-label]="mostrarAtual ? 'Ocultar senha atual' : 'Mostrar senha atual'"
            [attr.title]="mostrarAtual ? 'Ocultar senha' : 'Mostrar senha'"
          >
            <ng-container *ngTemplateOutlet="iconeOlho; context: { visivel: mostrarAtual }"></ng-container>
          </button>
        </div>

        <label for="senha-nova">Nova senha</label>
        <div class="campo-senha">
          <input
            id="senha-nova"
            [type]="mostrarNova ? 'text' : 'password'"
            [(ngModel)]="nova"
            name="nova"
            autocomplete="new-password"
          />
          <button
            type="button"
            class="btn-olho"
            (click)="mostrarNova = !mostrarNova"
            [attr.aria-label]="mostrarNova ? 'Ocultar nova senha' : 'Mostrar nova senha'"
            [attr.title]="mostrarNova ? 'Ocultar senha' : 'Mostrar senha'"
          >
            <ng-container *ngTemplateOutlet="iconeOlho; context: { visivel: mostrarNova }"></ng-container>
          </button>
        </div>

        <label for="senha-confirma">Confirmar nova senha</label>
        <div class="campo-senha">
          <input
            id="senha-confirma"
            [type]="mostrarConfirma ? 'text' : 'password'"
            [(ngModel)]="confirma"
            name="confirma"
            autocomplete="new-password"
          />
          <button
            type="button"
            class="btn-olho"
            (click)="mostrarConfirma = !mostrarConfirma"
            [attr.aria-label]="mostrarConfirma ? 'Ocultar confirmação' : 'Mostrar confirmação'"
            [attr.title]="mostrarConfirma ? 'Ocultar senha' : 'Mostrar senha'"
          >
            <ng-container *ngTemplateOutlet="iconeOlho; context: { visivel: mostrarConfirma }"></ng-container>
          </button>
        </div>

        <p class="erro" *ngIf="erro">{{ erro }}</p>
        <p class="ok" *ngIf="ok">Senha alterada com sucesso.</p>

        <div class="acoes">
          <a *ngIf="!obrigatorio" routerLink="/ordens-servico">Voltar</a>
          <button type="submit" [disabled]="salvando">Salvar</button>
        </div>
      </form>
    </div>

    <ng-template #iconeOlho let-visivel="visivel">
      <svg *ngIf="!visivel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <svg *ngIf="visivel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    </ng-template>
  `,
  styles: [`
    .page { max-width: 420px; margin: 24px auto; padding: 0 16px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .hint { color: #b45309; font-size: 13px; }
    .card {
      margin-top: 16px; padding: 18px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
    }
    label { display: block; margin: 10px 0 6px; font-size: 13px; font-weight: 600; }
    .campo-senha { position: relative; }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 44px 10px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
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
    .btn-olho:hover { color: #0f172a; background: #f1f5f9; }
    .btn-olho svg { width: 18px; height: 18px; }
    .erro { color: #b91c1c; font-size: 13px; margin-top: 12px; }
    .ok { color: #166534; font-size: 13px; margin-top: 12px; }
    .acoes { display: flex; justify-content: flex-end; gap: 12px; align-items: center; margin-top: 16px; }
    button[type="submit"] { background: #0f172a; color: #fff; border: none; border-radius: 8px; padding: 10px 16px; cursor: pointer; }
  `],
})
export class AlterarSenhaPage {
  atual = '';
  nova = '';
  confirma = '';
  mostrarAtual = false;
  mostrarNova = false;
  mostrarConfirma = false;
  erro = '';
  ok = false;
  salvando = false;
  obrigatorio = false;

  constructor(
    private auth: AppAuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.obrigatorio = !!this.auth.usuario()?.deveTrocarSenha;
  }

  salvar(): void {
    this.erro = '';
    this.ok = false;
    if (this.nova !== this.confirma) {
      this.erro = 'A confirmação da nova senha não confere.';
      return;
    }
    this.salvando = true;
    this.auth.alterarSenha(this.atual, this.nova).subscribe({
      next: () => {
        this.salvando = false;
        this.ok = true;
        const u = this.auth.usuario();
        if (u) this.auth.usuario.set({ ...u, deveTrocarSenha: false });
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/ordens-servico';
        setTimeout(() => void this.router.navigateByUrl(returnUrl), 600);
      },
      error: (err) => {
        this.salvando = false;
        this.erro = err?.error?.erro || 'Não foi possível alterar a senha.';
      },
    });
  }
}
