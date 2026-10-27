import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { NovoClienteModal } from '../novo-cliente-modal/novo-cliente-modal';
import {
  BlingVendaCelular,
  BlingVendaCelularService,
} from '../../services/bling-venda-celular.service';
import { BlingContato } from '../../models/bling.models';
import { formatarCpfCnpj } from '../../utils/contato-validacao';
import { avisarErroUsuario, avisarSucessoUsuario } from '../../services/user-feedback.service';
import { ClientesService } from '../../services/clientes';

@Component({
  selector: 'app-pendencia-cadastro-cliente',
  standalone: true,
  imports: [CommonModule, NovoClienteModal],
  template: `
    <button
      *ngIf="total > 0"
      type="button"
      class="pendencia-bar"
      (click)="abrirGrid()"
    >
      <span class="pendencia-tag">PENDÊNCIA</span>
      <span class="pendencia-texto">
        Terminar cadastro de cliente para passível de desconto
        <strong>({{ total }})</strong>
      </span>
    </button>

    <div class="modal-backdrop" *ngIf="gridAberto" (click)="fecharGrid()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Cadastro pendente · passível de desconto</h3>
          <button type="button" class="modal-close" (click)="fecharGrid()">✕</button>
        </div>
        <div class="modal-body">
          <p class="hint">
            Clique na linha para cadastrar o cliente. O aparelho comprado fica vinculado para desconto na manutenção.
          </p>
          <p *ngIf="erro" class="erro">{{ erro }}</p>
          <p *ngIf="carregando" class="hint">Carregando…</p>
          <div class="grid-scroll" *ngIf="!carregando && vendas.length > 0">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>CPF</th>
                  <th>Aparelho</th>
                  <th>IMEI</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of vendas" (click)="abrirCadastro(v)">
                  <td>{{ v.dataVenda | date:'dd/MM/yyyy':'UTC' }}</td>
                  <td>{{ v.pedidoNumero }}</td>
                  <td>{{ v.clienteNome || '—' }}</td>
                  <td>{{ formatarCpf(v.clienteCpf) }}</td>
                  <td>{{ resumoAparelho(v) }}</td>
                  <td class="imei">{{ v.imei }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="!carregando && vendas.length === 0" class="hint">Nenhuma pendência no momento.</p>
        </div>
      </div>
    </div>

    <app-novo-cliente-modal
      *ngIf="vendaSelecionada"
      [clienteEdicao]="prefill"
      [hintPendencia]="hintCadastro"
      (clienteCriado)="onClienteCriado($event)"
      (fecharModal)="vendaSelecionada = null"
    />
  `,
  styles: [`
    :host { display: block; }
    .pendencia-bar {
      width: 100%;
      margin: 0 0 14px;
      padding: 12px 16px;
      border: 1px solid #fdba74;
      border-radius: 10px;
      background: #fff7ed;
      color: #9a3412;
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
    }
    .pendencia-bar:hover { background: #ffedd5; }
    .pendencia-tag {
      flex: 0 0 auto;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: #ea580c;
      color: #fff;
      border-radius: 999px;
      padding: 4px 10px;
    }
    .pendencia-texto { font-size: 13px; font-weight: 600; line-height: 1.35; }
    .pendencia-texto strong { font-weight: 800; }
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 80;
      background: rgba(15, 23, 42, 0.45);
      display: flex; align-items: center; justify-content: center;
      padding: 16px;
    }
    .modal-box {
      width: min(1100px, 100%);
      max-height: min(86vh, 820px);
      background: #fff;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      background: #0d0d0d;
      color: #fff;
    }
    .modal-header h3 { margin: 0; font-size: 15px; }
    .modal-close {
      background: transparent; border: 0; color: rgba(255,255,255,0.75);
      font-size: 18px; cursor: pointer;
    }
    .modal-body { padding: 16px 20px 20px; overflow: auto; }
    .hint { margin: 0 0 12px; font-size: 13px; color: #64748b; }
    .erro { color: #dc2626; font-size: 13px; }
    .grid-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td {
      padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: #fff7ed; }
    .imei { font-variant-numeric: tabular-nums; white-space: nowrap; }
  `],
})
export class PendenciaCadastroCliente implements OnInit, OnDestroy {
  total = 0;
  vendas: BlingVendaCelular[] = [];
  gridAberto = false;
  carregando = false;
  erro = '';
  vendaSelecionada: BlingVendaCelular | null = null;
  private sub?: Subscription;

