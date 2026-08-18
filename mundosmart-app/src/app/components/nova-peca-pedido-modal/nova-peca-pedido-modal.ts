import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PecasService } from '../../services/pecas';
import { AparelhosService } from '../../services/aparelhos';
import { CategoriasPecaService } from '../../services/categorias-peca';
import {
  CATEGORIAS_PECA,
  categoriaUsaCoresPorModelo,
  inferirCategoriaPeca,
  labelPecaCatalogo,
} from '../../config/peca-categoria.config';
import { AutocompleteCriavel, AutocompleteItem } from '../autocomplete-criavel/autocomplete-criavel';
import { modeloParaAutocomplete } from '../../utils/modelo-autocomplete.util';
import { CorEstoqueModelo, ModeloAparelho, ModeloCompativel, PecaEstoque } from '../../models/bling.models';
import { PecaCatalogo } from '../../models/estoque.models';
import { MODELO_LIMITE_LISTA } from '../../config/aparelhos.config';

@Component({
  selector: 'app-nova-peca-pedido-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AutocompleteCriavel],
  template: `
    <div class="modal-backdrop" (click)="fechar()">
      <div class="modal-box modal-box-wide" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Nova pe&ccedil;a para o pedido</h3>
          <button type="button" class="modal-close" (click)="fechar()">✕</button>
        </div>

        <div class="modal-body">
          <p class="modal-hint">
            Ao salvar, a pe&ccedil;a entra no cat&aacute;logo e j&aacute; &eacute; vinculada &agrave; linha do pedido.
          </p>

          <div class="sugestao-cadastro" *ngIf="modeloLinha && peca.categoria">
            <p class="sugestao-titulo">N&atilde;o h&aacute; pe&ccedil;a cadastrada para este modelo.</p>
            <p class="modal-hint" style="margin-bottom:8px">
              Preencha abaixo ou use uma refer&ecirc;ncia de outro aparelho da mesma categoria.
            </p>
            <div class="sugestao-chips" *ngIf="pecasReferencia.length > 0">
              <button
                type="button"
                class="chip-referencia"
                *ngFor="let p of pecasReferencia"
                (click)="aplicarReferencia(p)"
              >
                {{ labelReferencia(p) }}
              </button>
            </div>
            <p class="modal-hint" *ngIf="pecasReferencia.length === 0" style="margin:0">
              Nenhuma refer&ecirc;ncia desta categoria no cat&aacute;logo — cadastre a primeira pe&ccedil;a.
            </p>
          </div>

          <p *ngIf="erro" class="erro">{{ erro }}</p>

          <div class="form-group">
            <label>Categoria <span class="campo-obrigatorio">*</span></label>
            <select [(ngModel)]="peca.categoria" name="categoria">
              <option value="">Selecione...</option>
              <option *ngFor="let c of categoriasPeca" [value]="c">{{ c }}</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex:1">
              <label>Fornecedor / qualidade</label>
              <input [(ngModel)]="peca.marcaPeca" name="marcaPeca" placeholder="Ex: Incell, Original" />
            </div>
            <div class="form-group" style="flex:1">
              <label>Nome (opcional)</label>
              <input [(ngModel)]="peca.nome" name="nome" [placeholder]="peca.categoria || 'Igual à categoria'" />
            </div>
          </div>

          <div class="form-group" *ngIf="modeloLinha as ml">
            <label>Modelo do pedido</label>
            <div class="modelo-vinculado">
              {{ ml.marcaNome ? ml.marcaNome + ' · ' : '' }}{{ ml.nome }}
            </div>
            <p class="modal-hint">Este modelo ser&aacute; vinculado &agrave; pe&ccedil;a automaticamente.</p>
          </div>

          <div class="form-group" *ngIf="!modeloLinha">
            <label>Modelo <span class="campo-obrigatorio">*</span></label>
            <app-autocomplete-criavel
              placeholder="Buscar modelo (marca + modelo)..."
              [buscarFn]="buscarModelosFn"
              [permitirCriar]="false"
              (itemSelecionadoChange)="onModeloSelecionado($event)"
            />
          </div>

          <div class="form-group" *ngIf="usaCoresPorModelo">
            <label>Cores deste modelo <span class="campo-obrigatorio">*</span></label>
            <p class="modal-hint">Informe cor e quantidade de cada tampa.</p>
            <div class="cor-linha" *ngFor="let c of coresModelo; let i = index">
              <input type="text" [(ngModel)]="c.cor" [name]="'cor_' + i" placeholder="Ex: Preto" />
              <input type="number" min="0" [(ngModel)]="c.quantidade" [name]="'qtd_' + i" />
              <button type="button" (click)="removerCor(i)" title="Remover">✕</button>
            </div>
            <button type="button" class="btn-add-cor" (click)="adicionarCor()">+ Cor</button>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" (click)="fechar()">Cancelar</button>
          <button type="button" (click)="salvar()" [disabled]="salvando">
            {{ salvando ? 'Salvando...' : 'Salvar e usar no pedido' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
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
      width: 100%; max-width: 520px;
      max-height: 90vh;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
      background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
    .modal-close { background: transparent; border: none; color: #fff; font-size: 18px; cursor: pointer; }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid #e5e7eb;
    }
    .modal-hint { font-size: 12px; color: #64748b; margin: 0 0 12px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .modelo-vinculado {
      padding: 8px 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #1e40af;
    }
    .cor-linha {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 6px;
    }
    .cor-linha input[type="text"] { flex: 1; }
    .cor-linha input[type="number"] { width: 72px; }
    .cor-linha button { width: 28px; height: 28px; padding: 0; }
    .btn-add-cor { font-size: 12px; padding: 4px 10px; }
    .erro { color: #b91c1c; font-size: 13px; }
    .sugestao-cadastro {
      margin-bottom: 14px;
      padding: 10px 12px;
      border: 1px solid #fde68a;
      border-radius: 10px;
      background: #fffbeb;
    }
    .sugestao-titulo {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      color: #92400e;
    }
    .sugestao-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip-referencia {
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      color: #1e40af;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: left;
    }
    .chip-referencia:hover { background: #dbeafe; }
  `,
})
export class NovaPecaPedidoModal implements OnInit {
  @Input() categoriaInicial = '';
  @Input() modeloLinha?: ModeloAparelho | null;
  @Input() pecasReferencia: PecaCatalogo[] = [];

