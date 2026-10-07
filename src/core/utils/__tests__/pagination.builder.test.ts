import { PaginationBuilder } from "../pagination.builder";
import type { PaginationOptions } from "../../types/pagination.types";

const opts = (page: number, limit: number): PaginationOptions => ({
  page,
  limit,
  skip: (page - 1) * limit,
  sortBy: "createdAt",
  sortOrder: "desc",
});

describe("PaginationBuilder.build", () => {
  describe("empty result", () => {
    it("total=0 yields zeroed meta", () => {
      const result = PaginationBuilder.build([], 0, opts(1, 10));
      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
        nextPage: null,
        previousPage: null,
        isFirstPage: true,
        isLastPage: true,
        from: 0,
        to: 0,
      });
    });
  });

  describe("single page", () => {
    it("total < limit collapses to one page", () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = PaginationBuilder.build(data, 3, opts(1, 10));
      expect(result.meta).toEqual({
        total: 3,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
        nextPage: null,
        previousPage: null,
        isFirstPage: true,
        isLastPage: true,
        from: 1,
        to: 3,
      });
    });

    it("total = limit yields exactly one full page", () => {
      const data = Array.from({ length: 10 }, (_, i) => i);
      const result = PaginationBuilder.build(data, 10, opts(1, 10));
      expect(result.meta).toMatchObject({
        totalPages: 1,
        isFirstPage: true,
        isLastPage: true,
        hasNext: false,
        hasPrevious: false,
        from: 1,
        to: 10,
      });
    });
  });

  describe("first of many pages", () => {
    it("page=1 of 10 has hasNext, no hasPrevious", () => {
      const result = PaginationBuilder.build(
        Array.from({ length: 10 }, (_, i) => i),
        100,
        opts(1, 10),
      );
      expect(result.meta).toEqual({
        total: 100,
        page: 1,
        limit: 10,
        totalPages: 10,
        hasNext: true,
        hasPrevious: false,
        nextPage: 2,
        previousPage: null,
        isFirstPage: true,
        isLastPage: false,
        from: 1,
        to: 10,
      });
    });
  });

  describe("middle page", () => {
    it("page=4 of 10 has both neighbors", () => {
      const data = Array.from({ length: 10 }, (_, i) => 30 + i);
      const result = PaginationBuilder.build(data, 100, opts(4, 10));
      expect(result.meta).toEqual({
        total: 100,
        page: 4,
        limit: 10,
        totalPages: 10,
        hasNext: true,
        hasPrevious: true,
        nextPage: 5,
        previousPage: 3,
        isFirstPage: false,
        isLastPage: false,
        from: 31,
        to: 40,
      });
    });
  });

  describe("last page", () => {
    it("exact multiple — to=page*limit", () => {
      const result = PaginationBuilder.build(
        Array.from({ length: 10 }, (_, i) => 90 + i),
        100,
        opts(10, 10),
      );
      expect(result.meta).toMatchObject({
        hasNext: false,
        hasPrevious: true,
        nextPage: null,
        previousPage: 9,
        isFirstPage: false,
        isLastPage: true,
        from: 91,
        to: 100,
      });
    });

    it("partial — to=total (not page*limit)", () => {
      // total=95, limit=10, page=10 → 5 trailing items
      const data = Array.from({ length: 5 }, (_, i) => 90 + i);
      const result = PaginationBuilder.build(data, 95, opts(10, 10));
      expect(result.meta).toEqual({
        total: 95,
        page: 10,
        limit: 10,
        totalPages: 10,
        hasNext: false,
        hasPrevious: true,
        nextPage: null,
        previousPage: 9,
        isFirstPage: false,
        isLastPage: true,
        from: 91,
        to: 95,
      });
    });
  });

  describe("out-of-range page", () => {
    it("page > totalPages still reports isLastPage=true and no hasNext", () => {
      const result = PaginationBuilder.build([], 50, opts(99, 10));
      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasNext).toBe(false);
      expect(result.meta.isLastPage).toBe(true);
      expect(result.meta.hasPrevious).toBe(true);
      expect(result.meta.previousPage).toBe(98);
      expect(result.meta.nextPage).toBeNull();
    });
  });

  describe("hasNext / hasPrevious correctness", () => {
    it("hasPrevious is false on page 1, true otherwise", () => {
      expect(PaginationBuilder.build([], 100, opts(1, 10)).meta.hasPrevious).toBe(false);
      expect(PaginationBuilder.build([], 100, opts(2, 10)).meta.hasPrevious).toBe(true);
    });

    it("hasNext is true while page < totalPages", () => {
      expect(PaginationBuilder.build([], 100, opts(9, 10)).meta.hasNext).toBe(true);
      expect(PaginationBuilder.build([], 100, opts(10, 10)).meta.hasNext).toBe(false);
    });
  });

  describe("from / to correctness", () => {
    it("page=2, limit=25, total=100 → from=26, to=50", () => {
      const result = PaginationBuilder.build([], 100, opts(2, 25));
      expect(result.meta.from).toBe(26);
      expect(result.meta.to).toBe(50);
    });

    it("from/to clamp to total on the last page", () => {
      const result = PaginationBuilder.build([], 47, opts(5, 10));
      expect(result.meta.from).toBe(41);
      expect(result.meta.to).toBe(47);
    });
  });
});
