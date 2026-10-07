import { Types } from "mongoose";
import { AdminModel } from "../admin.model";

describe("AdminModel", () => {
  it("uses the admins collection", () => {
    expect(AdminModel.collection.collectionName).toBe("admins");
    expect(AdminModel.modelName).toBe("Admin");
  });

  describe("validation", () => {
    it("requires email", () => {
      const err = new AdminModel({}).validateSync();
      expect(err?.errors.email).toBeDefined();
      expect(err?.errors.email?.kind).toBe("required");
    });

    it("accepts a minimal admin", () => {
      expect(new AdminModel({ email: "a@b.com" }).validateSync()).toBeUndefined();
    });

    it.each(["superadmin", "admin"])("accepts role %s", (role) => {
      expect(new AdminModel({ email: "a@b.com", role }).validateSync()).toBeUndefined();
    });

    it("rejects an unknown role", () => {
      const err = new AdminModel({ email: "a@b.com", role: "user" }).validateSync();
      expect(err?.errors.role?.kind).toBe("enum");
    });

    it("rejects a non-ObjectId bannedBy", () => {
      const err = new AdminModel({ email: "a@b.com", bannedBy: "nope" }).validateSync();
      expect(err?.errors.bannedBy).toBeDefined();
    });
  });

  describe("defaults", () => {
    it("defaults role=admin, isActive=true, isBanned=false", () => {
      const doc = new AdminModel({ email: "a@b.com" });
      expect(doc.role).toBe("admin");
      expect(doc.isActive).toBe(true);
      expect(doc.isBanned).toBe(false);
    });
  });

  describe("normalisation", () => {
    it("trims and lowercases email", () => {
      expect(new AdminModel({ email: "  Admin@Example.COM  " }).email).toBe("admin@example.com");
    });

    it("trims name and phone", () => {
      const doc = new AdminModel({ email: "a@b.com", name: "  Ram  ", phone: " 98000 " });
      expect(doc.name).toBe("Ram");
      expect(doc.phone).toBe("98000");
    });

    it("lowercases email in query filters so lookups are case-insensitive", () => {
      const q = AdminModel.findOne({ email: "  Admin@Example.COM " });
      q.cast(AdminModel);
      expect(q.getFilter()).toEqual({ email: "admin@example.com" });
    });

    it("casts bannedBy string to ObjectId", () => {
      const id = "507f1f77bcf86cd799439011";
      const doc = new AdminModel({ email: "a@b.com", bannedBy: id });
      expect(doc.bannedBy).toBeInstanceOf(Types.ObjectId);
      expect(doc.bannedBy?.toString()).toBe(id);
    });
  });

  describe("secret fields", () => {
    it.each(["password", "resetOtp", "otpExpiry"])("%s is excluded from default selects", (p) => {
      expect(AdminModel.schema.path(p).options.select).toBe(false);
    });

    it.each(["email", "role", "googleId", "isBanned"])("%s is selected by default", (p) => {
      expect(AdminModel.schema.path(p).options.select).not.toBe(false);
    });
  });

  describe("indexes", () => {
    const indexes = () => AdminModel.schema.indexes();
    const find = (field: string) =>
      indexes().find(([fields]: [Record<string, unknown>, ...unknown[]]) => field in fields);

    it("has a unique index on email", () => {
      const email = AdminModel.schema.path("email").options;
      expect(email.unique).toBe(true);
    });

    it("has a unique sparse index on googleId", () => {
      const idx = find("googleId");
      expect(idx?.[1]).toMatchObject({ unique: true, sparse: true });
    });

    it.each(["role", "isActive", "isBanned"])("indexes %s", (field) => {
      expect(find(field)).toBeDefined();
    });
  });

  it("enables timestamps", () => {
    expect(AdminModel.schema.path("createdAt")).toBeDefined();
    expect(AdminModel.schema.path("updatedAt")).toBeDefined();
  });
});