  @Output() fechado = new EventEmitter<void>();
  @Output() pecaSalva = new EventEmitter<PecaEstoque>();

  categoriasPeca: string[] = CATEGORIAS_PECA.filter(c => c !== 'Outros');

  peca: PecaEstoque = {
    nome: '',
    categoria: '',
    quantidadeEstoque: 0,
    estoqueNaLoja: true,
    modelosCompativeis: [],
    variacoes: [],
  };

  coresModelo: CorEstoqueModelo[] = [{ cor: '', quantidade: 0 }];
  modeloEscolhido?: ModeloAparelho;
  salvando = false;
  erro = '';

  get usaCoresPorModelo(): boolean {
    return categoriaUsaCoresPorModelo(this.peca.categoria);
  }

  buscarModelosFn = (termo: string): Observable<AutocompleteItem[]> =>
    this.aparelhosService.listarModelos({
      termo: termo.trim() || undefined,
      limite: MODELO_LIMITE_LISTA,
    }).pipe(
      map(ms => ms.map(modeloParaAutocomplete)),
    );

  constructor(
    private pecasService: PecasService,
    private aparelhosService: AparelhosService,
    private categoriasPecaService: CategoriasPecaService,
  ) {}

  ngOnInit(): void {
    this.peca.categoria = this.categoriaInicial?.trim() || '';
    this.categoriasPecaService.nomes().subscribe(nomes => {
      this.categoriasPeca = nomes.filter(c => c !== 'Outros');
    });
  }

