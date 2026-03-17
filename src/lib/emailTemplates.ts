type EmailCta = {
  label: string;
  href: string;
};

export type BaseEmailInput = {
  subject: string;
  greeting?: string;
  intro?: string;
  sections?: Array<{ title?: string; lines: string[] }>;
  cta?: EmailCta;
  footer?: string[];
};

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLines(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((l) => `<div style="margin:0 0 8px 0;">${escapeHtml(l)}</div>`)
    .join("");
}

export function getAppBaseUrl() {
  const raw = process.env.APP_BASE_URL?.trim();
  if (!raw) return null;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function renderBaseEmail(input: BaseEmailInput) {
  const greeting = input.greeting ? escapeHtml(input.greeting) : "";
  const intro = input.intro ? `<div style="margin:0 0 14px 0;">${escapeHtml(input.intro)}</div>` : "";

  const sectionsHtml = (input.sections || [])
    .map((s) => {
      const title = s.title ? `<div style="font-weight:600;margin:18px 0 10px 0;">${escapeHtml(s.title)}</div>` : "";
      return `${title}<div style="margin:0;">${renderLines(s.lines)}</div>`;
    })
    .join("");

  const ctaHtml = input.cta
    ? `
      <div style="margin:22px 0 6px 0;">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:600;">
          ${escapeHtml(input.cta.label)}
        </a>
      </div>
      <div style="margin:8px 0 0 0;color:#6b7280;font-size:12px;">Jika tombol tidak bisa dibuka, copy link ini: ${escapeHtml(
        input.cta.href
      )}</div>
    `
    : "";

  const footerLines = input.footer?.length
    ? input.footer
        .filter(Boolean)
        .map((l) => `<div style="margin:0 0 6px 0;">${escapeHtml(l)}</div>`)
        .join("")
    : `<div style="margin:0 0 6px 0;">PPI Curug Simulator Training</div>`;

  // Email-safe table layout.
  return `
  <div style="background:#f3f4f6;padding:24px 12px;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="padding:0 0 12px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111827;">
          <div style="font-weight:800;font-size:18px;letter-spacing:0.2px;">PPI Curug Simulator Training</div>
          <div style="color:#6b7280;font-size:12px;margin-top:2px;">Notifikasi otomatis</div>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-radius:14px;padding:22px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111827;">
          <div style="font-size:18px;font-weight:700;margin:0 0 12px 0;">${escapeHtml(input.subject)}</div>
          ${greeting ? `<div style="margin:0 0 12px 0;">${greeting}</div>` : ""}
          ${intro}
          ${sectionsHtml}
          ${ctaHtml}
          <div style="margin:22px 0 0 0;border-top:1px solid #e5e7eb;padding-top:14px;color:#6b7280;font-size:12px;">
            ${footerLines}
          </div>
        </td>
      </tr>
    </table>
  </div>`;
}
