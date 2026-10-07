/**
 * Email HTML utilities — a small, dependency-free toolkit for composing
 * transactional emails that render consistently across mail clients (Gmail,
 * Outlook, Apple Mail). Everything is table-based with inline styles because
 * that is the only reliably-supported layout model in email.
 *
 * `wrapBranded()` takes an inner content fragment and wraps it in the branded
 * shell (logo header + footer). The `.hbs` templates under templates/emails
 * render *content only*; the service wraps them so branding lives in one place.
 */
import { env } from "../../config/env";

const BRAND = {
  name: env.BRAND_NAME,
  // Primary green matches the landing site's CTA buttons.
  primary: "#1f8a4c",
  primaryDark: "#166b3a",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  bg: "#f1f5f9",
  card: "#ffffff",
  site: env.CLIENT_URL,
};

/** Escape a user-supplied string for safe inclusion in HTML. */
export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** A primary call-to-action button (bulletproof, table-based for Outlook). */
export const button = (label: string, href: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
    <tr>
      <td align="center" bgcolor="${BRAND.primary}" style="border-radius:10px">
        <a href="${esc(href)}" target="_blank"
           style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;
                  font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">
          ${esc(label)}
        </a>
      </td>
    </tr>
  </table>`;

/**
 * A row of side-by-side action buttons (e.g. WhatsApp + Call), each ~50% wide
 * so the row scales fluidly at any width. The gap between buttons is a
 * dedicated transparent spacer `<td>` — putting padding on the same `<td>` as
 * the button background instead would let the color bleed into the gap and
 * make the buttons look like one solid block with no margin between them.
 */
export const actionButtons = (
  actions: Array<{ label: string; href: string; bg: string }>,
): string => {
  const width = Math.floor(100 / actions.length);
  const cells = actions
    .map(
      (a) => `
      <td width="${width}%" align="center" bgcolor="${a.bg}" style="border-radius:10px">
        <a href="${esc(a.href)}" target="_blank"
           style="display:block;padding:13px 10px;font-family:Arial,Helvetica,sans-serif;
                  font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;
                  border-radius:10px;text-align:center">
          ${esc(a.label)}
        </a>
      </td>`,
    )
    .join(`<td width="12" style="font-size:0;line-height:0">&nbsp;</td>`);

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
    <tr>${cells}</tr>
  </table>`;
};

/** A label/value details table. Rows with an empty value are dropped. */
export const infoTable = (
  rows: Array<[label: string, value: string | number | null | undefined]>,
): string => {
  const body = rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:7px 16px 7px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;vertical-align:top">${esc(label)}</td>
        <td style="padding:7px 0;color:${BRAND.ink};font-size:14px;font-weight:600">${esc(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px">${body}</table>`;
};

/** A muted horizontal divider. */
export const divider = (): string =>
  `<div style="height:1px;background:${BRAND.border};margin:24px 0"></div>`;

/** A quoted message block (e.g. the customer's enquiry text). */
export const quote = (text: string): string => `
  <div style="margin:16px 0;padding:14px 16px;background:${BRAND.bg};border-left:3px solid ${BRAND.primary};
              border-radius:0 8px 8px 0;color:${BRAND.body};font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(
                text,
              )}</div>`;

export interface BrandedEmailOptions {
  /** Hidden preview text shown in the inbox list. */
  preheader?: string;
  /** Optional heading rendered at the top of the card. */
  heading?: string;
}

/**
 * Wrap a content fragment in the full branded, responsive email shell.
 * The content should be a set of block-level fragments (paragraphs, tables,
 * buttons built with the helpers above).
 */
export const wrapBranded = (content: string, opts: BrandedEmailOptions = {}): string => {
  const year = new Date().getFullYear();
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</div>`
    : "";
  const heading = opts.heading
    ? `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${BRAND.ink}">${esc(
        opts.heading,
      )}</h1>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${esc(BRAND.name)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};-webkit-font-smoothing:antialiased">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
            <!-- Header -->
            <tr>
              <td style="padding:8px 4px 20px">
                <a href="${esc(BRAND.site)}" target="_blank" style="text-decoration:none">
                  <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:${BRAND.ink}">${esc(
                    BRAND.name,
                  )}</span>
                </a>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:14px;padding:32px">
                ${heading}
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.body}">
                  ${content}
                </div>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:22px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${BRAND.muted}">
                <p style="margin:0 0 4px">You're receiving this because you contacted ${esc(BRAND.name)}.</p>
                <p style="margin:0">© ${year} ${esc(BRAND.name)} · <a href="${esc(BRAND.site)}" target="_blank" style="color:${BRAND.muted}">${esc(
                  BRAND.site.replace(/^https?:\/\//, ""),
                )}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

export const brand = BRAND;
