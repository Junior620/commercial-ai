import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, emailBodyToHtml } from "@/lib/resend";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) {
      return NextResponse.json({ error: "Campagne non trouvee" }, { status: 404 });
    }

    // Get app settings for daily limit
    const settings = await prisma.appSettings.findUnique({
      where: { id: "default" },
    });
    const dailyLimit = settings?.dailyEmailLimit || campaign.dailyLimit;
    const spacing = settings?.emailSpacingSeconds || 30;

    // Count emails sent today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sentToday = await prisma.email.count({
      where: {
        campaignId: id,
        sentAt: { gte: today },
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
      },
    });

    const remaining = dailyLimit - sentToday;
    if (remaining <= 0) {
      return NextResponse.json({ sent: 0, message: "Limite quotidienne atteinte" });
    }

    const pendingEmails = await prisma.email.findMany({
      where: { campaignId: id, status: "PENDING" },
      include: { prospect: true },
      take: Math.min(remaining, 20),
    });

    let sent = 0;
    for (const email of pendingEmails) {
      try {
        const result = await sendEmail({
          to: email.prospect.email,
          subject: email.subject,
          html: emailBodyToHtml(email.body),
          tags: [{ name: "app_email_id", value: email.id }],
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
          where: { id },
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

        // Spacing between emails
        if (spacing > 0 && sent < pendingEmails.length) {
          await new Promise((r) => setTimeout(r, spacing * 1000));
        }
      } catch (err) {
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
