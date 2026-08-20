import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { avisarErroUsuario } from '../../services/user-feedback.service';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ClientesService } from '../../services/clientes';

import { BlingContato, BlingContatoPrincipal } from '../../models/bling.models';

import { ParentescoChips } from '../parentesco-chips/parentesco-chips';

import {

  ErrosContatoForm,

  aplicarMascarasContato,

  contatoAlternativoValido,

  formatarTelefone,

  normalizarContatoParaSalvar,

  validarContatoAlternativo,

} from '../../utils/contato-validacao';



@Component({

  selector: 'app-contato-alternativo-modal',

  standalone: true,

  imports: [CommonModule, FormsModule, ParentescoChips],

  template: `

    <div class="modal-backdrop" (click)="fechar()">

      <div class="modal-box" (click)="$event.stopPropagation()">

        <div class="modal-header">

          <h3>{{ editando ? 'Editar contato alternativo' : 'Incluir contato alternativo' }}</h3>

          <button type="button" class="modal-close" (click)="fechar()">✕</button>

        </div>



        <div class="modal-body">

          <p *ngIf="erro" class="erro">{{ erro }}</p>

          <p class="modal-hint">Contato de refer&ecirc;ncia para avisar quando o aparelho ficar pronto.</p>



          <div class="form-group">

            <label>Nome <span class="campo-obrigatorio" aria-hidden="true">*</span></label>

            <input [(ngModel)]="contato.nome" name="nome" placeholder="Nome do contato" />

            <span class="campo-erro" *ngIf="erros.geral">{{ erros.geral }}</span>

          </div>



          <div class="form-group">

            <label>Parentesco <span class="campo-obrigatorio" aria-hidden="true">*</span></label>

            <app-parentesco-chips

              [valor]="contato.parentesco || ''"

              (valorChange)="contato.parentesco = $event; erros.parentesco = undefined"

            ></app-parentesco-chips>

            <span class="campo-erro" *ngIf="erros.parentesco">{{ erros.parentesco }}</span>

          </div>



          <div class="form-row">

            <div class="form-group">

              <label>Celular</label>

              <input

                [ngModel]="contato.celular"

                (ngModelChange)="onCelularChange($event)"

                name="celular"

                placeholder="(00) 90000-0000"

                inputmode="tel"

              />

            </div>

            <div class="form-group">

              <label>Telefone</label>

              <input

                [ngModel]="contato.telefone"

                (ngModelChange)="onTelefoneChange($event)"

                name="telefone"

                placeholder="(00) 0000-0000"

                inputmode="tel"

              />

            </div>

          </div>

          <span class="campo-erro" *ngIf="erros.contato">{{ erros.contato }}</span>

        </div>



        <div class="modal-footer">

          <button type="button" (click)="fechar()">Cancelar</button>

          <button

            type="button"

            class="btn-salvar"

            (click)="salvar()"

            [disabled]="salvando"

          >{{ salvando ? 'Salvando...' : 'Salvar' }}</button>

        </div>

      </div>

    </div>

  `,

  styles: [`

    .modal-backdrop {

      position: fixed; inset: 0;

      background: rgba(0,0,0,0.55);

      z-index: 10000;

      display: flex; align-items: center; justify-content: center;

      padding: 16px;

    }



    .modal-box {

      background: #fff;

      border-radius: 12px;

      width: 100%; max-width: 440px;

      box-shadow: 0 20px 60px rgba(0,0,0,0.25);

    }



    .modal-header {

      display: flex; align-items: center; justify-content: space-between;

      padding: 16px 20px;

      border-bottom: 1px solid #f1f5f9;

      background: #0d0d0d;

      border-radius: 12px 12px 0 0;

    }



    .modal-header h3 {

      margin: 0; font-size: 15px; font-weight: 700;

      color: #fff;

    }



    .modal-close {

      background: transparent; border: none;

      color: rgba(255,255,255,0.7); font-size: 18px;

      cursor: pointer; padding: 0 4px;

      &:hover { color: #fff; }

    }



    .modal-body { padding: 18px 20px; }



    .modal-hint {

      font-size: 12px; color: #6b7280;

      margin: 0 0 14px; line-height: 1.4;

    }



    .modal-footer {

      padding: 12px 20px 16px;

      border-top: 1px solid #f1f5f9;

      display: flex; gap: 10px; justify-content: flex-end;

    }



    .modal-footer button { padding: 8px 18px; font-size: 13px; }



    .btn-salvar { background: #2563EB; color: #fff; }



    .modal-footer button:first-child {

      background: #f1f5f9; color: #374151;

      border: 1px solid #e2e8f0;

    }



    .form-group {

      display: flex; flex-direction: column; margin-bottom: 12px;

    }



    .form-group label {

      font-size: 10px; font-weight: 700;

      color: #6b7280; margin-bottom: 5px;

      text-transform: uppercase; letter-spacing: 0.5px;

    }



    .form-group input {

      padding: 8px 12px; border: 1px solid #d1d5db;

      border-radius: 6px; font-size: 14px;

      font-family: inherit; outline: none;

      &:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }

    }



    .form-row { display: flex; gap: 12px; }

    .form-row .form-group { flex: 1; }



    .campo-erro {

      font-size: 11px; color: #dc2626;

      margin-top: 4px; font-weight: 600;

    }



    .erro {

      color: #dc2626; font-size: 13px;

      background: #fef2f2; border: 1px solid #fca5a5;

      padding: 8px 12px; border-radius: 6px; margin-bottom: 12px;

    }

  `],

})

