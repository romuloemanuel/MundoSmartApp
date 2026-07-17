import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PARENTESCO_OPCOES,
  PARENTESCO_OUTROS,
  ehParentescoCustomizado,
} from '../../utils/contato-validacao';

@Component({
  selector: 'app-parentesco-chips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="parentesco-wrap">
      <div class="parentesco-chips" role="group" aria-label="Parentesco">
        <button
          type="button"
          *ngFor="let op of opcoes"
          class="parentesco-chip"
          [class.parentesco-chip-ativo]="chipAtivo(op)"
          (click)="selecionar(op)"
        >{{ op }}</button>
      </div>
      <input
        *ngIf="modoOutros"
        class="parentesco-outros-input"
        [ngModel]="outrosTexto"
        (ngModelChange)="onOutrosInput($event)"
        placeholder="Digite o parentesco"
        maxlength="40"
      />
    </div>
  `,
  styles: [`
    .parentesco-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .parentesco-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .parentesco-chip {
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      background: #fff;
      color: #4b5563;
      cursor: pointer;
      line-height: 1.3;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
    }

    .parentesco-chip:hover {
      border-color: #2563EB;
      color: #2563EB;
    }

    .parentesco-chip-ativo {
      background: #2563EB;
      border-color: #2563EB;
      color: #fff;
    }

    .parentesco-outros-input {
      padding: 6px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      font-family: inherit;
      outline: none;
      max-width: 220px;
    }

    .parentesco-outros-input:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  `],
})
export class ParentescoChips implements OnChanges {
  readonly opcoes = PARENTESCO_OPCOES;
  readonly outrosLabel = PARENTESCO_OUTROS;

  @Input() valor = '';
  @Output() valorChange = new EventEmitter<string>();

  modoOutros = false;
  outrosTexto = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['valor']) {
      this.sincronizarComValor(this.valor);
    }
  }

  chipAtivo(op: string): boolean {
    if (op === this.outrosLabel) return this.modoOutros;
    return !this.modoOutros && this.valor === op;
  }

  selecionar(op: string): void {
    if (op === this.outrosLabel) {
      this.modoOutros = true;
      this.outrosTexto = '';
      this.valorChange.emit('');
      return;
    }
    this.modoOutros = false;
    this.outrosTexto = '';
    this.valorChange.emit(op);
  }

  onOutrosInput(texto: string): void {
    this.outrosTexto = texto;
    this.valorChange.emit(texto.trim());
  }

  private sincronizarComValor(valor: string): void {
    if (ehParentescoCustomizado(valor)) {
      this.modoOutros = true;
      this.outrosTexto = valor.trim();
      return;
    }
    if (valor === this.outrosLabel) {
      this.modoOutros = true;
      this.outrosTexto = '';
      return;
    }
    this.modoOutros = false;
    this.outrosTexto = '';
  }
}
