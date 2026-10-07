import type { NextFunction, Request, RequestHandler, Response } from "express";
import { PaginationMiddleware } from "../pagination.middleware";
import { ValidationError } from "../../errors/validation.error";

interface RunResult {
  pagination: Request["pagination"];
  err: unknown;
  nextCalled: boolean;
}

const run = (handler: RequestHandler, query: Record<string, unknown>): RunResult => {
  const req = { query } as unknown as Request;
  const res = {} as Response;
  let err: unknown;
  let nextCalled = false;
  const next: NextFunction = (e?: unknown) => {
    nextCalled = true;
    if (e !== undefined) err = e;
  };
  handler(req, res, next);
  return { pagination: req.pagination, err, nextCalled };
};

describe("PaginationMiddleware", () => {
  describe("defaults", () => {
    it("empty query yields built-in defaults", () => {
      const result = run(new PaginationMiddleware().handle, {});
      expect(result.err).toBeUndefined();
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        skip: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
    });

    it("respects constructor-provided defaults", () => {
      const handler = new PaginationMiddleware({
        defaultLimit: 25,
        defaultSortBy: "name",
        defaultSortOrder: "asc",
      }).handle;
      const result = run(handler, {});
      expect(result.pagination).toEqual({
        page: 1,
        limit: 25,
        skip: 0,
        sortBy: "name",
        sortOrder: "asc",
      });
    });
  });

  describe("limit cap", () => {
    it("caps limit at maxLimit when requested limit exceeds it", () => {
      const handler = new PaginationMiddleware({ maxLimit: 50 }).handle;
      const result = run(handler, { limit: "200" });
      expect(result.err).toBeUndefined();
      expect(result.pagination?.limit).toBe(50);
    });

    it("default maxLimit of 100 caps requests", () => {
      const result = run(new PaginationMiddleware().handle, { limit: "500" });
      expect(result.pagination?.limit).toBe(100);
    });

    it("limits below maxLimit pass through unchanged", () => {
      const handler = new PaginationMiddleware({ maxLimit: 50 }).handle;
      const result = run(handler, { limit: "20" });
      expect(result.pagination?.limit).toBe(20);
    });
  });

  describe("rejection", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["negative page", { page: "-1" }],
      ["zero page", { page: "0" }],
      ["non-numeric page", { page: "abc" }],
      ["negative limit", { limit: "-10" }],
      ["zero limit", { limit: "0" }],
      ["non-numeric limit", { limit: "hello" }],
      ["fractional page", { page: "1.5" }],
      ["invalid sortOrder", { sortOrder: "ASC" }],
    ];

    it.each(cases)("rejects %s via ValidationError", (_, query) => {
      const result = run(new PaginationMiddleware().handle, query);
      expect(result.err).toBeInstanceOf(ValidationError);
      expect(result.pagination).toBeUndefined();
    });
  });

  describe("skip computation", () => {
    it("computes skip = (page - 1) * limit", () => {
      const result = run(new PaginationMiddleware().handle, { page: "3", limit: "20" });
      expect(result.pagination?.page).toBe(3);
      expect(result.pagination?.limit).toBe(20);
      expect(result.pagination?.skip).toBe(40);
    });

    it("uses capped limit when computing skip", () => {
      const handler = new PaginationMiddleware({ maxLimit: 50 }).handle;
      const result = run(handler, { page: "4", limit: "200" });
      expect(result.pagination?.limit).toBe(50);
      expect(result.pagination?.skip).toBe(150);
    });
  });

  describe("sortBy whitelist", () => {
    it("accepts a whitelisted field", () => {
      const handler = new PaginationMiddleware({
        allowedSortFields: ["name", "email"],
      }).handle;
      const result = run(handler, { sortBy: "email" });
      expect(result.pagination?.sortBy).toBe("email");
    });

    it("falls back to defaultSortBy when sortBy not in whitelist", () => {
      const handler = new PaginationMiddleware({
        allowedSortFields: ["name", "email"],
        defaultSortBy: "createdAt",
      }).handle;
      const result = run(handler, { sortBy: "isAdmin" });
      expect(result.pagination?.sortBy).toBe("createdAt");
    });

    it("accepts any sortBy when whitelist is empty", () => {
      const result = run(new PaginationMiddleware().handle, { sortBy: "anything" });
      expect(result.pagination?.sortBy).toBe("anything");
    });
  });

  describe("search", () => {
    it("forwards trimmed search when provided", () => {
      const result = run(new PaginationMiddleware().handle, { search: "  alice  " });
      expect(result.pagination?.search).toBe("alice");
    });

    it("omits search when not provided", () => {
      const result = run(new PaginationMiddleware().handle, {});
      expect(result.pagination).not.toHaveProperty("search");
    });
  });

  describe("static factory", () => {
    it("create() returns a RequestHandler honoring config", () => {
      const handler = PaginationMiddleware.create({
        defaultLimit: 5,
        defaultSortBy: "id",
      });
      const result = run(handler, {});
      expect(result.pagination?.limit).toBe(5);
      expect(result.pagination?.sortBy).toBe("id");
    });
  });
});
