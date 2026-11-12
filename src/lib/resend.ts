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

const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const BORDER_COLOR = "#EAE1D0";

function buildSignatureHtml(): string {
  const s = senderInfo();
  if (!s.name && !s.company) return "";

  const role = [s.position, s.company].filter(Boolean);
  const roleHtml = role.length
    ? `<div style="margin-top:2px;font-size:13px;line-height:1.5;color:${MUTED_COLOR};">${[
        s.position ? escapeHtml(s.position) : "",
        s.company ? `<span style="color:${BRAND_PRIMARY};font-weight:600;">${escapeHtml(s.company)}</span>` : "",
      ]
        .filter(Boolean)
        .join(" &middot; ")}</div>`
    : "";

  // Une coordonnée par ligne, sans coupure au milieu d'un numéro ou d'une adresse.
  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:${BRAND_PRIMARY};text-decoration:none;">${escapeHtml(label)}</a>`;
  const contacts: string[] = [];
  if (s.phone) contacts.push(link(`tel:${s.phone.replace(/[^+\d]/g, "")}`, s.phone));
  if (s.email) contacts.push(link(`mailto:${s.email}`, s.email));
  if (s.website) contacts.push(link(s.website, s.website.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  const contactsHtml = contacts.length
    ? `<div style="margin-top:8px;font-size:13px;line-height:1.6;">${contacts
        .map((c) => `<div style="white-space:nowrap;">${c}</div>`)
        .join("")}</div>`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr><td style="padding-bottom:18px;"><div style="width:48px;height:2px;background:${BRAND_ACCENT};font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr>
        <td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="vertical-align:top;padding-right:16px;">
                <img src="${escapeHtml(s.logoUrl)}" alt="${escapeHtml(s.company || "Logo")}" width="72" height="48" style="display:block;width:72px;height:48px;border:0;" />
              </td>
              <td style="vertical-align:top;padding-left:16px;border-left:1px solid ${BORDER_COLOR};font-family:${FONT_STACK};">
                ${s.name ? `<div style="font-size:15px;line-height:1.4;font-weight:700;color:${TEXT_COLOR};">${escapeHtml(s.name)}</div>` : ""}
                ${roleHtml}
                ${contactsHtml}
              </td>
            </tr>
          </table>
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
    .map((p) => `<p class="body-text" style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:${TEXT_COLOR};">${escapeHtml(p.trim())}</p>`)
    .join("");
  const company = process.env.SENDER_COMPANY?.trim() || "";
  const address = opts.companyAddress?.trim() || process.env.COMPANY_ADDRESS?.trim() || "";
  const footerText = `margin:0 0 6px 0;font-size:11px;line-height:1.6;color:${MUTED_COLOR};text-align:center;`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(opts.language || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(company || "Message")}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .outer-pad { padding: 12px 8px !important; }
      .card-pad { padding: 28px 22px 26px 22px !important; }
      .foot-pad { padding: 18px 22px 22px 22px !important; }
      .body-text { font-size: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F6F1E7;font-family:${FONT_STACK};-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F6F1E7;">
    <tr>
      <td class="outer-pad" align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#FFFDF9;border-radius:12px;overflow:hidden;border:1px solid ${BORDER_COLOR};">
          <tr>
            <td style="font-size:0;line-height:0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="82%" style="height:4px;background:${BRAND_PRIMARY};font-size:0;line-height:0;">&nbsp;</td>
                  <td width="18%" style="height:4px;background:${BRAND_ACCENT};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="card-pad" style="padding:40px 44px 32px 44px;font-family:${FONT_STACK};">
              ${paragraphs}
              ${buildSignatureHtml()}
            </td>
          </tr>
          <tr>
            <td class="foot-pad" style="padding:20px 44px 26px 44px;background-color:#FAF6EE;border-top:1px solid ${BORDER_COLOR};font-family:${FONT_STACK};">
              <p style="${footerText}">${escapeHtml(copy.why)}</p>
              ${address ? `<p style="${footerText}">${escapeHtml([company, address].filter(Boolean).join(" · "))}</p>` : ""}
              <p style="margin:8px 0 0 0;font-size:11px;line-height:1.6;text-align:center;">
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
