import Papa from "papaparse";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  abortApifyRun,
  getApifyRunStatuses,
  getScrapingResults,
  scrapeContactInfo,
  scrapeGoogleMaps,
  scrapeWebsiteContent,
  searchGoogleForEmails,
  type ScrapedPlace,
} from "@/lib/apify";
import { calculateLeadScore, inferClientType, inferProduct, priorityFromScore } from "@/lib/scoring";
import { deduplicateItems, normalizeDomain } from "@/lib/dedup";
import { classifyTarget } from "@/lib/targeting";
import { inferProspectLanguageFromCountry, normalizeCountryToIso2 } from "@/lib/prospect-language";
import { emailMatchesDomain, extractEmails, fetchAndExtractFromSite, getBestEmail } from "@/lib/email-extractor";

// ─── Plafonds de coût et de charge ───────────────────────────────

export const SCRAPING_LIMITS = {
  maxKeywords: 50,
  defaultKeywords: 25,
  maxResultsPerSearch: 200,
  defaultResultsPerSearch: 60,
  maxCountries: 10,
  maxPlaces: 1500,
  contact: { maxSites: 200, chunk: 20, requestsPerUrl: 2 },
  deepContact: { maxSites: 100, chunk: 15, requestsPerUrl: 6 },
  googleSearch: { maxQueries: 60, chunk: 10 },
  websiteCrawler: { maxSites: 80, chunk: 12 },
  fallback: { maxSites: 150, chunk: 10 },
  mapsPoll: { intervalSeconds: 30, maxAttempts: 120 },
} as const;

const CSV_PRODUCT_SUBCATEGORIES = new Set([
  "cocoa beans", "cocoa butter", "cocoa powder", "cocoa mass/liquor", "derivatives", "cosmetics",
  "food/chocolate", "coffee beans", "green coffee", "ground coffee", "instant coffee", "agri-tech",
  "packaging", "machinery", "compliance", "finance", "circular",
]);

// ─── Types sérialisables (stockés entre les étapes Inngest) ──────

export type EmailSource = "maps" | "apify" | "deep-apify" | "google-search" | "web-crawler" | "fallback";

export interface EnrichedPlace {
  place: ScrapedPlace;
  domain: string | null;
  emails: string[];
  contactName: string | null;
  emailSource: EmailSource | null;
}

export interface RunEntry {
  runId: string;
  label: string;
}

// ─── Mots-clés ───────────────────────────────────────────────────

/** Ordre de priorité des catégories : le cœur de cible (fèves et dérivés) d'abord. */
const CATEGORY_PRIORITY = ["focus", "buyer", "trader", "product", "general"];

function rank(category: string): number {
  const i = CATEGORY_PRIORITY.indexOf(category);
  return i === -1 ? CATEGORY_PRIORITY.length : i;
}

/**
 * Sélectionne les mots-clés de recherche.
 * Les lignes du CSV sont groupées par sous-catégorie (produit) puis prises à tour de rôle,
 * pour que 25 mots-clés couvrent fèves, beurre, masse et poudre au lieu des 25 premières lignes.
 */
export function buildKeywords(input: {
  categories?: string[];
  countries?: string[];
  product?: string;
  customKeywords?: string[];
  maxKeywords?: number;
}): string[] {
  const limit = Math.min(SCRAPING_LIMITS.maxKeywords, Math.max(1, input.maxKeywords || SCRAPING_LIMITS.defaultKeywords));
  const custom = (input.customKeywords || []).map((k) => k.trim()).filter(Boolean);
  const groups = new Map<string, string[]>();

  try {
    const csv = readFileSync(join(process.cwd(), "data", "cocoa_keywords_scraping.csv"), "utf-8");
    const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const rows = data
      .filter((row) => !input.categories?.length || input.categories.includes(row.category))
      .filter((row) => !(input.product && CSV_PRODUCT_SUBCATEGORIES.has(row.subcategory) && row.subcategory !== input.product))
      .filter((row) => !(input.countries?.length && row.geo_scope === "country" && !input.countries.includes(row.country)))
      .sort((a, b) => rank(a.category) - rank(b.category));
    for (const row of rows) {
      const key = `${row.category}:${row.subcategory}`;
      const list = groups.get(key) ?? [];
      if (row.keyword?.trim()) list.push(row.keyword.trim());
      groups.set(key, list);
    }
  } catch {
    // CSV absent : seuls les mots-clés personnalisés sont utilisés.
  }

  const picked = [...custom];
  const queues = [...groups.values()];
  while (queues.some((q) => q.length) && picked.length < limit * 2) {
    for (const q of queues) {
      const next = q.shift();
      if (next) picked.push(next);
    }
  }
  return [...new Set(picked)].slice(0, limit);
}

