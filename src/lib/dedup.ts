/**
 * Domaines partagés par des entreprises distinctes : un même domaine ne prouve
 * pas qu'il s'agit du même prospect.
 */
const SHARED_DOMAINS = new Set([
  "facebook.com", "m.facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com",
  "linktr.ee", "wa.me", "whatsapp.com", "youtube.com", "tiktok.com", "google.com",
  "sites.google.com", "business.site", "wixsite.com", "wordpress.com", "blogspot.com",
  "yolasite.com", "weebly.com", "jimdo.com", "godaddysites.com", "square.site",
  "gmail.com", "yahoo.com", "yahoo.fr", "hotmail.com", "hotmail.fr", "outlook.com",
  "live.com", "orange.fr", "aol.com", "icloud.com",
]);

export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isSharedDomain(domain: string): boolean {
  if (SHARED_DOMAINS.has(domain)) return true;
  return [...SHARED_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

const LEGAL_SUFFIXES =
  /\b(ltd|llc|inc|corp|gmbh|sarl|sarlu|sas|sasu|sa|bv|nv|ag|co|company|group|groupe|international|intl|limited|plc|spa|srl)\b/g;

/**
 * Normalise un nom d'entreprise pour comparaison.
 * Les accents sont retirés mais les écritures non latines (arabe, chinois…) sont conservées.
 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

interface DedupCandidate {
  email?: string | null;
  website?: string | null;
  company: string;
}

/** Clés d'identité d'un prospect (email, domaine propre, nom significatif). */
export function dedupKeys(item: DedupCandidate): string[] {
  const keys: string[] = [];
  if (item.email) keys.push(`email:${normalizeEmail(item.email)}`);
  const domain = normalizeDomain(item.website);
  if (domain && !isSharedDomain(domain)) keys.push(`domain:${domain}`);
  const name = normalizeCompanyName(item.company);
  if (name.length >= 3) keys.push(`name:${name}`);
  return keys;
}

/** Conserve la première occurrence de chaque prospect. */
export function deduplicateItems<T extends DedupCandidate>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const keys = dedupKeys(item);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    result.push(item);
  }
  return result;
}
