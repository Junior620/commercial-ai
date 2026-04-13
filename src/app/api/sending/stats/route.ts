import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const [pendingEmails, sentToday, activeCampaigns] = await Promise.all([
    prisma.email.count({ where: { status: "PENDING" } }),
    prisma.email.count({
      where: {
        sentAt: { gte: today },
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
      },
    }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
  ]);

  return NextResponse.json({
    pendingEmails,
    sentToday,
    dailyLimit: settings?.dailyEmailLimit ?? 50,
    activeCampaigns,
  });
}
