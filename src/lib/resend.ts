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
}

export async function sendEmail(params: SendEmailParams) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY not configured, email not sent");
    return { id: `mock-${Date.now()}` };
  }

  const fromEmail =
    params.from || process.env.RESEND_FROM_EMAIL || "noreply@yourdomain.com";

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

export function emailBodyToHtml(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${body
        .split("\n")
        .map((line) => `<p style="margin: 0 0 10px 0;">${line}</p>`)
        .join("")}
    </body>
    </html>
  `;
}
