import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CepService, EnderecoPorCep } from '../../services/cep';
import { BlingContatoEndereco } from '../../models/bling.models';
import { apenasDigitos, formatarCep } from '../../utils/contato-validacao';
import { formatarEnderecoCompleto } from '../../utils/endereco-format.util';

@Component({
  selector: 'app-endereco-campo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="end-campo">
      <div class="form-row end-cep-row">
        <div class="form-group end-cep">
          <label [for]="namePrefix + '_cep'">CEP</label>
          <input
            [id]="namePrefix + '_cep'"
            [name]="namePrefix + '_cep'"
            [ngModel]="endereco.cep"
            (ngModelChange)="onCep($event)"
            placeholder="00000-000"
            inputmode="numeric"
            maxlength="9"
            autocomplete="postal-code"
          />
          <span class="campo-hint">Digite o CEP para preencher o endereço.</span>
          <span class="campo-verificando" *ngIf="buscandoCep">Consultando CEP…</span>
          <span class="campo-erro" *ngIf="erroCep">{{ erroCep }}</span>
        </div>
        <div class="form-group end-logradouro">
          <label [for]="namePrefix + '_logradouro'">Logradouro</label>
          <div class="end-auto">
            <input
              [id]="namePrefix + '_logradouro'"
              [name]="namePrefix + '_logradouro'"
              [ngModel]="endereco.logradouro"
              (ngModelChange)="onLogradouro($event)"
              (focus)="mostrarSugestoes = sugestoes.length > 0"
              (blur)="fecharSugestoes()"
              placeholder="Rua, avenida… (filtra pelo CEP ou pela cidade)"
              autocomplete="off"
            />
            <ul class="end-sugestoes" *ngIf="mostrarSugestoes && sugestoes.length">
              <li *ngFor="let s of sugestoes" (mousedown)="escolherSugestao(s)">
                <strong>{{ s.logradouro }}</strong>
                <span>{{ s.bairro }} · {{ s.municipio }}/{{ s.uf }} · {{ s.cep }}</span>
              </li>
            </ul>
          </div>
          <span class="campo-verificando" *ngIf="buscandoLogradouro">Buscando endereços…</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="max-width:120px;flex:0 0 120px">
          <label [for]="namePrefix + '_numero'">Número</label>
          <input
            [id]="namePrefix + '_numero'"
            [name]="namePrefix + '_numero'"
            [ngModel]="endereco.numero"
            (ngModelChange)="patch({ numero: $event })"
          />
        </div>
        <div class="form-group">
          <label [for]="namePrefix + '_complemento'">Complemento</label>
          <input
            [id]="namePrefix + '_complemento'"
            [name]="namePrefix + '_complemento'"
            [ngModel]="endereco.complemento"
            (ngModelChange)="patch({ complemento: $event })"
          />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label [for]="namePrefix + '_bairro'">Bairro</label>
          <input
            [id]="namePrefix + '_bairro'"
            [name]="namePrefix + '_bairro'"
            [ngModel]="endereco.bairro"
            (ngModelChange)="patch({ bairro: $event })"
          />
        </div>
        <div class="form-group">
          <label [for]="namePrefix + '_municipio'">Município</label>
          <input
            [id]="namePrefix + '_municipio'"
            [name]="namePrefix + '_municipio'"
            [ngModel]="endereco.municipio"
            (ngModelChange)="onMunicipio($event)"
          />
        </div>
        <div class="form-group" style="max-width:80px;flex:0 0 80px">
          <label [for]="namePrefix + '_uf'">UF</label>
          <input
            [id]="namePrefix + '_uf'"
            [name]="namePrefix + '_uf'"
            [ngModel]="endereco.uf"
            (ngModelChange)="onUf($event)"
            maxlength="2"
          />
        </div>
      </div>
      <p class="end-linha-contrato" *ngIf="mostrarLinhaContrato && linhaContrato">
        <span>Linha gravada no contrato</span>
        {{ linhaContrato }}
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .form-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: flex-end;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      margin-bottom: 10px;
    }
    .form-group label {
      font-size: 10px;
      font-weight: 700;
      color: #6b7280;
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .form-group input {
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      width: 100%;
      box-sizing: border-box;
    }
    .form-group input:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .end-cep-row { align-items: flex-start; }
    .end-cep { flex: 0 0 160px; max-width: 160px; min-width: 140px; }
    .end-logradouro { flex: 1 1 auto; min-width: 0; }
    .end-auto { position: relative; }
    .end-sugestoes {
      position: absolute;
      z-index: 30;
      left: 0; right: 0;
      top: calc(100% + 4px);
      margin: 0;
      padding: 4px 0;
      list-style: none;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
      max-height: 220px;
      overflow: auto;
    }
    .end-sugestoes li {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .end-sugestoes li:hover { background: #f1f5f9; }
    .end-sugestoes span { font-size: 12px; color: #64748b; }
    .end-linha-contrato {
      margin: 4px 0 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      font-size: 13px;
      color: #0f172a;
      line-height: 1.4;
    }
    .end-linha-contrato span {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
  `],
})
export class EnderecoCampo implements OnDestroy {
  @Input() endereco: BlingContatoEndereco = {};
  @Input() namePrefix = 'end';
  @Input() mostrarLinhaContrato = false;
  @Output() enderecoChange = new EventEmitter<BlingContatoEndereco>();
  @Output() linhaChange = new EventEmitter<string>();

  get linhaContrato(): string {
    return formatarEnderecoCompleto(this.endereco);
  }

  buscandoCep = false;
  buscandoLogradouro = false;
  erroCep = '';
  sugestoes: EnderecoPorCep[] = [];
  mostrarSugestoes = false;

  private cepTimer?: ReturnType<typeof setTimeout>;
  private logTimer?: ReturnType<typeof setTimeout>;

  constructor(private cep: CepService) {}

  ngOnDestroy(): void {
    if (this.cepTimer) clearTimeout(this.cepTimer);
    if (this.logTimer) clearTimeout(this.logTimer);
  }

  onCep(valor: string): void {
    this.patch({ cep: formatarCep(valor) });
    this.erroCep = '';
    const d = apenasDigitos(valor);
    if (this.cepTimer) clearTimeout(this.cepTimer);
    if (d.length < 8) {
      this.buscandoCep = false;
      return;
    }
    this.cepTimer = setTimeout(() => this.buscarCep(d), 350);
  }

  onLogradouro(valor: string): void {
    this.patch({ logradouro: valor });
    this.agendarBuscaLogradouro();
  }

  onMunicipio(valor: string): void {
    this.patch({ municipio: valor });
    this.agendarBuscaLogradouro();
  }

  onUf(valor: string): void {
    this.patch({ uf: (valor ?? '').toUpperCase() });
    this.agendarBuscaLogradouro();
  }

  escolherSugestao(s: EnderecoPorCep): void {
    this.mostrarSugestoes = false;
    this.sugestoes = [];
    this.patch({
      cep: s.cep,
      logradouro: s.logradouro,
      bairro: s.bairro || this.endereco.bairro,
      municipio: s.municipio || this.endereco.municipio,
      uf: s.uf || this.endereco.uf,
    });
  }

  fecharSugestoes(): void {
    setTimeout(() => { this.mostrarSugestoes = false; }, 180);
  }

  patch(parcial: BlingContatoEndereco): void {
    this.endereco = { ...this.endereco, ...parcial };
    this.enderecoChange.emit(this.endereco);
    this.linhaChange.emit(formatarEnderecoCompleto(this.endereco));
  }

  private buscarCep(cep: string): void {
    this.buscandoCep = true;
    this.cep.consultar(cep).subscribe(end => {
      this.buscandoCep = false;
      if (!end) {
        this.erroCep = 'CEP não encontrado.';
        return;
      }
      this.patch({
        cep: end.cep,
        logradouro: end.logradouro || this.endereco.logradouro,
        bairro: end.bairro || this.endereco.bairro,
        municipio: end.municipio || this.endereco.municipio,
        uf: end.uf || this.endereco.uf,
      });
    });
  }

  private agendarBuscaLogradouro(): void {
    if (this.logTimer) clearTimeout(this.logTimer);
    const rua = (this.endereco.logradouro ?? '').trim();
    if (rua.length < 3) {
      this.sugestoes = [];
      this.mostrarSugestoes = false;
      return;
    }
    this.logTimer = setTimeout(() => this.buscarLogradouro(), 400);
  }

  private buscarLogradouro(): void {
    const uf = (this.endereco.uf ?? '').trim() || 'SP';
    const cidade = (this.endereco.municipio ?? '').trim() || 'Mococa';
    this.buscandoLogradouro = true;
    this.cep.buscarPorLogradouro(
      uf,
      cidade,
      this.endereco.logradouro ?? '',
    ).subscribe(lista => {
      this.buscandoLogradouro = false;
      this.sugestoes = lista.slice(0, 8);
      this.mostrarSugestoes = this.sugestoes.length > 0;
    });
  }
}
