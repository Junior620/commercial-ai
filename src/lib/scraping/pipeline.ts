import Papa from "papaparse";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  abortApifyRun,
  friendlyApifyError,
  getApifyRunStatuses,
  getScrapingResults,
  scrapeGoogleMaps,
  type ScrapedPlace,
} from "@/lib/apify";
import {
  brightDataConfigured,
  brightDataCountry,
  cancelSnapshot,
  fetchSnapshot,
  getSnapshotStatus,
  mapBrightDataPlace,
  startMapsDiscovery,
} from "@/lib/brightdata";
import type { WorkerSiteResult } from "@/lib/scraping/worker-client";
import { calculateLeadScore, inferClientType, inferProduct, priorityFromScore } from "@/lib/scoring";
import { deduplicateItems, normalizeDomain } from "@/lib/dedup";
import { classifyTarget } from "@/lib/targeting";
import { validateEmailAddresses } from "@/lib/email-validation";
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
  contact: { maxSites: 200, chunk: 50 },
  deepContact: { maxSites: 100, chunk: 50 },
  googleSearch: { maxQueries: 60, chunk: 30 },
  websiteCrawler: { maxSites: 80, chunk: 40 },
  /** Interrogation d'un traitement d'enrichissement : 20 × 30 s = 10 minutes maximum */
  enrichPoll: { intervalSeconds: 30, maxAttempts: 20 },
  fallback: { maxSites: 150, chunk: 10 },
  /** Service de lecture des sites (VPS) : un job par recherche, interrogé toutes les 20 s, 30 minutes au plus */
  worker: { maxSites: 300, pollSeconds: 20, maxAttempts: 90, maxPagesPerSite: 5 },
  /** Plafonds de dépense Bright Data par recherche (pages débloquées, recherches web) */
  brightdata: { maxUnlocker: 100, maxSerp: 60 },
  mapsPoll: { intervalSeconds: 30, maxAttempts: 120 },
} as const;

const CSV_PRODUCT_SUBCATEGORIES = new Set([
  "cocoa beans", "cocoa butter", "cocoa powder", "cocoa mass/liquor", "derivatives", "cosmetics",
  "food/chocolate", "coffee beans", "green coffee", "ground coffee", "instant coffee", "agri-tech",
  "packaging", "machinery", "compliance", "finance", "circular",
]);

// ─── Types sérialisables (stockés entre les étapes Inngest) ──────

export type EmailSource = "maps" | "apify" | "deep-apify" | "google-search" | "web-crawler" | "fallback" | "worker";

export type MapsProvider = "apify" | "brightdata";

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
  /** Fournisseur du traitement (absent sur les anciens jobs : Apify) */
  provider?: MapsProvider;
  /** Renseigné quand ce traitement est un secours (raison de la bascule) */
  note?: string;
}

export const MAPS_PROVIDER_LABELS: Record<MapsProvider, string> = { apify: "Apify", brightdata: "Bright Data" };

const providerOf = (run: RunEntry): MapsProvider => run.provider ?? "apify";

/**
 * Ordre des sources pour Google Maps : la principale, puis le secours.
 * Bright Data exige un pays : une recherche sans pays reste sur Apify.
 */
export function chooseMapsProviders(opts: { apify: boolean; brightdata: boolean; hasCountry: boolean; primary?: string | null }): MapsProvider[] {
  const available: MapsProvider[] = [];
  if (opts.apify) available.push("apify");
  if (opts.brightdata && opts.hasCountry) available.push("brightdata");
  return opts.primary === "brightdata" ? available.reverse() : available;
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

/** Un job sans progression depuis ce délai est considéré comme interrompu. */
const STALE_JOB_MS = 3 * 60 * 60 * 1000;

/** Passe en échec les jobs restés « en cours » sans progression (worker interrompu). */
export async function failStaleJobs(): Promise<number> {
  const running = await prisma.scrapingJob.findMany({
    where: { status: "RUNNING" },
    select: { id: true, startedAt: true, createdAt: true, progress: true },
  });
  const stale = running.filter((job) => {
    const updatedAt = (job.progress as { updatedAt?: string } | null)?.updatedAt;
    const last = updatedAt ? Date.parse(updatedAt) : (job.startedAt ?? job.createdAt).getTime();
    return Date.now() - (Number.isNaN(last) ? job.createdAt.getTime() : last) > STALE_JOB_MS;
  });
  if (stale.length === 0) return 0;
  const { count } = await prisma.scrapingJob.updateMany({
    where: { id: { in: stale.map((j) => j.id) }, status: "RUNNING" },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      errorMessage: "Recherche interrompue : aucune progression depuis plus de 3 heures.",
    },
  });
  return count;
}

