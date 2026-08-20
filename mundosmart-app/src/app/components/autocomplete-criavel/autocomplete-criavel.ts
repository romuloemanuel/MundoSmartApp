import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { Observable } from 'rxjs';
import {
  MODELO_LIMITE_AUTOCOMPLETE_API,
  MODELO_LIMITE_AUTOCOMPLETE_UI,
} from '../../config/aparelhos.config';
import { posicionarPopoverFixo } from '../../utils/popover-posicao.util';

export interface AutocompleteItem {
  id?: string;
  nome: string;
  extra?: string;
  marcaId?: string;
  marcaNome?: string;
  criadoEm?: string;
}

@Component({
  selector: 'app-autocomplete-criavel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ac-wrapper" #ancora>
      <div class="ac-input-row">
        <div class="ac-input-container">
          <input
            type="text"
            [placeholder]="placeholder"
            [(ngModel)]="termo"
            (ngModelChange)="onTermoChange($event)"
            (focus)="onFocus()"
            (blur)="onBlur()"
            autocomplete="off"
            class="ac-input"
          />
          <span class="ac-spinner" *ngIf="carregando">⏳</span>
          <span class="ac-clear" *ngIf="itemSelecionado" (mousedown)="limpar()">✕</span>
        </div>
      </div>

      <ul
        class="ac-lista"
        *ngIf="aberto && !itemSelecionado && (carregando || sugestoesExibidas.length > 0 || buscaSemResultado || mensagemLimite)"
        [ngStyle]="listaStyle"
      >
        <li *ngIf="permitirCriar && sugestoesExibidas.length === 0 && !carregando && buscaSemResultado && termo.trim().length > 0" class="ac-criar"
          (mousedown)="criarNovo()">
          <span class="ac-criar-icone">+</span> Cadastrar <strong>"{{ termo }}"</strong>
        </li>
        <li *ngIf="sugestoesExibidas.length === 0 && !carregando && buscaSemResultado && termo.trim().length > 0 && !permitirCriar" class="ac-vazio">
          Nenhum resultado.
        </li>
        <li *ngFor="let s of sugestoesExibidas" (mousedown)="selecionar(s)" class="ac-item">
          <span class="ac-nome">{{ rotuloItem(s) }}</span>
          <span class="ac-extra" *ngIf="subtituloItem(s) as sub">{{ sub }}</span>
        </li>
        <li class="ac-limite" *ngIf="!carregando && mensagemLimite">
          {{ mensagemLimite }}
        </li>
      </ul>
    </div>
  `,
  styles: [`
    .ac-wrapper { position: relative; }
    .ac-input-row { display: flex; gap: 8px; align-items: center; }
    .ac-input-container { position: relative; flex: 1; }
    .ac-input {
      width: 100%; padding: 9px 32px 9px 12px;
      border: 1px solid #d1d5db; border-radius: 6px;
      font-size: 14px; font-family: inherit;
      background: #fff; color: #1a1a1a; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ac-input:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .ac-spinner, .ac-clear {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font-size: 13px; cursor: pointer; color: #9ca3af;
    }
    .ac-lista {
      /* position/size via [ngStyle] fixed — evita clip por overflow dos pais */
      background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
      list-style: none; margin: 0; padding: 0;
      max-height: 220px; overflow-y: auto;
      min-width: 180px;
    }
    .ac-item {
      display: flex; flex-direction: column;
      padding: 9px 14px; cursor: pointer;
      border-bottom: 1px solid #f1f5f9; transition: background 0.15s;
    }
    .ac-item:last-child { border-bottom: none; }
    .ac-item:hover { background: #f5f8ff; }
    .ac-nome { font-size: 14px; font-weight: 600; color: #1a1a1a; }
    .ac-extra { font-size: 11px; color: #6b7280; }
    .ac-criar {
      padding: 10px 14px; cursor: pointer; color: #2563EB;
      font-size: 13px; display: flex; align-items: center; gap: 6px;
      border-bottom: 1px solid #f1f5f9; transition: background 0.15s;
    }
    .ac-criar:hover { background: #eff6ff; }
    .ac-criar-icone { font-size: 16px; font-weight: 700; }
    .ac-vazio { padding: 12px 14px; font-size: 13px; color: #9ca3af; }
    .ac-limite {
      padding: 8px 14px;
      font-size: 11px;
      line-height: 1.35;
      color: #92400e;
      background: #fffbeb;
      border-top: 1px solid #fde68a;
      cursor: default;
    }
  `],
})
export class AutocompleteCriavel implements OnInit, OnDestroy, OnChanges {
  @Input() placeholder = 'Buscar por marca ou modelo...';
  @Input() buscarFn!: (termo: string) => Observable<AutocompleteItem[]>;
  @Input() criarFn?: (nome: string) => Observable<AutocompleteItem>;
  @Input() permitirCriar = true;
  @Input() valorInicial?: string;
  /** Id do item pré-selecionado (ex.: modeloId no prefill da OS). */
  @Input() valorInicialId?: string;
  @Input() valorInicialMarcaId?: string;
  @Input() valorInicialMarcaNome?: string;
  @Input() maxExibir = MODELO_LIMITE_AUTOCOMPLETE_UI;
  @Input() limiteConsulta = MODELO_LIMITE_AUTOCOMPLETE_API;

  @Output() itemSelecionadoChange = new EventEmitter<AutocompleteItem | null>();
  /** Quando `permitirCriar` e não há `criarFn`, emite o termo para o pai abrir modal de cadastro. */
  @Output() solicitarCriar = new EventEmitter<string>();

  @ViewChild('ancora', { static: true }) ancora!: ElementRef<HTMLElement>;

  termo = '';
  sugestoesExibidas: AutocompleteItem[] = [];
  totalRecebido = 0;
  mensagemLimite = '';
  carregando = false;
  aberto = false;
  buscaSemResultado = false;
  itemSelecionado: AutocompleteItem | null = null;
  listaStyle: Record<string, string> = {};

  private busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  private focado = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['valorInicial'] || changes['valorInicialId'] || changes['valorInicialMarcaId'])
      && this.valorInicial
      && !this.focado
    ) {
      this.aplicarValorInicial();
    }
  }

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('scroll', this.onScrollCapture, true);
    }
    if (this.valorInicial) {
      this.aplicarValorInicial();
    }

    this.busca$.pipe(
      debounceTime(80),
      distinctUntilChanged(),
      switchMap(t => {
        this.carregando = true;
        this.buscaSemResultado = false;
        return this.buscarFn(t.trim()).pipe(
          finalize(() => { this.carregando = false; }),
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: items => {
        this.totalRecebido = items.length;
        this.sugestoesExibidas = items.slice(0, this.maxExibir);
        this.buscaSemResultado = items.length === 0;
        this.mensagemLimite = this.montarMensagemLimite();
        if (items.length > 0 || this.focado) {
          this.aberto = true;
          this.atualizarPosicaoLista();
        }
      },
      error: () => {
        this.sugestoesExibidas = [];
        this.totalRecebido = 0;
        this.mensagemLimite = '';
        this.buscaSemResultado = true;
      }
    });
  }

  private montarMensagemLimite(): string {
    if (this.totalRecebido === 0) return '';

    const atingiuApi = this.totalRecebido >= this.limiteConsulta;
    const ocultosUi = this.totalRecebido > this.sugestoesExibidas.length;

    if (atingiuApi && ocultosUi) {
      return `Exibindo ${this.sugestoesExibidas.length} de ${this.limiteConsulta}+ resultados. Refine por marca ou modelo.`;
    }
    if (atingiuApi) {
      return `Exibindo até ${this.limiteConsulta} resultados. Refine a busca (ex: Samsung A14).`;
    }
    if (ocultosUi) {
      return `Exibindo ${this.sugestoesExibidas.length} de ${this.totalRecebido} encontrados.`;
    }
    return '';
  }

  rotuloItem(item: AutocompleteItem): string {
    return item.nome;
  }

  subtituloItem(item: AutocompleteItem): string | null {
    const partes: string[] = [];
    if (item.marcaNome?.trim()) partes.push(item.marcaNome.trim());
    if (item.criadoEm) {
      const d = new Date(item.criadoEm);
      if (!Number.isNaN(d.getTime())) {
        partes.push(`Cadastro ${d.toLocaleDateString('pt-BR')}`);
      }
    } else if (item.extra && !item.marcaNome) {
      partes.push(item.extra);
    }
    return partes.length ? partes.join(' · ') : null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (typeof document !== 'undefined') {
      document.removeEventListener('scroll', this.onScrollCapture, true);
    }
  }

  private readonly onScrollCapture = (): void => {
    if (this.aberto) this.atualizarPosicaoLista();
  };

  private aplicarValorInicial(): void {
    this.termo = this.valorInicial || '';
    this.itemSelecionado = {
      id: this.valorInicialId,
      nome: this.valorInicial || '',
      marcaId: this.valorInicialMarcaId,
      marcaNome: this.valorInicialMarcaNome,
    };
  }

  onTermoChange(valor: string): void {
    if (this.itemSelecionado?.id) {
      this.itemSelecionado = null;
      this.itemSelecionadoChange.emit(null);
    }
    this.buscaSemResultado = false;
    if (valor.trim().length > 0) {
      this.aberto = true;
      this.atualizarPosicaoLista();
    } else if (!this.focado) {
      this.sugestoesExibidas = [];
      this.mensagemLimite = '';
      this.aberto = false;
    }
    this.busca$.next(valor);
  }

  onFocus(): void {
    this.focado = true;
    if (this.itemSelecionado?.id) return;
    if (this.itemSelecionado && !this.itemSelecionado.id) {
      this.itemSelecionado = null;
    }
    this.aberto = true;
    this.atualizarPosicaoLista();
    if (!this.carregando) {
      this.busca$.next(this.termo);
    }
  }

  selecionar(item: AutocompleteItem): void {
    this.termo = this.rotuloItem(item);
    this.itemSelecionado = item;
    this.sugestoesExibidas = [];
    this.mensagemLimite = '';
    this.aberto = false;
    this.itemSelecionadoChange.emit(item);
  }

  criarNovo(): void {
    const nome = this.termo.trim();
    if (!nome) return;

    if (!this.criarFn) {
      this.aberto = false;
      this.solicitarCriar.emit(nome);
      return;
    }

    this.carregando = true;
    this.criarFn(nome).subscribe({
      next: item => { this.carregando = false; this.selecionar(item); },
      error: () => { this.carregando = false; }
    });
  }

  limpar(): void {
    this.termo = '';
    this.itemSelecionado = null;
    this.sugestoesExibidas = [];
    this.mensagemLimite = '';
    this.buscaSemResultado = false;
    this.aberto = false;
    this.itemSelecionadoChange.emit(null);
  }

  onBlur(): void {
    setTimeout(() => {
      this.focado = false;
      this.aberto = false;
    }, 150);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.aberto) this.atualizarPosicaoLista();
  }

  private atualizarPosicaoLista(): void {
    const el = this.ancora?.nativeElement;
    if (!el) return;
    const width = Math.max(el.getBoundingClientRect().width, 180);
    const style = posicionarPopoverFixo(el, {
      width,
      height: 220,
      gap: 4,
      align: 'start',
    });
    this.listaStyle = {
      ...style,
      width: `${width}px`,
      right: 'auto',
    };
  }
}