// ─── Suivi du job ────────────────────────────────────────────────

export async function persistProgress(
  jobId: string,
  progress: { phase: string; percent: number; detail?: string; runs?: RunEntry[] }
) {
  try {
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: { progress: { ...progress, updatedAt: new Date().toISOString() } as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    console.warn("[scraping] progression non enregistrée :", e instanceof Error ? e.message : e);
  }
}

export async function isJobCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.scrapingJob.findUnique({ where: { id: jobId }, select: { status: true } });
  return !job || job.status === "CANCELLED";
}

export async function markJobFailed(jobId: string, message: string) {
  await prisma.scrapingJob.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: { status: "FAILED", errorMessage: message.slice(0, 2000), completedAt: new Date() },
  });
}

export async function abortRuns(runs: RunEntry[]) {
  await Promise.all(runs.map((r) => abortApifyRun(r.runId)));
}

// ─── Phase 1 : Google Maps ───────────────────────────────────────

export async function startMapsRuns(keywords: string[], countries: string[], maxResults: number): Promise<RunEntry[]> {
  const targets = countries.length ? countries.slice(0, SCRAPING_LIMITS.maxCountries) : [undefined];
  const runs: RunEntry[] = [];
  for (const country of targets) {
    const { runId } = await scrapeGoogleMaps({ keywords, country, maxResults });
    runs.push({ runId, label: country || "Recherche globale" });
  }
  return runs;
}

/** « done » quand plus aucun run n'est en cours. */
export async function pollMapsRuns(runs: RunEntry[]): Promise<{ done: boolean; statuses: string[] }> {
  const statuses = await getApifyRunStatuses(runs.map((r) => r.runId));
  const done = statuses.every((s) => !["READY", "RUNNING"].includes(s.status));
  return { done, statuses: statuses.map((s) => s.status) };
}

