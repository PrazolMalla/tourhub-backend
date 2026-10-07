import { z } from "zod";

export class AuthValidator {
  static readonly register = z
    .object({
      email: z.email("Invalid email"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      name: z.string().trim().min(1).optional(),
    })
    .strict();

  static readonly login = z
    .object({
      email: z.email("Invalid email"),
      password: z.string().min(1, "Password is required"),
    })
    .strict();

  static readonly forgetPassword = z
    .object({
      email: z.email("Invalid email"),
    })
    .strict();

  static readonly resetPassword = z
    .object({
      email: z.email("Invalid email"),
      otp: z.string().length(6, "OTP must be exactly 6 characters"),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
    })
    .strict();

  static readonly resendOtp = z
    .object({
      email: z.email("Invalid email"),
    })
    .strict();
}
