export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(
      url.startsWith("http") ? url : `https://${url}`
    ).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(
      /\b(ltd|llc|inc|corp|gmbh|sarl|sas|sa|bv|nv|ag|co|company|group|international|intl)\b/g,
      ""
    )
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

export function findDuplicates<T extends DedupCandidate>(
  items: T[]
): Map<number, number[]> {
  const duplicateGroups = new Map<number, number[]>();
  const emailIndex = new Map<string, number>();
  const domainIndex = new Map<string, number>();
  const nameIndex = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let matchIdx: number | undefined;

    if (item.email) {
      const normEmail = normalizeEmail(item.email);
      if (emailIndex.has(normEmail)) {
        matchIdx = emailIndex.get(normEmail);
      } else {
        emailIndex.set(normEmail, i);
      }
    }

    if (matchIdx === undefined && item.website) {
      const domain = normalizeDomain(item.website);
      if (domain) {
        if (domainIndex.has(domain)) {
          matchIdx = domainIndex.get(domain);
        } else {
          domainIndex.set(domain, i);
        }
      }
    }

    if (matchIdx === undefined) {
      const normName = normalizeCompanyName(item.company);
      if (normName.length > 2) {
        if (nameIndex.has(normName)) {
          matchIdx = nameIndex.get(normName);
        } else {
          nameIndex.set(normName, i);
        }
      }
    }

    if (matchIdx !== undefined && matchIdx !== i) {
      if (!duplicateGroups.has(matchIdx)) {
        duplicateGroups.set(matchIdx, [matchIdx]);
      }
      duplicateGroups.get(matchIdx)!.push(i);
    }
  }

  return duplicateGroups;
}

export function deduplicateItems<T extends DedupCandidate>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const keys: string[] = [];

    if (item.email) keys.push(`email:${normalizeEmail(item.email)}`);
    if (item.website) {
      const domain = normalizeDomain(item.website);
      if (domain) keys.push(`domain:${domain}`);
    }
    keys.push(`name:${normalizeCompanyName(item.company)}`);

    const isDuplicate = keys.some((k) => seen.has(k));
    if (!isDuplicate) {
      keys.forEach((k) => seen.add(k));
      result.push(item);
    }
  }

  return result;
}