  constructor(
    private vendasCelular: BlingVendaCelularService,
    private clientes: ClientesService,
  ) {}

  get prefill(): BlingContato | undefined {
    const v = this.vendaSelecionada;
    if (!v) return undefined;
    return { nome: v.clienteNome || '', cpfCnpj: v.clienteCpf };
  }

  get hintCadastro(): string {
    const v = this.vendaSelecionada;
    if (!v) return '';
    return `Venda Bling #${v.pedidoNumero} · ${this.resumoAparelho(v)}. Complete o cadastro para o cliente ficar passível de desconto.`;
  }

  ngOnInit(): void {
    this.carregar();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  abrirGrid(): void {
    this.gridAberto = true;
    this.carregar();
  }

  fecharGrid(): void {
    this.gridAberto = false;
  }

  abrirCadastro(venda: BlingVendaCelular): void {
    const cpf = (venda.clienteCpf || '').trim();
    if (cpf && venda.id) {
      this.clientes.verificarCpf(cpf).subscribe({
        next: dup => {
          if (dup.existe && dup.clienteId) {
            this.vincularExistente(venda, dup.clienteId);
            return;
          }
          this.vendaSelecionada = venda;
        },
        error: () => {
          this.vendaSelecionada = venda;
        },
      });
      return;
    }
    this.vendaSelecionada = venda;
  }

  private vincularExistente(venda: BlingVendaCelular, clienteId: number): void {
    if (!venda.id) return;
    this.vendasCelular.vincularCliente(venda.id, clienteId).subscribe({
      next: () => {
        avisarSucessoUsuario('Cliente já cadastrado. Aparelho vinculado para passível de desconto.');
        this.carregar();
      },
      error: () => avisarErroUsuario('Não foi possível vincular a venda ao cliente já cadastrado.'),
    });
  }

  onClienteCriado(cliente: BlingContato): void {
    const vendaId = this.vendaSelecionada?.id;
    this.vendaSelecionada = null;
    if (vendaId && cliente.id) {
      this.vendasCelular.vincularCliente(vendaId, cliente.id).subscribe({
        next: () => {
          avisarSucessoUsuario('Cliente cadastrado. Aparelho vinculado para passível de desconto.');
          this.carregar();
        },
        error: () => {
          avisarErroUsuario('Cliente salvo, mas não foi possível vincular a venda. Recarregue a lista.');
          this.carregar();
        },
      });
      return;
    }
    this.carregar();
  }

  formatarCpf(valor?: string): string {
    return formatarCpfCnpj(valor) || '—';
  }

  resumoAparelho(v: BlingVendaCelular): string {
    const nome = [v.marca, v.modelo].filter(s => !!s?.trim()).join(' ') || v.produtoNome || '—';
    const extra = [v.cor, v.configuracao].filter(s => !!s?.trim()).join(' · ');
    return extra ? `${nome} · ${extra}` : nome;
  }

  private carregar(): void {
    this.carregando = true;
    this.erro = '';
    this.sub?.unsubscribe();
    this.sub = this.vendasCelular.pendencias().subscribe({
      next: res => {
        this.vendas = res.vendas ?? [];
        this.total = res.total ?? this.vendas.length;
        this.carregando = false;
        if (this.total === 0) this.gridAberto = false;
      },
      error: () => {
        this.carregando = false;
        this.erro = 'Não foi possível carregar as pendências de cadastro.';
      },
    });
  }
}
