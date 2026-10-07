import { UserValidator } from "../user.validator";

describe("UserValidator", () => {
  describe("create", () => {
    it("accepts a valid payload", () => {
      const result = UserValidator.create.safeParse({
        email: "user@example.com",
        password: "supersecret",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional name + phone (no role — customers can't have roles)", () => {
      const result = UserValidator.create.safeParse({
        email: "user@example.com",
        password: "supersecret",
        name: "Alice",
        phone: "9800000000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = UserValidator.create.safeParse({
        email: "not-an-email",
        password: "supersecret",
      });
      expect(result.success).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = UserValidator.create.safeParse({
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects extra fields (strict mode)", () => {
      const result = UserValidator.create.safeParse({
        email: "user@example.com",
        password: "supersecret",
        admin: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects role field entirely (customers can't have roles in the split schema)", () => {
      const result = UserValidator.create.safeParse({
        email: "user@example.com",
        password: "supersecret",
        role: "admin",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("update", () => {
    it("accepts a partial payload", () => {
      const result = UserValidator.update.safeParse({ name: "Alice" });
      expect(result.success).toBe(true);
    });

    it("rejects an empty payload", () => {
      const result = UserValidator.update.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects unknown fields", () => {
      const result = UserValidator.update.safeParse({ name: "Alice", admin: true });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = UserValidator.update.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("idParam", () => {
    it("accepts a 24-hex ObjectId", () => {
      const result = UserValidator.idParam.safeParse({ id: "507f1f77bcf86cd799439011" });
      expect(result.success).toBe(true);
    });

    it("rejects strings shorter than 24 chars", () => {
      const result = UserValidator.idParam.safeParse({ id: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects non-hex characters", () => {
      const result = UserValidator.idParam.safeParse({ id: "507f1f77bcf86cd799439xyz" });
      expect(result.success).toBe(false);
    });
  });
});