export async function abortRuns(runs: RunEntry[]) {
  await Promise.all(runs.map((r) => (providerOf(r) === "brightdata" ? cancelSnapshot(r.runId) : abortApifyRun(r.runId))));
}

/** État en direct de chaque traitement (pour l'écran de suivi). */
export async function liveRunStatuses(runs: RunEntry[]): Promise<{ runId: string; label: string; status: string }[]> {
  const apifyRuns = runs.filter((r) => providerOf(r) === "apify");
  const apify = apifyRuns.length && process.env.APIFY_API_TOKEN?.trim() ? await getApifyRunStatuses(apifyRuns.map((r) => r.runId)) : [];
  const byId = new Map(apify.map((s) => [s.runId, s.status]));
  return Promise.all(
    runs.map(async (r) => ({
      runId: r.runId,
      label: `${r.label} · ${MAPS_PROVIDER_LABELS[providerOf(r)]}`,
      status: providerOf(r) === "brightdata" ? (await getSnapshotStatus(r.runId)).toUpperCase() : byId.get(r.runId) ?? "?",
    }))
  );
}

// ─── Phase 1 : Google Maps ───────────────────────────────────────

async function startWith(provider: MapsProvider, keywords: string[], country: string | undefined, maxResults: number): Promise<string> {
  if (provider === "apify") return (await scrapeGoogleMaps({ keywords, country, maxResults })).runId;
  const code = brightDataCountry(country);
  if (!code) throw new Error(`Bright Data : pays non reconnu (${country ?? "aucun"})`);
  return startMapsDiscovery(
    keywords.map((keyword) => ({ keyword, country: code })),
    maxResults
  );
}

/**
 * Lance la recherche Google Maps, un traitement par pays.
 * Si la source principale refuse de démarrer (quota, mémoire, clé), le secours prend le relais.
 * `only` force une source (seconde tentative après un échec complet de la première).
 */
export async function startMapsRuns(keywords: string[], countries: string[], maxResults: number, only?: MapsProvider): Promise<RunEntry[]> {
  const targets = countries.length ? countries.slice(0, SCRAPING_LIMITS.maxCountries) : [undefined];
  const runs: RunEntry[] = [];
  for (const country of targets) {
    const order = only
      ? [only]
      : chooseMapsProviders({
          apify: !!process.env.APIFY_API_TOKEN?.trim(),
          brightdata: brightDataConfigured(),
          hasCountry: !!country,
          primary: process.env.SCRAPING_MAPS_PRIMARY?.trim().toLowerCase(),
        });
    if (order.length === 0) throw new Error("Aucune source de recherche configurée (APIFY_API_TOKEN ou BRIGHTDATA_API_TOKEN).");

    let failure: string | null = null;
    let started = false;
    for (const provider of order) {
      try {
        const runId = await startWith(provider, keywords, country, maxResults);
        runs.push({
          runId,
          label: country || "Recherche globale",
          provider,
          ...(failure ? { note: `${failure} : recherche confiée à ${MAPS_PROVIDER_LABELS[provider]}` } : {}),
        });
        started = true;
        break;
      } catch (err) {
        const message = friendlyApifyError(err instanceof Error ? err.message : String(err));
        failure = `${MAPS_PROVIDER_LABELS[provider]} indisponible (${message})`;
        console.error(`[scraping] ${failure}`);
      }
    }
    if (!started) {
      await abortRuns(runs);
      throw new Error(failure ?? "Recherche Google Maps impossible");
    }
  }
  return runs;
}

/** « done » quand plus aucun traitement n'est en cours. */
export async function pollMapsRuns(runs: RunEntry[]): Promise<{ done: boolean; statuses: string[] }> {
  const apifyRuns = runs.filter((r) => providerOf(r) === "apify");
  const brightRuns = runs.filter((r) => providerOf(r) === "brightdata");
  const [apify, bright] = await Promise.all([
    apifyRuns.length ? getApifyRunStatuses(apifyRuns.map((r) => r.runId)) : [],
    Promise.all(brightRuns.map((r) => getSnapshotStatus(r.runId))),
  ]);
  const running = apify.some((s) => ["READY", "RUNNING"].includes(s.status)) || bright.some((s) => ["starting", "running", "unknown"].includes(s));
  return { done: !running, statuses: [...apify.map((s) => s.status), ...bright] };
}

