import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Marque un email comme REPLIED (reponse recue hors webhook Resend).
 * Incremente replyCount sur la campagne une seule fois.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const email = await prisma.email.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!email) {
      return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }

    if (email.status === "REPLIED") {
      return NextResponse.json({ ok: true, already: true });
    }

    if (email.status === "PENDING") {
      return NextResponse.json(
        { error: "Impossible de marquer comme repondu un email non envoye" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.email.update({
        where: { id },
        data: { status: "REPLIED", repliedAt: new Date() },
      });
      await tx.campaign.update({
        where: { id: email.campaignId },
        data: { replyCount: { increment: 1 } },
      });
      const existingResponse = await tx.response.findFirst({
        where: { emailId: id },
      });
      if (!existingResponse) {
        await tx.response.create({
          data: {
            emailId: id,
            prospectId: email.prospectId,
            content:
              "Reponse recue — marquage manuel depuis la fiche campagne.",
            classification: "UNKNOWN",
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[mark-replied]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
