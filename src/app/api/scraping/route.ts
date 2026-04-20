import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  abortApifyRun,
  scrapeGoogleMaps,
  scrapeContactInfo,
  searchGoogleForEmails,
  scrapeWebsiteContent,
  ScrapingCancelledError,
  waitForRunAndFetchPlaces,
} from "@/lib/apify";
import { calculateLeadScore, inferClientType, inferProduct } from "@/lib/scoring";
import { deduplicateItems } from "@/lib/dedup";
import {
  getBestEmail,
  fetchAndExtractFromSite,
  extractEmails,
  SiteExtractionResult,
} from "@/lib/email-extractor";
import Papa from "papaparse";
import { readFileSync } from "fs";
import { join } from "path";

/** Sous-categories CSV alignees sur les ids du select « Produit » (scraping). */
const CSV_PRODUCT_SUBCATEGORIES = new Set([
  "cocoa beans",
  "cocoa butter",
  "cocoa powder",
  "cocoa mass/liquor",
  "derivatives",
  "cosmetics",
  "food/chocolate",
  "coffee beans",
  "green coffee",
  "ground coffee",
  "instant coffee",
  "agri-tech",
  "packaging",
  "machinery",
  "compliance",
  "finance",
  "circular",
]);

type ProgressRun = { runId: string; label: string };

type ProgressPayload = {
  phase: string;
  percent: number;
  detail?: string;
  runs?: ProgressRun[];
  updatedAt: string;
};

function truncateErr(msg: string, max = 2000): string {
  if (msg.length <= max) return msg;
  return `${msg.slice(0, max)}…`;
}

async function persistProgress(
  jobId: string,
  partial: Omit<ProgressPayload, "updatedAt"> & { runs?: ProgressRun[] }
) {
  const payload: ProgressPayload = {
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  try {
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: { progress: payload as object },
    });
  } catch (e) {
    console.warn(
      "[scraping] progress non enregistre:",
      e instanceof Error ? e.message : e
    );
  }
}

async function markJobCompleted(
  jobId: string,
  created: number,
  runEntries: ProgressRun[],
  stats: EmailStats
) {
  const detail = [
    `${created} prospect(s) cree(s)`,
    `Sources: Maps=${stats.fromMaps}, Apify=${stats.fromApify}, DeepApify=${stats.fromDeepApify}, Google=${stats.fromGoogleSearch}, WebCrawler=${stats.fromWebCrawler}, Fallback=${stats.fromFallback}`,
    `${stats.pagesScanned} page(s) scannee(s), ${stats.skippedNoEmail} sans email`,
  ].join(" | ");

  const progress = {
    phase: "Termine",
    percent: 100,
    detail,
    runs: runEntries,
    updatedAt: new Date().toISOString(),
  };
  try {
    await prisma.scrapingJob.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        resultsCount: created,
        completedAt: new Date(),
        progress: progress as object,
      },
    });
  } catch {
    await prisma.scrapingJob.updateMany({
      where: { id: jobId, status: "RUNNING" },
      data: {
        status: "COMPLETED",
        resultsCount: created,
        completedAt: new Date(),
      },
    });
  }
}

async function isScrapingJobCancelled(jobId: string): Promise<boolean> {
  const j = await prisma.scrapingJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return j?.status === "CANCELLED";
}

interface EmailStats {
  fromMaps: number;
  fromApify: number;
  fromDeepApify: number;
  fromGoogleSearch: number;
  fromWebCrawler: number;
  fromFallback: number;
  skippedNoEmail: number;
  pagesScanned: number;
}

type EnrichedPlace = {
  place: import("@/lib/apify").ScrapedPlace;
  emails: Set<string>;
  contactName: string | null;
  emailSource: "maps" | "apify" | "deep-apify" | "google-search" | "web-crawler" | "fallback" | null;
};

