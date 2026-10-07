import { AdminManagementValidator as V } from "../admin-management.validator";

describe("AdminManagementValidator", () => {
  describe("idParam", () => {
    it("accepts a 24-hex ObjectId", () => {
      expect(V.idParam.safeParse({ id: "507f1f77bcf86cd799439011" }).success).toBe(true);
    });

    it.each(["123", "zzzzzzzzzzzzzzzzzzzzzzzz", "507f1f77bcf86cd7994390111"])(
      "rejects %s",
      (id) => {
        expect(V.idParam.safeParse({ id }).success).toBe(false);
      },
    );
  });

  describe("create", () => {
    it("defaults role to admin", () => {
      const r = V.create.safeParse({ email: "a@b.com" });
      expect(r.success && r.data.role).toBe("admin");
    });

    it("accepts superadmin role", () => {
      expect(V.create.safeParse({ email: "a@b.com", role: "superadmin" }).success).toBe(true);
    });

    it("rejects bad email, unknown role and extra fields", () => {
      expect(V.create.safeParse({ email: "nope" }).success).toBe(false);
      expect(V.create.safeParse({ email: "a@b.com", role: "user" }).success).toBe(false);
      expect(V.create.safeParse({ email: "a@b.com", password: "x" }).success).toBe(false);
    });
  });

  describe("update", () => {
    it("accepts a partial update", () => {
      expect(V.update.safeParse({ name: "Ram" }).success).toBe(true);
      expect(V.update.safeParse({ isActive: false }).success).toBe(true);
    });

    it("rejects an empty body", () => {
      expect(V.update.safeParse({}).success).toBe(false);
    });

    it("rejects short phone and blank name", () => {
      expect(V.update.safeParse({ phone: "123" }).success).toBe(false);
      expect(V.update.safeParse({ name: "   " }).success).toBe(false);
    });

    it("rejects unknown fields like role", () => {
      expect(V.update.safeParse({ role: "superadmin" }).success).toBe(false);
    });
  });

  describe("ban", () => {
    it("accepts optional reason up to 500 chars", () => {
      expect(V.ban.safeParse({}).success).toBe(true);
      expect(V.ban.safeParse({ reason: "x".repeat(500) }).success).toBe(true);
      expect(V.ban.safeParse({ reason: "x".repeat(501) }).success).toBe(false);
    });
  });

  describe("clearDatabase", () => {
    it("requires a non-empty confirmationCode", () => {
      expect(V.clearDatabase.safeParse({ confirmationCode: "abc" }).success).toBe(true);
      expect(V.clearDatabase.safeParse({ confirmationCode: "" }).success).toBe(false);
      expect(V.clearDatabase.safeParse({}).success).toBe(false);
    });
  });
});
