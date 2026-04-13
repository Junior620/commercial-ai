import { ApifyClient } from "apify-client";

const client = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

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
  const searchQueries = params.keywords.map((keyword) =>
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

export async function getScrapingResults(
  runId: string
): Promise<ScrapedPlace[]> {
  const run = await client.run(runId).get();

  if (!run) throw new Error(`Run ${runId} not found`);

  if (run.status === "RUNNING" || run.status === "READY") {
    return [];
  }

  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(`Apify run ${runId} failed: ${run.status}`);
  }

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 5000 });

  return items.map((item) => ({
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
    email: undefined,
  }));
}

export async function scrapeContactInfo(websites: string[]): Promise<
  Map<
    string,
    {
      emails: string[];
      phones: string[];
    }
  >
> {
  const run = await client
    .actor("apify/contact-info-scraper")
    .call({
      startUrls: websites.map((url) => ({
        url: url.startsWith("http") ? url : `https://${url}`,
      })),
      maxRequestsPerStartUrl: 3,
    });

  const { items } = await client
    .dataset(run.defaultDatasetId)
    .listItems({ limit: 5000 });

  const contactMap = new Map<
    string,
    { emails: string[]; phones: string[] }
  >();

  for (const item of items) {
    const url = (item.url as string) || "";
    const emails = (item.emails as string[]) || [];
    const phones = (item.phones as string[]) || [];
    const domain = extractDomain(url);
    if (domain) {
      contactMap.set(domain, { emails, phones });
    }
  }

  return contactMap;
}

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
