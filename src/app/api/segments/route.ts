import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const segment = await prisma.segment.create({
      data: { name, description, filters: filters || {} },
    });

    // Auto-link matching prospects
    const where: Record<string, unknown> = {};
    if (filters.countries)
      where.country = { in: filters.countries };
    if (filters.sectors)
      where.sector = { in: filters.sectors };
    if (filters.clientTypes)
      where.clientType = { in: filters.clientTypes };
    if (filters.products)
      where.product = { in: filters.products };
    if (filters.priorities)
      where.priority = { in: filters.priorities };
    if (filters.languages)
      where.language = { in: filters.languages };
    if (filters.minScore)
      where.score = { gte: filters.minScore };
    if (filters.statuses)
      where.status = { in: filters.statuses };

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
