import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, prismaErrorCode, serverError } from "@/lib/api";

const CampaignUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    segmentId: z.string().max(60).nullable().optional(),
    product: z.string().max(60).nullable().optional(),
    language: z.string().max(10).optional(),
    tone: z.enum(["FORMAL", "FRIENDLY", "TECHNICAL", "PREMIUM"]).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    maxFollowUps: z.number().int().min(0).max(3).optional(),
    followUpDelayDays: z.number().int().min(1).max(60).optional(),
    dailyLimit: z.number().int().min(1).max(500).optional(),
    signature: z.string().max(2000).nullable().optional(),
    subjectTemplate: z.string().max(500).nullable().optional(),
    bodyTemplate: z.string().max(10000).nullable().optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: { select: { name: true, id: true } },
      emails: {
        include: { prospect: { select: { company: true, email: true, contact: true } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

  const [failedCount, pendingCount] = await Promise.all([
    prisma.email.count({ where: { campaignId: id, status: "FAILED" } }),
    prisma.email.count({ where: { campaignId: id, status: "PENDING" } }),
  ]);
  return NextResponse.json({ ...campaign, failedCount, pendingCount });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, CampaignUpdateSchema);
  if (!parsed.ok) return parsed.response;

  const data = { ...parsed.data, ...(parsed.data.segmentId === "" ? { segmentId: null } : {}) };
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  // Activer = approuver le lot : il faut au moins un email relu et prêt à partir.
  if (data.status === "ACTIVE") {
    const ready = await prisma.email.count({ where: { campaignId: id, status: { in: ["PENDING", "SENT", "DELIVERED", "OPENED", "CLICKED"] } } });
    if (ready === 0) {
      return NextResponse.json(
        { error: "Générez et relisez les emails avant d'activer la campagne." },
        { status: 409 }
      );
    }
  }

  try {
    const campaign = await prisma.campaign.update({ where: { id }, data });
    return NextResponse.json(campaign);
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") {
      return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    }
    return serverError("campaigns:update", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireUser(["ADMIN", "COMMERCIAL"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") {
      return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    }
    return serverError("campaigns:delete", err);
  }
}
