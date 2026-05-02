import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readFileSync } from "fs";
import { join } from "path";
import Papa from "papaparse";
import {
  abortApifyRun,
  scrapeGoogleMaps,
  scrapeContactInfo,
  scrapeWebsiteContent,
  searchGoogleForEmails,
  ScrapingCancelledError,
  waitForRunAndFetchPlaces,
} from "@/lib/apify";
import { deduplicateItems } from "@/lib/dedup";
import {
  extractEmails,
  fetchAndExtractFromSite,
  getBestEmail,
  SiteExtractionResult,
} from "@/lib/email-extractor";
import {
  calculateFinancialLeadScore,
  inferFinancialCategory,
} from "@/lib/financial-scoring";
import { FINANCIAL_SEEDS } from "@/lib/financial-seed-list";
import { inferProspectLanguageFromCountry } from "@/lib/prospect-language";

type ProgressRun = { runId: string; label: string };
type EmailSource =
  | "maps"
  | "apify"
  | "deep-apify"
  | "google-search"
  | "web-crawler"
  | "fallback"
  | "seed";
type EnrichedPlace = {
  place: import("@/lib/apify").ScrapedPlace;
  emails: Set<string>;
  contactName: string | null;
  emailSource: EmailSource | null;
};
type EmailStats = {
  fromMaps: number;
  fromApify: number;
  fromDeepApify: number;
  fromGoogleSearch: number;
  fromWebCrawler: number;
  fromFallback: number;
  fromSeed: number;
  skippedNoEmail: number;
  pagesScanned: number;
};

const SCRAPING_NETWORK_LIMITS = {
  runStartConcurrency: 3,
  runPollConcurrency: 3,
  mapsMaxResultsCap: 100,
  mapsMultiCountryKeywordCap: 15,
  mapsSingleCountryKeywordCap: 25,
  mapsMultiCountryResultsCap: 30,
  mapsRescueChunkSize: 12,
  mapsRescueDelayMs: 2000,
  mapsRescueRetryDelayMs: 5000,
  mapsRescueMaxRetries: 1,
  contactChunkSize: 20,
  contactMaxRequestsPerUrl: 2,
  deepContactChunkSize: 15,
  deepContactMaxRequestsPerUrl: 6,
  googleSearchChunkSize: 10,
  websiteCrawlerChunkSize: 12,
  fallbackConcurrency: 4,
  fallbackBatchDelayMs: 350,
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type ProgressPayload = {
  phase: string;
  percent: number;
  detail?: string;
  runs?: ProgressRun[];
  meta?: {
    mapsChunkErrors?: number;
    fallbackGlobalRuns?: number;
  };
  updatedAt: string;
};

function normalizeKeywordList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((k) => (typeof k === "string" ? k.trim() : ""))
    .filter(Boolean);
}