export async function fetchMapsPlaces(runs: RunEntry[]): Promise<{ places: EnrichedPlace[]; errors: string[] }> {
  const errors: string[] = [];
  let all: ScrapedPlace[] = [];
  for (const run of runs) {
    try {
      if (providerOf(run) === "brightdata") {
        const items = await fetchSnapshot(run.runId);
        all = all.concat(items.map(mapBrightDataPlace).filter((p): p is ScrapedPlace => p !== null));
      } else {
        all = all.concat(await getScrapingResults(run.runId));
      }
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

/** Normalise les emails bruts renvoyés par Apify (par domaine ou par requête). */
export function cleanEnrichment(raw: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(raw)) {
    const emails = [...new Set(values.flatMap((v) => extractEmails(v)))];
    if (emails.length) out[key] = emails;
  }
  return out;
}

export function googleSearchQuery(entry: EnrichedPlace): string {
  return entry.domain ? `"${entry.domain}" email contact` : `"${entry.place.title}" email contact`;
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

/** Sites à confier au service de lecture : d'abord ceux sans email, puis ceux sans nom de contact. */
export function workerTargets(places: EnrichedPlace[], max: number): string[] {
  const withSite = places.filter((p) => p.place.website);
  const ordered = [...withSite.filter((p) => p.emails.length === 0), ...withSite.filter((p) => p.emails.length > 0 && !p.contactName)];
  return [...new Set(ordered.map((p) => p.place.website!))].slice(0, max);
}

/**
 * Fusionne les résultats du service de lecture dans les fiches :
 * emails (si la fiche n'en a pas), nom du contact, téléphone, et présentation de l'activité
 * quand Google Maps n'en donnait pas (elle affine ensuite le ciblage).
 */
export function mergeWorkerResults(places: EnrichedPlace[], results: WorkerSiteResult[]): number {
  const byDomain = new Map<string, WorkerSiteResult>();
  for (const r of results) {
    const domain = normalizeDomain(r.url) ?? r.domain;
    if (domain && !byDomain.has(domain)) byDomain.set(domain, r);
    if (r.domain && !byDomain.has(r.domain)) byDomain.set(r.domain, r);
  }
  let added = 0;
  for (const entry of places) {
    if (!entry.domain) continue;
    const r = byDomain.get(entry.domain);
    if (!r) continue;
    if (!entry.contactName && r.contactName && r.contactName.toLowerCase() !== entry.place.title.toLowerCase()) {
      entry.contactName = r.contactName;
    }
    if (!entry.place.phone && r.phone) entry.place.phone = r.phone;
    if (!entry.place.description && r.description) entry.place.description = r.description.slice(0, 400);
    if (entry.emails.length === 0 && r.emails.length) {
      entry.emails = [...new Set(r.emails.flatMap((e) => extractEmails(e)))];
      if (entry.emails.length) {
        entry.emailSource = "worker";
        added++;
      }
    }
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
): Promise<{ created: number; withEmail: number; outOfScope: number; invalid: number }> {
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
  const fresh = deduped.filter((d) => !suppressed.has(d.email) && !existing.has(d.email));

  // Adresses vérifiées (syntaxe + MX) : une adresse manifestement morte n'entre pas dans la base.
  const checks = await validateEmailAddresses(fresh.map((d) => d.email));
  const checkedAt = new Date();
  let invalid = 0;
  const toCreate = fresh.flatMap((d) => {
    const verdict = checks.get(d.email);
    if (verdict && !verdict.valid && !verdict.transient) {
      invalid++;
      return [];
    }
    return [{ ...d, emailCheckedAt: verdict?.valid ? checkedAt : null }];
  });

  let created = 0;
  for (const batch of chunk(toCreate, 200)) {
    const result = await prisma.prospect.createMany({ data: batch, skipDuplicates: true });
    created += result.count;
  }
  return { created, withEmail: candidates.length, outOfScope, invalid };
}
