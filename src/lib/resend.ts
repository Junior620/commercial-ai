import { Resend } from "resend";
import { getAppUrl, oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/unsubscribe";

// Couleurs de marque SCPB (olive / soleil) pour les emails.
const BRAND_PRIMARY = "#4E5A1F";
const BRAND_ACCENT = "#F7AD21";
const TEXT_COLOR = "#1F2510";
const MUTED_COLOR = "#5F6650";

let _resend: Resend | null = null;
function getResendClient(): Resend | null {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  _resend = new Resend(apiKey);
  return _resend;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    /** true si un nouvel essai a des chances de réussir (429, 5xx, réseau). */
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Clé d'idempotence Resend (24 h) : l'id interne de l'email. */
  idempotencyKey: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id: string;
  simulated: boolean;
}

function fromAddress(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "noreply@example.com";
  const senderName = process.env.SENDER_NAME?.trim();
  const senderCompany = process.env.SENDER_COMPANY?.trim();
  const displayName =
    senderName && senderCompany ? `${senderName} - ${senderCompany}` : senderName || senderCompany || "";
  return displayName ? `${displayName.replace(/[<>"]/g, "")} <${fromEmail}>` : fromEmail;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const resend = getResendClient();
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY non configurée : envoi impossible");
    }
    console.warn(`[resend] RESEND_API_KEY absente : envoi simulé vers ${params.to}`);
    return { id: `simulated-${params.idempotencyKey}`, simulated: true };
  }

  const { data, error } = await resend.emails.send(
    {
      from: fromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo || process.env.RESEND_REPLY_TO?.trim() || process.env.RESEND_FROM_EMAIL?.trim(),
      headers: params.headers,
      tags: params.tags,
    },
    { idempotencyKey: params.idempotencyKey }
  );

  if (error || !data) {
    const status = error?.statusCode ?? 0;
    const retryable = status === 429 || status >= 500 || status === 0;
    throw new EmailSendError(`Resend : ${error?.message || "réponse vide"}`, retryable);
  }
  return { id: data.id, simulated: false };
}

// ─── Contenu ─────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type FooterCopy = { why: string; unsubscribe: string };

const FOOTER_COPY: Record<string, FooterCopy> = {
  fr: {
    why: "Vous recevez ce message car vos coordonnées professionnelles sont publiquement accessibles et en lien avec la filière cacao.",
    unsubscribe: "Ne plus recevoir nos messages",
  },
  en: {
    why: "You are receiving this message because your business contact details are publicly available and relevant to the cocoa industry.",
    unsubscribe: "Unsubscribe",
  },
  es: {
    why: "Recibe este mensaje porque sus datos de contacto profesionales son públicos y están relacionados con el sector del cacao.",
    unsubscribe: "Darse de baja",
  },
  pt: {
    why: "Recebe esta mensagem porque os seus contactos profissionais são públicos e relacionados com o setor do cacau.",
    unsubscribe: "Cancelar subscrição",
  },
  de: {
    why: "Sie erhalten diese Nachricht, weil Ihre geschäftlichen Kontaktdaten öffentlich zugänglich sind und mit der Kakaobranche in Verbindung stehen.",
    unsubscribe: "Abmelden",
  },
};

function footerCopy(lang: string): FooterCopy {
  return FOOTER_COPY[lang] || FOOTER_COPY.en;
}

function senderInfo() {
  const appUrl = getAppUrl();
  return {
    name: process.env.SENDER_NAME?.trim() || "",
    position: process.env.SENDER_POSITION?.trim() || "",
    company: process.env.SENDER_COMPANY?.trim() || "",
    phone: process.env.SENDER_PHONE?.trim() || "",
    website: process.env.SENDER_WEBSITE?.trim() || "",
    email: process.env.RESEND_FROM_EMAIL?.trim() || "",
    logoUrl: process.env.SENDER_LOGO_URL?.trim() || `${appUrl}/email-logo.png`,
  };
}

