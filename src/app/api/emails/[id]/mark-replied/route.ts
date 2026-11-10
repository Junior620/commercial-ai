import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { serverError } from "@/lib/api";

/**
 * Marque un email comme ayant reçu une réponse (saisie manuelle).
 * Idempotent : le compteur de réponses n'est incrémenté qu'une fois,
 * les relances en attente sont annulées et le prospect passe « En discussion ».
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const email = await prisma.email.findUnique({
      where: { id },
      select: { campaignId: true, prospectId: true, status: true },
    });
    if (!email) return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    if (email.status === "PENDING" || email.status === "SENDING") {
      return NextResponse.json({ error: "Cet email n'a pas encore été envoyé" }, { status: 400 });
    }

    const changed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.email.updateMany({
        where: { id, status: { not: "REPLIED" } },
        data: { status: "REPLIED", repliedAt: new Date() },
      });
      if (count === 0) return false;

      await tx.campaign.update({ where: { id: email.campaignId }, data: { replyCount: { increment: 1 } } });
      // Le prospect a répondu : on annule les relances encore en attente.
      await tx.email.updateMany({
        where: { campaignId: email.campaignId, prospectId: email.prospectId, status: "PENDING" },
        data: { status: "FAILED" },
      });
      await tx.prospect.updateMany({
        where: { id: email.prospectId, status: { in: ["NEW", "CONTACTED"] } },
        data: { status: "IN_DISCUSSION" },
      });
      const existing = await tx.response.findFirst({ where: { emailId: id }, select: { id: true } });
      if (!existing) {
        await tx.response.create({
          data: {
            emailId: id,
            prospectId: email.prospectId,
            content: `Réponse reçue (saisie manuelle par ${auth.user.email}).`,
            classification: "UNKNOWN",
          },
        });
      }
      return true;
    });

    return NextResponse.json({ ok: true, already: !changed });
  } catch (err) {
    return serverError("emails:mark-replied", err);
  }
}
