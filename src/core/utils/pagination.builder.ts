import type { PaginatedResult, PaginationMeta, PaginationOptions } from "../types/pagination.types";

export class PaginationBuilder {
  static build<T>(data: T[], total: number, options: PaginationOptions): PaginatedResult<T> {
    const { page, limit } = options;

    if (total <= 0) {
      const meta: PaginationMeta = {
        total: 0,
        page,
        limit,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
        nextPage: null,
        previousPage: null,
        isFirstPage: true,
        isLastPage: true,
        from: 0,
        to: 0,
      };
      return { data, meta };
    }

    const totalPages = Math.ceil(total / limit);
    const isFirstPage = page <= 1;
    const isLastPage = page >= totalPages;
    const hasPrevious = page > 1;
    const hasNext = page < totalPages;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrevious,
      nextPage: hasNext ? page + 1 : null,
      previousPage: hasPrevious ? page - 1 : null,
      isFirstPage,
      isLastPage,
      from,
      to,
    };

    return { data, meta };
  }
}