function normalizeCountry(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isGeolocalizedKeyword(keyword: string): boolean {
  return /\bin\s+[A-Za-z][A-Za-z\s.'-]{1,40}$/i.test(keyword.trim());
}

function toGlobalKeyword(keyword: string): string {
  return keyword
    .replace(/\s+in\s+[A-Za-z][A-Za-z\s.'-]{1,40}$/i, "")
    .trim();
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return msg.includes("429") || lower.includes("rate limit") || lower.includes("too many requests");
}

function getMapsExecutionSettings(
  keywords: string[],
  countries: string[],
  maxResults: number
) {
  const safeMaxResults = Math.min(
    maxResults,
    SCRAPING_NETWORK_LIMITS.mapsMaxResultsCap
  );
  const mapsKeywords =
    countries.length >= 2
      ? keywords.slice(0, SCRAPING_NETWORK_LIMITS.mapsMultiCountryKeywordCap)
      : keywords.slice(0, SCRAPING_NETWORK_LIMITS.mapsSingleCountryKeywordCap);
  const effectiveMapsMaxResults =
    countries.length >= 2
      ? Math.min(safeMaxResults, SCRAPING_NETWORK_LIMITS.mapsMultiCountryResultsCap)
      : safeMaxResults;
  return { mapsKeywords, effectiveMapsMaxResults };
}

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(
      url.startsWith("http") ? url : `https://${url}`
    ).hostname;
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function mergeContactMap(
  enriched: EnrichedPlace[],
  contactMap: Map<string, { emails: string[]; phones: string[] }>,
  source: "apify" | "deep-apify",
  stats: EmailStats
) {
  for (const entry of enriched) {
    if (!entry.place.website) continue;
    const domain = extractDomain(entry.place.website);
    if (!domain) continue;
    const contact = contactMap.get(domain);
    if (!contact || contact.emails.length === 0) continue;
    const before = entry.emails.size;
    for (const e of contact.emails) {
      for (const cleaned of extractEmails(e)) entry.emails.add(cleaned);
    }
    if (entry.emails.size > before && !entry.emailSource) {
      entry.emailSource = source;
      if (source === "apify") stats.fromApify++;
      else stats.fromDeepApify++;
    }
  }
}

async function persistProgress(
  jobId: string,
  payload: Omit<ProgressPayload, "updatedAt">
) {
  try {
    // updateMany avec filtre status=RUNNING : ne fait rien si le job a ete
    // annule ou termine entre-temps. Evite un throw "record not found" qui
    // remonterait au catch global et marquerait FAILED a tort.
    await prisma.scrapingJob.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: { progress: { ...payload, updatedAt: new Date().toISOString() } as object },
    });
  } catch (err) {
    console.warn(
      "[financial-scraping] progress non enregistre:",
      err instanceof Error ? err.message : err
    );
  }
}

async function isCancelled(jobId: string): Promise<boolean> {
  const job = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === "CANCELLED";
}

export async function GET(req: NextRequest) {
  const pageParam = Number(req.nextUrl.searchParams.get("page") || "1");
  const pageSizeParam = Number(req.nextUrl.searchParams.get("pageSize") || "10");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(50, Math.floor(pageSizeParam))
      : 10;

  const [total, runningCount, jobs] = await Promise.all([
    prisma.scrapingJob.count({ where: { kind: "FINANCIAL" } }),
    prisma.scrapingJob.count({ where: { kind: "FINANCIAL", status: "RUNNING" } }),
    prisma.scrapingJob.findMany({
      where: { kind: "FINANCIAL" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    items: jobs,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    runningCount,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categories = normalizeKeywordList(body.categories);
    const countries = normalizeKeywordList(body.countries);
    const customKeywords = normalizeKeywordList(body.customKeywords);
    const maxResultsRaw = Number(body.maxResults);
    const maxKeywordsRaw = Number(body.maxKeywords);
    const includeSeeds = body.includeSeeds !== false;
    const maxResults =
      Number.isFinite(maxResultsRaw) && maxResultsRaw > 0
        ? Math.min(500, Math.max(10, Math.floor(maxResultsRaw)))
        : 100;
    const maxKeywords =
      Number.isFinite(maxKeywordsRaw) && maxKeywordsRaw > 0
        ? Math.min(500, Math.max(10, Math.floor(maxKeywordsRaw)))
        : 200;

    const csvPath = join(
      process.cwd(),
      "data",
      "financial_partners_scraping.csv"
    );
    const csv = readFileSync(csvPath, "utf-8");
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const csvRows = parsed.data as Record<string, string>[];

    const csvKeywords = csvRows
      .filter((row) => {
        if (categories.length && !categories.includes(row.category)) return false;
        if (countries.length && row.geo_scope === "country") {
          // Si un pays est deja selectionne dans le run, on evite les keywords
          // deja geolocalises pour ne pas produire "in X in Y".
          return false;
        }
        return true;
      })
      .map((row) => row.keyword);

    const sanitizedCustomKeywords = countries.length
      ? customKeywords.filter((k) => !isGeolocalizedKeyword(k))
      : customKeywords;

    const keywords = [...new Set([...sanitizedCustomKeywords, ...csvKeywords])].slice(0, maxKeywords);
    if (!keywords.length) {
      return NextResponse.json(
        { error: "Aucun mot-cle financier disponible avec ces filtres." },
        { status: 400 }
      );
    }

    const { mapsKeywords, effectiveMapsMaxResults } = getMapsExecutionSettings(
      keywords,
      countries,
      maxResults
    );

    const job = await prisma.scrapingJob.create({
      data: {
        keywords,
        countries,
        categories,
        kind: "FINANCIAL",
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    processFinancialScraping({
      jobId: job.id,
      keywords,
      countries,
      maxResults,
      includeSeeds,
    }).catch((err) => console.error("[financial-scraping]", err));

    return NextResponse.json(
      {
        ...job,
        execution: {
          requestedKeywords: keywords.length,
          usedKeywords: mapsKeywords.length,
          maxResultsPerKeyword: effectiveMapsMaxResults,
          countriesCount: countries.length,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[financial-scraping] POST error:", err);
    return NextResponse.json(
      { error: "Erreur de lancement du scraping financier" },
      { status: 500 }
    );
  }
}

async function processFinancialScraping(params: {
  jobId: string;
  keywords: string[];
  countries: string[];
  maxResults: number;
  includeSeeds: boolean;
}) {
  const { jobId, keywords, countries, maxResults, includeSeeds } = params;
  let runEntries: ProgressRun[] = [];
  const mapsChunkErrors: string[] = [];
  let fallbackGlobalRuns = 0;
  const stats: EmailStats = {
    fromMaps: 0,
    fromApify: 0,
    fromDeepApify: 0,
    fromGoogleSearch: 0,
    fromWebCrawler: 0,
    fromFallback: 0,
    fromSeed: 0,
    skippedNoEmail: 0,
    pagesScanned: 0,
  };
  try {
    await persistProgress(jobId, {
      phase: "Preparation",
      percent: 5,
      detail: `${keywords.length} mot(s)-cle financier(s)`,
    });

    if (await isCancelled(jobId)) return;

    const {
      mapsKeywords,
      effectiveMapsMaxResults,
    } = getMapsExecutionSettings(
      keywords,
      countries,
      maxResults
    );
    const batchInputs: { country?: string }[] = countries.length
      ? countries.map((country) => ({ country }))
      : [{}];
    const dynamicRunStartConcurrency =
      countries.length >= 2
        ? 1
        : SCRAPING_NETWORK_LIMITS.runStartConcurrency;

    const launchedRuns = await mapWithConcurrency(
      batchInputs,
      dynamicRunStartConcurrency,
      ({ country }) =>
        scrapeGoogleMaps({
          keywords: countries.length ? mapsKeywords.map((k) => toGlobalKeyword(k)) : mapsKeywords,
          country,
          maxResults: effectiveMapsMaxResults,
        })
    );

    runEntries = launchedRuns.map((run, index) => ({
      runId: run.runId,
      label: batchInputs[index].country || "Global",
    }));

    await persistProgress(jobId, {
      phase: "Crawls Google Maps (Apify)",
      percent: 18,
      detail: `${runEntries.length} execution(s) lancee(s) — ${mapsKeywords.length} mots-cles, max ${effectiveMapsMaxResults} resultats`,
      runs: runEntries,
    });

    if (await isCancelled(jobId)) {
      await Promise.allSettled(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }

    const settled = await mapSettledWithConcurrency(
      launchedRuns,
      SCRAPING_NETWORK_LIMITS.runPollConcurrency,
      ({ runId }) =>
        waitForRunAndFetchPlaces(runId, {
          shouldCancel: () => isCancelled(jobId),
        })
    );

    if (
      settled.some(
        (s): s is PromiseRejectedResult =>
          s.status === "rejected" &&
          s.reason instanceof ScrapingCancelledError
      )
    ) {
      await Promise.allSettled(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }

    const places: import("@/lib/apify").ScrapedPlace[] = [];
    const rescueCountries: string[] = [];
    for (let idx = 0; idx < settled.length; idx++) {
      const s = settled[idx];
      if (s.status === "fulfilled") {
        places.push(...s.value);
      } else {
        const msg = (s.reason instanceof Error ? s.reason.message : String(s.reason)).slice(0, 180);
        mapsChunkErrors.push(msg);
        if (countries.length > 0 && isRateLimitError(s.reason)) {
          const failedCountry = batchInputs[idx]?.country;
          if (failedCountry) rescueCountries.push(failedCountry);
        }
      }
    }

    const uniqueRescueCountries = [...new Set(rescueCountries)];
    if (uniqueRescueCountries.length > 0) {
      const keywordChunks = chunkArray(
        mapsKeywords.map((k) => toGlobalKeyword(k)).filter(Boolean),
        SCRAPING_NETWORK_LIMITS.mapsRescueChunkSize
      );
      for (const country of uniqueRescueCountries) {
        for (let i = 0; i < keywordChunks.length; i++) {
          const chunk = keywordChunks[i];
          if (!chunk.length) continue;
          let rescued = false;
          for (let attempt = 0; attempt <= SCRAPING_NETWORK_LIMITS.mapsRescueMaxRetries; attempt++) {
            await persistProgress(jobId, {
              phase: "Rescue anti-429 Maps",
              percent: 24,
              detail: `${country} — lot ${i + 1}/${keywordChunks.length}${attempt > 0 ? ` (retry ${attempt})` : ""}`,
              runs: runEntries,
            });
            try {
              const rescueRun = await scrapeGoogleMaps({
                keywords: chunk,
                country,
                maxResults: effectiveMapsMaxResults,
              });
              runEntries.push({
                runId: rescueRun.runId,
                label: `${country} [rescue ${i + 1}]`,
              });
              const rescuedPlaces = await waitForRunAndFetchPlaces(rescueRun.runId, {
                shouldCancel: () => isCancelled(jobId),
              });
              places.push(...rescuedPlaces);
              rescued = true;
              break;
            } catch (err) {
              if (isRateLimitError(err) && attempt < SCRAPING_NETWORK_LIMITS.mapsRescueMaxRetries) {
                await sleep(SCRAPING_NETWORK_LIMITS.mapsRescueRetryDelayMs);
                continue;
              }
              if (isRateLimitError(err)) {
                try {
                  const fallbackRun = await scrapeGoogleMaps({
                    keywords: chunk.map((k) => toGlobalKeyword(k)).filter(Boolean),
                    maxResults: effectiveMapsMaxResults,
                  });
                  runEntries.push({
                    runId: fallbackRun.runId,
                    label: `${country} [rescue ${i + 1} fallback global]`,
                  });
                  const fallbackPlaces = await waitForRunAndFetchPlaces(fallbackRun.runId, {
                    shouldCancel: () => isCancelled(jobId),
                  });
                  places.push(...fallbackPlaces);
                  fallbackGlobalRuns++;
                  rescued = true;
                  break;
                } catch (fallbackErr) {
                  mapsChunkErrors.push(
                    `rescue ${country} lot ${i + 1}: ${String(
                      fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
                    ).slice(0, 180)}`
                  );
                }
              } else {
                mapsChunkErrors.push(
                  `rescue ${country} lot ${i + 1}: ${String(
                    err instanceof Error ? err.message : err
                  ).slice(0, 180)}`
                );
              }
              break;
            }
          }
          if (await isCancelled(jobId)) {
            await Promise.allSettled(runEntries.map((r) => abortApifyRun(r.runId)));
            return;
          }
          if (!rescued) {
            // keep going to maximize partial results
          }
          if (i < keywordChunks.length - 1) {
            await sleep(SCRAPING_NETWORK_LIMITS.mapsRescueDelayMs);
          }
        }
      }
    }

    if (places.length === 0 && mapsChunkErrors.length > 0) {
      throw new Error(mapsChunkErrors.join(" | "));
    }

    await persistProgress(jobId, {
      phase: "Resultats Google Maps",
      percent: 45,
      detail: `${places.length} fiche(s) Google Maps`,
      runs: runEntries,
    });

    const enriched: EnrichedPlace[] = places.map((place) => {
      const emails = new Set<string>();
      let emailSource: EmailSource | null = null;
      if (place.email) {
        for (const e of extractEmails(place.email)) {
          emails.add(e);
          emailSource = "maps";
        }
      }
      return { place, emails, contactName: null, emailSource };
    });
    stats.fromMaps = enriched.filter((p) => p.emailSource === "maps").length;

    const shouldCancel = () => isCancelled(jobId);
    const websiteUrls = places.filter((p) => p.website).map((p) => p.website!);

    if (websiteUrls.length > 0) {
      await persistProgress(jobId, {
        phase: "Source 2 — Contact Info Scraper",
        percent: 52,
        detail: `Analyse de ${Math.min(websiteUrls.length, 200)} site(s)`,
        runs: runEntries,
      });
      try {
        const contactMap = await scrapeContactInfo(websiteUrls.slice(0, 200), {
          shouldCancel,
          maxRequestsPerStartUrl: SCRAPING_NETWORK_LIMITS.contactMaxRequestsPerUrl,
          chunkSize: SCRAPING_NETWORK_LIMITS.contactChunkSize,
        });
        mergeContactMap(enriched, contactMap, "apify", stats);
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
      }
    }

    const stillNoEmail = enriched.filter((p) => p.emails.size === 0 && p.place.website);
    if (stillNoEmail.length > 0) {
      const deepUrls = stillNoEmail.map((p) => p.place.website!).slice(0, 100);
      await persistProgress(jobId, {
        phase: "Source 3 — Contact Info DEEP",
        percent: 60,
        detail: `Crawl approfondi de ${deepUrls.length} site(s)`,
        runs: runEntries,
      });
      try {
        const deepMap = await scrapeContactInfo(deepUrls, {
          shouldCancel,
          maxRequestsPerStartUrl: SCRAPING_NETWORK_LIMITS.deepContactMaxRequestsPerUrl,
          chunkSize: SCRAPING_NETWORK_LIMITS.deepContactChunkSize,
        });
        mergeContactMap(enriched, deepMap, "deep-apify", stats);
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
      }
    }

    const stillNoEmail2 = enriched.filter((p) => p.emails.size === 0 && p.place.title);
    if (stillNoEmail2.length > 0) {
      const maxSearch = Math.min(stillNoEmail2.length, 60);
      const searchQueries = stillNoEmail2.slice(0, maxSearch).map((p) => {
        const domain = p.place.website ? extractDomain(p.place.website) : null;
        return domain ? `"${domain}" email contact` : `"${p.place.title}" email contact`;
      });
      await persistProgress(jobId, {
        phase: "Source 4 — Google Search emails",
        percent: 68,
        detail: `${searchQueries.length} requete(s)`,
        runs: runEntries,
      });
      try {
        const searchResults = await searchGoogleForEmails(searchQueries, {
          shouldCancel,
          chunkSize: SCRAPING_NETWORK_LIMITS.googleSearchChunkSize,
        });
        for (let idx = 0; idx < maxSearch; idx++) {
          const entry = stillNoEmail2[idx];
          const query = searchQueries[idx].toLowerCase();
          const found = searchResults.get(query);
          if (found && found.length > 0) {
            const before = entry.emails.size;
            for (const e of found) entry.emails.add(e);
            if (entry.emails.size > before && !entry.emailSource) {
              entry.emailSource = "google-search";
              stats.fromGoogleSearch++;
            }
          }
        }
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
      }
    }

    const stillNoEmail3 = enriched.filter((p) => p.emails.size === 0 && p.place.website);
    if (stillNoEmail3.length > 0) {
      const crawlUrls = stillNoEmail3.map((p) => p.place.website!).slice(0, 80);
      await persistProgress(jobId, {
        phase: "Source 5 — Website Content Crawler",
        percent: 74,
        detail: `Crawl de ${crawlUrls.length} site(s)`,
        runs: runEntries,
      });
      try {
        const contentMap = await scrapeWebsiteContent(crawlUrls, {
          shouldCancel,
          chunkSize: SCRAPING_NETWORK_LIMITS.websiteCrawlerChunkSize,
        });
        for (const entry of enriched) {
          if (entry.emails.size > 0 || !entry.place.website) continue;
          const domain = extractDomain(entry.place.website);
          if (!domain) continue;
          const content = contentMap.get(domain);
          if (!content) continue;
          const found = extractEmails(content.texts.join(" "));
          if (found.length > 0) {
            for (const e of found) entry.emails.add(e);
            if (!entry.emailSource) {
              entry.emailSource = "web-crawler";
              stats.fromWebCrawler++;
            }
          }
        }
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
      }
    }

    const needFallback = enriched.filter((p) => p.emails.size === 0 && p.place.website);
    const needContact = enriched.filter((p) => !p.contactName && p.place.website);
    const fallbackTargets = [
      ...new Map([...needFallback, ...needContact].map((e) => [e.place.title, e])).values(),
    ];
    if (fallbackTargets.length > 0) {
      const count = Math.min(150, fallbackTargets.length);
      await persistProgress(jobId, {
        phase: "Source 6 — Fallback multi-pages",
        percent: 80,
        detail: `${count} site(s)`,
        runs: runEntries,
      });
      for (let i = 0; i < count; i += SCRAPING_NETWORK_LIMITS.fallbackConcurrency) {
        if (await isCancelled(jobId)) return;
        const batch = fallbackTargets.slice(
          i,
          i + SCRAPING_NETWORK_LIMITS.fallbackConcurrency
        );
        const batchResults = await Promise.allSettled(
          batch.map((b) => fetchAndExtractFromSite(b.place.website!))
        );
        batchResults.forEach((r, idx) => {
          if (r.status !== "fulfilled") return;
          const extraction: SiteExtractionResult = r.value;
          stats.pagesScanned += extraction.pagesScanned;
          const entry = batch[idx];
          if (extraction.emails.length > 0) {
            const before = entry.emails.size;
            for (const e of extraction.emails) entry.emails.add(e);
            if (entry.emails.size > before && !entry.emailSource) {
              entry.emailSource = "fallback";
              stats.fromFallback++;
            }
          }
          if (!entry.contactName && extraction.contactName) {
            entry.contactName = extraction.contactName;
          }
        });
        if (i + SCRAPING_NETWORK_LIMITS.fallbackConcurrency < count) {
          await new Promise((r) =>
            setTimeout(r, SCRAPING_NETWORK_LIMITS.fallbackBatchDelayMs)
          );
        }
      }
    }

    const candidates: Array<{
      company: string;
      contact: string | null;
      email: string;
      country: string;
      sector: string | null;
      clientType: string | null;
      product: string | null;
      language: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
      score: number;
      website: string | null;
      source: string;
      notes: string;
      prospectType: "FINANCIAL";
      financialCategory: string | null;
    }> = [];

    for (const entry of enriched) {
      const emailArr = [...entry.emails];
      if (emailArr.length === 0) {
        stats.skippedNoEmail++;
        continue;
      }
      const bestEmail = getBestEmail(
        emailArr,
        entry.place.website || undefined
      ) || emailArr[0];
      const scoring = calculateFinancialLeadScore({
        title: entry.place.title,
        description: entry.place.description,
        categoryName: entry.place.categoryName,
        website: entry.place.website,
        country: entry.place.country,
      });
      candidates.push({
        company: entry.place.title || "Organisation financiere",
        contact: entry.contactName || null,
        email: bestEmail,
        country: entry.place.country || "Unknown",
        sector: entry.place.categoryName || "financial-services",
        clientType: "financial_partner",
        product: null,
        language: inferProspectLanguageFromCountry(entry.place.country),
        priority: scoring.score >= 60 ? "HIGH" : scoring.score >= 35 ? "MEDIUM" : "LOW",
        score: scoring.score,
        website: entry.place.website || null,
        source: `financial_scraping_${entry.emailSource ?? "unknown"}`,
        notes: scoring.reasons.join(", "),
        prospectType: "FINANCIAL",
        financialCategory: scoring.financialCategory,
      });
    }

    if (includeSeeds) {
      const selectedCountries = new Set(countries.map((c) => normalizeCountry(c)));
      const seedsToUse =
        selectedCountries.size > 0
          ? FINANCIAL_SEEDS.filter((seed) =>
              selectedCountries.has(normalizeCountry(seed.country))
            )
          : FINANCIAL_SEEDS;

      await persistProgress(jobId, {
        phase: "Seed list curatee",
        percent: 68,
        detail: `${seedsToUse.length} organisation(s) seed`,
        runs: runEntries,
      });

      for (const seed of seedsToUse) {
        if (await isCancelled(jobId)) return;
        const extraction = await fetchAndExtractFromSite(seed.website);
        const bestEmail = getBestEmail(extraction.emails, seed.website);
        if (!bestEmail) continue;
        const scoring = calculateFinancialLeadScore({
          title: seed.name,
          description: seed.notes,
          categoryName: seed.category,
          website: seed.website,
          country: seed.country,
        });
        candidates.push({
          company: seed.name,
          contact: extraction.contactName || null,
          email: bestEmail,
          country: seed.country || "Unknown",
          sector: "financial-services",
          clientType: "financial_partner",
          product: null,
          language: inferProspectLanguageFromCountry(seed.country),
          priority: scoring.score >= 60 ? "HIGH" : scoring.score >= 35 ? "MEDIUM" : "LOW",
          score: scoring.score,
          website: seed.website,
          source: "financial_seed",
          notes: scoring.reasons.join(", "),
          prospectType: "FINANCIAL",
          financialCategory: seed.category || inferFinancialCategory({ title: seed.name }),
        });
        stats.fromSeed++;
      }
    }

    const deduped = deduplicateItems(candidates);
    let created = 0;
    await persistProgress(jobId, {
      phase: "Import en base",
      percent: 88,
      detail: `${deduped.length} prospect(s) financier(s) prepares`,
      runs: runEntries,
    });

    for (const prospect of deduped) {
      if (await isCancelled(jobId)) return;
      try {
        await prisma.prospect.create({ data: prospect });
        created++;
      } catch {
        // duplicate email
      }
    }

    await prisma.scrapingJob.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultsCount: created,
        progress: {
          phase: "Termine",
          percent: 100,
          detail: [
            `${created} prospect(s) financier(s) cree(s)`,
            `Sources: Maps=${stats.fromMaps}, Apify=${stats.fromApify}, DeepApify=${stats.fromDeepApify}, Google=${stats.fromGoogleSearch}, WebCrawler=${stats.fromWebCrawler}, Fallback=${stats.fromFallback}, Seeds=${stats.fromSeed}`,
            `${stats.pagesScanned} page(s) scannee(s), ${stats.skippedNoEmail} sans email`,
            fallbackGlobalRuns > 0
              ? `${fallbackGlobalRuns} lot(s) bascules en fallback global`
              : null,
            mapsChunkErrors.length
              ? `${mapsChunkErrors.length} lot(s) Maps en erreur (429/proxy)`
              : null,
          ].join(" | "),
          runs: runEntries,
          meta: {
            mapsChunkErrors: mapsChunkErrors.length,
            fallbackGlobalRuns,
          },
          updatedAt: new Date().toISOString(),
        } as object,
      },
    });
  } catch (err) {
    if (err instanceof ScrapingCancelledError) {
      // Job annule par l utilisateur : la route PATCH a deja persiste l etat
      // CANCELLED. On evite de le repasser en FAILED.
      await Promise.allSettled(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }
    const message = err instanceof Error ? err.message : "Erreur";
    console.error("[financial-scraping] processFinancialScraping failed:", err);
    try {
      await prisma.scrapingJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: message.slice(0, 1900),
        },
      });
    } catch (dbErr) {
      console.error(
        "[financial-scraping] impossible de marquer FAILED:",
        dbErr
      );
    }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const out: R[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({
    length: Math.max(1, Math.min(concurrency, items.length)),
  }).map(async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) break;
      out[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return out;
}

async function mapSettledWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({
    length: Math.max(1, Math.min(concurrency, items.length)),
  }).map(async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= items.length) break;
      try {
        out[idx] = { status: "fulfilled", value: await worker(items[idx], idx) };
      } catch (error) {
        out[idx] = { status: "rejected", reason: error };
      }
    }
  });

  await Promise.all(runners);
  return out;
}
