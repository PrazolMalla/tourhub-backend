import mongoose from "mongoose";
import { AdminManagementService } from "../admin-management.service";
import type { AdminRepository } from "../../admin/admin.repository";
import { ConflictError, ForbiddenError, NotFoundError } from "../../../core/errors";
import type { PaginationOptions } from "../../../core/types/pagination.types";
import { env } from "../../../config/env";

const revokeAllForUser = jest.fn();
jest.mock("../../session/session.module", () => ({
  SessionModule: { service: () => ({ revokeAllForUser }) },
}));
jest.mock("../../../bootstrap/seed", () => ({ Seeder: { run: jest.fn() } }));
jest.mock("../../../core/utils/uploads", () => ({ wipeAllUploads: jest.fn() }));

import { Seeder } from "../../../bootstrap/seed";
import { wipeAllUploads } from "../../../core/utils/uploads";

const ID = "507f1f77bcf86cd799439011";
const SUPER_ID = "507f1f77bcf86cd799439099";

const makeDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: { toString: () => ID },
  email: "admin@example.com",
  role: "admin" as const,
  isActive: true,
  isBanned: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  ...overrides,
});

const makeRepo = () => ({
  findById: jest.fn(),
  findAll: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  setBanned: jest.fn(),
});

const opts = (overrides: Partial<PaginationOptions> = {}): PaginationOptions => ({
  page: 1,
  limit: 10,
  skip: 0,
  sortBy: "createdAt",
  sortOrder: "desc",
  ...overrides,
});

