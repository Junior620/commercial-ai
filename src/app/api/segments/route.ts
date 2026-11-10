import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import {
  buildProspectWhereFromFilters,
  hasTargetingCriteria,
  normalizeSegmentFilters,
} from "@/lib/segment-filters-normalize";

const SegmentSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

function filtersOf(segment: { filters: unknown }) {
  return normalizeSegmentFilters(
    segment.filters && typeof segment.filters === "object" ? (segment.filters as Record<string, unknown>) : {}
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const includeLiveCount = req.nextUrl.searchParams.get("live") === "1";
  const segments = await prisma.segment.findMany({
    include: { _count: { select: { prospectLinks: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!includeLiveCount) return NextResponse.json(segments);

  // Séquentiel : évite de saturer le petit pool de connexions Postgres.
  const withCounts = [];
  for (const segment of segments) {
    const filters = filtersOf(segment);
    const liveProspectsCount = hasTargetingCriteria(filters)
      ? await prisma.prospect.count({ where: buildProspectWhereFromFilters(filters) })
      : 0;
    withCounts.push({ ...segment, liveProspectsCount });
  }
  return NextResponse.json(withCounts);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, SegmentSchema);
  if (!parsed.ok) return parsed.response;
  const { name, description, filters } = parsed.data;
  const normalized = normalizeSegmentFilters(filters ?? {});
  if (!hasTargetingCriteria(normalized)) {
    return NextResponse.json({ error: "Définissez au moins un critère de ciblage" }, { status: 400 });
  }

  try {
    const segment = await prisma.segment.create({
      data: { name, description: description || null, filters: normalized as Prisma.InputJsonValue },
    });
    const matching = await prisma.prospect.findMany({
      where: buildProspectWhereFromFilters(normalized),
      select: { id: true },
    });
    if (matching.length) {
      await prisma.prospectSegment.createMany({
        data: matching.map((p) => ({ prospectId: p.id, segmentId: segment.id })),
        skipDuplicates: true,
      });
    }
    return NextResponse.json(segment, { status: 201 });
  } catch (err) {
    return serverError("segments:create", err, "Erreur de création du segment");
  }
}
