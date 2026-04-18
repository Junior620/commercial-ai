import { prisma } from "@/lib/prisma";

const MS_DAY = 24 * 60 * 60 * 1000;

export type DashboardExtra = Awaited<ReturnType<typeof getDashboardExtras>>;

export async function getDashboardExtras() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * MS_DAY);
  const thirtyDaysAgo = new Date(now - 30 * MS_DAY);
  const thirtyDaysContact = new Date(now - 30 * MS_DAY);

  const [
    settings,
    weeklyEmailsSent,
    weeklyNewProspects,
    weeklyRepliesMarked,
    hotNewNoOutreach,
    staleContacted,
    segments,
    emailsForVolume,
    attempted30,
    bounced30,
    prospectsBySource,
    failedScrapes7d,
    recentBouncedSamples,
  ] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    prisma.email.count({
      where: {
        sentAt: { gte: weekAgo },
        NOT: { status: "PENDING" },
      },
    }),
    prisma.prospect.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.email.count({
      where: {
        status: "REPLIED",
        repliedAt: { gte: weekAgo },
      },
    }),
    prisma.prospect.findMany({
      where: {
        status: "NEW",
        score: { gte: 50 },
        NOT: {
          emails: { some: { NOT: { status: "PENDING" } } },
        },
      },
      orderBy: { score: "desc" },
      take: 8,
      select: {
        id: true,
        company: true,
        email: true,
        country: true,
        score: true,
      },
    }),
    prisma.prospect.findMany({
      where: {
        status: "CONTACTED",
        OR: [
          { lastContactedAt: { lt: thirtyDaysContact } },
          { lastContactedAt: null },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        company: true,
        email: true,
        country: true,
        lastContactedAt: true,
      },
    }),
    prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        _count: { select: { prospectLinks: true } },
      },
    }),
    prisma.email.findMany({
      where: { sentAt: { gte: new Date(now - 7 * MS_DAY) } },
      select: { sentAt: true },
    }),
    prisma.email.count({
      where: {
        sentAt: { gte: thirtyDaysAgo },
        NOT: { status: "PENDING" },
      },
    }),
    prisma.email.count({
      where: {
        status: "BOUNCED",
        sentAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.prospect.groupBy({
      by: ["source"],
      _count: true,
      orderBy: { _count: { source: "desc" } },
      take: 12,
    }),
    prisma.scrapingJob.count({
      where: {
        status: "FAILED",
        createdAt: { gte: weekAgo },
      },
    }),
    prisma.email.findMany({
      where: { status: "BOUNCED" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        subject: true,
        prospect: { select: { company: true, email: true } },
      },
    }),
  ]);

  const byDay = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * MS_DAY);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, 0);
  }
  for (const e of emailsForVolume) {
    if (!e.sentAt) continue;
    const key = e.sentAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const sendVolumeByDay = [...byDay.entries()].map(([day, count]) => ({
    day,
    count,
  }));

  const bounceRate30 =
    attempted30 > 0
      ? ((bounced30 / attempted30) * 100).toFixed(1)
      : "0";

  const threshold = settings?.alertBouncePctThreshold ?? 5;
  const alerts: { level: "warning" | "danger"; message: string }[] = [];
  if (failedScrapes7d > 0) {
    alerts.push({
      level: "danger",
      message: `${failedScrapes7d} job(s) de scraping en echec sur 7 jours — verifier la page Scraping.`,
    });
  }
  if (Number(bounceRate30) >= threshold) {
    alerts.push({
      level: "warning",
      message: `Taux de rebond 30j (${bounceRate30}%) au-dessus du seuil (${threshold}%) — verifier listes et domaine.`,
    });
  }

  const dailyCap = settings?.dailyEmailLimit ?? 50;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.email.count({
    where: {
      sentAt: { gte: todayStart },
      NOT: { status: "PENDING" },
    },
  });

  return {
    targets: {
      weeklyEmail: settings?.weeklyEmailTarget ?? 200,
      weeklyProspects: settings?.weeklyNewProspectTarget ?? 30,
      weeklyReplies: settings?.weeklyReplyTarget ?? 5,
      bounceAlertThreshold: threshold,
    },
    progress: {
      weeklyEmailsSent,
      weeklyNewProspects,
      weeklyRepliesMarked,
    },
    hotNewNoOutreach,
    staleContacted,
    segments,
    sendVolumeByDay,
    bounceRate30,
    attempted30,
    bounced30,
    prospectsBySource: prospectsBySource.map((p) => ({
      source: p.source || "(non renseigne)",
      count: p._count,
    })),
    alerts,
    recentBouncedSamples,
    dailyCap,
    sentToday,
  };
}
