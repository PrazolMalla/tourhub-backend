import type { RequestHandler } from "express";
import { z } from "zod";
import { ValidationError } from "../errors/validation.error";
import type { PaginationConfig, PaginationOptions, SortOrder } from "../types/pagination.types";
import "../types/pagination.types";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DEFAULT_SORT_BY = "createdAt";
const DEFAULT_SORT_ORDER: SortOrder = "desc";

interface ResolvedConfig {
  defaultLimit: number;
  maxLimit: number;
  defaultSortBy: string;
  defaultSortOrder: SortOrder;
  allowedSortFields: string[];
}

export class PaginationMiddleware {
  private readonly config: ResolvedConfig;

  constructor(config: PaginationConfig = {}) {
    this.config = {
      defaultLimit: config.defaultLimit ?? DEFAULT_LIMIT,
      maxLimit: config.maxLimit ?? MAX_LIMIT,
      defaultSortBy: config.defaultSortBy ?? DEFAULT_SORT_BY,
      defaultSortOrder: config.defaultSortOrder ?? DEFAULT_SORT_ORDER,
      allowedSortFields: config.allowedSortFields ?? [],
    };
  }

  private buildSchema() {
    return z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().default(this.config.defaultLimit),
      sortBy: z.string().trim().min(1).default(this.config.defaultSortBy),
      sortOrder: z.enum(["asc", "desc"]).default(this.config.defaultSortOrder),
      search: z.string().trim().min(1).optional(),
    });
  }

  public handle: RequestHandler = (req, _res, next) => {
    const result = this.buildSchema().safeParse(req.query);
    if (!result.success) {
      next(new ValidationError("Invalid pagination query", result.error.issues));
      return;
    }

    const data = result.data;
    const limit = Math.min(data.limit, this.config.maxLimit);

    let sortBy = data.sortBy;
    if (
      this.config.allowedSortFields.length > 0 &&
      !this.config.allowedSortFields.includes(sortBy)
    ) {
      sortBy = this.config.defaultSortBy;
    }

    const options: PaginationOptions = {
      page: data.page,
      limit,
      skip: (data.page - 1) * limit,
      sortBy,
      sortOrder: data.sortOrder,
    };
    if (data.search !== undefined) options.search = data.search;

    req.pagination = options;
    next();
  };

  /** Static factory — returns a `RequestHandler` for inline route use. */
  static create(config: PaginationConfig = {}): RequestHandler {
    return new PaginationMiddleware(config).handle;
  }
}
