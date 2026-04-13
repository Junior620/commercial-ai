const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const GOOD_PREFIXES = [
  "info",
  "sales",
  "export",
  "contact",
  "procurement",
  "trading",
  "commercial",
  "business",
  "import",
  "office",
  "hello",
  "enquiry",
  "inquiry",
];

const BAD_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|bmp)$/i,
  /\.(?:js|css|woff|ttf|eot)$/i,
  /^(?:no-?reply|unsubscribe|bounce|mailer-daemon|postmaster)/i,
  /example\.com$/i,
  /sentry\.io$/i,
  /cloudflare/i,
  /google(?:usercontent|apis)/i,
  /facebook\.com$/i,
  /twitter\.com$/i,
  /wixpress\.com$/i,
  /wordpress/i,
];

export function extractEmails(html: string): string[] {
  const matches = html.match(EMAIL_REGEX) || [];
  const unique = [...new Set(matches.map((e) => e.toLowerCase()))];

  return unique.filter((email) => {
    if (BAD_PATTERNS.some((pattern) => pattern.test(email))) return false;
    if (email.length > 100) return false;

    const parts = email.split("@");
    if (parts.length !== 2) return false;
    if (parts[1].split(".").length < 2) return false;

    return true;
  });
}

export function rankEmails(emails: string[]): string[] {
  return [...emails].sort((a, b) => {
    const prefixA = a.split("@")[0].toLowerCase();
    const prefixB = b.split("@")[0].toLowerCase();

    const scoreA = GOOD_PREFIXES.findIndex((p) => prefixA.startsWith(p));
    const scoreB = GOOD_PREFIXES.findIndex((p) => prefixB.startsWith(p));

    const rankA = scoreA >= 0 ? scoreA : 999;
    const rankB = scoreB >= 0 ? scoreB : 999;

    return rankA - rankB;
  });
}

export function getBestEmail(emails: string[]): string | null {
  const ranked = rankEmails(emails);
  return ranked.length > 0 ? ranked[0] : null;
}

export async function fetchAndExtractEmails(
  url: string
): Promise<string[]> {
  try {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];
    const html = await response.text();
    return extractEmails(html);
  } catch {
    return [];
  }
}