export class ContatoAlternativoModal implements OnChanges {

  @Input() cliente?: BlingContato;

  @Input() indiceEdicao?: number;

  @Output() contatoSalvo = new EventEmitter<{ cliente: BlingContato; indice: number }>();

  @Output() fecharModal = new EventEmitter<void>();



  contato: BlingContatoPrincipal = {};

  editando = false;

  salvando = false;

  erro = '';

  erros: ErrosContatoForm = {};



  constructor(private clientesService: ClientesService) {}



  ngOnChanges(changes: SimpleChanges): void {

    if (changes['cliente'] || changes['indiceEdicao']) {

      this.inicializar();

    }

  }



  private inicializar(): void {

    this.erro = '';

    this.erros = {};

    this.editando = this.indiceEdicao !== undefined;

    if (this.editando && this.cliente?.contatos?.[this.indiceEdicao!]) {

      const c = this.cliente.contatos[this.indiceEdicao!];

      this.contato = {

        ...c,

        celular: c.celular ? formatarTelefone(c.celular) : c.celular,

        telefone: c.telefone ? formatarTelefone(c.telefone) : c.telefone,

      };

    } else {

      this.contato = {};

    }

  }



  onCelularChange(valor: string): void {

    this.contato.celular = formatarTelefone(valor);

    this.erros.contato = undefined;

  }



  onTelefoneChange(valor: string): void {

    this.contato.telefone = formatarTelefone(valor);

    this.erros.contato = undefined;

  }



  salvar(): void {

    if (!this.cliente?.id) return;



    this.erros = validarContatoAlternativo(this.contato);

    if (!contatoAlternativoValido(this.erros)) return;



    const contatos = (this.cliente.contatos ?? []).map(c => ({ ...c }));

    const payload: BlingContatoPrincipal = {

      nome: this.contato.nome?.trim(),

      parentesco: this.contato.parentesco?.trim(),

      celular: this.contato.celular,

      telefone: this.contato.telefone,

    };



    let indiceSalvo: number;

    if (this.editando && this.indiceEdicao !== undefined) {

      contatos[this.indiceEdicao] = payload;

      indiceSalvo = this.indiceEdicao;

    } else {

      if (contatos.length >= 2) {

        this.erro = 'Máximo de 2 contatos alternativos por cliente.';
        avisarErroUsuario(this.erro);

        return;

      }

      contatos.push(payload);

      indiceSalvo = contatos.length - 1;

    }



    this.salvando = true;

    this.erro = '';



    const atualizado: BlingContato = normalizarContatoParaSalvar({

      ...this.cliente,

      contatos,

    });



    this.clientesService.atualizar(this.cliente.id, atualizado).subscribe({

      next: cliente => {

        this.salvando = false;

        this.contatoSalvo.emit({ cliente: aplicarMascarasContato(cliente), indice: indiceSalvo });

      },

      error: err => {

        this.salvando = false;

        this.erro = err?.error?.erro ?? 'Erro ao salvar contato alternativo.';

      },

    });

  }



  fechar(): void {

    this.fecharModal.emit();

  }

}


