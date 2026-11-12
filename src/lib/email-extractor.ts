const EMAIL_REGEX = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

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
  "admin",
  "support",
  "general",
  "direction",
  "team",
  "partner",
  "order",
  "orders",
];

const BAD_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|svg|webp|ico|bmp|pdf|zip)$/i,
  /\.(?:js|css|woff|woff2|ttf|eot|map)$/i,
  /^(?:no-?reply|unsubscribe|bounce|mailer-daemon|postmaster|noreply)/i,
  /^(?:test|example|demo|placeholder|changeme|your)/i,
  /example\.com$/i,
  /domain\.com$/i,
  /yourdomain\.com$/i,
  /sentry\.io$/i,
  /cloudflare/i,
  /google(?:usercontent|apis|syndication|mail\.com)/i,
  /facebook\.com$/i,
  /twitter\.com$/i,
  /instagram\.com$/i,
  /linkedin\.com$/i,
  /wixpress\.com$/i,
  /wix\.com$/i,
  /wordpress\.(?:com|org)$/i,
  /squarespace\.com$/i,
  /shopify\.com$/i,
  /mailchimp\.com$/i,
  /hubspot\.com$/i,
  /zendesk\.com$/i,
  /intercom\.io$/i,
  /intercom-mail\.com$/i,
  /(?:mailgun|sendgrid|amazonses|mandrillapp|mcsv|mailchimpapp)\.(?:net|com|org)$/i,
  /github\.com$/i,
  /gravatar\.com$/i,
  /@\d+\.\d+\.\d+/,
  /\.local$/i,
  /localhost/i,
];

const GENERIC_PREFIXES = new Set([
  "webmaster",
  "hostmaster",
  "abuse",
  "spam",
  "root",
  "www",
  "ftp",
  "mail",
  "smtp",
  "pop",
  "imap",
]);

export function extractEmails(html: string): string[] {
  const decoded = html
    .replace(/&#64;/g, "@")
    .replace(/&#x40;/g, "@")
    .replace(/\[at\]/gi, "@")
    .replace(/\(at\)/gi, "@")
    .replace(/\[dot\]/gi, ".")
    .replace(/\(dot\)/gi, ".");

  const matches = decoded.match(EMAIL_REGEX) || [];
  const unique = [...new Set(matches.map((e) => e.toLowerCase().trim()))];

  return unique.filter((email) => {
    if (BAD_PATTERNS.some((pattern) => pattern.test(email))) return false;
    if (email.length > 100 || email.length < 5) return false;

    const parts = email.split("@");
    if (parts.length !== 2) return false;

    const [local, domain] = parts;
    if (!local || !domain) return false;
    if (domain.split(".").length < 2) return false;
    if (domain.split(".").some((seg) => seg.length === 0)) return false;
    if (/^\d+$/.test(local)) return false;
    if (GENERIC_PREFIXES.has(local)) return false;

    const tld = domain.split(".").pop();
    if (!tld || tld.length < 2 || tld.length > 12) return false;

    return true;
  });
}

const SECOND_LEVEL_LABELS = new Set(["co", "com", "net", "org", "gov", "gouv", "edu", "ac", "or", "ne", "go"]);

/** Domaine enregistrable approximatif (ex. « shop.acme.co.uk » → « acme.co.uk »). */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const sld = parts[parts.length - 2];
  // co.uk, com.br, co.ci, gouv.fr…
  const twoLevel = SECOND_LEVEL_LABELS.has(sld) && parts[parts.length - 1].length === 2;
  return parts.slice(twoLevel ? -3 : -2).join(".");
}

/** true si l'email appartient au domaine du site (même domaine enregistrable). */
export function emailMatchesDomain(email: string, siteDomain: string | null | undefined): boolean {
  if (!siteDomain) return false;
  const emailDomain = email.split("@")[1]?.toLowerCase();
  if (!emailDomain) return false;
  return baseDomain(emailDomain) === baseDomain(siteDomain);
}

export function scoreEmail(email: string, siteDomain?: string): number {
  const prefix = email.split("@")[0].toLowerCase();
  const emailDomain = email.split("@")[1].toLowerCase();

  let score = 0;

  const prefixIdx = GOOD_PREFIXES.findIndex((p) => prefix.startsWith(p));
  if (prefixIdx >= 0) {
    score += 100 - prefixIdx;
  }

  if (siteDomain && emailDomain.includes(siteDomain.replace(/^www\./, ""))) {
    score += 200;
  }

  const personalParts = prefix.split(/[._\-]/);
  if (
    personalParts.length === 2 &&
    personalParts[0].length >= 2 &&
    personalParts[1].length >= 2 &&
    /^[a-z]+$/.test(personalParts[0]) &&
    /^[a-z]+$/.test(personalParts[1])
  ) {
    score += 50;
  }

  if (/^[a-z]{1,2}\d{2,}@/i.test(email)) score -= 80;
  if (prefix.length > 30) score -= 40;

  return score;
}

export function rankEmails(
  emails: string[],
  siteDomain?: string
): string[] {
  return [...emails].sort(
    (a, b) => scoreEmail(b, siteDomain) - scoreEmail(a, siteDomain)
  );
}

export function getBestEmail(
  emails: string[],
  siteDomain?: string
): string | null {
  const ranked = rankEmails(emails, siteDomain);
  return ranked.length > 0 ? ranked[0] : null;
}

export function extractContactName(html: string): string | null {
  const schemaMatch = html.match(
    /"(?:name|contactPoint|author)"\s*:\s*"([A-Z][a-zÀ-ÿ]+(?: [A-Z][a-zÀ-ÿ]+)+)"/
  );
  if (schemaMatch) return schemaMatch[1];

  const metaAuthor = html.match(
    /<meta[^>]+name=["']author["'][^>]+content=["']([^"']{3,60})["']/i
  );
  if (metaAuthor) {
    const name = metaAuthor[1].trim();
    if (/^[A-Z][a-zÀ-ÿ]+(?: [A-Z][a-zÀ-ÿ]+)+$/.test(name)) return name;
  }

  const contactLine = html.match(
    /(?:Contact|Owner|Manager|Director|CEO|Founder|Gérant|Directeur)\s*[:\-–]\s*([A-Z][a-zÀ-ÿ]+(?: [A-Z][a-zÀ-ÿ]+){1,3})/
  );
  if (contactLine) return contactLine[1];

  const emails = extractEmails(html);
  for (const em of emails) {
    const prefix = em.split("@")[0];
    const parts = prefix.split(/[._\-]/);
    if (
      parts.length === 2 &&
      parts[0].length >= 2 &&
      parts[1].length >= 2 &&
      /^[a-z]+$/.test(parts[0]) &&
      /^[a-z]+$/.test(parts[1])
    ) {
      return (
        parts[0].charAt(0).toUpperCase() +
        parts[0].slice(1) +
        " " +
        parts[1].charAt(0).toUpperCase() +
        parts[1].slice(1)
      );
    }
  }

  return null;
}

const CONTACT_PATHS = [
  "",
  "/contact",
  "/contact-us",
  "/contactez-nous",
  "/kontakt",
  "/about",
  "/about-us",
  "/a-propos",
  "/impressum",
  "/imprint",
];

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SCPBProspectBot/1.0)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
};

const MAX_PAGE_BYTES = 500_000;
const MAX_REDIRECTS = 3;

/** Refuse les hôtes internes (protection SSRF : métadonnées cloud, réseau privé). */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  if (host.includes(":")) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host === "::";
  }
  return false;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

