import { DEFAULT_GRID_PAGE_SIZE, GridPageSize } from '../config/grid.config';
import { intervaloPagina, paginar, totalPaginas } from './grid-pagination.util';

export class GridPaginationState {
  page = 1;
  pageSize: GridPageSize = DEFAULT_GRID_PAGE_SIZE;

  reset(): void {
    this.page = 1;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size as GridPageSize;
    this.page = 1;
  }

  onPageChange(page: number): void {
    this.page = page;
  }

  paginate<T>(items: T[]): T[] {
    return paginar(items, this.page, this.pageSize);
  }

  totalPages(total: number): number {
    return totalPaginas(total, this.pageSize);
  }

  range(total: number): { inicio: number; fim: number } {
    return intervaloPagina(total, this.page, this.pageSize);
  }
}
