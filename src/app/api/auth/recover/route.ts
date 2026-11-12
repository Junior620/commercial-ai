import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/api";
import { sendAccessLink } from "@/lib/access-links";

const RecoverSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/** Anti-abus simple : une demande par adresse toutes les 2 minutes (par instance). */
const lastRequest = new Map<string, number>();
const THROTTLE_MS = 2 * 60 * 1000;

/**
 * « Mot de passe oublié ». Route publique : la réponse est identique que l'adresse
 * appartienne ou non à un membre, pour ne rien révéler sur l'équipe.
 */
export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, RecoverSchema);
  if (!parsed.ok) return parsed.response;
  const { email } = parsed.data;

  const now = Date.now();
  const recent = now - (lastRequest.get(email) ?? 0) < THROTTLE_MS;
  if (!recent) {
    lastRequest.set(email, now);
    if (lastRequest.size > 5000) lastRequest.clear();
    try {
      const member = await prisma.user.findUnique({ where: { email }, select: { active: true, name: true } });
      if (member?.active) {
        const result = await sendAccessLink({ email, kind: "recovery", name: member.name });
        if (!result.ok) console.error("[auth:recover]", result.error);
      }
    } catch (err) {
      console.error("[auth:recover]", err);
    }
  }
  return NextResponse.json({ ok: true });
}
