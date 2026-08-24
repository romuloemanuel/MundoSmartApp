import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { BlingAuthService } from '../../../services/bling-auth';
import {
  BlingConfigAdmin,
  BlingConfigService,
} from '../../../services/bling-config.service';

@Component({
  selector: 'app-config-bling',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Bling (produção)</h2>
        <div class="acoes">
          <button type="button" class="secundario" (click)="conectar()" [disabled]="!form.consultaProdutosHabilitada || !form.clientId">
            {{ cfg?.tokenConectado ? 'Reconectar OAuth' : 'Conectar OAuth' }}
          </button>
          <button type="button" (click)="salvar()" [disabled]="salvando">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>

      <p class="hint">
        Credenciais do aplicativo Bling usadas na consulta de estoque (capinhas / películas / térmicos).
        Somente administradores alteram. O Client Secret nunca é exibido após salvar.
      </p>

      <p class="erro" *ngIf="erro">{{ erro }}</p>
      <p class="ok" *ngIf="ok">Configuração salva.</p>

      <section class="status" *ngIf="cfg">
        <div class="pill" [class.on]="cfg.tokenConectado" [class.off]="!cfg.tokenConectado">
          {{ cfg.tokenConectado ? 'Token OAuth conectado' : 'Token OAuth ausente' }}
        </div>
        <div class="pill muted" *ngIf="cfg.tokenExpiraEm">
          Expira {{ cfg.tokenExpiraEm | date:'short' }}
        </div>
        <div class="pill muted">
          {{ cfg.temOverrideMongo ? 'Valores do Mongo (admin)' : 'Valores do appsettings / env' }}
        </div>
        <div class="pill muted" *ngIf="cfg.modoLocal">Modo local (OS/clientes no Mongo)</div>
      </section>

      <form class="form" *ngIf="carregado" (ngSubmit)="salvar()">
        <label>
          Client ID
          <input type="text" [(ngModel)]="form.clientId" name="clientId" autocomplete="off" required />
        </label>

        <label>
          Client Secret
          <input
            type="password"
            [(ngModel)]="form.clientSecret"
            name="clientSecret"
            autocomplete="new-password"
            [placeholder]="cfg?.clientSecretConfigurado ? '•••••••• (deixe em branco para manter)' : 'Obrigatório'"
          />
        </label>

        <label>
          Redirect URI
          <input type="url" [(ngModel)]="form.redirectUri" name="redirectUri" required />
          <span class="campo-hint">Deve ser idêntica à cadastrada no portal Bling (ex.: https://seu-dominio/auth/callback).</span>
        </label>

        <label class="check">
          <input type="checkbox" [(ngModel)]="form.consultaProdutosHabilitada" name="consultaOn" />
          Consulta de produtos / estoque habilitada
        </label>

        <label>
          Intervalo de sync (minutos)
          <input type="number" min="5" max="1440" [(ngModel)]="form.consultaProdutosSyncMinutos" name="syncMin" />
        </label>

        <label>
          Id campo «Permite Personalização»
          <input type="number" min="0" [(ngModel)]="form.idCampoPermitePersonalizacao" name="idCampo" />
          <span class="campo-hint">0 = descobrir automaticamente. Preencha se souber o id no Bling.</span>
        </label>
      </form>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .acoes { display: flex; gap: 8px; flex-wrap: wrap; }
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .hint { color: #64748b; font-size: 13px; margin: 0 0 16px; max-width: 720px; line-height: 1.45; }
    .erro { color: #b91c1c; margin-bottom: 12px; }
    .ok { color: #166534; margin-bottom: 12px; }
    .status { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .pill {
      font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid #e2e8f0; background: #f8fafc;
    }
    .pill.on { background: #dcfce7; border-color: #86efac; color: #166534; }
    .pill.off { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
    .pill.muted { color: #64748b; }
    .form {
      display: grid; gap: 14px; max-width: 560px;
    }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; color: #334155; }
    input[type="text"], input[type="password"], input[type="url"], input[type="number"] {
      font-weight: 400; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px;
    }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 500; }
    .check input { width: auto; }
    .campo-hint { font-weight: 400; font-size: 12px; color: #64748b; }
  `],
})
export class ConfigBlingPage implements OnInit {
  cfg: BlingConfigAdmin | null = null;
  carregado = false;
  salvando = false;
  erro = '';
  ok = false;

  form = {
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    consultaProdutosHabilitada: true,
    consultaProdutosSyncMinutos: 15,
    idCampoPermitePersonalizacao: 0,
  };

  constructor(
    private config: BlingConfigService,
    private blingAuth: BlingAuthService,
  ) {}

  ngOnInit(): void {
    this.config.carregar().subscribe({
      next: cfg => this.aplicar(cfg),
      error: err => {
        // Em dev, preenche o form com environment mesmo se a API falhar (ex.: API offline).
        this.aplicar(this.fallbackDevCfg());
        const status = err?.status;
        if (status === 401 || status === 403) {
          this.erro = 'Sem permissão. Entre como Admin ou Root.';
        } else if (status === 0 || !status) {
          this.erro = 'API indisponível. Suba a API (porta 5276) e recarregue.';
        } else {
          this.erro = err?.error?.erro || err?.error?.message || `Não foi possível carregar a config Bling (HTTP ${status}).`;
        }
      },
    });
  }

  salvar(): void {
    this.erro = '';
    this.ok = false;
    this.salvando = true;
    this.config.salvar({
      clientId: this.form.clientId.trim(),
      clientSecret: this.form.clientSecret.trim() || undefined,
      redirectUri: this.form.redirectUri.trim(),
      consultaProdutosHabilitada: this.form.consultaProdutosHabilitada,
      consultaProdutosSyncMinutos: Number(this.form.consultaProdutosSyncMinutos) || 15,
      idCampoPermitePersonalizacao: Number(this.form.idCampoPermitePersonalizacao) || 0,
    }).subscribe({
      next: cfg => {
        this.salvando = false;
        this.ok = true;
        this.form.clientSecret = '';
        this.aplicar(cfg);
      },
      error: err => {
        this.salvando = false;
        this.erro = err?.error?.erro || 'Não foi possível salvar.';
      },
    });
  }

  conectar(): void {
    this.erro = '';
    this.blingAuth.getAuthorizationUrl().subscribe({
      next: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
      error: err => {
        this.erro = err?.error?.message || 'Não foi possível iniciar o OAuth Bling. Salve as credenciais antes.';
      },
    });
  }

  private aplicar(cfg: BlingConfigAdmin): void {
    this.cfg = cfg;
    this.carregado = true;
    const dev = environment.bling;
    this.form = {
      clientId: this.valorOuDev(cfg.clientId, dev?.clientId),
      clientSecret: '',
      redirectUri: this.valorOuDev(cfg.redirectUri, dev?.redirectUri),
      consultaProdutosHabilitada: environment.production
        ? !!cfg.consultaProdutosHabilitada
        : !!(cfg.consultaProdutosHabilitada || dev?.consultaProdutosHabilitada),
      consultaProdutosSyncMinutos: cfg.consultaProdutosSyncMinutos || 15,
      idCampoPermitePersonalizacao: cfg.idCampoPermitePersonalizacao || 0,
    };
  }

  /** Prefill só em dev quando a API devolve vazio ou placeholder de appsettings.json. */
  private valorOuDev(atual: string | null | undefined, fallback?: string): string {
    const t = (atual ?? '').trim();
    const vazio = !t || t === 'SEU_CLIENT_ID_AQUI' || t === 'SEU_CLIENT_SECRET_AQUI';
    if (!vazio) return t;
    if (environment.production) return '';
    return (fallback ?? '').trim();
  }

  private fallbackDevCfg(): BlingConfigAdmin {
    const d = environment.bling;
    return {
      clientId: d?.clientId ?? '',
      clientSecretConfigurado: false,
      redirectUri: d?.redirectUri ?? '',
      consultaProdutosHabilitada: !!d?.consultaProdutosHabilitada,
      consultaProdutosSyncMinutos: 15,
      idCampoPermitePersonalizacao: 0,
      modoLocal: true,
      habilitado: false,
      tokenConectado: false,
      temOverrideMongo: false,
    };
  }
}
