import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildProspectWhereFromFilters,
  normalizeSegmentFilters,
} from "@/lib/segment-filters-normalize";

export async function GET() {
  const segments = await prisma.segment.findMany({
    include: { _count: { select: { prospectLinks: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(segments);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, filters } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Le nom est requis" },
        { status: 400 }
      );
    }

    const normalized = normalizeSegmentFilters(
      (filters || {}) as Record<string, unknown>
    );

    const segment = await prisma.segment.create({
      data: {
        name,
        description,
        filters: JSON.parse(JSON.stringify(normalized)) as Prisma.InputJsonValue,
      },
    });

    const where = buildProspectWhereFromFilters(normalized);

    if (Object.keys(where).length > 0) {
      const matchingProspects = await prisma.prospect.findMany({
        where,
        select: { id: true },
      });

      if (matchingProspects.length > 0) {
        await prisma.prospectSegment.createMany({
          data: matchingProspects.map((p) => ({
            prospectId: p.id,
            segmentId: segment.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json(segment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erreur de creation" },
      { status: 500 }
    );
  }
}
