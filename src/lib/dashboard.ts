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
 * Toutes les données du tableau de bord, en deux lots de requêtes parallèles
 * (regroupées par GROUP BY / FILTER plutôt qu'une requête par compteur).
 */
export async function loadDashboard() {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);
  const monthAgo = new Date(now.getTime() - 30 * DAY);
  const today = startOfTodayInTimeZone();

  const sentList = SENT_STATUSES.map((st) => `'${st}'`).join(",");

  // Lot 1 : agrégats (exécutés en parallèle, dans la limite du pool Postgres)
  const [settings, prospectStatus, newProspects7d, emails30, emailCounts, volumeRows, pendingReview, byCountry] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    prisma.prospect.groupBy({ by: ["status"], where: COMMERCIAL, _count: { _all: true } }),
    prisma.prospect.count({ where: { ...COMMERCIAL, createdAt: { gte: weekAgo } } }),
    prisma.email.groupBy({
      by: ["status"],
      where: { sentAt: { gte: monthAgo }, status: { in: SENT_STATUSES } },
      _count: { _all: true },
    }),
    // Un seul passage sur la table emails pour les compteurs de la semaine
    prisma.$queryRawUnsafe<{ sent7d: bigint; sentprev7d: bigint; senttoday: bigint; replies7d: bigint; failed30: bigint }[]>(
      `SELECT
         count(*) FILTER (WHERE "sentAt" >= $1 AND status::text IN (${sentList})) AS sent7d,
         count(*) FILTER (WHERE "sentAt" >= $2 AND "sentAt" < $1 AND status::text IN (${sentList})) AS sentprev7d,
         count(*) FILTER (WHERE "sentAt" >= $3 AND status::text IN (${sentList})) AS senttoday,
         count(*) FILTER (WHERE "repliedAt" >= $1) AS replies7d,
         count(*) FILTER (WHERE status::text = 'FAILED' AND "updatedAt" >= $4) AS failed30
       FROM "emails"
       WHERE "sentAt" >= $2 OR "repliedAt" >= $1 OR "updatedAt" >= $4`,
      weekAgo,
      twoWeeksAgo,
      today,
      monthAgo
    ),
    prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT to_char(("sentAt" AT TIME ZONE 'UTC' AT TIME ZONE ${APP_TIMEZONE})::date, 'YYYY-MM-DD') AS day,
             count(*) AS count
      FROM "emails"
      WHERE "sentAt" >= ${weekAgo}
      GROUP BY 1`,
    prisma.email.groupBy({
      by: ["campaignId"],
      where: { status: "PENDING", campaign: { status: { in: ["DRAFT", "PAUSED"] } } },
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({
      by: ["country"],
      where: COMMERCIAL,
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),
  ]);

  // Lot 2 : listes
  const [reviewCampaigns, activeCampaigns, hotNotContacted, inDiscussion, lastScrape, failedScrapes7d, suppressed] = await Promise.all([
    pendingReview.length
      ? prisma.campaign.findMany({
          where: { id: { in: pendingReview.map((r) => r.campaignId) } },
          select: { id: true, name: true, status: true, segment: { select: { name: true } } },
        })
      : Promise.resolve([]),
    prisma.campaign.findMany({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, sentCount: true, openCount: true, replyCount: true, bounceCount: true, deliveredCount: true },
    }),
    prisma.prospect.findMany({
      where: { ...COMMERCIAL, status: "NEW", score: { gte: 50 }, emails: { none: {} } },
      orderBy: { score: "desc" },
      take: 6,
      select: { id: true, company: true, country: true, score: true },
    }),
    prisma.prospect.findMany({
      where: { ...COMMERCIAL, status: "IN_DISCUSSION" },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, company: true, country: true, updatedAt: true },
    }),
    prisma.scrapingJob.findFirst({
      where: { kind: "COMMERCIAL" },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, resultsCount: true, createdAt: true, completedAt: true, errorMessage: true },
    }),
    prisma.scrapingJob.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
    prisma.suppression.count(),
  ]);

  const statusCount = (st: string) => prospectStatus.find((p) => p.status === st)?._count._all ?? 0;
  const totalProspects = prospectStatus.reduce((sum, p) => sum + p._count._all, 0);
  const e30 = (statuses: string[]) =>
    emails30.filter((e) => statuses.includes(e.status)).reduce((sum, e) => sum + e._count._all, 0);
  const sent30 = e30(SENT_STATUSES);
  const delivered30 = e30(["DELIVERED", "OPENED", "CLICKED", "REPLIED"]);
  const opened30 = e30(["OPENED", "CLICKED", "REPLIED"]);
  const replied30 = e30(["REPLIED"]);
  const bounced30 = e30(["BOUNCED"]);
  const counts = emailCounts[0];
  const sent7d = Number(counts?.sent7d ?? 0);
  const sentPrev7d = Number(counts?.sentprev7d ?? 0);
  const sentToday = Number(counts?.senttoday ?? 0);
  const replies7d = Number(counts?.replies7d ?? 0);
  const failed30 = Number(counts?.failed30 ?? 0);

  const volumeByDay = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() - (6 - i) * DAY);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(d);
    const row = volumeRows.find((r) => r.day === key);
    return { day: key, count: row ? Number(row.count) : 0 };
  });

  const pendingReviewTotal = pendingReview.reduce((sum, r) => sum + r._count._all, 0);
  const campaignsToReview = reviewCampaigns
    .map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      segment: c.segment?.name ?? null,
      pending: pendingReview.find((r) => r.campaignId === c.id)?._count._all ?? 0,
    }))
    .sort((a, b) => b.pending - a.pending)
    .slice(0, 5);

  const dailyCap = settings?.dailyEmailLimit ?? 50;
  const bounceThreshold = settings?.alertBouncePctThreshold ?? 5;
  const bounceRate = pct(bounced30, sent30);

  const alerts: { level: "warning" | "danger" | "info"; message: string; href?: string; cta?: string }[] = [];
  if (pendingReviewTotal > 0) {
    alerts.push({
      level: "info",
      message: `${pendingReviewTotal} email(s) rédigé(s) attendent votre relecture. Une fois relus, activez la campagne pour lancer l'envoi.`,
      href: campaignsToReview[0] ? `/campaigns/${campaignsToReview[0].id}` : "/campaigns",
      cta: "Relire les emails",
    });
  }
  if (bounceRate !== null && bounceRate >= bounceThreshold) {
    alerts.push({
      level: "danger",
      message: `Taux de rebond sur 30 jours de ${bounceRate} % (seuil ${bounceThreshold} %). Réduisez le volume et vérifiez la qualité des listes.`,
      href: "/sending",
      cta: "Voir l'envoi",
    });
  }
  if (failedScrapes7d > 0) {
    alerts.push({ level: "warning", message: `${failedScrapes7d} recherche(s) de prospects en échec cette semaine.`, href: "/scraping", cta: "Voir les recherches" });
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
    campaignsToReview,
    pendingReviewTotal,
    hotNotContacted,
    inDiscussion,
    byCountry: byCountry.map((c) => ({ country: c.country, count: c._count._all })),
    lastScrape,
  };
}
