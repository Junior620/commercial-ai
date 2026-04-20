import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CampaignCreateSchema = z
  .object({
    name: z.string().min(1),
    segmentId: z.string().optional(),
    product: z.string().optional(),
    language: z.string().optional(),
    tone: z.enum(["FORMAL", "FRIENDLY", "TECHNICAL", "PREMIUM"]).optional(),
    maxFollowUps: z.number().int().min(0).max(10).optional(),
    followUpDelayDays: z.number().int().min(1).max(60).optional(),
    dailyLimit: z.number().int().min(1).max(500).optional(),
    signature: z.string().optional(),
  })
  .strict();

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
    const parsed = CampaignCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Donnees invalides" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        segmentId: data.segmentId || null,
        product: data.product || null,
        language: data.language || "en",
        tone: data.tone || "FORMAL",
        maxFollowUps: data.maxFollowUps ?? 2,
        followUpDelayDays: data.followUpDelayDays ?? 4,
        dailyLimit: data.dailyLimit ?? 50,
        signature: data.signature || null,
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
