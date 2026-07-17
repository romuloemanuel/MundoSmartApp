import {
  Component, EventEmitter, Input, OnDestroy, OnInit, Output, forwardRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { ClientesService } from '../../services/clientes';
import { BlingContato, BlingContatoRef } from '../../models/bling.models';

@Component({
  selector: 'app-cliente-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ClienteAutocomplete),
      multi: true,
    },
  ],
  template: `
    <div class="autocomplete-wrapper">
      <div class="autocomplete-input-row">
        <div class="autocomplete-input-container">
          <input
            type="text"
            [placeholder]="placeholder"
            [(ngModel)]="termoBusca"
            (ngModelChange)="onTermoChange($event)"
            (focus)="onFocus()"
            (blur)="onBlur()"
            autocomplete="off"
            class="autocomplete-input"
          />
          <span class="autocomplete-spinner" *ngIf="carregando">⏳</span>
          <span class="autocomplete-clear" *ngIf="contatoSelecionado" (mousedown)="limpar()">✕</span>
        </div>
        <button
          type="button"
          class="btn-novo-cliente"
          title="Cadastrar novo cliente"
          (mousedown)="$event.preventDefault(); novoClienteClick.emit()"
        >+</button>
      </div>

      <!-- Dropdown de sugestões -->
      <ul class="autocomplete-lista" *ngIf="aberto && !contatoSelecionado && (carregando || sugestoes.length > 0 || buscaSemResultado)">
        <li *ngIf="sugestoes.length === 0 && !carregando && buscaSemResultado" class="autocomplete-vazio">
          Nenhum cliente encontrado.
        </li>
        <li
          *ngFor="let s of sugestoes"
          (mousedown)="selecionar(s)"
          class="autocomplete-item"
        >
          <span class="autocomplete-nome">
            {{ s.nome }}
            <span class="autocomplete-origem" *ngIf="s.origem === 'local'">local</span>
            <span class="autocomplete-origem autocomplete-origem-bling" *ngIf="s.origem === 'bling'">bling</span>
          </span>
          <span class="autocomplete-detalhe" *ngIf="s.cpfCnpj">{{ s.cpfCnpj }}</span>
          <span class="autocomplete-detalhe" *ngIf="s.celular || s.telefone">{{ s.celular || s.telefone }}</span>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .autocomplete-wrapper { position: relative; }

    .autocomplete-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .autocomplete-input-container {
      position: relative;
      flex: 1;
    }

    .autocomplete-input {
      width: 100%;
      padding: 9px 32px 9px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 14px;
      font-family: inherit;
      background: #fff;
      color: #1a1a1a;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .autocomplete-input:focus {
      border-color: #2563EB;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }

    .autocomplete-spinner,
    .autocomplete-clear {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 13px;
      cursor: pointer;
      color: #9ca3af;
      user-select: none;
    }

    .autocomplete-hint {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 4px;
      padding-left: 2px;
    }

    .btn-novo-cliente {
      width: 36px;
      height: 36px;
      min-width: 36px;
      padding: 0;
      font-size: 20px;
      font-weight: 700;
      border-radius: 6px;
      background: #0d0d0d;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .btn-novo-cliente:hover { background: #2563EB; }

    .autocomplete-lista {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      z-index: 9999;
      list-style: none;
      max-height: 260px;
      overflow-y: auto;
    }

    .autocomplete-item {
      display: flex;
      flex-direction: column;
      padding: 10px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }

    .autocomplete-item:last-child { border-bottom: none; }
    .autocomplete-item:hover { background: #f5f8ff; }

    .autocomplete-nome {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .autocomplete-origem {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 1px 5px;
      border-radius: 4px;
      background: #dbeafe;
      color: #1d4ed8;
    }

    .autocomplete-origem-bling {
      background: #ede9fe;
      color: #6d28d9;
    }

    .autocomplete-detalhe {
      font-size: 11px;
      color: #6b7280;
    }

    .autocomplete-vazio {
      padding: 12px 14px;
      font-size: 13px;
      color: #9ca3af;
    }
  `],
})
export class ClienteAutocomplete implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() placeholder = 'Buscar por nome, CPF/CNPJ ou telefone...';
  @Output() novoClienteClick = new EventEmitter<void>();
  @Output() clienteSelecionadoChange = new EventEmitter<BlingContato | null>();

  termoBusca = '';
  sugestoes: BlingContato[] = [];
  carregando = false;
  aberto = false;
  buscaSemResultado = false;
  contatoSelecionado: BlingContatoRef | null = null;

  private busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private onChange: (v: BlingContatoRef | null) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private clientesService: ClientesService) {}

  ngOnInit(): void {
    this.busca$.pipe(
      debounceTime(80),
      distinctUntilChanged(),
      switchMap(termo => {
        this.carregando = true;
        this.buscaSemResultado = false;
        const busca = termo.trim() || undefined;
        return this.clientesService.listar(busca).pipe(
          finalize(() => { this.carregando = false; }),
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (clientes) => {
        this.sugestoes = clientes;
        this.buscaSemResultado = clientes.length === 0;
        this.aberto = true;
      },
      error: () => {
        this.sugestoes = [];
        this.buscaSemResultado = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTermoChange(valor: string): void {
    this.contatoSelecionado = null;
    this.onChange(null);
    this.buscaSemResultado = false;
    if (valor.trim().length > 0) {
      this.aberto = true;
    } else {
      this.sugestoes = [];
      this.aberto = false;
    }
    this.busca$.next(valor);
  }

  onFocus(): void {
    if (this.contatoSelecionado) return;
    this.aberto = true;
    if (this.sugestoes.length === 0 && !this.carregando) {
      this.busca$.next(this.termoBusca);
    }
  }

  selecionar(cliente: BlingContato): void {
    this.termoBusca = cliente.nome;
    this.contatoSelecionado = { id: cliente.id!, nome: cliente.nome };
    this.sugestoes = [];
    this.aberto = false;
    this.onChange(this.contatoSelecionado);
    this.clienteSelecionadoChange.emit(cliente);
  }

  limpar(): void {
    this.termoBusca = '';
    this.contatoSelecionado = null;
    this.sugestoes = [];
    this.buscaSemResultado = false;
    this.aberto = false;
    this.onChange(null);
    this.clienteSelecionadoChange.emit(null);
  }

  onBlur(): void {
    setTimeout(() => { this.aberto = false; }, 150);
    this.onTouched();
  }

  // ControlValueAccessor
  writeValue(val: BlingContatoRef | null): void {
    this.contatoSelecionado = val ?? null;
    this.termoBusca = val?.nome ?? '';
  }
  registerOnChange(fn: (v: BlingContatoRef | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
}
