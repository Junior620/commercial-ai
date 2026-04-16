import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const body = await req.json();
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

    switch (type) {
      case "email.delivered":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "DELIVERED", deliveredAt: new Date() },
        });
        await prisma.campaign.update({
          where: { id: email.campaignId },
          data: { deliveredCount: { increment: 1 } },
        });
        break;

      case "email.opened":
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

      case "email.clicked":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "CLICKED", clickedAt: new Date() },
        });
        await prisma.campaign.update({
          where: { id: email.campaignId },
          data: { clickCount: { increment: 1 } },
        });
        break;

      case "email.bounced":
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "BOUNCED" },
        });
        await prisma.campaign.update({
          where: { id: email.campaignId },
          data: { bounceCount: { increment: 1 } },
        });
        break;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
