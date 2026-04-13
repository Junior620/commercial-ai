import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!data?.email_id) {
      return NextResponse.json({ ok: true });
    }

    const email = await prisma.email.findFirst({
      where: { resendId: data.email_id },
      include: { campaign: true },
    });

    if (!email) {
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
