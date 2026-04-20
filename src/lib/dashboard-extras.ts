import { prisma } from "@/lib/prisma";

const MS_DAY = 24 * 60 * 60 * 1000;

export type DashboardExtra = {
  targets: {
    weeklyEmail: number;
    weeklyProspects: number;
    weeklyReplies: number;
    bounceAlertThreshold: number;
  };
  progress: {
    weeklyEmailsSent: number;
    weeklyNewProspects: number;
    weeklyRepliesMarked: number;
  };
  hotNewNoOutreach: Array<{
    id: string;
    company: string;
    email: string;
    country: string;
    score: number;
  }>;
  staleContacted: Array<{
    id: string;
    company: string;
    email: string;
    country: string;
    lastContactedAt: Date | null;
  }>;
  segments: Array<{
    id: string;
    name: string;
    _count: { prospectLinks: number };
  }>;
  sendVolumeByDay: Array<{ day: string; count: number }>;
  bounceRate30: string;
  attempted30: number;
  bounced30: number;
  prospectsBySource: Array<{ source: string; count: number }>;
  alerts: Array<{ level: "warning" | "danger"; message: string }>;
  recentBouncedSamples: Array<{
    id: string;
    subject: string;
    prospect: { company: string; email: string };
  }>;
  dailyCap: number;
  sentToday: number;
};

function emptyWeekVolume(): { day: string; count: number }[] {
  const now = Date.now();
  const out: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * MS_DAY);
    out.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  return out;
}

function defaultExtras(): DashboardExtra {
  return {
    targets: {
      weeklyEmail: 200,
      weeklyProspects: 30,
      weeklyReplies: 5,
      bounceAlertThreshold: 5,
    },
    progress: {
      weeklyEmailsSent: 0,
      weeklyNewProspects: 0,
      weeklyRepliesMarked: 0,
    },
    hotNewNoOutreach: [],
    staleContacted: [],
    segments: [],
    sendVolumeByDay: emptyWeekVolume(),
    bounceRate30: "0",
    attempted30: 0,
    bounced30: 0,
    prospectsBySource: [],
    alerts: [],
    recentBouncedSamples: [],
    dailyCap: 50,
    sentToday: 0,
  };
}

async function loadDashboardExtrasCore(): Promise<DashboardExtra> {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * MS_DAY);
  const thirtyDaysAgo = new Date(now - 30 * MS_DAY);
  const thirtyDaysContact = new Date(now - 30 * MS_DAY);

  const [settings, weeklyEmailsSent, weeklyNewProspects, weeklyRepliesMarked] =
    await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "default" } }),
    prisma.email.count({
      where: {
        sentAt: { gte: weekAgo },
        status: { not: "PENDING" },
      },
    }),
    prisma.prospect.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.email.count({
      where: {
        status: "REPLIED",
        repliedAt: { gte: weekAgo },
      },
    }),
  ]);

  const [hotNewNoOutreach, staleContacted, segments, emailsForVolume] =
    await Promise.all([
    prisma.prospect.findMany({
      where: {
        status: "NEW",
        score: { gte: 50 },
        NOT: {
          emails: { some: { status: { not: "PENDING" } } },
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
  ]);

  const [attempted30, bounced30, prospectsBySource, failedScrapes7d] =
    await Promise.all([
    prisma.email.count({
      where: {
        sentAt: { gte: thirtyDaysAgo },
        status: { not: "PENDING" },
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
  ]);

  const [recentBouncedSamples] = await Promise.all([
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
      status: { not: "PENDING" },
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

/** Ne fait jamais echouer le dashboard : migration incomplete, DB, etc. */
export async function getDashboardExtras(): Promise<DashboardExtra> {
  try {
    return await loadDashboardExtrasCore();
  } catch (e) {
    console.error("[dashboard-extras] chargement partiel ou impossible:", e);
    return defaultExtras();
  }
}
