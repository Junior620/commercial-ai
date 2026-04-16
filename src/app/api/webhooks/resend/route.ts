import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

function normalizeEventType(type: string | undefined): string {
  if (!type) return "";
  return type.toLowerCase().replace(/^email\./, "");
}

function prismaIdFromTags(tags: unknown): string | undefined {
  if (tags == null) return undefined;
  if (typeof tags === "object" && !Array.isArray(tags)) {
    const v = (tags as Record<string, string>)["app_email_id"];
    if (typeof v === "string" && v.length > 0) return v;
  }
  if (Array.isArray(tags)) {
    const row = tags.find(
      (x: { name?: string; value?: string }) => x?.name === "app_email_id"
    );
    if (row?.value && typeof row.value === "string") return row.value;
  }
  return undefined;
}

function resolveAppEmailId(data: {
  email_id?: string;
  tags?: unknown;
}): { resendId?: string; prismaId?: string } {
  const resendId =
    typeof data.email_id === "string" ? data.email_id : undefined;
  const prismaId = prismaIdFromTags(data.tags);
  return { resendId, prismaId };
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

    let body: unknown;
    if (webhookSecret) {
      const svixId = req.headers.get("svix-id");
      const svixTimestamp = req.headers.get("svix-timestamp");
      const svixSignature = req.headers.get("svix-signature");
      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json(
          { error: "Missing webhook signature headers" },
          { status: 400 }
        );
      }
      const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
      body = resend.webhooks.verify({
        payload: rawBody,
        headers: {
          id: svixId,
          timestamp: svixTimestamp,
          signature: svixSignature,
        },
        webhookSecret,
      });
    } else {
      body = JSON.parse(rawBody);
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[webhook resend] RESEND_WEBHOOK_SECRET absent: verification signature desactivee"
        );
      }
    }

    const { type, data } = body as {
      type?: string;
      data?: {
        email_id?: string;
        tags?: unknown;
      };
    };

    if (!data || typeof data !== "object") {
      return NextResponse.json({ ok: true });
    }

    const { resendId, prismaId } = resolveAppEmailId(data);
    if (!resendId && !prismaId) {
      return NextResponse.json({ ok: true });
    }

    const email = await prisma.email.findFirst({
      where: {
        OR: [
          ...(resendId ? [{ resendId }] : []),
          ...(prismaId ? [{ id: prismaId }] : []),
        ],
      },
      include: { campaign: true },
    });

    if (!email) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[webhook resend] Email introuvable (resendId / tag app_email_id)",
          { type, resendId, prismaId }
        );
      }
      return NextResponse.json({ ok: true });
    }

    const evt = normalizeEventType(type);

    switch (evt) {
      case "sent":
      case "scheduled":
      case "queued":
        if (email.status === "PENDING") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "SENT", sentAt: email.sentAt ?? new Date() },
          });
        }
        break;

      case "delivered":
        if (email.status === "SENT" || email.status === "PENDING") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "DELIVERED", deliveredAt: new Date() },
          });
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { deliveredCount: { increment: 1 } },
          });
        }
        break;

      case "opened":
        if (email.status !== "OPENED" && email.status !== "CLICKED" && email.status !== "REPLIED") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "OPENED", openedAt: new Date() },
          });
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { openCount: { increment: 1 } },
          });
        }
        break;

      case "clicked":
        if (email.status !== "CLICKED" && email.status !== "REPLIED") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "CLICKED", clickedAt: new Date() },
          });
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { clickCount: { increment: 1 } },
          });
        }
        break;

      case "bounced":
        if (email.status !== "BOUNCED") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "BOUNCED" },
          });
          await prisma.campaign.update({
            where: { id: email.campaignId },
            data: { bounceCount: { increment: 1 } },
          });
        }
        break;

      // Statuts Resend non modélisés dans notre enum Prisma.
      // On les classe en FAILED pour éviter de laisser un email en SENT/PENDING.
      case "failed":
      case "canceled":
      case "suppressed":
      case "complained":
        if (email.status !== "FAILED") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "FAILED" },
          });
        }
        break;

      // Informationnel chez Resend: on garde SENT tant qu'il n'y a pas delivered/bounced/failed.
      case "delivery_delayed":
        if (email.status === "PENDING") {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: "SENT", sentAt: email.sentAt ?? new Date() },
          });
        }
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[webhook resend] verification/processing error:", error);
    }
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }
}
