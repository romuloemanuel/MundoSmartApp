import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PaymobiCobrancaConfig, PaymobiConfig, PaymobiVendasService } from '../../../services/paymobi-vendas.service';
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
          <a routerLink="/paymobi/cobranca">Gerenciar cobrança</a>
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

      <form class="form form-wide" (ngSubmit)="salvarCobranca()">
        <h3>Alerta de vencimento</h3>
        <p class="campo-hint">
          No dia do pagamento enviamos o lembrete. Quem tem mais boletos atrasados do que o limite não recebe alerta.
          Placeholders: {{ placeholdersCobranca }}.
        </p>
        <label class="chk">
          <input type="checkbox" [(ngModel)]="alertaHabilitado" name="alertaHabilitado" />
          Enviar alerta no dia do vencimento
        </label>
        <label>
          Hora (Brasília)
          <input type="number" min="0" max="23" [(ngModel)]="alertaHora" name="alertaHora" />
        </label>
        <label>
          Não alertar se tiver mais de N boletos atrasados
          <input type="number" min="0" [(ngModel)]="alertaMaxAtraso" name="alertaMaxAtraso" />
          <span class="campo-hint">Padrão 2. Com 3 ou mais atrasados o cliente sai do alerta do dia.</span>
        </label>
        <label>
          Mensagem do alerta
          <textarea [(ngModel)]="alertaMensagem" name="alertaMensagem" rows="3" placeholder="Deixe vazio para usar o texto padrão."></textarea>
        </label>

        <h3>Cobrança automática</h3>
        <p class="campo-hint">
          Exemplo: boleto venceu dia 5, primeira cobrança depois de 2 dias (dia 7). Se o cliente pedir para pagar dia 15, use a soneca na tela de cobrança.
        </p>
        <label class="chk">
          <input type="checkbox" [(ngModel)]="autoHabilitada" name="autoHabilitada" />
          Gerar fila de cobrança automática
        </label>
        <label>
          Dias após o vencimento (primeira cobrança)
          <input type="number" min="0" [(ngModel)]="autoDiasAposVencimento" name="autoDiasAposVencimento" />
        </label>
        <label>
          Repetir a cada (dias)
          <input type="number" min="1" [(ngModel)]="autoRepetirDias" name="autoRepetirDias" />
        </label>
        <label>
          Hora (Brasília)
          <input type="number" min="0" max="23" [(ngModel)]="autoHora" name="autoHora" />
        </label>
        <label class="chk">
          <input type="checkbox" [(ngModel)]="autoSoDiasUteis" name="autoSoDiasUteis" />
          Só em dias úteis
        </label>
        <label>
          Mensagem da cobrança
          <textarea [(ngModel)]="autoMensagem" name="autoMensagem" rows="3" placeholder="Deixe vazio para usar o texto padrão."></textarea>
        </label>
        <button type="submit" [disabled]="salvandoCobranca">
          {{ salvandoCobranca ? 'Salvando…' : 'Salvar cobrança' }}
        </button>
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
      margin-bottom: 16px;
    }
    .form-wide { max-width: 640px; }
    .form h3 { margin: 8px 0 0; font-size: 15px; }
    .form label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .form label.chk {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    .form input, .form textarea {
      padding: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      font-family: inherit;
    }
    .form button[type='submit'] {
      align-self: flex-start;
      padding: 8px 12px;
      border-radius: 8px;
      border: 0;
      background: #0f172a;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
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
  salvandoCobranca = false;
  erro = '';
  ok = false;
  alertaHabilitado = true;
  alertaHora = 9;
  alertaMaxAtraso = 2;
  alertaMensagem = '';
  autoHabilitada = true;
  autoDiasAposVencimento = 2;
  autoRepetirDias = 3;
  autoHora = 10;
  autoSoDiasUteis = true;
  autoMensagem = '';
  readonly placeholdersCobranca = '{nome}, {aparelho}, {vencimento}, {valor}, {atraso}';

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
    this.api.cobrancaConfig().subscribe({
      next: cfg => this.aplicarCobranca(cfg),
      error: () => { /* custos já carregaram */ },
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

  salvarCobranca(): void {
    this.salvandoCobranca = true;
    this.erro = '';
    this.api.salvarCobrancaConfig({
      alertaHabilitado: this.alertaHabilitado,
      alertaHora: Number(this.alertaHora) || 0,
      alertaMaxAtraso: Number(this.alertaMaxAtraso) || 0,
      alertaMensagem: this.alertaMensagem,
      autoHabilitada: this.autoHabilitada,
      autoDiasAposVencimento: Number(this.autoDiasAposVencimento) || 0,
      autoRepetirDias: Number(this.autoRepetirDias) || 1,
      autoHora: Number(this.autoHora) || 0,
      autoSoDiasUteis: this.autoSoDiasUteis,
      autoMensagem: this.autoMensagem,
    }).subscribe({
      next: cfg => {
        this.salvandoCobranca = false;
        this.aplicarCobranca(cfg);
        avisarSucessoUsuario('Parametrização da cobrança salva.');
      },
      error: err => {
        this.salvandoCobranca = false;
        this.erro = err?.error?.erro || 'Não foi possível salvar a cobrança.';
        avisarErroUsuario(this.erro);
      },
    });
  }

  private aplicarCobranca(cfg: PaymobiCobrancaConfig): void {
    this.alertaHabilitado = cfg.alertaHabilitado !== false;
    this.alertaHora = Number(cfg.alertaHora) >= 0 ? Number(cfg.alertaHora) : 9;
    this.alertaMaxAtraso = Number(cfg.alertaMaxAtraso) >= 0 ? Number(cfg.alertaMaxAtraso) : 2;
    this.alertaMensagem = cfg.alertaMensagem ?? '';
    this.autoHabilitada = cfg.autoHabilitada !== false;
    this.autoDiasAposVencimento = Number(cfg.autoDiasAposVencimento) >= 0 ? Number(cfg.autoDiasAposVencimento) : 2;
    this.autoRepetirDias = Number(cfg.autoRepetirDias) >= 1 ? Number(cfg.autoRepetirDias) : 3;
    this.autoHora = Number(cfg.autoHora) >= 0 ? Number(cfg.autoHora) : 10;
    this.autoSoDiasUteis = cfg.autoSoDiasUteis !== false;
    this.autoMensagem = cfg.autoMensagem ?? '';
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
