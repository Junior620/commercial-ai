import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scrapeGoogleMaps, getScrapingResults, scrapeContactInfo } from "@/lib/apify";
import { calculateLeadScore } from "@/lib/scoring";
import { deduplicateItems } from "@/lib/dedup";
import { getBestEmail } from "@/lib/email-extractor";
import Papa from "papaparse";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  const jobs = await prisma.scrapingJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(jobs);
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
        if (product && row.subcategory !== product) continue;
        if (countries && countries.length > 0) {
          if (row.geo_scope === "country" && !countries.includes(row.country)) continue;
        }
        keywords.push(row.keyword);
      }
    } catch {
      // CSV not found, use custom keywords only
    }

    keywords = [...new Set(keywords)].slice(0, 50);

    const job = await prisma.scrapingJob.create({
      data: {
        keywords: keywords,
        countries: countries || [],
        categories: categories || [],
        status: "RUNNING",
        startedAt: new Date(),
      },
    });

    // Launch async scraping
    processScraping(job.id, keywords, countries, maxResults).catch(
      console.error
    );

    return NextResponse.json(job, { status: 201 });
  } catch (err) {
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
  try {
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
    let allPlaces: Awaited<ReturnType<typeof getScrapingResults>> = [];

    for (const { runId } of results) {
      // Poll for completion
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 10000));
        try {
          const places = await getScrapingResults(runId);
          if (places.length > 0) {
            allPlaces = [...allPlaces, ...places];
            break;
          }
        } catch {
          break;
        }
        attempts++;
      }
    }

    // Extract emails from websites
    const websiteUrls = allPlaces
      .filter((p) => p.website)
      .map((p) => p.website!);

    let contactMap = new Map<string, { emails: string[]; phones: string[] }>();
    if (websiteUrls.length > 0) {
      try {
        contactMap = await scrapeContactInfo(websiteUrls.slice(0, 200));
      } catch {
        // Fallback: continue without enrichment
      }
    }

    const prospectsToCreate = allPlaces.map((place) => {
      let email: string | undefined;
      if (place.website) {
        const domain = place.website
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0];
        const contact = contactMap.get(domain);
        if (contact && contact.emails.length > 0) {
          email = getBestEmail(contact.emails) || contact.emails[0];
        }
      }

      const scoring = calculateLeadScore({
        description: place.description,
        categoryName: place.categoryName,
        country: place.country,
        email,
        website: place.website,
        title: place.title,
      });

      return {
        company: place.title,
        email: email || `contact@${place.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "unknown.com"}`,
        country: place.country || "Unknown",
        website: place.website,
        phone: place.phone,
        sector: place.categoryName,
        score: scoring.score,
        source: "apify_google_maps",
        notes: `Score: ${scoring.grade} - ${scoring.reasons.join(", ")}`,
      };
    });

    const deduped = deduplicateItems(prospectsToCreate);

    let created = 0;
    for (const prospect of deduped) {
      try {
        await prisma.prospect.create({ data: prospect });
        created++;
      } catch {
        // duplicate email, skip
      }
    }

    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        resultsCount: created,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.scrapingJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        completedAt: new Date(),
      },
    });
  }
}
