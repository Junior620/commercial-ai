import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailBodyToHtml } from "@/lib/resend";

export async function POST() {
  try {
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });
    const dailyLimit = settings?.dailyEmailLimit ?? 50;
    const spacing = settings?.emailSpacingSeconds ?? 30;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentToday = await prisma.email.count({
      where: {
        sentAt: { gte: today },
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
      },
    });

    const remaining = dailyLimit - sentToday;
    if (remaining <= 0) {
      return NextResponse.json({ sent: 0, message: "Limite quotidienne atteinte" });
    }

    const pendingEmails = await prisma.email.findMany({
      where: {
        status: "PENDING",
        campaign: { status: "ACTIVE" },
      },
      include: { prospect: true, campaign: true },
      take: Math.min(remaining, 20),
    });

    let sent = 0;
    for (const email of pendingEmails) {
      try {
        const result = await sendEmail({
          to: email.prospect.email,
          subject: email.subject,
          html: emailBodyToHtml(email.body),
        });

        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            resendId: result?.id,
          },
        });

        await prisma.campaign.update({
          where: { id: email.campaignId },
          data: { sentCount: { increment: 1 } },
        });

        await prisma.prospect.update({
          where: { id: email.prospectId },
          data: {
            status: "CONTACTED",
            lastContactedAt: new Date(),
          },
        });

        sent++;

        if (spacing > 0 && sent < pendingEmails.length) {
          await new Promise((r) => setTimeout(r, spacing * 1000));
        }
      } catch {
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ sent });
  } catch {
    return NextResponse.json({ error: "Erreur d'envoi" }, { status: 500 });
  }
}
