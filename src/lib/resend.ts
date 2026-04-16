import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY not configured, email not sent");
    return { id: `mock-${Date.now()}` };
  }

  const fromEmail =
    params.from || process.env.RESEND_FROM_EMAIL || "noreply@yourdomain.com";

  const senderName = process.env.SENDER_NAME?.trim();
  const senderCompany = process.env.SENDER_COMPANY?.trim();
  const displayName = senderName && senderCompany
    ? `${senderName} - ${senderCompany}`
    : senderName || senderCompany || "";

  const from = displayName ? `${displayName} <${fromEmail}>` : fromEmail;

  const { data, error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo || fromEmail,
    tags: params.tags,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSignatureHtml(): string {
  const name = process.env.SENDER_NAME?.trim() || "";
  const position = process.env.SENDER_POSITION?.trim() || "";
  const company = process.env.SENDER_COMPANY?.trim() || "";
  const phone = process.env.SENDER_PHONE?.trim() || "";
  const website = process.env.SENDER_WEBSITE?.trim() || "";
  const email = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "";
  const logoUrl =
    process.env.SENDER_LOGO_URL?.trim() ||
    (appUrl ? `${appUrl}/logo.png` : "");

  if (!name && !company) return "";

  const lines: string[] = [];

  if (name) {
    lines.push(
      `<span style="font-weight:600;color:#1a1a1a;font-size:15px;">${escapeHtml(name)}</span>`
    );
  }
  if (position) {
    lines.push(
      `<span style="color:#555;font-size:13px;">${escapeHtml(position)}</span>`
    );
  }
  if (company) {
    lines.push(
      `<span style="font-weight:600;color:#2563eb;font-size:14px;">${escapeHtml(company)}</span>`
    );
  }

  const contactParts: string[] = [];
  if (phone) {
    contactParts.push(
      `<span style="color:#555;">&#9742; ${escapeHtml(phone)}</span>`
    );
  }
  if (email) {
    contactParts.push(
      `<a href="mailto:${escapeHtml(email)}" style="color:#2563eb;text-decoration:none;">&#9993; ${escapeHtml(email)}</a>`
    );
  }
  if (website) {
    const cleanUrl = website.replace(/^https?:\/\//, "");
    contactParts.push(
      `<a href="${escapeHtml(website)}" style="color:#2563eb;text-decoration:none;">&#127760; ${escapeHtml(cleanUrl)}</a>`
    );
  }

  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;border-top:2px solid #2563eb;padding-top:16px;">
      <tr>
        ${
          logoUrl
            ? `<td style="vertical-align:top;padding-right:14px;">
          <img
            src="${escapeHtml(logoUrl)}"
            alt="${escapeHtml(company || "Company logo")}"
            width="52"
            height="52"
            style="display:block;width:52px;height:52px;object-fit:contain;border-radius:8px;background:#fff;"
          />
        </td>`
            : ""
        }
        <td style="vertical-align:top;padding-right:16px;">
          <div style="width:4px;height:60px;background:#2563eb;border-radius:2px;"></div>
        </td>
        <td style="vertical-align:top;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.5;">
          ${lines.join("<br>")}
          ${contactParts.length > 0 ? `<div style="margin-top:6px;font-size:12px;line-height:1.8;">${contactParts.join("&nbsp;&nbsp;|&nbsp;&nbsp;")}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

export function emailBodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n|\n/)
    .filter((p) => p.trim().length > 0)
    .map((p) => {
      const trimmed = p.trim();
      return `<p style="margin:0 0 14px 0;line-height:1.65;">${escapeHtml(trimmed)}</p>`;
    })
    .join("");

  const signature = buildSignatureHtml();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Email</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Outer wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Inner card -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#2563eb,#1e40af);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px 40px;font-size:15px;color:#1a1a1a;line-height:1.65;">
              ${paragraphs}
              ${signature}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px 40px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;color:#999;line-height:1.5;text-align:center;">
                This email was sent by ${escapeHtml(process.env.SENDER_COMPANY?.trim() || "our team")}. If you believe you received this message in error, please disregard it.
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
