import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: { segment: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        segmentId: body.segmentId || null,
        product: body.product || null,
        language: body.language || "en",
        tone: body.tone || "FORMAL",
        maxFollowUps: body.maxFollowUps ?? 2,
        followUpDelayDays: body.followUpDelayDays ?? 4,
        dailyLimit: body.dailyLimit ?? 50,
        signature: body.signature || null,
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Erreur de creation" },
      { status: 500 }
    );
  }
}