export async function fetchMapsPlaces(runs: RunEntry[]): Promise<{ places: EnrichedPlace[]; errors: string[] }> {
  const errors: string[] = [];
  let all: ScrapedPlace[] = [];
  for (const run of runs) {
    try {
      all = all.concat(await getScrapingResults(run.runId));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const places = all.slice(0, SCRAPING_LIMITS.maxPlaces).map((place) => {
    const slim: ScrapedPlace = { ...place, description: place.description?.slice(0, 400) };
    const emails = place.email ? extractEmails(place.email) : [];
    return {
      place: slim,
      domain: normalizeDomain(place.website),
      emails,
      contactName: null,
      emailSource: emails.length ? ("maps" as const) : null,
    };
  });
  return { places, errors };
}

// ─── Phases d'enrichissement ─────────────────────────────────────

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function sitesWithoutEmail(places: EnrichedPlace[], max: number): string[] {
  return places.filter((p) => p.emails.length === 0 && p.place.website).map((p) => p.place.website!).slice(0, max);
}

/** Emails par domaine, issus du Contact Info Scraper (un appel Apify par lot). */
export async function contactInfoBatch(urls: string[], requestsPerUrl: number): Promise<Record<string, string[]>> {
  const map = await scrapeContactInfo(urls, { chunkSize: urls.length, maxRequestsPerStartUrl: requestsPerUrl });
  const out: Record<string, string[]> = {};
  for (const [domain, value] of map) out[domain] = value.emails.flatMap((e) => extractEmails(e));
  return out;
}

export async function websiteCrawlerBatch(urls: string[]): Promise<Record<string, string[]>> {
  const map = await scrapeWebsiteContent(urls, { chunkSize: urls.length });
  const out: Record<string, string[]> = {};
  for (const [domain, value] of map) out[domain] = extractEmails(value.texts.join(" "));
  return out;
}

export function googleSearchQuery(entry: EnrichedPlace): string {
  return entry.domain ? `"${entry.domain}" email contact` : `"${entry.place.title}" email contact`;
}

export async function googleSearchBatch(queries: string[]): Promise<Record<string, string[]>> {
  const map = await searchGoogleForEmails(queries, { chunkSize: queries.length });
  return Object.fromEntries(map);
}

export async function fallbackBatch(
  urls: string[]
): Promise<Record<string, { emails: string[]; contactName: string | null }>> {
  const settled = await Promise.allSettled(urls.map((u) => fetchAndExtractFromSite(u)));
  const out: Record<string, { emails: string[]; contactName: string | null }> = {};
  settled.forEach((r, i) => {
    const domain = normalizeDomain(urls[i]);
    if (domain && r.status === "fulfilled") out[domain] = { emails: r.value.emails, contactName: r.value.contactName };
  });
  return out;
}

/** Fusionne des emails trouvés par domaine dans les fiches encore sans email. */
export function mergeByDomain(
  places: EnrichedPlace[],
  found: Record<string, string[]>,
  source: EmailSource
): number {
  let added = 0;
  for (const entry of places) {
    if (entry.emails.length > 0 || !entry.domain) continue;
    const emails = found[entry.domain];
    if (!emails?.length) continue;
    entry.emails = [...new Set(emails)];
    entry.emailSource = source;
    added++;
  }
  return added;
}

/**
 * Résultats Google Search : on n'accepte un email que s'il appartient au domaine
 * du site de l'entreprise (évite d'écrire à un tiers cité sur la même page).
 */
export function mergeGoogleResults(places: EnrichedPlace[], results: Record<string, string[]>): number {
  let added = 0;
  for (const entry of places) {
    if (entry.emails.length > 0 || !entry.domain) continue;
    const found = results[googleSearchQuery(entry).toLowerCase()];
    const matching = (found || []).filter((e) => emailMatchesDomain(e, entry.domain));
    if (!matching.length) continue;
    entry.emails = matching;
    entry.emailSource = "google-search";
    added++;
  }
  return added;
}

export function mergeFallback(
  places: EnrichedPlace[],
  results: Record<string, { emails: string[]; contactName: string | null }>
): number {
  let added = 0;
  for (const entry of places) {
    if (!entry.domain) continue;
    const r = results[entry.domain];
    if (!r) continue;
    if (!entry.contactName && r.contactName && r.contactName.toLowerCase() !== entry.place.title.toLowerCase()) {
      entry.contactName = r.contactName;
    }
    if (entry.emails.length === 0 && r.emails.length) {
      entry.emails = r.emails;
      entry.emailSource = "fallback";
      added++;
    }
  }
  return added;
}

// ─── Import ──────────────────────────────────────────────────────

export async function importPlaces(
  places: EnrichedPlace[],
  opts: { includeOutOfScope?: boolean } = {}
): Promise<{ created: number; withEmail: number; outOfScope: number }> {
  let outOfScope = 0;
  const candidates = places
    .filter((p) => p.emails.length > 0)
    .filter((p) => {
      // Commerces de détail, cafés, concurrents… écartés sauf demande explicite
      if (opts.includeOutOfScope) return true;
      const fit = classifyTarget({ title: p.place.title, categoryName: p.place.categoryName, description: p.place.description }).fit;
      if (fit === "OUT_OF_SCOPE") outOfScope++;
      return fit !== "OUT_OF_SCOPE";
    })
    .map(({ place, domain, emails, contactName }) => {
      const email = (getBestEmail(emails, domain || undefined) || emails[0]).toLowerCase();
      const country = normalizeCountryToIso2(place.country) || "UNKNOWN";
      const scoreInput = {
        description: place.description,
        categoryName: place.categoryName,
        country,
        email,
        website: place.website,
        title: place.title,
      };
      const scoring = calculateLeadScore(scoreInput);
      return {
        company: place.title.slice(0, 200),
        contact: contactName,
        email,
        country,
        language: inferProspectLanguageFromCountry(country),
        website: place.website ?? null,
        phone: place.phone ?? null,
        sector: place.categoryName ?? null,
        clientType: inferClientType(scoreInput),
        product: inferProduct(scoreInput),
        score: scoring.score,
        priority: priorityFromScore(scoring.score, scoring.fit),
        targetFit: scoring.fit,
        productNeeds: scoring.productNeeds,
        source: "apify_google_maps",
        notes: `Score ${scoring.grade} : ${scoring.reasons.join(", ")}`,
        prospectType: "COMMERCIAL" as const,
      };
    });

  const deduped = deduplicateItems(candidates);
  const suppressed = new Set(
    (await prisma.suppression.findMany({ where: { email: { in: deduped.map((d) => d.email) } }, select: { email: true } })).map(
      (s) => s.email
    )
  );
  const existing = new Set(
    (
      await prisma.prospect.findMany({
        where: { email: { in: deduped.map((d) => d.email), mode: "insensitive" } },
        select: { email: true },
      })
    ).map((p) => p.email.toLowerCase())
  );
  const toCreate = deduped.filter((d) => !suppressed.has(d.email) && !existing.has(d.email));

  let created = 0;
  for (const batch of chunk(toCreate, 200)) {
    const result = await prisma.prospect.createMany({ data: batch, skipDuplicates: true });
    created += result.count;
  }
  return { created, withEmail: candidates.length, outOfScope };
}
