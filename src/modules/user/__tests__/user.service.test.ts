import { UserService } from "../user.service";
import type { UserRepository } from "../user.repository";
import { NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";

const revokeAllForUser = jest.fn();
jest.mock("../../session/session.module", () => ({
  SessionModule: { service: () => ({ revokeAllForUser }) },
}));

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => "507f1f77bcf86cd799439011" },
  email: "alice@example.com",
  role: "user" as const,
  name: "Alice",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeRepo = () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
});

const opts = (overrides: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...overrides,
});

describe("UserService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: UserService;

  beforeEach(() => {
    repo = makeRepo();
    service = new UserService(repo as unknown as UserRepository);
  });

  describe("list", () => {
    it("returns paginated DTO mapped from documents", async () => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);

      const result = await service.list(opts());
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: "507f1f77bcf86cd799439011",
        email: "alice@example.com",
        name: "Alice",
      });
      // Customers no longer have a `role` field — the user/admin split moved
      // roles onto the Admin model. Asserting absence here so a regression
      // (accidentally re-adding role to the customer DTO) fails the test.
      expect(result.data[0]).not.toHaveProperty("role");
      expect(result.data[0]).not.toHaveProperty("password");
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it("forwards skip/limit/sort to repository", async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.list(opts({ page: 2, limit: 25, skip: 25, sortBy: "email", sortOrder: "asc" }));

      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 25, limit: 25, sort: { email: 1 } });
    });

    it("builds a search filter when search is provided", async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);

      await service.list(opts({ search: "alice" }));

      const filter = repo.findAll.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(filter).toHaveProperty("$or");
      expect(Array.isArray(filter.$or)).toBe(true);
    });
  });

  describe("findById", () => {
    it("returns DTO when found", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      const result = await service.findById("507f1f77bcf86cd799439011");
      expect(result.id).toBe("507f1f77bcf86cd799439011");
      expect(result.email).toBe("alice@example.com");
    });

    it("throws NotFoundError when missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getCurrentUser", () => {
    it("delegates to findById", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      const result = await service.getCurrentUser("507f1f77bcf86cd799439011");
      expect(result.id).toBe("507f1f77bcf86cd799439011");
    });
  });

  describe("update", () => {
    it("returns the updated DTO", async () => {
      repo.update.mockResolvedValue(makeDoc({ name: "Bob" }));
      const result = await service.update("id1", { name: "Bob" });
      expect(result.name).toBe("Bob");
    });

    it("throws NotFoundError when missing", async () => {
      repo.update.mockResolvedValue(null);
      await expect(service.update("missing", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("delete", () => {
    it("resolves silently when found and revokes the user's sessions", async () => {
      repo.delete.mockResolvedValue(makeDoc());
      await expect(service.delete("id")).resolves.toBeUndefined();
      expect(revokeAllForUser).toHaveBeenCalledWith("id", "user", "account-deleted");
    });

    it("throws NotFoundError when missing", async () => {
      repo.delete.mockResolvedValue(null);
      await expect(service.delete("missing")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("setBanned", () => {
    beforeEach(() => {
      revokeAllForUser.mockClear();
      (repo as unknown as { setBanned: jest.Mock }).setBanned = jest.fn();
    });

    it("bans, revokes sessions and returns the refreshed DTO", async () => {
      repo.findById
        .mockResolvedValueOnce(makeDoc())
        .mockResolvedValueOnce(makeDoc({ isBanned: true, bannedReason: "spam" }));
      const res = await service.setBanned("id", true, "spam", "admin1");
      expect((repo as unknown as { setBanned: jest.Mock }).setBanned).toHaveBeenCalledWith(
        "id",
        true,
        "spam",
        "admin1",
      );
      expect(revokeAllForUser).toHaveBeenCalledWith("id", "user", "customer-banned");
      expect(res).toMatchObject({ isBanned: true, bannedReason: "spam" });
    });

    it("unban leaves sessions alone and hides cleared ban fields", async () => {
      repo.findById
        .mockResolvedValueOnce(makeDoc({ isBanned: true }))
        .mockResolvedValueOnce(makeDoc({ isBanned: false, bannedReason: null, bannedAt: null }));
      const res = await service.setBanned("id", false, undefined, "admin1");
      expect(revokeAllForUser).not.toHaveBeenCalled();
      expect(res).not.toHaveProperty("bannedReason");
      expect(res).not.toHaveProperty("bannedAt");
    });

    it("404 when missing before or after the write", async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.setBanned("id", true, undefined, "a")).rejects.toBeInstanceOf(
        NotFoundError,
      );
      repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.setBanned("id", true, undefined, "a")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
