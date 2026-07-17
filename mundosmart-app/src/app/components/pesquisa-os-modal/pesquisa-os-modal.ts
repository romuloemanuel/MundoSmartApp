import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, takeUntil } from 'rxjs/operators';
import { OrdensServicoService } from '../../services/ordens-servico';
import { BlingOrdemServico } from '../../models/bling.models';

@Component({
  selector: 'app-pesquisa-os-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="fechar()">
      <div class="modal-box" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Pesquisar OS Original</h3>
          <button type="button" class="modal-close" (click)="fechar()">✕</button>
        </div>
        <div class="modal-body">
          <div class="pesq-input-wrap">
            <input
              type="text"
              placeholder="Buscar por n°, cliente ou equipamento..."
              [(ngModel)]="termo"
              (ngModelChange)="busca$.next($event)"
              autofocus
            />
            <span *ngIf="carregando" class="pesq-spinner">⏳</span>
          </div>

          <div class="pesq-lista" *ngIf="resultados.length > 0">
            <div
              *ngFor="let os of resultados"
              class="pesq-item"
              (click)="selecionar(os)"
            >
              <div class="pesq-numero">OS #{{ os.numero }}</div>
              <div class="pesq-detalhe">
                <span>{{ os.contato?.nome || '—' }}</span>
                <span *ngIf="os.equipamento"> · {{ os.equipamento }}</span>
                <span *ngIf="os.marcaNome"> {{ os.marcaNome }}</span>
                <span *ngIf="os.modeloNome"> {{ os.modeloNome }}</span>
              </div>
              <div class="pesq-data">{{ os.dataEntrada || os.data | date:'dd/MM/yyyy HH:mm' }}</div>
            </div>
          </div>

          <p class="pesq-vazio"
            *ngIf="!carregando && resultados.length === 0 && termo.trim().length > 0">
            Nenhuma OS encontrada.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.55);
      z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 12px; width: 100%; max-width: 580px;
      max-height: 80vh; display: flex; flex-direction: column;
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 22px; background: #0d0d0d;
      border-radius: 12px 12px 0 0;
    }
    .modal-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: #fff; }
    .modal-close {
      background: transparent; border: none; color: rgba(255,255,255,0.7);
      font-size: 18px; cursor: pointer;
      &:hover { color: #fff; }
    }
    .modal-body { flex: 1; overflow-y: auto; padding: 18px 22px; }
    .pesq-input-wrap { position: relative; margin-bottom: 12px; }
    .pesq-input-wrap input {
      width: 100%; padding: 10px 36px 10px 14px;
      border: 1px solid #d1d5db; border-radius: 7px;
      font-size: 14px; font-family: inherit; outline: none;
      &:focus { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    }
    .pesq-spinner {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      font-size: 14px;
    }
    .pesq-hint { font-size: 12px; color: #9ca3af; margin-bottom: 10px; }
    .pesq-lista { display: flex; flex-direction: column; gap: 6px; }
    .pesq-item {
      border: 1px solid #e2e8f0; border-radius: 8px;
      padding: 12px 14px; cursor: pointer; transition: background 0.15s;
      &:hover { background: #f5f8ff; border-color: #2563EB; }
    }
    .pesq-numero { font-size: 13px; font-weight: 700; color: #2563EB; margin-bottom: 3px; }
    .pesq-detalhe { font-size: 13px; color: #374151; }
    .pesq-data { font-size: 11px; color: #9ca3af; margin-top: 3px; }
    .pesq-vazio { font-size: 13px; color: #9ca3af; text-align: center; padding: 20px 0; }
  `],
})
export class PesquisaOsModal {
  @Output() osSelecionada = new EventEmitter<BlingOrdemServico>();
  @Output() fecharModal = new EventEmitter<void>();

  termo = '';
  resultados: BlingOrdemServico[] = [];
  carregando = false;

  busca$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private service: OrdensServicoService) {
    this.busca$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(t => {
        const termo = t.trim();
        if (!termo) {
          this.resultados = [];
          this.carregando = false;
          return of([]);
        }
        this.carregando = true;
        return this.service.listar({ nome: termo, pagina: 1, tamanhoPagina: 50 }).pipe(
          map(resposta => resposta.itens ?? []),
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: lista => { this.resultados = lista; this.carregando = false; },
      error: () => { this.carregando = false; this.resultados = []; }
    });
  }

  selecionar(os: BlingOrdemServico): void { this.osSelecionada.emit(os); }
  fechar(): void { this.fecharModal.emit(); }
}
