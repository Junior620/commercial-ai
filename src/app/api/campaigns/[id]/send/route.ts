import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest, EVENTS } from "@/lib/inngest";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { getDailyQuota } from "@/lib/sending";

/**
 * Déclenche un lot d'envoi. L'envoi réel (quota global, espacement, réservation
 * anti-doublon) est fait par la fonction Inngest « send-pending-emails ».
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
  if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  if (campaign.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Activez la campagne (après relecture des emails) avant de lancer l'envoi." },
      { status: 409 }
    );
  }

  const [quota, pending] = await Promise.all([
    getDailyQuota(),
    prisma.email.count({ where: { campaignId: id, status: "PENDING" } }),
  ]);
  if (quota.remaining <= 0) {
    return NextResponse.json({ queued: false, message: "Limite quotidienne atteinte", quota });
  }

  await inngest.send({ name: EVENTS.sendRequested, data: { campaignId: id, requestedBy: auth.user.email } });
  return NextResponse.json({ queued: true, pending, quota });
}
