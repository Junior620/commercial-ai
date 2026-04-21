// apify-client utilise un require dynamique de "proxy-agent" via dynamicNodeImport,
// que @vercel/nft (tracer serverless) ne detecte pas. On force l import statique
// pour que proxy-agent (et ses agents http/https/socks) soient inclus dans la Lambda.
import "proxy-agent";
import { ApifyClient } from "apify-client";

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(
      url.startsWith("http") ? url : `https://${url}`
    ).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

interface GoogleMapsSearchParams {
  keywords: string[];
  country?: string;
  maxResults?: number;
}

/** Levee quand l utilisateur a annule le job (statut CANCELLED en base). */
export class ScrapingCancelledError extends Error {
  constructor() {
    super("Scraping annule par l utilisateur");
    this.name = "ScrapingCancelledError";
  }
}

export interface ScrapedPlace {
  title: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  categoryName?: string;
  url?: string;
  description?: string;
  totalScore?: number;
  email?: string;
}

export async function scrapeGoogleMaps(
  params: GoogleMapsSearchParams
): Promise<{ runId: string }> {
  const cleaned = params.keywords.map((k) => k.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error(
      "Aucun mot-cle pour Google Maps : la liste est vide apres filtrage."
    );
  }

  const searchQueries = cleaned.map((keyword) =>
    params.country ? `${keyword} in ${params.country}` : keyword
  );

  const run = await client.actor("compass/crawler-google-places").call({
    searchStringsArray: searchQueries,
    maxCrawledPlacesPerSearch: params.maxResults || 100,
    language: "en",
    includeWebResults: false,
  });

  return { runId: run.id };
}

function mapDatasetItemToPlace(item: Record<string, unknown>): ScrapedPlace {
  return {
    title: (item.title as string) || "",
    website: (item.website as string) || undefined,
    phone: (item.phone as string) || undefined,
    address: (item.address as string) || undefined,
    city: (item.city as string) || undefined,
    country: (item.countryCode as string) || undefined,
    categoryName: (item.categoryName as string) || undefined,
    url: (item.url as string) || undefined,
    description: (item.description as string) || undefined,
    totalScore: (item.totalScore as number) || undefined,
    email: (item.email as string) || undefined,
  };
}

export async function getScrapingResults(
  runId: string
): Promise<ScrapedPlace[]> {
  const run = await client.run(runId).get();

  if (!run) throw new Error(`Run ${runId} not found`);

  if (run.status === "RUNNING" || run.status === "READY") {
    return [];
  }

  if (
    run.status === "FAILED" ||
    run.status === "ABORTED" ||
    run.status === "TIMED-OUT"
  ) {
    throw new Error(`Apify run ${runId} failed: ${run.status}`);
  }

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 5000 });

  return items.map((item) => mapDatasetItemToPlace(item as Record<string, unknown>));
}

export async function abortApifyRun(runId: string): Promise<void> {
  if (!process.env.APIFY_API_TOKEN?.trim()) return;
  try {
    await client.run(runId).abort();
  } catch {
    // run deja termine ou introuvable
  }
}

export async function waitForRunAndFetchPlaces(
  runId: string,
  opts?: {
    maxWaitMs?: number;
    pollMs?: number;
    shouldCancel?: () => Promise<boolean>;
  }
): Promise<ScrapedPlace[]> {
  const maxWaitMs = opts?.maxWaitMs ?? 55 * 60 * 1000;
  const pollMs = opts?.pollMs ?? 8000;
  const deadline = Date.now() + maxWaitMs;
  const shouldCancel = opts?.shouldCancel;

  while (Date.now() < deadline) {
    if (shouldCancel && (await shouldCancel())) {
      throw new ScrapingCancelledError();
    }
    const run = await client.run(runId).get();
    if (!run) throw new Error(`Run ${runId} not found`);

    if (run.status === "RUNNING" || run.status === "READY") {
      await new Promise((r) => setTimeout(r, pollMs));
      continue;
    }

    if (
      run.status === "FAILED" ||
      run.status === "ABORTED" ||
      run.status === "TIMED-OUT"
    ) {
      throw new Error(`Apify run ${runId}: ${run.status}`);
    }

    if (run.status === "SUCCEEDED") {
      const { items } = await client
        .dataset(run.defaultDatasetId)
        .listItems({ limit: 5000 });
      return items.map((item) =>
        mapDatasetItemToPlace(item as Record<string, unknown>)
      );
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Delai depasse (~${Math.round(maxWaitMs / 60000)} min) pour le run Apify ${runId}.`
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────
// Source 2 : Contact Info Scraper (standard + deep)
// ─────────────────────────────────────────────────────────────

export async function scrapeContactInfo(
  websites: string[],
  opts?: {
    shouldCancel?: () => Promise<boolean>;
    chunkSize?: number;
    maxRequestsPerStartUrl?: number;
  }
): Promise<Map<string, { emails: string[]; phones: string[] }>> {
  const shouldCancel = opts?.shouldCancel;
  const chunkSize = opts?.chunkSize ?? 40;
  const maxReqs = opts?.maxRequestsPerStartUrl ?? 3;
  const contactMap = new Map<string, { emails: string[]; phones: string[] }>();

  for (let i = 0; i < websites.length; i += chunkSize) {
    if (shouldCancel && (await shouldCancel())) {
      throw new ScrapingCancelledError();
    }
    const chunk = websites.slice(i, i + chunkSize);
    const run = await client.actor("apify/contact-info-scraper").call({
      startUrls: chunk.map((url) => ({
        url: url.startsWith("http") ? url : `https://${url}`,
      })),
      maxRequestsPerStartUrl: maxReqs,
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 5000 });

    for (const item of items) {
      const url = (item.url as string) || "";
      const emails = (item.emails as string[]) || [];
      const phones = (item.phones as string[]) || [];
      const domain = extractDomain(url);
      if (domain) {
        const existing = contactMap.get(domain);
        if (existing) {
          const mergedEmails = [...new Set([...existing.emails, ...emails])];
          const mergedPhones = [...new Set([...existing.phones, ...phones])];
          contactMap.set(domain, { emails: mergedEmails, phones: mergedPhones });
        } else {
          contactMap.set(domain, { emails, phones });
        }
      }
    }

    if (i + chunkSize < websites.length) {
      await sleep(400);
    }
  }

  return contactMap;
}

