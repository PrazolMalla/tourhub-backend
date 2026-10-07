/**
 * Transactional email service.
 *
 * Thin, typed layer over `emailConfig` that renders branded HTML with the
 * helpers in `email.templates.ts`. Every method is best-effort: it returns a
 * boolean and never throws, so callers can fire-and-forget without wrapping in
 * try/catch (email must never break a request).
 */
import emailConfig from "../../config/emailConfig";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { button, esc, infoTable, wrapBranded } from "./email.templates";

export interface EnquiryEmailData {
  name?: string;
  email?: string;
  phone?: string;
  people?: string;
  trip?: string;
  date?: string;
  message?: string;
  source: string;
}

export interface AdminWelcomeData {
  name: string;
  email: string;
  role?: string;
  loginUrl?: string;
  invitedBy?: string;
}

const p = (html: string): string => `<p style="margin:0 0 14px">${html}</p>`;

export class EmailService {
  /** Notify the internal inbox that a new public lead came in. Renders `quote-request.hbs`. */
  static async sendEnquiryAdminNotification(e: EnquiryEmailData): Promise<boolean> {
    const to = env.ENQUIRY_NOTIFY_EMAIL;
    if (!to) return false;

    // wa.me links need digits only (no "+", spaces, or dashes).
    const whatsappNumber = e.phone ? e.phone.replace(/[^\d]/g, "") : "";

    return emailConfig.sendEmail({
      to,
      subject: `New enquiry${e.trip ? ` · ${e.trip}` : ""}${e.name ? ` — ${e.name}` : ""}`,
      template: "quote-request",
      data: {
        appName: env.BRAND_NAME,
        year: new Date().getFullYear(),
        fullName: e.name || "Website visitor",
        email: e.email || "—",
        phone: e.phone || "—",
        travellers: e.people || "—",
        interestedIn: e.trip || e.source,
        preferredDate: e.date || "Not specified",
        message: e.message,
        whatsappNumber,
      },
      // Let staff reply straight to the customer.
      ...(e.email ? { replyTo: e.email } : {}),
    });
  }

  /** Acknowledge the customer's enquiry (only when they provided an email). Renders `enquiry-acknowledgement.hbs`. */
  static async sendEnquiryAcknowledgement(e: EnquiryEmailData): Promise<boolean> {
    if (!e.email) return false;

    return emailConfig.sendEmail({
      to: e.email,
      subject: `Thanks for your enquiry — ${env.BRAND_NAME}`,
      template: "enquiry-acknowledgement",
      data: {
        appName: env.BRAND_NAME,
        year: new Date().getFullYear(),
        name: e.name,
        trip: e.trip,
        message: e.message,
        clientUrl: env.CLIENT_URL,
      },
    });
  }

  /** Welcome a new newsletter subscriber. */
  static async sendNewsletterWelcome(email: string): Promise<boolean> {
    if (!email) return false;
    const content =
      p(`Welcome aboard! 🏔️`) +
      p(
        `You're now subscribed to the <strong>${esc(env.BRAND_NAME)}</strong> newsletter. Expect handpicked treks, seasonal offers and mountain stories — no spam, ever.`,
      ) +
      button("Browse our treks", env.CLIENT_URL);
    const html = wrapBranded(content, {
      heading: "You're subscribed 🎉",
      preheader: "Handpicked treks, seasonal offers and mountain stories.",
    });
    return emailConfig.sendHtml({
      to: email,
      subject: `Welcome to ${env.BRAND_NAME}`,
      html,
    });
  }

  /** Welcome / invite a newly-created admin or staff member. */
  static async sendAdminWelcome(data: AdminWelcomeData): Promise<boolean> {
    if (!data.email) return false;
    const loginUrl = data.loginUrl ?? env.ADMIN_PANEL_URL ?? env.CLIENT_URL;
    const content =
      p(`Hi ${esc(data.name)},`) +
      p(
        `An administrator account has been created for you on the <strong>${esc(env.BRAND_NAME)}</strong> panel${
          data.invitedBy ? ` by ${esc(data.invitedBy)}` : ""
        }.`,
      ) +
      infoTable([
        ["Email", data.email],
        ["Role", data.role],
      ]) +
      p(`Sign in with your email and the password you were given, then change it right away.`) +
      button("Sign in to the admin panel", loginUrl);
    const html = wrapBranded(content, {
      heading: "Your admin account is ready",
      preheader: "An admin account has been created for you.",
    });
    return emailConfig.sendHtml({
      to: data.email,
      subject: `Your ${env.BRAND_NAME} admin account`,
      html,
    });
  }

  /** Security notice sent after a successful password change. */
  static async sendPasswordChangedNotice(name: string, email: string): Promise<boolean> {
    if (!email) return false;
    const content =
      p(`Hi ${esc(name)},`) +
      p(
        `This is a confirmation that the password for your <strong>${esc(env.BRAND_NAME)}</strong> account was just changed.`,
      ) +
      p(
        `<span style="color:#b91c1c">If you didn't do this, please contact us immediately — your account may be at risk.</span>`,
      );
    const html = wrapBranded(content, {
      heading: "Your password was changed",
      preheader: "Confirmation of a recent password change.",
    });
    return emailConfig.sendHtml({
      to: email,
      subject: `Security alert — your password was changed`,
      html,
    });
  }

  /** Log the resolved transport at boot so ops can see how mail will be sent. */
  static async logTransportStatus(): Promise<void> {
    const ok = await emailConfig.verifyTransport();
    if (ok) logger.info("Email transport ready");
    else
      logger.warn(
        "Email transport not configured — set RESEND_API_KEY or SMTP_HOST/SMTP_USER to enable outgoing mail",
      );
  }
}
