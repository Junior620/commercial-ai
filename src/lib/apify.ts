// apify-client utilise un require dynamique de "proxy-agent" via dynamicNodeImport,
// que @vercel/nft (tracer serverless) ne detecte pas. On force l import statique
// pour que proxy-agent (et ses agents http/https/socks) soient inclus dans la Lambda.
import "proxy-agent";
import { ApifyClient } from "apify-client";

let _client: ApifyClient | null = null;
function getClient(): ApifyClient {
  if (_client) return _client;
  const token = process.env.APIFY_API_TOKEN?.trim();
  if (!token) throw new Error("APIFY_API_TOKEN non configuré : scraping impossible");
  _client = new ApifyClient({ token });
  return _client;
}
const client = new Proxy({} as ApifyClient, {
  get: (_target, prop) => {
    const real = getClient();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
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

  const searchQueries = cleaned.map((keyword) => {
    if (!params.country) return keyword;
    // Evite les requetes du style "in X in Y"
    if (/\bin\s+[A-Za-z][A-Za-z\s.'-]{1,40}$/i.test(keyword)) {
      return keyword;
    }
    return `${keyword} in ${params.country}`;
  });

  // start() : on n'attend pas la fin du run, Inngest interroge son statut ensuite.
  const run = await client.actor("compass/crawler-google-places").start({
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

// ─────────────────────────────────────────────────────────────
// Enrichissement : traitements lancés sans attendre leur fin.
// Inngest interroge ensuite leur état (aucune étape ne dépend de la durée d'un traitement Apify).
// ─────────────────────────────────────────────────────────────

export type EnrichmentKind = "contact" | "deep-contact" | "search" | "content";

const withProtocol = (url: string) => (url.startsWith("http") ? url : `https://${url}`);

/** Lance un traitement d'enrichissement et renvoie son identifiant. */
export async function startEnrichmentRun(kind: EnrichmentKind, payload: string[]): Promise<string> {
  const startUrls = payload.map((url) => ({ url: withProtocol(url) }));
  const run =
    kind === "search"
      ? await client.actor("apify/google-search-scraper").start({
          queries: payload.join("\n"),
          maxPagesPerQuery: 1,
          resultsPerPage: 10,
          languageCode: "en",
          mobileResults: false,
        })
      : kind === "content"
        ? await client.actor("apify/website-content-crawler").start({ startUrls, maxCrawlDepth: 2, maxCrawlPages: 8, crawlerType: "cheerio" })
        : await client.actor("apify/contact-info-scraper").start({ startUrls, maxRequestsPerStartUrl: kind === "deep-contact" ? 6 : 2 });
  return run.id;
}

export async function getRunState(runId: string): Promise<{ done: boolean; ok: boolean; status: string }> {
  const run = await client.run(runId).get();
  const status = run?.status ?? "UNKNOWN";
  const done = !["READY", "RUNNING"].includes(status);
  return { done, ok: status === "SUCCEEDED", status };
}

const EMAIL_IN_TEXT = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;

/**
 * Lit le résultat d'un traitement terminé.
 * - contact / deep-contact / content : emails bruts par domaine
 * - search : emails par requête (en minuscules)
 */
export async function readEnrichmentRun(kind: EnrichmentKind, runId: string): Promise<Record<string, string[]>> {
  const run = await client.run(runId).get();
  if (!run?.defaultDatasetId) return {};
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5000 });
  const out: Record<string, string[]> = {};
  const add = (key: string, values: string[]) => {
    if (!key || values.length === 0) return;
    out[key] = [...new Set([...(out[key] ?? []), ...values])].slice(0, 30);
  };

  for (const item of items) {
    if (kind === "search") {
      const query = ((item.searchQuery as { term?: string })?.term || "").toLowerCase();
      const results = (item.organicResults as { description?: string; url?: string }[]) || [];
      const found = results
        .flatMap((r) => `${r.description || ""} ${r.url || ""}`.match(EMAIL_IN_TEXT) || [])
        .map((e) => e.toLowerCase())
        .filter((e) => e.length < 80 && !/example\.com|domain\.com|sentry\.io|google/.test(e));
      add(query, found);
    } else if (kind === "content") {
      const domain = extractDomain((item.url as string) || "");
      const text = ((item.text as string) || "").slice(0, 200_000);
      if (domain) add(domain, text.match(EMAIL_IN_TEXT) || []);
    } else {
      const domain = extractDomain((item.url as string) || "");
      if (domain) add(domain, (item.emails as string[]) || []);
    }
  }
  return out;
}

/** Message lisible pour les erreurs Apify les plus courantes. */
export function friendlyApifyError(message: string): string {
  if (/monthly usage hard limit/i.test(message)) return "Quota mensuel Apify atteint. Augmentez la limite dans votre compte Apify ou attendez le mois prochain.";
  if (/memory limit/i.test(message)) return "Trop de traitements Apify en parallèle pour votre compte (limite de mémoire). Réessayez dans quelques minutes avec moins de pays ou de mots-clés.";
  if (/token|unauthorized|401/i.test(message)) return "Clé Apify refusée : vérifiez APIFY_API_TOKEN.";
  return message;
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
