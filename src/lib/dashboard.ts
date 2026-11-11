import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE, startOfTodayInTimeZone } from "@/lib/time";
import { SENT_STATUSES } from "@/lib/sending";

const DAY = 24 * 60 * 60 * 1000;
const COMMERCIAL = { prospectType: "COMMERCIAL" as const };

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

function pct(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : null;
}

/**
 * Toutes les données du tableau de bord.
 * Requêtes exécutées en séquence (petit pool Postgres partagé) et regroupées
 * par GROUP BY plutôt qu'une requête par statut.
 */
export async function loadDashboard() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const today = startOfTodayInTimeZone();

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });

  const prospectStatus = await prisma.prospect.groupBy({ by: ["status"], where: COMMERCIAL, _count: { _all: true } });
  const statusCount = (s: string) => prospectStatus.find((p) => p.status === s)?._count._all ?? 0;
  const totalProspects = prospectStatus.reduce((sum, p) => sum + p._count._all, 0);
  const newProspects7d = await prisma.prospect.count({ where: { ...COMMERCIAL, createdAt: { gte: weekAgo } } });

  // Emails envoyés sur 30 jours, par statut (délivrabilité, ouvertures, réponses)
  const emails30 = await prisma.email.groupBy({
    by: ["status"],
    where: { sentAt: { gte: monthAgo }, status: { in: SENT_STATUSES } },
    _count: { _all: true },
  });
  const e30 = (statuses: string[]) =>
    emails30.filter((e) => statuses.includes(e.status)).reduce((s, e) => s + e._count._all, 0);
  const sent30 = e30(SENT_STATUSES);
  const delivered30 = e30(["DELIVERED", "OPENED", "CLICKED", "REPLIED"]);
  const opened30 = e30(["OPENED", "CLICKED", "REPLIED"]);
  const replied30 = e30(["REPLIED"]);
  const bounced30 = e30(["BOUNCED"]);
  const failed30 = await prisma.email.count({ where: { status: "FAILED", updatedAt: { gte: monthAgo } } });

  const sent7d = await prisma.email.count({ where: { sentAt: { gte: weekAgo }, status: { in: SENT_STATUSES } } });
  const sentPrev7d = await prisma.email.count({
    where: { sentAt: { gte: twoWeeksAgo, lt: weekAgo }, status: { in: SENT_STATUSES } },
  });
  const sentToday = await prisma.email.count({ where: { sentAt: { gte: today }, status: { in: SENT_STATUSES } } });
  const replies7d = await prisma.email.count({ where: { repliedAt: { gte: weekAgo } } });

  const volumeRows = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT to_char(("sentAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIMEZONE})::date, 'YYYY-MM-DD') AS day,
           count(*) AS count
    FROM "emails"
    WHERE "sentAt" >= ${weekAgo}
    GROUP BY 1`;
  const volumeByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * DAY);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);
    const row = volumeRows.find((r) => r.day === key);
    return { day: key, count: row ? Number(row.count) : 0 };
  });

  const pendingReview = await prisma.email.groupBy({
    by: ["campaignId"],
    where: { status: "PENDING", campaign: { status: { in: ["DRAFT", "PAUSED"] } } },
    _count: { _all: true },
  });
  const pendingReviewTotal = pendingReview.reduce((s, r) => s + r._count._all, 0);

  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: { id: true, name: true, sentCount: true, openCount: true, replyCount: true, bounceCount: true, deliveredCount: true },
  });

  const hotNotContacted = await prisma.prospect.findMany({
    where: { ...COMMERCIAL, status: "NEW", score: { gte: 50 }, emails: { none: {} } },
    orderBy: { score: "desc" },
    take: 6,
    select: { id: true, company: true, country: true, score: true },
  });
  const inDiscussion = await prisma.prospect.findMany({
    where: { ...COMMERCIAL, status: "IN_DISCUSSION" },
    orderBy: { updatedAt: "desc" },
    take: 6,
    select: { id: true, company: true, country: true, updatedAt: true },
  });

  const byCountry = await prisma.prospect.groupBy({
    by: ["country"],
    where: COMMERCIAL,
    _count: { _all: true },
    orderBy: { _count: { country: "desc" } },
    take: 8,
  });

  const lastScrape = await prisma.scrapingJob.findFirst({
    where: { kind: "COMMERCIAL" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, resultsCount: true, createdAt: true, completedAt: true, errorMessage: true },
  });
  const failedScrapes7d = await prisma.scrapingJob.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } });
  const suppressed = await prisma.suppression.count();

  const dailyCap = settings?.dailyEmailLimit ?? 50;
  const bounceThreshold = settings?.alertBouncePctThreshold ?? 5;
  const bounceRate = pct(bounced30, sent30);

  const alerts: { level: "warning" | "danger" | "info"; message: string; href?: string }[] = [];
  if (pendingReviewTotal > 0) {
    alerts.push({
      level: "info",
      message: `${pendingReviewTotal} email(s) attendent votre relecture avant activation de leur campagne.`,
      href: pendingReview.length === 1 ? `/campaigns/${pendingReview[0].campaignId}` : "/campaigns",
    });
  }
  if (bounceRate !== null && bounceRate >= bounceThreshold) {
    alerts.push({
      level: "danger",
      message: `Taux de rebond sur 30 jours de ${bounceRate} % (seuil ${bounceThreshold} %). Réduisez le volume et vérifiez la qualité des listes.`,
      href: "/sending",
    });
  }
  if (failedScrapes7d > 0) {
    alerts.push({ level: "warning", message: `${failedScrapes7d} recherche(s) de prospects en échec cette semaine.`, href: "/scraping" });
  }

  return {
    targets: {
      emails: settings?.weeklyEmailTarget ?? 200,
      prospects: settings?.weeklyNewProspectTarget ?? 30,
      replies: settings?.weeklyReplyTarget ?? 5,
    },
    kpis: {
      totalProspects,
      newProspects7d,
      sent7d,
      sentTrend: sentPrev7d > 0 ? Math.round(((sent7d - sentPrev7d) / sentPrev7d) * 100) : null,
      openRate: pct(opened30, delivered30),
      replyRate: pct(replied30, sent30),
      replies7d,
    },
    pipeline: [
      { status: "NEW", value: statusCount("NEW") },
      { status: "CONTACTED", value: statusCount("CONTACTED") },
      { status: "IN_DISCUSSION", value: statusCount("IN_DISCUSSION") },
      { status: "CONVERTED", value: statusCount("CONVERTED") },
    ],
    health: {
      sent30,
      deliverability: pct(delivered30, sent30),
      bounceRate,
      bounceThreshold,
      failed30,
      suppressed,
    },
    sending: { sentToday, dailyCap, volumeByDay },
    alerts,
    activeCampaigns,
    hotNotContacted,
    inDiscussion,
    byCountry: byCountry.map((c) => ({ country: c.country, count: c._count._all })),
    lastScrape,
  };
}
