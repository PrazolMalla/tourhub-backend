import { env } from "../config/env";

/**
 * AppConstants
 *
 * Centralized, frozen configuration constants used across the application.
 * All magic values live here — never scatter raw numbers or strings in business logic.
 */
export class AppConstants {
  // ─── Authentication ────────────────────────────────────────────
  static readonly BCRYPT_SALT_ROUNDS = 10;
  static readonly JWT_EXPIRY = "7d";
  static readonly JWT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  // ─── OTP ───────────────────────────────────────────────────────
  static readonly OTP_LENGTH = 6;
  static readonly OTP_EXPIRY_MINUTES = 15;
  static readonly OTP_EXPIRY_MS = 15 * 60 * 1000;

  // ─── Cookie ────────────────────────────────────────────────────
  static readonly AUTH_COOKIE_NAME = "access_token";
  static readonly REFRESH_COOKIE_NAME = "refresh_token";
  static readonly REFRESH_COOKIE_PATH = "/api/v1/auth";
  static readonly AUTH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

  // ─── Rate Limiting ─────────────────────────────────────────────
  // Sourced from env (see config/env.ts) so values can be tuned per
  // environment without a redeploy. Defaults there match the previous
  // hardcoded values below.
  static readonly RATE_LIMIT_GLOBAL_WINDOW_MS = env.RATE_LIMIT_GLOBAL_WINDOW_MS;
  static readonly RATE_LIMIT_GLOBAL_MAX = env.RATE_LIMIT_GLOBAL_MAX;

  static readonly RATE_LIMIT_AUTH_WINDOW_MS = env.RATE_LIMIT_AUTH_WINDOW_MS;
  static readonly RATE_LIMIT_AUTH_MAX = env.RATE_LIMIT_AUTH_MAX;

  static readonly RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS = env.RATE_LIMIT_PUBLIC_SUBMIT_WINDOW_MS;
  static readonly RATE_LIMIT_PUBLIC_SUBMIT_MAX = env.RATE_LIMIT_PUBLIC_SUBMIT_MAX;

  static readonly RATE_LIMIT_PUBLIC_API_WINDOW_MS = env.RATE_LIMIT_PUBLIC_API_WINDOW_MS;
  static readonly RATE_LIMIT_PUBLIC_API_MAX = env.RATE_LIMIT_PUBLIC_API_MAX;

  // Money endpoints: stricter than `auth` because the cost-per-call is high
  // (each payment-initiate hits eSewa, each order-create touches stock).
  // See qa-test.md#M-1.
  static readonly RATE_LIMIT_MONEY_WINDOW_MS = env.RATE_LIMIT_MONEY_WINDOW_MS;
  static readonly RATE_LIMIT_MONEY_MAX = env.RATE_LIMIT_MONEY_MAX;

  // ─── Email ─────────────────────────────────────────────────────
  static readonly EMAIL_FROM_NAME = "Support";
  static readonly EMAIL_SUBJECT_OTP = "Your Password Reset OTP";

  // ─── Roles ─────────────────────────────────────────────────────
  static readonly ROLE_SUPERADMIN = "superadmin";
  static readonly ROLE_ADMIN = "admin";
  static readonly ROLE_USER = "user";
  static readonly ALL_ROLES = ["superadmin", "admin", "user"] as const;
  static readonly STAFF_ROLES = ["superadmin", "admin"] as const;

  // ─── Order ─────────────────────────────────────────────────────
  /**
   * Fulfillment lifecycle ONLY. Does not encode payment state — product and
   * shipping payments live on their own status fields and never auto-sync
   * with order status. Transitions are validated by the service layer:
   *
   *   placed → contacted | cancelled
   *   contacted → processing | cancelled
   *   processing → shipped | cancelled
   *   shipped → delivered | cancelled
   *   delivered → (terminal)
   *   cancelled → (terminal)
   */
  static readonly ORDER_STATUSES = [
    "placed",
    "contacted",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ] as const;
  /**
   * `COD` / `ONLINE` are the two methods the customer actually sees; admins
   * mark which one they collected. `STRIPE` / `ESEWA` / `KHALTI` remain in the
   * union so historical orders + the eSewa integration code stay typed, but
   * customers can't pick them at checkout right now.
   */
  static readonly PAYMENT_METHODS = ["COD", "ONLINE", "STRIPE", "ESEWA", "KHALTI"] as const;
  /**
   * Product payment lifecycle. Covers payment for items only — never shipping.
   *   pending → paid | failed
   *   failed  → pending | paid
   *   paid    → refunded
   *   refunded → (terminal)
   */
  static readonly PRODUCT_PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
  /**
   * Shipping payment lifecycle. Independent from product payment.
   *   unpaid  → pending | paid | waived
   *   pending → paid
   *   paid    → (terminal)
   *   waived  → (terminal)
   *
   * "waived" zeroes the shipping cost in the order total; "unpaid"/"pending"
   * keep the shipping cost on the bill but DO NOT count as confirmed revenue.
   */
  static readonly SHIPPING_PAYMENT_STATUSES = ["unpaid", "pending", "paid", "waived"] as const;
  /**
   * Kept as an alias of {@link PRODUCT_PAYMENT_STATUSES} because the
   * payment-transaction log records gateway events (initiate/payment/refund)
   * with this exact vocabulary — independent of whether the txn belongs to
   * the product or shipping stream.
   */
  static readonly PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
  /** Caps for money fields — defends against typo overflows. */
  static readonly ORDER_MAX_SHIPPING_FEE = 1_000_000;
  static readonly ORDER_MAX_DISCOUNT = 1_000_000;

  // ─── HMAC Security ─────────────────────────────────────────────
  // The real HMAC_SECRET / API_KEY live in env.ts. There used to be hardcoded
  // dev-defaults here but they're gone now (see qa-test.md#M-2) — if HMAC
  // signing is enabled with the env vars unset, the schema will fail fast
  // rather than fall back to a known-weak constant.
  static readonly REQUEST_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 min replay window

  // ─── Prevent instantiation ─────────────────────────────────────
  private constructor() {}
}