// ─────────────────────────────────────────────────────────────
// Source 4 : Google Search Scraper — recherche "company email"
// dans annuaires, directories, reseaux sociaux...
// ─────────────────────────────────────────────────────────────

export interface GoogleSearchEmailResult {
  query: string;
  emails: string[];
  sources: string[];
}

export async function searchGoogleForEmails(
  queries: string[],
  opts?: {
    shouldCancel?: () => Promise<boolean>;
    chunkSize?: number;
  }
): Promise<Map<string, string[]>> {
  const shouldCancel = opts?.shouldCancel;
  const chunkSize = opts?.chunkSize ?? 20;
  const resultMap = new Map<string, string[]>();

  for (let i = 0; i < queries.length; i += chunkSize) {
    if (shouldCancel && (await shouldCancel())) {
      throw new ScrapingCancelledError();
    }
    const chunk = queries.slice(i, i + chunkSize);

    const run = await client.actor("apify/google-search-scraper").call({
      queries: chunk.join("\n"),
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      languageCode: "en",
      mobileResults: false,
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 5000 });

    for (const item of items) {
      const searchQuery = (item.searchQuery as { term?: string })?.term || "";
      const organicResults =
        (item.organicResults as { description?: string; url?: string }[]) || [];

      const emails: string[] = [];
      for (const result of organicResults) {
        const text = [result.description || "", result.url || ""].join(" ");
        const emailRegex = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
        const found = text.match(emailRegex) || [];
        for (const e of found) {
          const lower = e.toLowerCase();
          if (
            !lower.includes("example.com") &&
            !lower.includes("domain.com") &&
            !lower.includes("sentry.io") &&
            !lower.includes("google") &&
            lower.length < 80
          ) {
            emails.push(lower);
          }
        }
      }

      if (emails.length > 0) {
        resultMap.set(
          searchQuery.toLowerCase(),
          [...new Set(emails)]
        );
      }
    }

    if (i + chunkSize < queries.length) {
      await sleep(500);
    }
  }

  return resultMap;
}

// ─────────────────────────────────────────────────────────────
// Source 5 : Website Content Crawler — crawl profond
// ─────────────────────────────────────────────────────────────

export async function scrapeWebsiteContent(
  websites: string[],
  opts?: {
    shouldCancel?: () => Promise<boolean>;
    chunkSize?: number;
  }
): Promise<Map<string, { texts: string[] }>> {
  const shouldCancel = opts?.shouldCancel;
  const chunkSize = opts?.chunkSize ?? 25;
  const resultMap = new Map<string, { texts: string[] }>();

  for (let i = 0; i < websites.length; i += chunkSize) {
    if (shouldCancel && (await shouldCancel())) {
      throw new ScrapingCancelledError();
    }
    const chunk = websites.slice(i, i + chunkSize);

    const run = await client.actor("apify/website-content-crawler").call({
      startUrls: chunk.map((url) => ({
        url: url.startsWith("http") ? url : `https://${url}`,
      })),
      maxCrawlDepth: 2,
      maxCrawlPages: 8,
      crawlerType: "cheerio",
    });

    const { items } = await client
      .dataset(run.defaultDatasetId)
      .listItems({ limit: 5000 });

    for (const item of items) {
      const pageUrl = (item.url as string) || "";
      const text = (item.text as string) || "";
      const domain = extractDomain(pageUrl);
      if (domain && text) {
        const existing = resultMap.get(domain);
        if (existing) {
          existing.texts.push(text);
        } else {
          resultMap.set(domain, { texts: [text] });
        }
      }
    }

    if (i + chunkSize < websites.length) {
      await sleep(400);
    }
  }

  return resultMap;
}

/** Statuts Apify en direct (pour la progression dans l UI). */
export async function getApifyRunStatuses(
  runIds: string[]
): Promise<{ runId: string; status: string }[]> {
  if (!process.env.APIFY_API_TOKEN?.trim()) {
    return runIds.map((runId) => ({ runId, status: "NO_TOKEN" }));
  }
  return Promise.all(
    runIds.map(async (runId) => {
      try {
        const run = await client.run(runId).get();
        return { runId, status: run?.status ?? "UNKNOWN" };
      } catch {
        return { runId, status: "ERROR" };
      }
    })
  );
}
