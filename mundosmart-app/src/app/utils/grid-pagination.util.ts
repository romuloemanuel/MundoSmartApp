export function paginar<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPaginas(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function intervaloPagina(total: number, page: number, pageSize: number): { inicio: number; fim: number } {
  if (total === 0) return { inicio: 0, fim: 0 };
  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);
  return { inicio, fim };
}
