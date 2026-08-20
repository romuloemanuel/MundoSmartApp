import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DEFAULT_GRID_PAGE_SIZE, GRID_PAGE_SIZES } from '../../config/grid.config';
import { intervaloPagina, totalPaginas } from '../../utils/grid-pagination.util';

@Component({
  selector: 'app-grid-paginator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid-toolbar" *ngIf="total > 0">
      <div class="grid-toolbar-size">
        <label>
          <span class="grid-toolbar-label">Exibir</span>
          <select [ngModel]="pageSize" (ngModelChange)="onSizeChange($event)">
            <option *ngFor="let s of pageSizes" [ngValue]="s">{{ s }}</option>
          </select>
        </label>
        <span class="grid-toolbar-range">{{ inicio }}–{{ fim }} de {{ total }}</span>
      </div>
      <nav class="grid-toolbar-nav" *ngIf="totalPages > 1" aria-label="Paginação">
        <button
          type="button"
          class="grid-nav-btn"
          (click)="setPage(page - 1)"
          [disabled]="page <= 1"
          aria-label="Página anterior"
        >‹</button>
        <span class="grid-nav-info">{{ page }} / {{ totalPages }}</span>
        <button
          type="button"
          class="grid-nav-btn"
          (click)="setPage(page + 1)"
          [disabled]="page >= totalPages"
          aria-label="Próxima página"
        >›</button>
      </nav>
    </div>
  `,
})
export class GridPaginator {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = DEFAULT_GRID_PAGE_SIZE;
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  readonly pageSizes = GRID_PAGE_SIZES;

  get totalPages(): number {
    return totalPaginas(this.total, this.pageSize);
  }

  get inicio(): number {
    return intervaloPagina(this.total, this.page, this.pageSize).inicio;
  }

  get fim(): number {
    return intervaloPagina(this.total, this.page, this.pageSize).fim;
  }

  onSizeChange(size: number): void {
    this.pageSizeChange.emit(size);
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageChange.emit(page);
  }
}
