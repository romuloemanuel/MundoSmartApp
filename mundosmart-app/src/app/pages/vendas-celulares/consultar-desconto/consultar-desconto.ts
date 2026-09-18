import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BlingContato } from '../../../models/bling.models';
import { ClientesService } from '../../../services/clientes';
import { avisarErroUsuario } from '../../../services/user-feedback.service';
import { formatarCpfCnpj, apenasDigitos } from '../../../utils/contato-validacao';

@Component({
  selector: 'app-consultar-cliente-desconto',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Consultar Cliente Desconto</h2>
      </div>
      <p class="hint">
        Aparelhos comercializados pela Mundo Smart têm desconto na assistência técnica.
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
      <p class="aviso" *ngIf="imei && buscou">
        A consulta pelo IMEI (vínculo com o CPF) entra neste fluxo em breve.
      </p>
      <p *ngIf="!carregando && buscou && clientes.length === 0 && !erro">
        Nenhum cliente encontrado para essa consulta.
      </p>

      <table class="data-grid" *ngIf="!carregando && clientes.length > 0">
        <thead>
          <tr>
            <th>Nome</th>
            <th>CPF/CNPJ</th>
            <th>Telefone</th>
            <th>IMEI</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let c of clientes">
            <td>{{ c.nome }}</td>
            <td>{{ c.cpfCnpj || '-' }}</td>
            <td>{{ c.celular || c.telefone || '-' }}</td>
            <td>—</td>
            <td><a *ngIf="c.id" [routerLink]="['/clientes', c.id]">Abrir cadastro</a></td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .hint { color: #64748b; font-size: 13px; margin: 0 0 16px; max-width: 640px; line-height: 1.45; }
    .aviso { color: #64748b; font-size: 13px; margin: 0 0 12px; }
    td a { color: #1d4ed8; font-weight: 600; text-decoration: none; }
  `],
})
export class ConsultarClienteDescontoPage {
  cpf = '';
  imei = '';
  carregando = false;
  buscou = false;
  erro = '';
  clientes: BlingContato[] = [];

  constructor(private clientesApi: ClientesService) {}

  onCpfChange(valor: string): void {
    this.cpf = formatarCpfCnpj(valor);
  }

  onImeiChange(valor: string): void {
    this.imei = apenasDigitos(valor).slice(0, 15);
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
    this.clientes = [];

    if (!cpf) {
      this.carregando = false;
      return;
    }

    this.clientesApi.listar(cpf).subscribe({
      next: lista => {
        this.clientes = lista ?? [];
        this.carregando = false;
      },
      error: () => {
        this.clientes = [];
        this.carregando = false;
        this.erro = 'Não foi possível consultar o cliente.';
      },
    });
  }
}