describe("AdminManagementService", () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: AdminManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = makeRepo();
    service = new AdminManagementService(repo as unknown as AdminRepository);
  });

  describe("listAdmins", () => {
    it("returns paginated DTOs", async () => {
      repo.findAll.mockResolvedValue([makeDoc()]);
      repo.count.mockResolvedValue(1);
      const res = await service.listAdmins(opts());
      expect(res.data[0]).toMatchObject({ id: ID, email: "admin@example.com", role: "admin" });
      expect(res.meta).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it("forwards skip/limit/sort and uses an empty filter without search", async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);
      await service.listAdmins(opts({ skip: 20, limit: 20, sortBy: "email", sortOrder: "asc" }));
      expect(repo.findAll).toHaveBeenCalledWith({}, { skip: 20, limit: 20, sort: { email: 1 } });
      expect(repo.count).toHaveBeenCalledWith({});
    });

    it("builds an escaped, case-insensitive email/name search", async () => {
      repo.findAll.mockResolvedValue([]);
      repo.count.mockResolvedValue(0);
      await service.listAdmins(opts({ search: "a.b+" }));
      expect(repo.findAll.mock.calls[0][0]).toEqual({
        $or: [
          { email: { $regex: "a\\.b\\+", $options: "i" } },
          { name: { $regex: "a\\.b\\+", $options: "i" } },
        ],
      });
      expect(repo.count).toHaveBeenCalledWith(repo.findAll.mock.calls[0][0]);
    });
  });

  describe("createAdmin", () => {
    it("normalises email and defaults role to admin", async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc({ email: "new@example.com" }));
      const res = await service.createAdmin({ email: "  New@Example.COM " });
      expect(repo.findByEmail).toHaveBeenCalledWith("new@example.com");
      expect(repo.create).toHaveBeenCalledWith({
        email: "new@example.com",
        role: "admin",
        isActive: true,
        isBanned: false,
      });
      expect(res.email).toBe("new@example.com");
    });

    it("keeps an explicit superadmin role", async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.create.mockResolvedValue(makeDoc({ role: "superadmin" }));
      await service.createAdmin({ email: "x@y.com", role: "superadmin" });
      expect(repo.create.mock.calls[0][0]).toMatchObject({ role: "superadmin" });
    });

    it("throws ConflictError when email is taken", async () => {
      repo.findByEmail.mockResolvedValue(makeDoc());
      await expect(service.createAdmin({ email: "admin@example.com" })).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("updateAdmin", () => {
    it("updates and returns the DTO", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(makeDoc({ name: "Ram" }));
      const res = await service.updateAdmin(ID, { name: "Ram" });
      expect(repo.update).toHaveBeenCalledWith(ID, { name: "Ram" });
      expect(res.name).toBe("Ram");
    });

    it("404 when admin is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateAdmin(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });

    it("403 for a superadmin target", async () => {
      repo.findById.mockResolvedValue(makeDoc({ role: "superadmin" }));
      await expect(service.updateAdmin(ID, { name: "x" })).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("404 when the document disappears between read and update", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      repo.update.mockResolvedValue(null);
      await expect(service.updateAdmin(ID, { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("deleteAdmin", () => {
    it("deletes and revokes every session", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await service.deleteAdmin(ID);
      expect(repo.delete).toHaveBeenCalledWith(ID);
      expect(revokeAllForUser).toHaveBeenCalledWith(ID, "admin", "admin-account-deleted");
    });

    it("404 when admin is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.deleteAdmin(ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("403 for a superadmin target", async () => {
      repo.findById.mockResolvedValue(makeDoc({ role: "superadmin" }));
      await expect(service.deleteAdmin(ID)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repo.delete).not.toHaveBeenCalled();
      expect(revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe("setBanned", () => {
    it("bans, revokes sessions and returns the fresh DTO", async () => {
      repo.findById
        .mockResolvedValueOnce(makeDoc())
        .mockResolvedValueOnce(makeDoc({ isBanned: true, bannedReason: "abuse" }));
      const res = await service.setBanned(ID, true, "abuse", SUPER_ID);
      expect(repo.setBanned).toHaveBeenCalledWith(ID, true, "abuse", SUPER_ID);
      expect(revokeAllForUser).toHaveBeenCalledWith(ID, "admin", "admin-banned");
      expect(res).toMatchObject({ isBanned: true, bannedReason: "abuse" });
    });

    it("unban does not revoke sessions", async () => {
      repo.findById.mockResolvedValue(makeDoc());
      await service.setBanned(ID, false, undefined, SUPER_ID);
      expect(repo.setBanned).toHaveBeenCalledWith(ID, false, undefined, SUPER_ID);
      expect(revokeAllForUser).not.toHaveBeenCalled();
    });

    it("404 when admin is missing", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.setBanned(ID, true, undefined, SUPER_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("403 when targeting a superadmin", async () => {
      repo.findById.mockResolvedValue(makeDoc({ role: "superadmin" }));
      await expect(service.setBanned(ID, true, undefined, SUPER_ID)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repo.setBanned).not.toHaveBeenCalled();
    });

    it("404 when the document disappears after the ban", async () => {
      repo.findById.mockResolvedValueOnce(makeDoc()).mockResolvedValueOnce(null);
      await expect(service.setBanned(ID, true, undefined, SUPER_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("clearDatabase", () => {
    const db = {
      listCollections: jest.fn(),
      dropCollection: jest.fn(),
    };

    const setDb = (value: unknown) =>
      Object.defineProperty(mongoose.connection, "db", {
        value,
        configurable: true,
        writable: true,
      });

    beforeEach(() => {
      setDb(db);
      db.listCollections.mockReturnValue({
        toArray: () =>
          Promise.resolve([{ name: "admins" }, { name: "system.views" }, { name: "trips" }]),
      });
      (wipeAllUploads as jest.Mock).mockResolvedValue({ filesDeleted: 3, subdirs: ["trips"] });
    });

    afterEach(() => {
      delete (mongoose.connection as unknown as Record<string, unknown>).db;
    });

    it("403 on a wrong confirmation code and touches nothing", async () => {
      await expect(service.clearDatabase("wrong-code")).rejects.toBeInstanceOf(ForbiddenError);
      expect(db.dropCollection).not.toHaveBeenCalled();
      expect(wipeAllUploads).not.toHaveBeenCalled();
      expect(Seeder.run).not.toHaveBeenCalled();
    });

    it("drops non-system collections, wipes uploads and re-seeds", async () => {
      const res = await service.clearDatabase(env.DB_CLEAR_CONFIRMATION_CODE);
      expect(db.dropCollection.mock.calls.map((c) => c[0])).toEqual(["admins", "trips"]);
      expect(Seeder.run).toHaveBeenCalledTimes(1);
      expect(res).toEqual({
        collectionsDropped: 2,
        collections: ["admins", "trips"],
        filesDeleted: 3,
        uploadSubdirsWiped: ["trips"],
      });
    });

    it("throws when there is no active DB connection", async () => {
      setDb(undefined);
      await expect(service.clearDatabase(env.DB_CLEAR_CONFIRMATION_CODE)).rejects.toThrow(
        "No active database connection",
      );
    });
  });
});
