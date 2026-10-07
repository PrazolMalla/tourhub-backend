import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

export class AdminManagementValidator {
  static readonly idParam = z.object({ id: z.string().regex(objectIdRegex) }).strict();

  /**
   * Invite-only admin creation. The invitee signs in via Google OAuth using
   * the email recorded here — no password is set, since auth is delegated to
   * the OAuth provider.
   */
  static readonly create = z
    .object({
      email: z.email(),
      role: z.enum(["admin", "superadmin"]).default("admin"),
    })
    .strict();

  static readonly update = z
    .object({
      name: z.string().trim().min(1).optional(),
      phone: z.string().trim().min(7).max(20).optional(),
      isActive: z.boolean().optional(),
      // isBanned / bannedReason are deliberately NOT accepted here: banning
      // must go through POST /:id/ban so sessions are revoked and
      // bannedBy / bannedAt are recorded.
    })
    .strict()
    .refine((d) => Object.keys(d).length > 0, { message: "At least one field required" });

  static readonly ban = z.object({ reason: z.string().trim().max(500).optional() }).strict();

  /**
   * SuperAdmin "factory reset" guard. We do NOT match the literal code here
   * — the actual value lives in env (`DB_CLEAR_CONFIRMATION_CODE`) and is
   * checked in the service. This schema only enforces shape so a malformed
   * payload is rejected before it reaches the destructive code path.
   */
  static readonly clearDatabase = z
    .object({ confirmationCode: z.string().min(1, "confirmationCode is required") })
    .strict();
}