export async function GET(req: NextRequest) {
  const pageParam = Number(req.nextUrl.searchParams.get("page") || "1");
  const pageSizeParam = Number(req.nextUrl.searchParams.get("pageSize") || "10");
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
  const pageSize =
    Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(50, Math.floor(pageSizeParam))
      : 10;

  const [total, runningCount, jobs] = await Promise.all([
    prisma.scrapingJob.count(),
    prisma.scrapingJob.count({ where: { status: "RUNNING" } }),
    prisma.scrapingJob.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    items: jobs,
    total,
    page,
    pageSize,
    totalPages,
    runningCount,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categories, countries, product, customKeywords, maxResults } = body;

    let keywords: string[] = [...(customKeywords || [])];

    try {
      const csvPath = join(process.cwd(), "data", "cocoa_keywords_scraping.csv");
      const csvContent = readFileSync(csvPath, "utf-8");
      const { data } = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
      });

      for (const row of data as Record<string, string>[]) {
        if (categories && categories.length > 0) {
          if (!categories.includes(row.category)) continue;
        }
        if (
          product &&
          CSV_PRODUCT_SUBCATEGORIES.has(row.subcategory) &&
          row.subcategory !== product
        ) {
          continue;
        }
        if (countries && countries.length > 0) {
          if (row.geo_scope === "country" && !countries.includes(row.country))
            continue;
        }
        keywords.push(row.keyword);
      }
    } catch {
      // CSV not found
    }

    keywords = [
      ...new Set(
        keywords
          .map((k) => (typeof k === "string" ? k.trim() : ""))
          .filter(Boolean)
      ),
    ].slice(0, 50);

    if (keywords.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucun mot-cle ne correspond aux filtres (categories, produit, pays), ou le fichier data/cocoa_keywords_scraping.csv est absent. Assouplissez les filtres ou ajoutez des mots-cles personnalises (un par ligne).",
        },
        { status: 400 }
      );
    }

    const job = await prisma.scrapingJob.create({
      data: {
        keywords,
        countries: countries || [],
        categories: categories || [],
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    processScraping(job.id, keywords, countries, maxResults).catch(
      console.error
    );

    return NextResponse.json(job, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erreur de lancement du scraping" },
      { status: 500 }
    );
  }
}

async function processScraping(
  jobId: string,
  keywords: string[],
  countries?: string[],
  maxResults?: number
) {
  let runEntries: ProgressRun[] = [];
  const stats: EmailStats = {
    fromMaps: 0,
    fromApify: 0,
    fromDeepApify: 0,
    fromGoogleSearch: 0,
    fromWebCrawler: 0,
    fromFallback: 0,
    skippedNoEmail: 0,
    pagesScanned: 0,
  };

  try {
    await persistProgress(jobId, {
      phase: "Preparation",
      percent: 3,
      detail: `${keywords.length} mot(s)-cle, ${countries?.length ? `${countries.length} pays` : "sans filtre pays"}`,
    });

    if (await isScrapingJobCancelled(jobId)) return;

    // ═══════════════════════════════════════════════════════════
    // PHASE 1 : Google Maps
    // ═══════════════════════════════════════════════════════════
    const batches = [];
    if (countries && countries.length > 0) {
      for (const country of countries) {
        batches.push(
          scrapeGoogleMaps({ keywords, country, maxResults: maxResults || 100 })
        );
      }
    } else {
      batches.push(
        scrapeGoogleMaps({ keywords, maxResults: maxResults || 100 })
      );
    }

    const results = await Promise.all(batches);
    runEntries = results.map((r, i) => ({
      runId: r.runId,
      label:
        countries && countries.length > 0 && countries[i]
          ? String(countries[i])
          : "Recherche globale",
    }));

    if (await isScrapingJobCancelled(jobId)) {
      await Promise.all(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }

    await persistProgress(jobId, {
      phase: "Crawls Google Maps (Apify)",
      percent: 10,
      detail: `${runEntries.length} execution(s) lancee(s)...`,
      runs: runEntries,
    });

    const shouldCancel = () => isScrapingJobCancelled(jobId);
    const settled = await Promise.allSettled(
      results.map(({ runId }) =>
        waitForRunAndFetchPlaces(runId, { shouldCancel })
      )
    );

    if (await isScrapingJobCancelled(jobId)) {
      await Promise.all(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }
    if (
      settled.some(
        (s): s is PromiseRejectedResult =>
          s.status === "rejected" &&
          s.reason instanceof ScrapingCancelledError
      )
    ) {
      await Promise.all(runEntries.map((r) => abortApifyRun(r.runId)));
      return;
    }

    const runErrors: string[] = [];
    let allPlaces: Awaited<ReturnType<typeof waitForRunAndFetchPlaces>> = [];
    for (const s of settled) {
      if (s.status === "fulfilled") {
        allPlaces = [...allPlaces, ...s.value];
      } else {
        runErrors.push(
          s.reason instanceof Error ? s.reason.message : String(s.reason)
        );
      }
    }

    if (allPlaces.length === 0 && runErrors.length > 0) {
      throw new Error(runErrors.join(" | "));
    }
    if (await isScrapingJobCancelled(jobId)) return;

    await persistProgress(jobId, {
      phase: "Resultats Google Maps",
      percent: 30,
      detail: `${allPlaces.length} fiche(s) recuperee(s)${runErrors.length ? ` (${runErrors.length} erreur(s))` : ""}`,
      runs: runEntries,
    });

    // ═══════════════════════════════════════════════════════════
    // Initialiser la structure enrichie — Source 1 : Maps emails
    // ═══════════════════════════════════════════════════════════
    const enriched: EnrichedPlace[] = allPlaces.map((place) => {
      const emails = new Set<string>();
      let emailSource: EnrichedPlace["emailSource"] = null;

      if (place.email) {
        for (const e of extractEmails(place.email)) {
          emails.add(e);
          emailSource = "maps";
        }
      }
      return { place, emails, contactName: null, emailSource };
    });
    stats.fromMaps = enriched.filter((p) => p.emailSource === "maps").length;

    // ═══════════════════════════════════════════════════════════
    // PHASE 2 : Contact Info Scraper (passe standard, 3 pages/site)
    // ═══════════════════════════════════════════════════════════
    const websiteUrls = allPlaces
      .filter((p) => p.website)
      .map((p) => p.website!);

    if (websiteUrls.length > 0) {
      await persistProgress(jobId, {
        phase: "Source 2 — Contact Info Scraper",
        percent: 35,
        detail: `Analyse de ${Math.min(websiteUrls.length, 200)} site(s) (3 pages/site)...`,
        runs: runEntries,
      });

      try {
        const contactMap = await scrapeContactInfo(
          websiteUrls.slice(0, 200),
          { shouldCancel, maxRequestsPerStartUrl: 3 }
        );
        mergeContactMap(enriched, contactMap, "apify", stats);
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
        console.error("[scraping] contactInfo standard echec:", e);
      }
    }

    if (await isScrapingJobCancelled(jobId)) return;

    // ═══════════════════════════════════════════════════════════
    // PHASE 3 : Contact Info Scraper DEEP (10 pages/site) pour
    //           les sites qui n'ont pas encore donne d'email
    // ═══════════════════════════════════════════════════════════
    const stillNoEmail = enriched.filter(
      (p) => p.emails.size === 0 && p.place.website
    );
    if (stillNoEmail.length > 0) {
      const deepUrls = stillNoEmail
        .map((p) => p.place.website!)
        .slice(0, 100);

      await persistProgress(jobId, {
        phase: "Source 3 — Contact Info DEEP (10 pages/site)",
        percent: 42,
        detail: `Crawl approfondi de ${deepUrls.length} site(s) sans email...`,
        runs: runEntries,
      });

      try {
        const deepMap = await scrapeContactInfo(deepUrls, {
          shouldCancel,
          maxRequestsPerStartUrl: 10,
          chunkSize: 25,
        });
        mergeContactMap(enriched, deepMap, "deep-apify", stats);
      } catch (e) {
        if (e instanceof ScrapingCancelledError) throw e;
        console.error("[scraping] contactInfo deep echec:", e);
      }
    }

    if (await isScrapingJobCancelled(jobId)) return;

    // ═══════════════════════════════════════════════════════════
    // PHASE 4 : Google Search — chercher "company email" dans
    //           les annuaires, directories, reseaux sociaux
    // ═══════════════════════════════════════════════════════════
    const stillNoEmail2 = enriched.filter(
      (p) => p.emails.size === 0 && p.place.title
    );
    if (stillNoEmail2.length > 0) {
      const maxSearch = Math.min(stillNoEmail2.length, 60);
      const searchQueries = stillNoEmail2.slice(0, maxSearch).map((p) => {
        const domain = p.place.website
          ? extractDomain(p.place.website)
          : null;
        return domain
          ? `"${domain}" email contact`
          : `"${p.place.title}" email contact`;
      });

      await persistProgress(jobId, {
        phase: "Source 4 — Google Search emails",
        percent: 55,
        detail: `Recherche Google de ${searchQueries.length} requete(s) pour emails...`,
        runs: runEntries,
      });

      try {
        const searchResults = await searchGoogleForEmails(searchQueries, {
          shouldCancel,
        });

        for (let idx = 0; idx < Math.min(stillNoEmail2.length, maxSearch); idx++) {
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
        console.error("[scraping] googleSearch echec:", e);
      }
    }

    if (await isScrapingJobCancelled(jobId)) return;

    // ═══════════════════════════════════════════════════════════
    // PHASE 5 : Website Content Crawler — crawl profond
    //           (8 pages, profondeur 2) pour extraire emails du contenu
    // ═══════════════════════════════════════════════════════════
    const stillNoEmail3 = enriched.filter(
      (p) => p.emails.size === 0 && p.place.website
    );
    if (stillNoEmail3.length > 0) {
      const crawlUrls = stillNoEmail3
        .map((p) => p.place.website!)
        .slice(0, 80);

      await persistProgress(jobId, {
        phase: "Source 5 — Website Content Crawler (crawl profond)",
        percent: 63,
        detail: `Crawl profond de ${crawlUrls.length} site(s) (8 pages, profondeur 2)...`,
        runs: runEntries,
      });

      try {
        const contentMap = await scrapeWebsiteContent(crawlUrls, {
          shouldCancel,
        });

        for (const entry of enriched) {
          if (entry.emails.size > 0 || !entry.place.website) continue;
          const domain = extractDomain(entry.place.website);
          if (!domain) continue;
          const content = contentMap.get(domain);
          if (!content) continue;

          const allText = content.texts.join(" ");
          const found = extractEmails(allText);
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
        console.error("[scraping] websiteContentCrawler echec:", e);
      }
    }

    if (await isScrapingJobCancelled(jobId)) return;

    // ═══════════════════════════════════════════════════════════
    // PHASE 6 : Fallback direct (multi-pages, fetch maison)
    //           pour les fiches toujours sans email + enrichissement contact
    // ═══════════════════════════════════════════════════════════
    const needFallback = enriched.filter(
      (p) => p.emails.size === 0 && p.place.website
    );
    const needContact = enriched.filter(
      (p) => !p.contactName && p.place.website
    );
    const fallbackTargets = [
      ...new Map(
        [...needFallback, ...needContact].map((e) => [e.place.title, e])
      ).values(),
    ];

    if (fallbackTargets.length > 0) {
      const maxFallback = 150;
      const count = Math.min(fallbackTargets.length, maxFallback);

      await persistProgress(jobId, {
        phase: "Source 6 — Fallback multi-pages (fetch direct)",
        percent: 72,
        detail: `Scraping direct de ${count} site(s) : homepage + /contact + /about...`,
        runs: runEntries,
      });
      if (await isScrapingJobCancelled(jobId)) return;

      const CONCURRENCY = 8;
      for (let i = 0; i < count; i += CONCURRENCY) {
        if (await isScrapingJobCancelled(jobId)) return;
        const batch = fallbackTargets.slice(i, i + CONCURRENCY);
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

        if (i + CONCURRENCY < count) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 7 : Selectionner le meilleur email + import en base
    // ═══════════════════════════════════════════════════════════
    type FinalPlace = {
      place: (typeof allPlaces)[number];
      email: string;
      contactName: string | null;
    };

    const withEmail: FinalPlace[] = [];

    for (const entry of enriched) {
      const emailArr = [...entry.emails];
      if (emailArr.length === 0) {
        stats.skippedNoEmail++;
        continue;
      }
      const domain = entry.place.website
        ? extractDomain(entry.place.website) || undefined
        : undefined;
      const best = getBestEmail(emailArr, domain) || emailArr[0];
      withEmail.push({
        place: entry.place,
        email: best,
        contactName: entry.contactName,
      });
    }

    await persistProgress(jobId, {
      phase: "Import en base",
      percent: 88,
      detail: [
        `${withEmail.length} prospect(s) avec email`,
        `(${stats.skippedNoEmail} sans email)`,
        `Maps=${stats.fromMaps} Apify=${stats.fromApify} Deep=${stats.fromDeepApify} Google=${stats.fromGoogleSearch} Crawler=${stats.fromWebCrawler} Fallback=${stats.fromFallback}`,
      ].join(" | "),
      runs: runEntries,
    });

    const prospectsToCreate = withEmail.map(({ place, email, contactName }) => {
      const scoreInput = {
        description: place.description,
        categoryName: place.categoryName,
        country: place.country,
        email,
        website: place.website,
        title: place.title,
      };
      const scoring = calculateLeadScore(scoreInput);

      return {
        company: place.title,
        contact: contactName || null,
        email,
        country: place.country || "Unknown",
        website: place.website,
        phone: place.phone,
        sector: place.categoryName,
        clientType: inferClientType(scoreInput),
        product: inferProduct(scoreInput),
        score: scoring.score,
        source: "apify_google_maps",
        notes: `Score: ${scoring.grade} - ${scoring.reasons.join(", ")}`,
      };
    });

    const deduped = deduplicateItems(prospectsToCreate);

    let created = 0;
    let step = 0;
    for (const prospect of deduped) {
      step++;
      if (step % 12 === 0 && (await isScrapingJobCancelled(jobId))) return;
      try {
        await prisma.prospect.create({ data: prospect });
        created++;
      } catch {
        // duplicate
      }
    }

    await markJobCompleted(jobId, created, runEntries, stats);
  } catch (err) {
    if (err instanceof ScrapingCancelledError) return;
    const msg = truncateErr(
      err instanceof Error ? err.message : "Unknown error"
    );
    try {
      await prisma.scrapingJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: { status: "FAILED", errorMessage: msg, completedAt: new Date() },
      });
    } catch (e) {
      console.error("[scraping] impossible de marquer FAILED:", e);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────

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

function mergeContactMap(
  enriched: EnrichedPlace[],
  contactMap: Map<string, { emails: string[]; phones: string[] }>,
  source: EnrichedPlace["emailSource"],
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
      const cleaned = extractEmails(e);
      for (const c of cleaned) entry.emails.add(c);
    }
    if (entry.emails.size > before && !entry.emailSource) {
      entry.emailSource = source;
      switch (source) {
        case "apify":
          stats.fromApify++;
          break;
        case "deep-apify":
          stats.fromDeepApify++;
          break;
      }
    }
  }
}
