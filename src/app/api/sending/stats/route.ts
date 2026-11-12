import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { startOfTodayInTimeZone } from "@/lib/time";
import { getDailyQuota } from "@/lib/sending";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const today = startOfTodayInTimeZone();
  const [quota, pendingEmails, pendingReady, deliveredToday, openedToday, bouncedToday, failedToday, activeCampaigns, suppressed] =
    await Promise.all([
      getDailyQuota(),
      prisma.email.count({ where: { status: "PENDING" } }),
      // Prêts à partir : approuvés, dans une campagne active
      prisma.email.count({ where: { status: "PENDING", approvedAt: { not: null }, campaign: { status: "ACTIVE" } } }),
      prisma.email.count({ where: { deliveredAt: { gte: today } } }),
      prisma.email.count({ where: { openedAt: { gte: today } } }),
      prisma.email.count({ where: { status: "BOUNCED", sentAt: { gte: today } } }),
      prisma.email.count({ where: { status: "FAILED", updatedAt: { gte: today } } }),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.suppression.count(),
    ]);

  const sentToday = quota.sentToday;
  return NextResponse.json({
    pendingEmails,
    pendingReady,
    sentToday,
    deliveredToday,
    openedToday,
    bouncedToday,
    failedToday,
    openRate: deliveredToday > 0 ? Math.round((openedToday / deliveredToday) * 100) : 0,
    bounceRate: sentToday > 0 ? Math.round((bouncedToday / sentToday) * 100) : 0,
    dailyLimit: quota.dailyLimit,
    remainingToday: quota.remaining,
    activeCampaigns,
    suppressed,
    updatedAt: new Date().toISOString(),
  });
}
