import { AuthValidator } from "../auth.validator";

describe("AuthValidator", () => {
  describe("register", () => {
    it("accepts a valid payload", () => {
      const result = AuthValidator.register.safeParse({
        email: "user@example.com",
        password: "supersecret",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = AuthValidator.register.safeParse({
        email: "not-an-email",
        password: "supersecret",
      });
      expect(result.success).toBe(false);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const result = AuthValidator.register.safeParse({
        email: "user@example.com",
        password: "short",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown fields (strict)", () => {
      const result = AuthValidator.register.safeParse({
        email: "user@example.com",
        password: "supersecret",
        admin: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("login", () => {
    it("accepts a valid payload", () => {
      const result = AuthValidator.login.safeParse({
        email: "user@example.com",
        password: "anything",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty password", () => {
      const result = AuthValidator.login.safeParse({
        email: "user@example.com",
        password: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("resetPassword", () => {
    it("requires a 6-character OTP", () => {
      const result = AuthValidator.resetPassword.safeParse({
        email: "user@example.com",
        otp: "123",
        newPassword: "supersecret",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid payload", () => {
      const result = AuthValidator.resetPassword.safeParse({
        email: "user@example.com",
        otp: "123456",
        newPassword: "supersecret",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("forgetPassword / resendOtp", () => {
    it("forgetPassword accepts a valid email", () => {
      expect(AuthValidator.forgetPassword.safeParse({ email: "user@example.com" }).success).toBe(
        true,
      );
    });

    it("resendOtp rejects unknown fields", () => {
      const result = AuthValidator.resendOtp.safeParse({
        email: "user@example.com",
        force: true,
      });
      expect(result.success).toBe(false);
    });
  });
});
