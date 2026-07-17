export const GRID_PAGE_SIZES = [10, 20, 50, 100, 500] as const;

export const DEFAULT_GRID_PAGE_SIZE = 20;

export type GridPageSize = (typeof GRID_PAGE_SIZES)[number];
