import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ComissaoOrigem, ComissoesOrigemService } from '../../../services/comissoes-origem.service';

@Component({
  selector: 'app-comissao-origem',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>{{ titulo }}</h2>
      </div>
      <p class="formula-hint">{{ explicacao }}</p>

      <div class="filtros">
        <div class="form-group">
          <label>De</label>
          <input type="date" [(ngModel)]="dataInicio" name="dataInicio" />
        </div>
        <div class="form-group">
          <label>até</label>
          <input type="date" [(ngModel)]="dataFim" name="dataFim" />
        </div>
        <button type="button" (click)="carregar()" [disabled]="carregando">
          {{ carregando ? 'Gerando...' : 'Gerar relatório' }}
        </button>
      </div>

      <p class="aviso" *ngIf="relatorio?.aviso">{{ relatorio?.aviso }}</p>
      <p class="erro" *ngIf="erro">{{ erro }}</p>
      <p *ngIf="carregando">Carregando...</p>

      <ng-container *ngIf="relatorio && !carregando">
        <div class="resumo">
          <span>{{ relatorio.quantidade }} lançamentos</span>
          <span *ngIf="smartphones">Vendas: {{ relatorio.vendas }}</span>
          <span *ngIf="smartphones">Trocas: {{ relatorio.trocas }}</span>
          <span class="destaque">Entrou: {{ moeda(relatorio.total) }}</span>
          <span *ngIf="smartphones && relatorio.dinheiroPago">Saiu na troca: {{ moeda(relatorio.dinheiroPago) }}</span>
        </div>

        <h3>Por vendedor</h3>
        <div class="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Qtd</th>
                <th *ngIf="smartphones">Vendas</th>
                <th *ngIf="smartphones">Trocas</th>
                <th>Entrou</th>
                <th *ngIf="smartphones">Saiu</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of relatorio.vendedores">
                <td>{{ v.nome }}</td>
                <td>{{ v.quantidade }}</td>
                <td *ngIf="smartphones">{{ v.vendas }}</td>
                <td *ngIf="smartphones">{{ v.trocas }}</td>
                <td>{{ moeda(v.total) }}</td>
                <td *ngIf="smartphones">{{ moeda(v.dinheiroPago) }}</td>
              </tr>
              <tr *ngIf="relatorio.vendedores.length === 0">
                <td [attr.colspan]="smartphones ? 6 : 3">Nenhum lançamento neste período.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Lançamentos</h3>
        <div class="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Vendedor</th>
                <th>Descrição</th>
                <th>Cliente</th>
                <th>Entrou</th>
                <th *ngIf="smartphones">Saiu</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let l of relatorio.lancamentos">
                <td>{{ dataBr(l.data) }}</td>
                <td>{{ rotuloTipo(l.tipo) }}</td>
                <td>{{ l.vendedor }}</td>
                <td>{{ l.descricao }}</td>
                <td>{{ l.cliente }}</td>
                <td>{{ moeda(l.valor) }}</td>
                <td *ngIf="smartphones">{{ moeda(l.dinheiroPago) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .formula-hint { color: #475569; font-size: 14px; max-width: 760px; }
    .filtros { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin: 16px 0; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group label { font-size: 12px; font-weight: 600; color: #475569; }
    input[type="date"] { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .aviso { background: #fffbeb; border: 1px solid #fcd34d; color: #92400e; padding: 10px 12px; border-radius: 8px; }
    .erro { color: #b91c1c; }
    .resumo { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-bottom: 16px; padding: 12px 16px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; color: #0c4a6e; }
    .resumo .destaque { font-weight: 700; }
    h3 { font-size: 15px; margin: 18px 0 8px; }
    .tabela-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    th { font-size: 12px; color: #475569; }
  `],
})
export class ComissaoOrigemPage implements OnInit, OnDestroy {
  origem: 'loja' | 'smartphones' = 'loja';
  dataInicio = '';
  dataFim = '';
  relatorio: ComissaoOrigem | null = null;
  carregando = false;
  erro = '';
  private sub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private api: ComissoesOrigemService,
  ) {}

  get smartphones(): boolean {
    return this.origem === 'smartphones';
  }

  get titulo(): string {
    return this.smartphones ? 'Comissão de smartphones' : 'Comissão da loja';
  }

  get explicacao(): string {
    return this.smartphones
      ? 'Aparelhos vendidos e trocados neste sistema, por vendedor. Entra só o dinheiro que de fato entrou. Na troca, o aparelho deixado pelo cliente não conta como venda; se a loja devolveu dinheiro, ele aparece em Saiu.'
      : 'Vendas realizadas no Bling (acessórios e eletrônicos), por vendedor do pedido. Pedidos cancelados ficam de fora.';
  }

  ngOnInit(): void {
    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.dataInicio = this.iso(ini);
    this.dataFim = this.iso(hoje);
    this.sub = this.route.data.subscribe(data => {
      this.origem = data['origem'] === 'smartphones' ? 'smartphones' : 'loja';
      this.relatorio = null;
      this.carregar();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  carregar(): void {
    if (!this.dataInicio || !this.dataFim) return;
    this.carregando = true;
    this.erro = '';
    const pedido = this.smartphones
      ? this.api.smartphones(this.dataInicio, this.dataFim)
      : this.api.loja(this.dataInicio, this.dataFim);
    pedido.subscribe({
      next: relatorio => {
        this.relatorio = relatorio;
        this.carregando = false;
      },
      error: () => {
        this.erro = 'Não foi possível gerar o relatório.';
        this.carregando = false;
      },
    });
  }

  rotuloTipo(tipo: string): string {
    if (tipo === 'troca') return 'Troca';
    if (tipo === 'venda') return 'Venda';
    return tipo;
  }

  dataBr(iso: string): string {
    const [ano, mes, dia] = (iso || '').split('-');
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
  }

  moeda(valor: number): string {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private iso(data: Date): string {
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${data.getFullYear()}-${mes}-${dia}`;
  }
}
