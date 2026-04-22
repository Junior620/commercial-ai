import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildProspectWhereFromFilters,
  normalizeSegmentFilters,
} from "@/lib/segment-filters-normalize";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    Object.keys(where).length > 0
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
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Identifiant manquant" }, { status: 400 });
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
