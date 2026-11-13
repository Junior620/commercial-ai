import { NextResponse } from "next/server";
import { inngest, EVENTS, queueErrorMessage } from "@/lib/inngest";
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
  try {
    await inngest.send({ name: EVENTS.sendRequested, data: { requestedBy: auth.user.email } });
  } catch (err) {
    console.error("[batch] mise en file impossible :", err);
    return NextResponse.json({ error: queueErrorMessage(err) }, { status: 503 });
  }
  return NextResponse.json({ queued: true, quota });
}
