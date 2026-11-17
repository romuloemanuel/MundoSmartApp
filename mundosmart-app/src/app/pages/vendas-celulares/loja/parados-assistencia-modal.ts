import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AparelhoLojaItem } from '../../../services/aparelho-loja.service';
import { GridPaginationState } from '../../../utils/grid-pagination.state';
import { GridPaginator } from '../../../components/grid-paginator/grid-paginator';

@Component({
  selector: 'app-parados-assistencia-modal',
  standalone: true,
  imports: [CommonModule, GridPaginator],
  template: `
    <div class="modal-backdrop" (click)="fechar.emit()">
      <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="titulo-parados" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3 id="titulo-parados">Parados na assistência</h3>
          <button type="button" class="modal-close" (click)="fechar.emit()" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <p class="hint">Só aparelhos com OS ativa. Abrir OS abre a ordem em outra aba.</p>
          <p class="hint" *ngIf="!aparelhos.length">Nenhum aparelho parado na assistência agora.</p>
          <app-grid-paginator
            *ngIf="aparelhos.length"
            [total]="aparelhos.length"
            [page]="grid.page"
            [pageSize]="grid.pageSize"
            (pageChange)="grid.onPageChange($event)"
            (pageSizeChange)="grid.onPageSizeChange($event)"
          />
          <table class="data-grid" *ngIf="pagina.length">
            <thead>
              <tr>
                <th>Código</th>
                <th>Marca</th>
                <th>Modelo</th>
                <th>Configuração</th>
                <th>Cor</th>
                <th>Custo</th>
                <th>OS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of pagina">
                <td class="codigo">{{ a.codigo || '—' }}</td>
                <td>{{ a.marca || '—' }}</td>
                <td>{{ a.modelo || '—' }}</td>
                <td>{{ a.configuracao || '—' }}</td>
                <td>{{ a.cor || '—' }}</td>
                <td>{{ dinheiro(custoDe(a)) }}</td>
                <td>{{ a.osEntradaNumero || a.osEntradaId || '—' }}</td>
                <td>
                  <a
                    *ngIf="a.osEntradaId"
                    class="abrir-os"
                    [href]="urlOs(a.osEntradaId)"
                    target="_blank"
                    rel="noopener noreferrer"
                  >Abrir OS</a>
                  <span *ngIf="!a.osEntradaId">Sem OS</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 10120;
      display: flex; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-box {
      background: #fff; border-radius: 12px; width: 100%; max-width: min(1100px, 96vw); max-height: 92vh;
      display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25); overflow: hidden;
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 16px 20px; background: #0d0d0d; color: #fff;
    }
    .modal-header h3 { margin: 0; font-size: 16px; color: #fff; }
    .modal-close { background: transparent; border: 0; color: rgba(255,255,255,0.75); font-size: 18px; cursor: pointer; }
    .modal-body { flex: 1; overflow: auto; padding: 16px 20px; }
    .hint { color: #64748b; font-size: 13px; margin: 0 0 12px; line-height: 1.45; }
    .data-grid { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-grid th, .data-grid td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .data-grid th { color: #475569; font-weight: 700; }
    .codigo { font-weight: 700; }
    .abrir-os {
      display: inline-flex; align-items: center; padding: 5px 10px; border-radius: 8px;
      background: #1e3a8a; color: #fff; font-size: 12px; font-weight: 700; text-decoration: none;
    }
    .abrir-os:hover { background: #1d4ed8; }
  `],
})
export class ParadosAssistenciaModal {
  @Input() aparelhos: AparelhoLojaItem[] = [];
  @Output() fechar = new EventEmitter<void>();

  readonly grid = new GridPaginationState();

  constructor(private router: Router) {
    this.grid.pageSize = 20;
  }

  @HostListener('document:keydown.escape')
  noEsc(): void {
    this.fechar.emit();
  }

  get pagina(): AparelhoLojaItem[] {
    return this.grid.paginate(this.aparelhos);
  }

  urlOs(id: number): string {
    return this.router.serializeUrl(this.router.createUrlTree(['/ordens-servico', id]));
  }

  custoDe(a: AparelhoLojaItem): number {
    if (a.custoTotal != null && Number.isFinite(Number(a.custoTotal))) return Number(a.custoTotal);
    return (Number(a.custo) || 0) + (Number(a.custoPecas) || 0);
  }

  dinheiro(valor?: number | null): string {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