async function fetchPage(url: string, timeoutMs = 12000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = new URL(current);
      if (!["http:", "https:"].includes(parsed.protocol) || isPrivateHost(parsed.hostname)) return "";

      const response = await fetch(current, {
        signal: controller.signal,
        headers: FETCH_HEADERS,
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return "";
        current = new URL(location, current).href;
        continue;
      }
      if (!response.ok) return "";
      const ct = response.headers.get("content-type") || "";
      if (!ct.includes("text/html") && !ct.includes("text/plain") && !ct.includes("application/xhtml")) return "";
      return await readLimited(response, MAX_PAGE_BYTES);
    }
    return "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(raw: string): string {
  if (!raw.startsWith("http")) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return raw;
  }
}

export interface SiteExtractionResult {
  emails: string[];
  contactName: string | null;
  pagesScanned: number;
}

export async function fetchAndExtractFromSite(
  rawUrl: string
): Promise<SiteExtractionResult> {
  const base = normalizeUrl(rawUrl);
  const domain = base.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const allEmails = new Set<string>();
  let contactName: string | null = null;
  let pagesScanned = 0;

  const homeHtml = await fetchPage(base);
  if (homeHtml) {
    pagesScanned++;
    for (const e of extractEmails(homeHtml)) allEmails.add(e);
    contactName = extractContactName(homeHtml);
  }

  const contactLinks = extractInternalContactLinks(homeHtml, base);

  const pathsToTry = new Set<string>();
  for (const p of CONTACT_PATHS) {
    if (p) pathsToTry.add(`${base}${p}`);
  }
  for (const link of contactLinks) {
    pathsToTry.add(link);
  }

  const extra = [...pathsToTry].filter((u) => u !== base).slice(0, 6);

  const settled = await Promise.allSettled(
    extra.map((u) => fetchPage(u, 10000))
  );

  for (const r of settled) {
    if (r.status !== "fulfilled" || !r.value) continue;
    pagesScanned++;
    const html = r.value;
    for (const e of extractEmails(html)) allEmails.add(e);
    if (!contactName) contactName = extractContactName(html);
  }

  const filtered = [...allEmails].filter((e) => {
    return !BAD_PATTERNS.some((p) => p.test(e));
  });

  return {
    emails: rankEmails(filtered, domain),
    contactName,
    pagesScanned,
  };
}

function extractInternalContactLinks(
  html: string,
  baseUrl: string
): string[] {
  if (!html) return [];
  const links: string[] = [];
  const regex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    if (
      /contact|about|impressum|imprint|a-propos|kontakt|nous-joindre|join/i.test(
        href
      )
    ) {
      try {
        const resolved = new URL(href, baseUrl).href;
        if (resolved.startsWith(baseUrl)) {
          links.push(resolved);
        }
      } catch {
        /* malformed href */
      }
    }
  }
  return [...new Set(links)].slice(0, 5);
}

export async function fetchAndExtractEmails(url: string): Promise<string[]> {
  const result = await fetchAndExtractFromSite(url);
  return result.emails;
}