function buildSignatureHtml(): string {
  const s = senderInfo();
  if (!s.name && !s.company) return "";

  const lines: string[] = [];
  if (s.name) lines.push(`<strong style="color:${TEXT_COLOR};font-size:15px;">${escapeHtml(s.name)}</strong>`);
  if (s.position) lines.push(`<span style="color:${MUTED_COLOR};font-size:13px;">${escapeHtml(s.position)}</span>`);
  if (s.company) lines.push(`<span style="color:${BRAND_PRIMARY};font-weight:600;font-size:14px;">${escapeHtml(s.company)}</span>`);

  const contacts: string[] = [];
  if (s.phone) contacts.push(escapeHtml(s.phone));
  if (s.email) contacts.push(`<a href="mailto:${escapeHtml(s.email)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(s.email)}</a>`);
  if (s.website) {
    contacts.push(
      `<a href="${escapeHtml(s.website)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(s.website.replace(/^https?:\/\//, ""))}</a>`
    );
  }

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:2px solid ${BRAND_ACCENT};padding-top:16px;">
      <tr>
        <td style="vertical-align:top;padding-right:14px;">
          <img src="${escapeHtml(s.logoUrl)}" alt="${escapeHtml(s.company || "Logo")}" width="56" height="37" style="display:block;width:56px;height:auto;" />
        </td>
        <td style="vertical-align:top;font-family:Helvetica,Arial,sans-serif;line-height:1.5;">
          ${lines.join("<br>")}
          ${contacts.length ? `<div style="margin-top:6px;font-size:12px;color:${MUTED_COLOR};">${contacts.join("&nbsp;&middot;&nbsp;")}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

export interface EmailContentOptions {
  /** Destinataire : sert au lien de désinscription. */
  to: string;
  /** Langue du prospect (fr, en, es, pt, de). */
  language: string;
  /** Adresse postale de l'expéditeur (obligation légale). */
  companyAddress?: string | null;
}

export function buildEmailHtml(body: string, opts: EmailContentOptions): string {
  const copy = footerCopy(opts.language);
  const paragraphs = body
    .split(/\n\s*\n|\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => `<p style="margin:0 0 14px 0;line-height:1.65;">${escapeHtml(p.trim())}</p>`)
    .join("");
  const company = process.env.SENDER_COMPANY?.trim() || "";
  const address = opts.companyAddress?.trim() || process.env.COMPANY_ADDRESS?.trim() || "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.language || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(company || "Message")}</title>
</head>
<body style="margin:0;padding:0;background-color:#F8F3EA;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F8F3EA;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#FFFDF8;border-radius:10px;overflow:hidden;border:1px solid #E4D9C6;">
          <tr><td style="height:4px;background:${BRAND_PRIMARY};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:36px 40px 24px 40px;font-size:15px;color:${TEXT_COLOR};line-height:1.65;">
              ${paragraphs}
              ${buildSignatureHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 24px 40px;border-top:1px solid #E4D9C6;">
              <p style="margin:0 0 6px 0;font-size:11px;color:${MUTED_COLOR};line-height:1.5;text-align:center;">${escapeHtml(copy.why)}</p>
              ${address ? `<p style="margin:0 0 6px 0;font-size:11px;color:${MUTED_COLOR};line-height:1.5;text-align:center;">${escapeHtml([company, address].filter(Boolean).join(" · "))}</p>` : ""}
              <p style="margin:0;font-size:11px;line-height:1.5;text-align:center;">
                <a href="${escapeHtml(unsubscribeUrl(opts.to))}" style="color:${MUTED_COLOR};text-decoration:underline;">${escapeHtml(copy.unsubscribe)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmailText(body: string, opts: EmailContentOptions): string {
  const s = senderInfo();
  const copy = footerCopy(opts.language);
  const address = opts.companyAddress?.trim() || process.env.COMPANY_ADDRESS?.trim() || "";
  const signature = [s.name, s.position, s.company, [s.phone, s.email, s.website].filter(Boolean).join(" · ")]
    .filter(Boolean)
    .join("\n");
  return [
    body.trim(),
    signature ? `--\n${signature}` : "",
    "",
    copy.why,
    address ? [s.company, address].filter(Boolean).join(" · ") : "",
    `${copy.unsubscribe} : ${unsubscribeUrl(opts.to)}`,
  ]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n");
}

/** En-têtes exigés par Gmail / Yahoo pour l'envoi en volume (RFC 2369 + RFC 8058). */
export function buildUnsubscribeHeaders(to: string): Record<string, string> {
  const mailto = process.env.RESEND_FROM_EMAIL?.trim();
  const links = [`<${oneClickUnsubscribeUrl(to)}>`];
  if (mailto) links.push(`<mailto:${mailto}?subject=unsubscribe>`);
  return {
    "List-Unsubscribe": links.join(", "),
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
