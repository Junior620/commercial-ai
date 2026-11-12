import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";

const CampaignCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis").max(120),
    segmentId: z.string().max(60).optional(),
    product: z.string().max(60).optional(),
    language: z.string().max(10).optional(),
    tone: z.enum(["FORMAL", "FRIENDLY", "TECHNICAL", "PREMIUM"]).optional(),
    maxFollowUps: z.number().int().min(0).max(3).optional(),
    followUpDelayDays: z.number().int().min(1).max(60).optional(),
    dailyLimit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const campaigns = await prisma.campaign.findMany({
    include: { segment: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, CampaignCreateSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  try {
    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        segmentId: data.segmentId || null,
        product: data.product || null,
        language: data.language || "auto",
        tone: data.tone || "FORMAL",
        maxFollowUps: data.maxFollowUps ?? 2,
        followUpDelayDays: data.followUpDelayDays ?? 4,
        dailyLimit: data.dailyLimit ?? 50,
        createdById: auth.user.id,
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    return serverError("campaigns:create", err, "Erreur de création de la campagne");
  }
}
