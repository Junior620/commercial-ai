import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest, EVENTS, queueErrorMessage } from "@/lib/inngest";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { listGenerationTargets } from "@/lib/campaign-generation";

/** Lance la génération IA en tâche de fond (Inngest, 5 emails en parallèle). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

  const targets = await listGenerationTargets(id);
  if (targets.length === 0) {
    return NextResponse.json({ queued: 0, message: "Aucun nouveau prospect à cibler pour cette campagne." });
  }

  try {
    await inngest.send({ name: EVENTS.generateRequested, data: { campaignId: id } });
  } catch (err) {
    console.error("[generate] mise en file impossible :", err);
    return NextResponse.json({ error: queueErrorMessage(err) }, { status: 503 });
  }
  return NextResponse.json({ queued: targets.length });
}