  adicionarCor(): void {
    this.coresModelo.push({ cor: '', quantidade: 0 });
  }

  removerCor(index: number): void {
    this.coresModelo.splice(index, 1);
    if (this.coresModelo.length === 0) {
      this.coresModelo = [{ cor: '', quantidade: 0 }];
    }
  }

  onModeloSelecionado(item: AutocompleteItem | null): void {
    if (!item?.id) {
      this.modeloEscolhido = undefined;
      return;
    }
    this.modeloEscolhido = {
      id: item.id,
      nome: item.nome,
      marcaId: item.marcaId,
      marcaNome: item.marcaNome,
    };
  }

  labelReferencia(p: PecaCatalogo): string {
    const modelo = (p.modelosCompativeis ?? [])
      .map(mc => (mc.modeloNome ?? mc.modeloId ?? '').trim())
      .find(Boolean);
    const base = labelPecaCatalogo(p.nome, p.categoria, p.marcaPeca);
    return modelo ? `${modelo} · ${base}` : base;
  }

  aplicarReferencia(p: PecaCatalogo): void {
    if (p.categoria?.trim()) this.peca.categoria = p.categoria.trim();
    if (p.marcaPeca?.trim()) this.peca.marcaPeca = p.marcaPeca.trim();
    if (p.nome?.trim()) this.peca.nome = p.nome.trim();

    if (!this.usaCoresPorModelo) return;

    const compat = (p.modelosCompativeis ?? [])[0];
    const cores = (compat?.cores ?? [])
      .map(c => ({
        cor: (c.cor ?? '').trim(),
        quantidade: Math.max(0, Math.floor(Number(c.quantidade) || 0)),
      }))
      .filter(c => c.cor);

    if (cores.length > 0) {
      this.coresModelo = cores.map(c => ({ cor: c.cor, quantidade: 0 }));
    }
  }

  salvar(): void {
    this.erro = '';
    const categoria = this.peca.categoria?.trim();
    if (!categoria) {
      this.erro = 'Selecione a categoria.';
      return;
    }

    const modelo = this.modeloLinha ?? this.modeloEscolhido;
    if (!modelo?.id) {
      this.erro = 'Selecione o modelo compatível.';
      return;
    }

    const cores = this.usaCoresPorModelo
      ? this.coresModelo
          .map(c => ({
            cor: (c.cor ?? '').trim(),
            quantidade: Math.max(0, Math.floor(Number(c.quantidade) || 0)),
          }))
          .filter(c => c.cor)
      : undefined;

    if (this.usaCoresPorModelo && (!cores || cores.length === 0)) {
      this.erro = 'Informe ao menos uma cor para a Tampa traseira / Vidro Traseiro.';
      return;
    }

    const nome = this.peca.nome?.trim() || categoria;
    const qtdTotal = cores?.reduce((s, c) => s + c.quantidade, 0) ?? 0;
    const compativel: ModeloCompativel = {
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      marcaNome: modelo.marcaNome,
      cores,
    };

    const payload: PecaEstoque = {
      nome,
      categoria,
      descricao: this.peca.descricao?.trim() || undefined,
      marcaPeca: this.peca.marcaPeca?.trim() || undefined,
      quantidadeEstoque: qtdTotal,
      estoqueNaLoja: true,
      modelosCompativeis: [compativel],
      variacoes: [],
    };

    this.salvando = true;
    this.pecasService.salvar(payload).subscribe({
      next: salva => {
        this.pecaSalva.emit({
          ...salva,
          categoria: salva.categoria ?? inferirCategoriaPeca(salva.nome, categoria),
          modelosCompativeis: salva.modelosCompativeis?.length
            ? salva.modelosCompativeis
            : [compativel],
        });
        this.fechado.emit();
      },
      error: err => {
        this.erro = err?.error?.erro ?? err?.error ?? 'Erro ao salvar peça.';
        this.salvando = false;
      },
    });
  }

  fechar(): void {
    this.fechado.emit();
  }
}
