import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),

    DB_URL: z.string().min(1, "DB_URL is required"),

    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    // No default — must be a real 32+ char secret in every environment.
    // (Previously defaulted to a hardcoded dev string, which would silently
    //  ship to production if the env var was forgotten. See qa-test.md#H-3.)
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),

    CLIENT_URL: z.url("CLIENT_URL must be a valid URL"),
    ADMIN_PANEL_URL: z.url("ADMIN_PANEL_URL must be a valid URL").optional(),

    // Extra CORS origins beyond CLIENT_URL + ADMIN_PANEL_URL. Comma-separated,
    // each must be a full origin (scheme + host, no trailing slash).
    // Example: ALLOWED_ORIGINS=https://landing.example.com,https://shop.example.com
    ALLOWED_ORIGINS: z
      .string()
      .optional()
      .transform((v) =>
        (v ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      ),

    COOKIE_DOMAIN: z.string().optional(),
    /**
     * Cookie `SameSite` policy. Defaults to `lax`, which is the right balance
     * of CSRF protection + OAuth compatibility when api / admin / customer
     * sit on the same registrable domain.
     *
     * If you genuinely need cross-domain cookies (e.g. api on `api.example.com`,
     * admin on `panel.other.com`), set to `none` AND add a CSRF token layer.
     * Setting to `none` without CSRF tokens is what shipped previously and
     * triggered qa-test.md#H-2.
     */
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),

    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    SUPERADMIN_EMAIL: z.email("SUPERADMIN_EMAIL must be a valid email"),
    // No default — must be set in every environment. (Previously defaulted
    // to "ChangeMe!Now123" which is publicly known and would bootstrap the
    // SuperAdmin with takeover-trivial credentials. See qa-test.md#C-3.)
    SUPERADMIN_PASSWORD: z.string().min(8, "SUPERADMIN_PASSWORD must be at least 8 characters"),
    SUPERADMIN_NAME: z.string().default("Super Admin"),

    // ── Rate limiting ─────────────────────────────────────────────
    // Per-scope window + max requests, read directly from env — no DB
    // override. Applied via DynamicRateLimitMiddleware (global/auth/trip/
    // enquiry) and RateLimitMiddleware (money, applied directly at the route).
    DISABLE_RATE_LIMITS: z
      .union([z.literal("true"), z.literal("false")])
      .default("false")
      .transform((v) => v === "true"),

    RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(100),

    RATE_LIMIT_AUTH_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),

    RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 1000),
    RATE_LIMIT_PUBLIC_SUBMIT_MAX: z.coerce.number().int().positive().default(5),

    RATE_LIMIT_PUBLIC_API_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_PUBLIC_API_MAX: z.coerce.number().int().positive().default(50),

    // Money endpoints (order create, payment initiate, mark-paid): stricter
    // and windowed in minutes, not the 15-min blocks used elsewhere.
    RATE_LIMIT_MONEY_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 1000),
    RATE_LIMIT_MONEY_MAX: z.coerce.number().int().positive().default(10),

    // Confirmation code required by the SuperAdmin "clear database" endpoint.
    // Drops every collection in the active Mongo database, so the code is a
    // last-line guard against accidental clicks even with a valid session.
    // Override in production via env; defaults to "12345678" for dev parity.
    DB_CLEAR_CONFIRMATION_CODE: z.string().min(1).default("12345678"),

    MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(5),

    // ── Cloudinary (image/video/document uploads) ──────────────────
    CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required"),
    CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
    CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
    CLOUDINARY_FOLDER: z.string().default("yatranepaltours"),
    MAX_VIDEO_UPLOAD_SIZE_MB: z.coerce.number().int().positive().default(50),

    // ── OAuth (shared) ────────────────────────────────────────────
    OAUTH_STATE_SECRET: z
      .string()
      .min(32, "OAUTH_STATE_SECRET must be at least 32 characters")
      .optional(),
    OAUTH_SUCCESS_REDIRECT_URL: z.url().optional(),
    OAUTH_FAILURE_REDIRECT_URL: z.url().optional(),

    // ── OAuth (Google) ────────────────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.url().optional(),

    // ── Admin-portal OAuth (separate redirect URIs from the user flow) ─
    // When ADMIN_GOOGLE_CALLBACK_URL is set, the admin-only OAuth route at
    // /api/v1/auth/admin/google is enabled. Requires the shared OAUTH_*
    // vars already enforced above.
    ADMIN_GOOGLE_CALLBACK_URL: z.url().optional(),
    ADMIN_OAUTH_SUCCESS_REDIRECT_URL: z.url().optional(),
    ADMIN_OAUTH_FAILURE_REDIRECT_URL: z.url().optional(),

    // ── HMAC request signing ──────────────────────────────────────
    HMAC_SECRET: z.string().optional(),
    API_KEY: z.string().optional(),
    REQUEST_TIMESTAMP_TOLERANCE_MS: z.coerce.number().int().positive().optional(),
    HMAC_ENABLED: z
      .union([z.literal("true"), z.literal("false")])
      .default("false")
      .transform((v) => v === "true"),

    // ── Email transport selection ─────────────────────────────────
    // Transactional email (OTP, enquiry notifications, acknowledgements,
    // newsletter, admin invites) picks the first configured transport:
    //   1. RESEND_API_KEY set          → Resend
    //   2. SMTP_HOST + SMTP_USER set   → generic SMTP (nodemailer)
    //   3. ZOHO_* set                  → legacy Zoho SMTP (back-compat)
    //   4. none                        → logged no-op (dev-friendly)
    RESEND_API_KEY: z.string().optional(),

    // ── Generic SMTP (nodemailer) ─────────────────────────────────
    // Works with any provider (Gmail, Zoho, Mailgun, SES, Postmark, a
    // self-hosted relay, or Mailpit/MailHog in local dev).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // true → implicit TLS (port 465); false → STARTTLS (port 587/25).
    SMTP_SECURE: z
      .union([z.literal("true"), z.literal("false")])
      .default("false")
      .transform((v) => v === "true"),

    // Verified sender, e.g. "Nepal Yatra <hello@nepalyatratours.com>".
    // Defaults to Resend's shared test sender for local development.
    EMAIL_FROM: z.string().default("Nepal Yatra <onboarding@resend.dev>"),
    // Optional Reply-To applied to every outgoing email (e.g. a support inbox).
    MAIL_REPLY_TO: z.email().optional(),
    // Brand name used in email headers/footers.
    BRAND_NAME: z.string().default("Nepal Yatra Tours"),

    // ── Lead / enquiry notifications (optional) ───────────────────
    // When set, new public enquiries are emailed to ENQUIRY_NOTIFY_EMAIL.
    // The enquiry is always persisted regardless of email success.
    ENQUIRY_NOTIFY_EMAIL: z.email().optional(),
  })
  .superRefine((data, ctx) => {
    // SameSite=None requires Secure=true (browsers reject the combination
    // otherwise). If someone overrides cookie policy locally, fail fast.
    if (data.COOKIE_SAME_SITE === "none" && data.NODE_ENV !== "production") {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SAME_SITE"],
        message:
          "COOKIE_SAME_SITE=none requires HTTPS (Secure cookies), which is only enabled when NODE_ENV=production. Use `lax` for non-production environments.",
      });
    }

    const googleSet = [
      data.GOOGLE_CLIENT_ID,
      data.GOOGLE_CLIENT_SECRET,
      data.GOOGLE_CALLBACK_URL,
    ].some(Boolean);

    if (googleSet) {
      const requiredWhenGoogle = [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_CALLBACK_URL",
        "OAUTH_STATE_SECRET",
        "OAUTH_SUCCESS_REDIRECT_URL",
        "OAUTH_FAILURE_REDIRECT_URL",
      ] as const;
      for (const key of requiredWhenGoogle) {
        if (!data[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required when Google OAuth is enabled (any GOOGLE_* var set)",
          });
        }
      }
    }

    if (data.ADMIN_GOOGLE_CALLBACK_URL) {
      const requiredForAdminOAuth = [
        "ADMIN_OAUTH_SUCCESS_REDIRECT_URL",
        "ADMIN_OAUTH_FAILURE_REDIRECT_URL",
        "GOOGLE_CLIENT_ID",
      ] as const;
      for (const key of requiredForAdminOAuth) {
        if (!data[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required when ADMIN_GOOGLE_CALLBACK_URL is set",
          });
        }
      }
    }

    if (data.HMAC_ENABLED && (!data.HMAC_SECRET || !data.API_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["HMAC_ENABLED"],
        message: "HMAC_ENABLED=true requires both HMAC_SECRET and API_KEY",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("[env] Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    console.error(`  - ${path}: ${issue.message}`);
  }
  process.exit(1);
}

export type Env = z.infer<typeof envSchema>;
export const env: Env = parsed.data;

/** @deprecated Phase 2 alias — migrate to `env`; alias removed in Phase 7. */
export const ENV = env;
