import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CampaignUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    segmentId: z.string().nullable().optional(),
    product: z.string().nullable().optional(),
    language: z.string().optional(),
    tone: z
      .enum(["FORMAL", "FRIENDLY", "TECHNICAL", "PREMIUM"])
      .optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    maxFollowUps: z.number().int().min(0).max(10).optional(),
    followUpDelayDays: z.number().int().min(1).max(60).optional(),
    dailyLimit: z.number().int().min(1).max(500).optional(),
    signature: z.string().nullable().optional(),
    subjectTemplate: z.string().nullable().optional(),
    bodyTemplate: z.string().nullable().optional(),
  })
  .strict();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      segment: { select: { name: true, id: true } },
      emails: {
        include: {
          prospect: { select: { company: true, email: true, contact: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campagne non trouvee" },
      { status: 404 }
    );
  }

  const failedCount = campaign.emails.filter((email) => email.status === "FAILED").length;

  return NextResponse.json({
    ...campaign,
    failedCount,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = CampaignUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Donnees invalides" },
        { status: 400 }
      );
    }
    let data = { ...parsed.data };
    if (data.segmentId === "") data = { ...data, segmentId: null };

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ a mettre a jour" },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data,
    });
    return NextResponse.json(campaign);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Campagne introuvable" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Campagne introuvable" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
