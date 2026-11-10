import { NextResponse } from "next/server";
import { inngest, EVENTS } from "@/lib/inngest";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { getDailyQuota } from "@/lib/sending";

/** Déclenche immédiatement un lot d'envoi (toutes campagnes actives). */
export async function POST() {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const quota = await getDailyQuota();
  if (quota.remaining <= 0) {
    return NextResponse.json({ queued: false, message: "Limite quotidienne atteinte", quota });
  }
  await inngest.send({ name: EVENTS.sendRequested, data: { requestedBy: auth.user.email } });
  return NextResponse.json({ queued: true, quota });
}
