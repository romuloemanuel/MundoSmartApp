import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BlingVendaCelular,
  BlingVendaCelularDesconto,
  BlingVendaCelularService,
} from '../../../services/bling-venda-celular.service';
import { AppAuthService } from '../../../services/app-auth';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../../services/user-feedback.service';
import { formatarCpfCnpj, apenasDigitos } from '../../../utils/contato-validacao';

@Component({
  selector: 'app-consultar-cliente-desconto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Consultar Cliente Desconto</h2>
        <div class="acoes" *ngIf="isAdmin">
          <button type="button" class="secundario" (click)="sincronizar()" [disabled]="sincronizando">
            {{ sincronizando ? 'Importando…' : 'Importar vendas do Bling' }}
          </button>
        </div>
      </div>
      <p class="hint">
        Aparelhos novos e iPhones usados vendidos pela Mundo Smart (Bling) têm desconto na assistência.
        O desconto é garantido pelo <strong>CPF atrelado ao IMEI</strong> do aparelho.
      </p>

      <form class="filtros" (submit)="$event.preventDefault(); consultar()">
        <input
          [(ngModel)]="cpf"
          name="cpf"
          inputmode="numeric"
          autocomplete="off"
          placeholder="CPF"
          (ngModelChange)="onCpfChange($event)"
        />
        <input
          [(ngModel)]="imei"
          name="imei"
          inputmode="numeric"
          autocomplete="off"
          placeholder="IMEI"
          (ngModelChange)="onImeiChange($event)"
        />
        <button type="submit" [disabled]="carregando">
          {{ carregando ? 'Consultando…' : 'Consultar' }}
        </button>
      </form>

      <p *ngIf="erro" class="erro">{{ erro }}</p>

      <div class="resultado" *ngIf="!carregando && resultado" [class.ok]="resultado.elegivel" [class.off]="!resultado.elegivel">
        <strong>{{ resultado.elegivel ? 'Desconto liberado' : 'Sem desconto automático' }}</strong>
        <p>{{ resultado.motivo }}</p>
        <p *ngIf="resultado.elegivel">Percentual: <strong>{{ resultado.descontoPercentual | number:'1.0-2' }}%</strong></p>
      </div>

      <p *ngIf="!carregando && buscou && !resultado?.vendas?.length && !erro">
        Nenhuma venda importada do Bling para essa consulta.
      </p>

      <table class="data-grid" *ngIf="!carregando && vendasVisiveis.length > 0">
        <thead>
          <tr>
            <th>Data</th>
            <th>Cliente</th>
            <th>CPF</th>
            <th>Aparelho</th>
            <th>IMEI</th>
            <th>Tipo</th>
            <th>Pedido</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let v of vendasVisiveis">
            <td>{{ v.dataVenda | date:'dd/MM/yyyy' }}</td>
            <td>{{ v.clienteNome || '-' }}</td>
            <td>{{ formatarDoc(v.clienteCpf) }}</td>
            <td>{{ v.produtoNome || '-' }}</td>
            <td>{{ v.imei || '-' }}</td>
            <td>{{ rotuloTipo(v.tipo) }}</td>
            <td>{{ v.pedidoNumero || '-' }}</td>
          </tr>
        </tbody>
      </table>

      <section class="recentes" *ngIf="isAdmin">
        <h3>Últimas vendas importadas</h3>
        <p class="hint" *ngIf="!recentes.length && !carregandoRecentes">Nenhuma venda importada ainda. Use «Importar vendas do Bling».</p>
        <table class="data-grid" *ngIf="recentes.length">
          <thead>
            <tr>
              <th>Data</th>
              <th>Cliente</th>
              <th>CPF</th>
              <th>Aparelho</th>
              <th>IMEI</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of recentes">
              <td>{{ v.dataVenda | date:'dd/MM/yyyy' }}</td>
              <td>{{ v.clienteNome || '-' }}</td>
              <td>{{ formatarDoc(v.clienteCpf) }}</td>
              <td>{{ v.produtoNome || '-' }}</td>
              <td>{{ v.imei || '-' }}</td>
              <td>{{ rotuloTipo(v.tipo) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="hint">
          Categoria e percentual ficam em
          <a routerLink="/configuracoes/bling">Configurações → Bling</a>.
        </p>
      </section>
    </div>
  `,
  styles: [`
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .acoes { display: flex; gap: 8px; }
    .secundario { background: #fff; color: #0d0d0d; border: 1px solid #cbd5e1; }
    .hint { color: #64748b; font-size: 13px; margin: 0 0 16px; max-width: 720px; line-height: 1.45; }
    .erro { color: #b91c1c; margin-bottom: 12px; }
    .resultado {
      margin: 0 0 16px; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.45; max-width: 720px;
    }
    .resultado.ok { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
    .resultado.off { background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; }
    .resultado p { margin: 6px 0 0; }
    .recentes { margin-top: 28px; }
    .recentes h3 { font-size: 15px; margin: 0 0 10px; }
    td a, .hint a { color: #1d4ed8; font-weight: 600; text-decoration: none; }
  `],
})
export class ConsultarClienteDescontoPage implements OnInit {
  cpf = '';
  imei = '';
  carregando = false;
  sincronizando = false;
  carregandoRecentes = false;
  buscou = false;
  erro = '';
  resultado: BlingVendaCelularDesconto | null = null;
  recentes: BlingVendaCelular[] = [];

  constructor(
    private api: BlingVendaCelularService,
    private appAuth: AppAuthService,
  ) {}

  get isAdmin(): boolean {
    return this.appAuth.isAdmin();
  }

  get vendasVisiveis(): BlingVendaCelular[] {
    return this.resultado?.vendas ?? [];
  }

  ngOnInit(): void {
    if (this.isAdmin) this.carregarRecentes();
  }

  onCpfChange(valor: string): void {
    this.cpf = formatarCpfCnpj(valor);
  }

  onImeiChange(valor: string): void {
    this.imei = apenasDigitos(valor).slice(0, 15);
  }

  formatarDoc(valor?: string): string {
    return formatarCpfCnpj(valor) || '—';
  }

  rotuloTipo(tipo?: string): string {
    if (tipo === 'iphone_usado') return 'iPhone usado';
    if (tipo === 'novo') return 'Novo';
    return tipo || '—';
  }

  consultar(): void {
    const cpf = apenasDigitos(this.cpf);
    const imei = apenasDigitos(this.imei);
    if (!cpf && !imei) {
      avisarErroUsuario('Informe o CPF ou o IMEI para consultar o desconto.');
      return;
    }

    this.carregando = true;
    this.erro = '';
    this.buscou = true;
    this.resultado = null;

    this.api.consultarDesconto(cpf, imei).subscribe({
      next: res => {
        this.resultado = res;
        this.carregando = false;
      },
      error: err => {
        this.carregando = false;
        this.erro = err?.error?.erro || 'Não foi possível consultar o desconto.';
      },
    });
  }

  sincronizar(): void {
    this.sincronizando = true;
    this.erro = '';
    this.api.sincronizar({ historicoCompleto: this.recentes.length === 0 }).subscribe({
      next: res => {
        this.sincronizando = false;
        if (res.ok) {
          avisarSucessoUsuario(`${res.importadas} novas, ${res.atualizadas} atualizadas.`);
        } else {
          this.erro = res.aviso || 'Importação sem dados novos.';
        }
        this.carregarRecentes();
      },
      error: err => {
        this.sincronizando = false;
        this.erro = err?.error?.erro || 'Não foi possível importar as vendas do Bling.';
      },
    });
  }

  private carregarRecentes(): void {
    this.carregandoRecentes = true;
    this.api.listar().subscribe({
      next: lista => {
        this.recentes = lista ?? [];
        this.carregandoRecentes = false;
      },
      error: () => {
        this.carregandoRecentes = false;
      },
    });
  }
}
