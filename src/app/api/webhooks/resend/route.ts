import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { computeEmailEventEffect, normalizeEventType } from "@/lib/email-events";
import { suppressEmail } from "@/lib/sending";

type WebhookPayload = {
  type?: string;
  data?: {
    email_id?: string;
    tags?: unknown;
    bounce?: { type?: string };
  };
};

function appEmailIdFromTags(tags: unknown): string | undefined {
  if (tags && typeof tags === "object" && !Array.isArray(tags)) {
    const v = (tags as Record<string, unknown>)["app_email_id"];
    return typeof v === "string" && v ? v : undefined;
  }
  if (Array.isArray(tags)) {
    const row = tags.find((x: { name?: string }) => x?.name === "app_email_id") as { value?: string } | undefined;
    return typeof row?.value === "string" ? row.value : undefined;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const svixId = req.headers.get("svix-id");

  let payload: WebhookPayload;
  if (secret) {
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Signature manquante" }, { status: 401 });
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
      payload = resend.webhooks.verify({
        payload: rawBody,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret: secret,
      }) as WebhookPayload;
    } catch {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[webhook resend] RESEND_WEBHOOK_SECRET absent : événement refusé");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  } else {
    console.warn("[webhook resend] RESEND_WEBHOOK_SECRET absent : signature non vérifiée (dev)");
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
    }
  }

  // Idempotence : Resend peut livrer plusieurs fois le même événement.
  if (svixId && (await prisma.webhookEvent.findUnique({ where: { id: svixId } }))) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const data = payload.data;
  const resendId = typeof data?.email_id === "string" ? data.email_id : undefined;
  const appId = appEmailIdFromTags(data?.tags);
  if (!resendId && !appId) return NextResponse.json({ ok: true });

  const email = await prisma.email.findFirst({
    where: { OR: [...(appId ? [{ id: appId }] : []), ...(resendId ? [{ resendId }] : [])] },
    include: { prospect: { select: { email: true } } },
  });
  if (!email) return NextResponse.json({ ok: true });

  const effect = computeEmailEventEffect(email, payload.type || "", { bounceType: data?.bounce?.type });

  if (Object.keys(effect.update).length > 0 || effect.increments.length > 0) {
    await prisma.$transaction([
      prisma.email.update({ where: { id: email.id }, data: effect.update }),
      ...(effect.increments.length
        ? [
            prisma.campaign.update({
              where: { id: email.campaignId },
              data: Object.fromEntries(effect.increments.map((c) => [c, { increment: 1 }])),
            }),
          ]
        : []),
    ]);
  }

  if (effect.suppress) {
    await suppressEmail(email.prospect.email, effect.suppress.reason, effect.suppress.prospectStatus);
  }

  if (svixId) {
    await prisma.webhookEvent
      .create({ data: { id: svixId, type: normalizeEventType(payload.type) } })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
