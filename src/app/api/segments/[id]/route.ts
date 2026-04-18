import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
