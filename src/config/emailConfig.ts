import * as nodemailer from "nodemailer";
import { Resend } from "resend";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Email transport selection (first configured wins):
 *   1. RESEND_API_KEY set          → Resend (recommended for prod).
 *   2. SMTP_HOST + SMTP_USER set   → generic SMTP via nodemailer (any provider:
 *                                    Gmail, Zoho, Mailgun, SES, Postmark, a
 *                                    self-hosted relay, or Mailpit in dev).
 *   3. ZOHO_* set                  → legacy Zoho SMTP (kept for back-compat).
 *   4. none                        → log and skip (dev-friendly no-op).
 *
 * `sendEmail` renders a Handlebars template; `sendHtml` sends ready HTML.
 */

let transporter: nodemailer.Transporter | null = null;
let resend: Resend | null = null;

const initTransports = (): void => {
  // TEMP DEBUG: print exactly which env vars the running process actually
  // sees, so a prod-vs-local mismatch (missing var, wrong file loaded, etc.)
  // shows up immediately in the deploy logs instead of failing silently.
  console.error("[email] initTransports() called", {
    NODE_ENV: env.NODE_ENV,
    hasResendKey: Boolean(env.RESEND_API_KEY),
    hasSmtpHost: Boolean(env.SMTP_HOST),
    hasSmtpUser: Boolean(env.SMTP_USER),
    hasZohoUser: Boolean(process.env.ZOHO_USER),
    alreadyHaveResend: Boolean(resend),
    alreadyHaveTransporter: Boolean(transporter),
  });

  // Resend takes priority when configured.
  if (env.RESEND_API_KEY && !resend) {
    resend = new Resend(env.RESEND_API_KEY);
    console.error("[email] Resend transport initialized");
    logger.info("Email: Resend transport initialized");
    return;
  }
  if (env.RESEND_API_KEY) return;

  if (transporter) return;

  // Generic SMTP (preferred): configured via SMTP_* env vars.
  if (env.SMTP_HOST && env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true for 465, false for 587/25 (STARTTLS)
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      tls: { rejectUnauthorized: env.NODE_ENV === "production" },
    });
    console.error("[email] generic SMTP transport initialized", {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
    });
    logger.info("Email: generic SMTP transport initialized", {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
    });
    return;
  }

  // Legacy Zoho SMTP (back-compat with older deployments).
  if (process.env.ZOHO_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.ZOHO_HOST || "smtp.zeptomail.com",
      port: Number(process.env.ZOHO_PORT) || 465,
      secure: true,
      auth: { user: process.env.ZOHO_USER, pass: process.env.ZOHO_PASS },
      tls: { rejectUnauthorized: true },
    });
    console.error("[email] legacy Zoho SMTP transport initialized");
    logger.info("Email: legacy Zoho SMTP transport initialized");
    return;
  }

  console.error(
    "[email] NO TRANSPORT CONFIGURED — RESEND_API_KEY, SMTP_HOST/SMTP_USER, and ZOHO_USER are all unset in this process's env. Emails will be skipped.",
  );
};

const loadTemplate = async (templateName: string) => {
  const templatePath = path.join(__dirname, "../templates/emails", `${templateName}.hbs`);
  const template = await fs.readFile(templatePath, "utf-8");
  return handlebars.compile(template);
};

/** Low-level send used by both helpers. Returns true if a transport accepted it. */
const dispatch = async (
  to: string | string[],
  subject: string,
  html: string,
  replyTo?: string,
): Promise<boolean> => {
  initTransports();
  const from = env.EMAIL_FROM;
  const reply = replyTo ?? env.MAIL_REPLY_TO;

  console.error("[email] dispatch() attempting send", {
    to,
    subject,
    from,
    reply,
    via: resend ? "resend" : transporter ? "smtp" : "none",
  });

  if (resend) {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(reply ? { replyTo: reply } : {}),
    });
    if (error) {
      // Full error object (not just .message) — Resend puts the useful bit
      // (unverified domain, invalid "from", bad API key, etc.) in `.name`/
      // other fields that String(error) or error.message alone can hide.
      console.error("[email] Resend send failed", { to, subject, from, error });
      logger.error("Email (Resend) failed", { error: String(error.message ?? error) });
      return false;
    }
    console.error("[email] Resend send succeeded", { id: data?.id, to });
    logger.info("Email sent via Resend", { id: data?.id, to });
    return true;
  }

  if (transporter) {
    const result = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      ...(reply ? { replyTo: reply } : {}),
    });
    console.error("[email] SMTP send succeeded", { messageId: result.messageId, to });
    logger.info("Email sent via SMTP", { messageId: result.messageId, to });
    return true;
  }

  console.error("[email] Email skipped — no transport configured", { to, subject });
  logger.warn("Email skipped — no transport configured (set RESEND_API_KEY)", { to, subject });
  return false;
};

const sendEmail = async ({
  to,
  subject,
  template,
  data,
  replyTo,
}: {
  to: string;
  subject: string;
  template: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  replyTo?: string;
}): Promise<boolean> => {
  try {
    const compiled = await loadTemplate(template);
    return await dispatch(to, subject, compiled(data), replyTo);
  } catch (error) {
    // Logged with the raw error (not stringified) so a template-file-not-found
    // in the deployed `dist` (a common prod-only failure — .hbs files not
    // copied by the build) shows its real stack instead of "[object Object]".
    console.error("[email] sendEmail() threw", { to, subject, template, error });
    logger.error("Email sending failed", { error: String(error) });
    return false;
  }
};

const sendHtml = async ({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> => {
  try {
    return await dispatch(to, subject, html, replyTo);
  } catch (error) {
    console.error("[email] sendHtml() threw", { to, subject, error });
    logger.error("Email sending failed", { error: String(error) });
    return false;
  }
};

/** Verify the active SMTP transport (nodemailer only; Resend has no verify step). */
const verifyTransport = async (): Promise<boolean> => {
  initTransports();
  if (resend) return true;
  if (!transporter) return false;
  try {
    await transporter.verify();
    return true;
  } catch (error) {
    logger.error("SMTP verify failed", { error: String(error) });
    return false;
  }
};

const initializeEmail = (): void => initTransports();

const emailConfig = {
  initializeEmail,
  sendEmail,
  sendHtml,
  verifyTransport,
};

export default emailConfig;
