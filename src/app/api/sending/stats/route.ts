import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
  });

  const [
    pendingEmails,
    sentToday,
    deliveredToday,
    openedToday,
    bouncedToday,
    activeCampaigns,
  ] = await Promise.all([
    prisma.email.count({ where: { status: "PENDING" } }),
    prisma.email.count({
      where: {
        sentAt: { gte: today },
        status: { in: ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
      },
    }),
    prisma.email.count({
      where: {
        deliveredAt: { gte: today },
        status: { in: ["DELIVERED", "OPENED", "CLICKED", "REPLIED"] },
      },
    }),
    prisma.email.count({
      where: {
        openedAt: { gte: today },
        status: { in: ["OPENED", "CLICKED", "REPLIED"] },
      },
    }),
    prisma.email.count({
      where: {
        status: "BOUNCED",
        updatedAt: { gte: today },
      },
    }),
    prisma.campaign.count({ where: { status: "ACTIVE" } }),
  ]);

  const openRate = deliveredToday > 0 ? Math.round((openedToday / deliveredToday) * 100) : 0;
  const bounceRate =
    sentToday > 0 ? Math.round((bouncedToday / sentToday) * 100) : 0;

  return NextResponse.json({
    pendingEmails,
    sentToday,
    deliveredToday,
    openedToday,
    bouncedToday,
    openRate,
    bounceRate,
    dailyLimit: settings?.dailyEmailLimit ?? 50,
    activeCampaigns,
    updatedAt: new Date().toISOString(),
  });
}
