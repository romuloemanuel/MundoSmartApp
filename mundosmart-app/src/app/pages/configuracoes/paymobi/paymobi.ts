import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymobiConfig, PaymobiVendasService } from '../../../services/paymobi-vendas.service';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';

@Component({
  selector: 'app-config-paymobi',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>PayMobi</h2>
        <div class="acoes">
          <a routerLink="/paymobi">Ver vendas</a>
          <button type="button" (click)="salvar()" [disabled]="salvando">
            {{ salvando ? 'Salvando…' : 'Salvar' }}
          </button>
        </div>
      </div>

      <p class="hint">
        O custo de cada aparelho é o valor de compra + o custo por aparelho + a chave.
        A entrada da venda é receita, não entra nesse custo.
      </p>

      <p class="erro" *ngIf="erro">{{ erro }}</p>
      <p class="ok" *ngIf="ok">Configuração salva.</p>

      <form class="form" (ngSubmit)="salvar()">
        <h3>Custos</h3>
        <label>
          Custo por aparelho (R$)
          <input type="number" min="0" step="0.01" [(ngModel)]="custoPorAparelho" name="custoPorAparelho" />
          <span class="campo-hint">Somado em cada venda, além da chave e do valor de compra. Começa em R$ 20.</span>
        </label>
        <label>
          Custo da chave (R$)
          <input type="number" min="0" step="0.01" [(ngModel)]="custoChave" name="custoChave" />
        </label>
        <label>
          Custo mensal da plataforma (R$)
          <input type="number" min="0" step="0.01" [(ngModel)]="custoPlataformaMensal" name="custoPlataformaMensal" />
        </label>

        <h3>Conta PayMobi</h3>
        <label>
          E-mail
          <input type="email" [(ngModel)]="email" name="email" autocomplete="username" />
        </label>
        <label>
          Senha
          <input
            type="password"
            [(ngModel)]="senha"
            name="senha"
            autocomplete="new-password"
            [placeholder]="senhaConfigurada ? 'Senha já salva — preencha só se quiser trocar' : ''"
          />
        </label>
        <p class="campo-hint" *ngIf="ultimaSincronizacao">
          Última busca de vendas: {{ dataCurta(ultimaSincronizacao) }} — {{ ultimoTotalImportado }} vendas.
        </p>
      </form>
    </div>
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0 0 16px; max-width: 720px; line-height: 1.45; }
    .erro { color: #b91c1c; margin-bottom: 12px; }
    .ok { color: #166534; margin-bottom: 12px; }
    .acoes { display: flex; gap: 10px; align-items: center; }
    .acoes a { color: #1d4ed8; font-weight: 600; text-decoration: none; }
    .form {
      max-width: 480px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .form h3 { margin: 8px 0 0; font-size: 15px; }
    .form label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .form input {
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
    }
    .campo-hint { font-size: 12px; color: #64748b; margin: 0; font-weight: 400; }
  `],
})
export class ConfigPaymobiPage implements OnInit {
  custoPorAparelho = 20;
  custoChave = 80;
  custoPlataformaMensal = 200;
  email = '';
  senha = '';
  senhaConfigurada = false;
  ultimaSincronizacao = '';
  ultimoTotalImportado = 0;
  salvando = false;
  erro = '';
  ok = false;

  constructor(private api: PaymobiVendasService) {}

  ngOnInit(): void {
    this.api.config().subscribe({
      next: cfg => {
        this.email = cfg.email ?? '';
        this.senhaConfigurada = !!cfg.senhaConfigurada;
        this.ultimaSincronizacao = cfg.ultimaSincronizacao ?? '';
        this.ultimoTotalImportado = cfg.ultimoTotalImportado ?? 0;
        this.custoPorAparelho = lerCustoPorAparelho(cfg);
        this.custoChave = Number(cfg.custoFixoAparelho) > 0 ? Number(cfg.custoFixoAparelho) : 80;
        const mensal = Number(cfg.custoPlataformaMensal ?? cfg.custoPlataformaTotal);
        this.custoPlataformaMensal = Number.isFinite(mensal) && mensal >= 0 ? mensal : 200;
      },
      error: () => {
        this.erro = 'Não foi possível carregar a configuração.';
      },
    });
  }

  salvar(): void {
    this.salvando = true;
    this.erro = '';
    this.ok = false;
    this.api.salvarCustos({
      custoFixoAparelho: Number(this.custoChave) || 0,
      custoPorAparelho: Number(this.custoPorAparelho) || 0,
      custoPlataformaTotal: Number(this.custoPlataformaMensal) || 0,
      custoPlataformaMensal: Number(this.custoPlataformaMensal) || 0,
      email: this.email.trim() || undefined,
      senha: this.senha || undefined,
    }).subscribe({
      next: cfg => {
        this.salvando = false;
        this.ok = true;
        this.senha = '';
        this.email = cfg.email ?? this.email;
        this.senhaConfigurada = !!cfg.senhaConfigurada;
        this.custoPorAparelho = lerCustoPorAparelho(cfg);
        this.custoChave = Number(cfg.custoFixoAparelho) > 0 ? Number(cfg.custoFixoAparelho) : 80;
        const mensal = Number(cfg.custoPlataformaMensal ?? cfg.custoPlataformaTotal);
        this.custoPlataformaMensal = Number.isFinite(mensal) && mensal >= 0 ? mensal : 200;
        avisarSucessoUsuario('Configuração das vendas no boleto salva.');
      },
      error: err => {
        this.salvando = false;
        this.erro = err?.error?.erro || 'Não foi possível salvar a configuração.';
        avisarErroUsuario(this.erro);
      },
    });
  }

  dataCurta(iso: string | undefined): string {
    if (!iso) return '—';
    const d = iso.slice(0, 10);
    const [a, m, dia] = d.split('-');
    return a && m && dia ? `${dia}/${m}/${a}` : iso;
  }
}

function lerCustoPorAparelho(cfg: PaymobiConfig): number {
  const n = Number(cfg.custoPorAparelho);
  return Number.isFinite(n) && n >= 0 ? n : 20;
}
