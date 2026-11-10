import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProspectWhereFromFilters,
  hasTargetingCriteria,
  normalizeSegmentFilters,
} from "@/lib/segment-filters-normalize";
import { requireUser, WRITE_ROLES } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
  }

  const segment = await prisma.segment.findUnique({
    where: { id },
    include: { _count: { select: { prospectLinks: true } } },
  });

  if (!segment) {
    return NextResponse.json({ error: "Segment introuvable" }, { status: 404 });
  }

  const rawFilters =
    segment.filters && typeof segment.filters === "object"
      ? (segment.filters as Record<string, unknown>)
      : {};
  const normalized = normalizeSegmentFilters(rawFilters);
  const where = buildProspectWhereFromFilters(normalized);

  const prospects =
    hasTargetingCriteria(normalized)
      ? await prisma.prospect.findMany({
          where,
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 250,
          select: {
            id: true,
            company: true,
            contact: true,
            email: true,
            country: true,
            sector: true,
            clientType: true,
            product: true,
            language: true,
            score: true,
            status: true,
            priority: true,
            source: true,
            createdAt: true,
          },
        })
      : [];

  return NextResponse.json({
    id: segment.id,
    name: segment.name,
    description: segment.description,
    filters: normalized,
    linkedProspectsCount: segment._count.prospectLinks,
    liveProspectsCount: prospects.length,
    prospects,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
  }

  // Sans segment, une campagne ciblerait tous les prospects : on bloque la suppression.
  const linked = await prisma.campaign.count({
    where: { segmentId: id, status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
  });
  if (linked > 0) {
    return NextResponse.json(
      { error: `Ce segment est utilisé par ${linked} campagne(s) en cours. Terminez-les ou changez leur segment avant de le supprimer.` },
      { status: 409 }
    );
  }

  try {
    await prisma.$transaction([
      prisma.campaign.updateMany({
        where: { segmentId: id },
        data: { segmentId: null },
      }),
      prisma.segment.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Impossible de supprimer ce segment" },
      { status: 500 }
    );
  }
}
