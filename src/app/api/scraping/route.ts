import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest, EVENTS } from "@/lib/inngest";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import { SCRAPING_LIMITS, buildKeywords } from "@/lib/scraping/pipeline";

const ScrapingSchema = z.object({
  categories: z.array(z.string().max(100)).max(50).optional(),
  countries: z.array(z.string().trim().min(1).max(80)).max(SCRAPING_LIMITS.maxCountries).optional(),
  product: z.string().max(60).optional().nullable(),
  customKeywords: z.array(z.string().trim().min(1).max(120)).max(SCRAPING_LIMITS.maxKeywords).optional(),
  maxResults: z.coerce.number().int().min(5).max(SCRAPING_LIMITS.maxResultsPerSearch).optional(),
  maxKeywords: z.coerce.number().int().min(1).max(SCRAPING_LIMITS.maxKeywords).optional(),
});

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const page = Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("page")) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(req.nextUrl.searchParams.get("pageSize")) || 10)));
  const where = { kind: "COMMERCIAL" as const };

  const [total, runningCount, jobs] = await Promise.all([
    prisma.scrapingJob.count({ where }),
    prisma.scrapingJob.count({ where: { ...where, status: "RUNNING" } }),
    prisma.scrapingJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return NextResponse.json({
    items: jobs,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    runningCount,
    limits: SCRAPING_LIMITS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, ScrapingSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  if (!process.env.APIFY_API_TOKEN?.trim()) {
    return NextResponse.json({ error: "APIFY_API_TOKEN n'est pas configuré sur le serveur." }, { status: 503 });
  }

  const running = await prisma.scrapingJob.count({ where: { status: "RUNNING" } });
  if (running > 0) {
    return NextResponse.json(
      { error: "Un scraping est déjà en cours. Attendez sa fin ou annulez-le avant d'en lancer un autre." },
      { status: 409 }
    );
  }

  const countries = input.countries ?? [];
  const keywords = buildKeywords({
    categories: input.categories,
    countries,
    product: input.product || undefined,
    customKeywords: input.customKeywords,
    maxKeywords: input.maxKeywords,
  });
  if (keywords.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucun mot-clé ne correspond aux filtres. Assouplissez les filtres ou ajoutez des mots-clés personnalisés (un par ligne).",
      },
      { status: 400 }
    );
  }

  try {
    const maxResults = input.maxResults ?? SCRAPING_LIMITS.defaultResultsPerSearch;
    const job = await prisma.scrapingJob.create({
      data: {
        keywords,
        countries,
        categories: input.categories ?? [],
        kind: "COMMERCIAL",
        status: "RUNNING",
        startedAt: new Date(),
        progress: { phase: "En file d'attente", percent: 1, updatedAt: new Date().toISOString() },
      },
    });
    await inngest.send({ name: EVENTS.scrapingRequested, data: { jobId: job.id, keywords, countries, maxResults } });
    return NextResponse.json(job, { status: 201 });
  } catch (err) {
    return serverError("scraping:create", err, "Erreur de lancement du scraping");
  }
}
