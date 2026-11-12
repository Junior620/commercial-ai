import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { inngest, EVENTS } from "@/lib/inngest";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";

const RegenerateSchema = z
  .object({
    /** Emails à rédiger à nouveau ; absent = tous les brouillons non approuvés de la campagne */
    emailIds: z.array(z.string().max(60)).min(1).max(2000).optional(),
  })
  .strict();

const FOLLOW_UP_NUMBER: Record<string, number> = { FOLLOWUP_1: 1, FOLLOWUP_2: 2, FOLLOWUP_3: 3 };

/**
 * « Rédiger à nouveau » : supprime des brouillons non approuvés et relance leur rédaction
 * (avec l'argumentaire et le ciblage actuels). Les emails approuvés ou déjà partis ne sont jamais touchés.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, RegenerateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const drafts = await prisma.email.findMany({
      where: {
        campaignId: id,
        status: "PENDING",
        approvedAt: null,
        sentAt: null,
        ...(parsed.data.emailIds ? { id: { in: parsed.data.emailIds } } : {}),
      },
      select: { id: true, prospectId: true, type: true },
    });
    if (drafts.length === 0) {
      return NextResponse.json({ queued: 0, message: "Aucun brouillon non approuvé à rédiger à nouveau." });
    }

    await prisma.email.deleteMany({ where: { id: { in: drafts.map((d) => d.id) }, approvedAt: null, sentAt: null } });

    const events = drafts.map((d) =>
      d.type === "INITIAL"
        ? { name: EVENTS.generateProspect, data: { campaignId: id, prospectId: d.prospectId } }
        : { name: EVENTS.followUpRequested, data: { campaignId: id, prospectId: d.prospectId, followUpNumber: FOLLOW_UP_NUMBER[d.type] ?? 1 } }
    );
    for (let i = 0; i < events.length; i += 200) await inngest.send(events.slice(i, i + 200));

    return NextResponse.json({ queued: drafts.length });
  } catch (err) {
    return serverError("campaigns:regenerate", err, "La rédaction n'a pas pu être relancée. Vérifiez que les tâches de fond sont démarrées.");
  }
}
