export type SortOrder = "asc" | "desc";

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: SortOrder;
  search?: string;
}

export interface PaginationConfig {
  defaultLimit?: number;
  maxLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: SortOrder;
  /** Whitelist for `sortBy`. When non-empty, requested sortBy not in the list falls back to `defaultSortBy`. */
  allowedSortFields?: string[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextPage: number | null;
  previousPage: number | null;
  isFirstPage: boolean;
  isLastPage: boolean;
  /** 1-indexed position of the first item on this page (0 when total=0). */
  from: number;
  /** 1-indexed position of the last item on this page (0 when total=0). */
  to: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      pagination?: PaginationOptions;
    }
  }
}

export {};
