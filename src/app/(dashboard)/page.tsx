import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import {
  Users,
  Mail,
  Send,
  TrendingUp,
  Target,
  Globe,
  ArrowRight,
  Zap,
  Inbox,
  MousePointerClick,
  AlertTriangle,
  Database,
  Sparkles,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/charts";
import { EngagementFunnel } from "@/components/dashboard/engagement-funnel";
import { StrategicDashboardSections } from "@/components/dashboard/strategic-blocks";
import { getDashboardExtras } from "@/lib/dashboard-extras";
import { PageTitle } from "@/components/layout/page-title";
import { AIBanner } from "@/components/ui/ai-banner";
import { AIBadge } from "@/components/ui/ai-badge";
import { AITimeline } from "@/components/dashboard/ai-timeline";

const SCRAPE_LABELS: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  COMPLETED: "Termine",
  FAILED: "Echec",
  CANCELLED: "Annule",
};

function getFallbackStats() {
  return {
    totalProspects: 0,
    totalEmails: 0,
    sentEmails: 0,
    deliveredEmails: 0,
    openedEmails: 0,
    clickedEmails: 0,
    repliedEmails: 0,
    bouncedEmails: 0,
    failedEmails: 0,
    openRate: "0",
    replyRate: "0",
    deliverabilityPct: "0",
    bounceRatePct: "0",
    failRatePct: "0",
    clickRateOfDelivered: "0",
    activeCampaigns: 0,
    hotProspects: 0,
    prospectsByCountry: [],
    prospectsByStatus: [],
    responsesCount: 0,
    prospectsNew: 0,
    prospectsContacted: 0,
    prospectsInDiscussion: 0,
    prospectsConverted: 0,
    highPriorityProspects: 0,
    warmNewLeads: 0,
    lastScrape: null,
    activeCampaignsDetail: [],
    emailsLast7Days: 0,
    emailsPrev7Days: 0,
    emailTrendLabel: "—",
    funnelSteps: [
      { label: "Tentatives (hors brouillon)", value: 0 },
      { label: "Livres", value: 0 },
      { label: "Ouverts (tracking)", value: 0 },
      { label: "Clics trackes", value: 0 },
    ],
  } as Awaited<ReturnType<typeof getStats>>;
}

async function getStats() {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  // Evite de saturer le pool SQL en session mode:
  // on limite le nombre de requetes Prisma executees en parallele.
  const totalProspects = await prisma.prospect.count();
  const totalEmails = await prisma.email.count();
  const sentEmails = await prisma.email.count({
    where: { status: { not: "PENDING" } },
  });
  const deliveredEmails = await prisma.email.count({
    where: { status: { in: ["DELIVERED", "OPENED", "CLICKED", "REPLIED"] } },
  });

  const openedEmails = await prisma.email.count({
    where: { status: { in: ["OPENED", "CLICKED", "REPLIED"] } },
  });
  const repliedEmails = await prisma.email.count({ where: { status: "REPLIED" } });
  const clickedEmails = await prisma.email.count({ where: { status: "CLICKED" } });
  const bouncedEmails = await prisma.email.count({ where: { status: "BOUNCED" } });

  const failedEmails = await prisma.email.count({ where: { status: "FAILED" } });
  const activeCampaigns = await prisma.campaign.count({ where: { status: "ACTIVE" } });
  const hotProspects = await prisma.prospect.count({ where: { score: { gte: 60 } } });
  const prospectsByCountry = await prisma.prospect.groupBy({
    by: ["country"],
    _count: true,
    orderBy: { _count: { country: "desc" } },
    take: 10,
  });

  const prospectsByStatus = await prisma.prospect.groupBy({
    by: ["status"],
    _count: true,
  });
  const responsesCount = await prisma.response.count();
  const prospectsNew = await prisma.prospect.count({ where: { status: "NEW" } });
  const prospectsContacted = await prisma.prospect.count({
    where: { status: "CONTACTED" },
  });

  const prospectsInDiscussion = await prisma.prospect.count({
    where: { status: "IN_DISCUSSION" },
  });
  const prospectsConverted = await prisma.prospect.count({
    where: { status: "CONVERTED" },
  });
  const highPriorityProspects = await prisma.prospect.count({
    where: { priority: "HIGH" },
  });

  const warmNewLeads = await prisma.prospect.count({
    where: { status: "NEW", score: { gte: 50 } },
  });
  const lastScrape = await prisma.scrapingJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      resultsCount: true,
      createdAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });
  const activeCampaignsDetail = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      sentCount: true,
      deliveredCount: true,
      openCount: true,
      clickCount: true,
      replyCount: true,
      bounceCount: true,
      dailyLimit: true,
    },
  });

  const emailsLast7Days = await prisma.email.count({
    where: {
      sentAt: { gte: weekAgo },
      status: { not: "PENDING" },
    },
  });
  const emailsPrev7Days = await prisma.email.count({
    where: {
      sentAt: { gte: twoWeeksAgo, lt: weekAgo },
      status: { not: "PENDING" },
    },
  });

  const attempted = Math.max(0, sentEmails);

  const openRate =
    deliveredEmails > 0
      ? ((openedEmails / deliveredEmails) * 100).toFixed(1)
      : "0";
  const replyRate =
    deliveredEmails > 0
      ? ((repliedEmails / deliveredEmails) * 100).toFixed(1)
      : "0";
  const deliverabilityPct =
    attempted > 0
      ? ((deliveredEmails / attempted) * 100).toFixed(1)
      : "0";
  const bounceRatePct =
    attempted > 0 ? ((bouncedEmails / attempted) * 100).toFixed(1) : "0";
  const failRatePct =
    attempted > 0 ? ((failedEmails / attempted) * 100).toFixed(1) : "0";
  const clickRateOfDelivered =
    deliveredEmails > 0
      ? ((clickedEmails / deliveredEmails) * 100).toFixed(1)
      : "0";

  let emailTrendLabel = "—";
  if (emailsPrev7Days > 0) {
    const delta = Math.round(
      ((emailsLast7Days - emailsPrev7Days) / emailsPrev7Days) * 100
    );
    emailTrendLabel = delta >= 0 ? `+${delta}%` : `${delta}%`;
  } else if (emailsLast7Days > 0) {
    emailTrendLabel = "nouveau";
  }

  return {
    totalProspects,
    totalEmails,
    sentEmails,
    deliveredEmails,
    openedEmails,
    clickedEmails,
    repliedEmails,
    bouncedEmails,
    failedEmails,
    openRate,
    replyRate,
    deliverabilityPct,
    bounceRatePct,
    failRatePct,
    clickRateOfDelivered,
    activeCampaigns,
    hotProspects,
    prospectsByCountry: prospectsByCountry.map((p) => ({
      country: p.country,
      count: p._count,
    })),
    prospectsByStatus: prospectsByStatus.map((p) => ({
      status: p.status,
      count: p._count,
    })),
    responsesCount,
    prospectsNew,
    prospectsContacted,
    prospectsInDiscussion,
    prospectsConverted,
    highPriorityProspects,
    warmNewLeads,
    lastScrape,
    activeCampaignsDetail,
    emailsLast7Days,
    emailsPrev7Days,
    emailTrendLabel,
    funnelSteps: [
      { label: "Tentatives (hors brouillon)", value: attempted },
      { label: "Livres", value: deliveredEmails },
      { label: "Ouverts (tracking)", value: openedEmails },
      { label: "Clics trackes", value: clickedEmails },
    ],
  };
}

export default async function DashboardPage() {
  let stats: Awaited<ReturnType<typeof getStats>> = getFallbackStats();
  try {
    stats = await getStats();
  } catch (e) {
    console.error("[dashboard] getStats:", e);
    stats = getFallbackStats();
  }
  const extras = await getDashboardExtras();

  const kpis = [
        {
          label: "Prospects",
          value: stats.totalProspects,
          icon: Users,
          color: "text-blue-600",
          hint: `${stats.warmNewLeads} nouveaux scores ≥ 50`,
        },
        {
          label: "Emails partis (7 j.)",
          value: stats.emailsLast7Days,
          icon: Send,
          color: "text-green-600",
          hint:
            stats.emailTrendLabel === "—"
              ? "vs semaine precedente"
              : `vs sem. prec. : ${stats.emailTrendLabel}`,
        },
        {
          label: "Delivrabilite",
          value: `${stats.deliverabilityPct}%`,
          icon: Mail,
          color: "text-orange-600",
          hint: `Rebonds ${stats.bounceRatePct}% · Echecs ${stats.failRatePct}%`,
        },
        {
          label: "Engagement",
          value: `${stats.openRate}% ouvert`,
          icon: TrendingUp,
          color: "text-purple-600",
          hint: `${stats.clickRateOfDelivered}% clics / livres · ${stats.responsesCount} reponses en base`,
        },
        {
          label: "Campagnes actives",
          value: stats.activeCampaigns,
          icon: Target,
          color: "text-red-600",
          hint: `${stats.highPriorityProspects} prospects priorite haute`,
        },
        {
          label: "Prospects chauds",
          value: stats.hotProspects,
          icon: Globe,
          color: "text-amber-600",
          hint: "Score ≥ 60",
        },
      ];

  const pipeline = [
        { label: "Nouveaux", value: stats.prospectsNew, color: "bg-slate-500" },
        {
          label: "Contactes",
          value: stats.prospectsContacted,
          color: "bg-blue-500",
        },
        {
          label: "En discussion",
          value: stats.prospectsInDiscussion,
          color: "bg-amber-500",
        },
        {
          label: "Convertis",
          value: stats.prospectsConverted,
          color: "bg-emerald-500",
        },
      ];

  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  return (
    <div className="space-y-8">
      <PageTitle
        title="Dashboard"
        description="Pilotage pipeline, delivrabilite et campagnes — vue strategique"
        icon={TrendingUp}
      />

      <AIBanner
        title="Assistant IA actif"
        description="Scoring des prospects, priorisation des leads chauds et generation des emails sont pilotes en continu par l IA."
        stats={[
          {
            icon: "sparkles",
            label: "Prospects chauds",
            value: stats.hotProspects,
          },
          {
            icon: "brain",
            label: "Leads prioritaires",
            value: stats.highPriorityProspects,
          },
          {
            icon: "zap",
            label: "Emails IA (7 j.)",
            value: stats.emailsLast7Days,
          },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/campaigns"
          className={cn(buttonVariants({ variant: "default", size: "sm" }))}
        >
          <Target className="mr-2 h-4 w-4" />
          Campagnes
          <ArrowRight className="ml-2 h-3.5 w-3.5 opacity-70" />
        </Link>
        <Link
          href="/prospects"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Users className="mr-2 h-4 w-4" />
          Prospects
        </Link>
        <Link
          href="/sending"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Send className="mr-2 h-4 w-4" />
          Envoi
        </Link>
        <Link
          href="/scraping"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Database className="mr-2 h-4 w-4" />
          Scraping
        </Link>
        <Link
          href="/responses"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Inbox className="mr-2 h-4 w-4" />
          Reponses
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
              {kpi.hint ? (
                <p className="mt-1.5 text-xs text-muted-foreground">{kpi.hint}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <StrategicDashboardSections extras={extras} />

      <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <AITimeline />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Tunnel d&apos;engagement
                  </CardTitle>
                  <CardDescription>
                    Parcours depuis l&apos;envoi jusqu&apos;au clic (approximatif selon tracking)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EngagementFunnel
                    steps={stats.funnelSteps.map((s) => ({
                      label: s.label,
                      value: Math.max(0, s.value),
                    }))}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        Pipeline commercial
                      </CardTitle>
                      <CardDescription>
                        Repartition des statuts prospect — priorisez la conversion
                      </CardDescription>
                    </div>
                    <AIBadge label="Scoring IA" size="xs" variant="soft" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pipeline.map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium tabular-nums">{row.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${row.color}`}
                          style={{
                            width: `${Math.max(3, (row.value / pipelineMax) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MousePointerClick className="h-4 w-4 text-sky-500" />
                  Sante des envois
                </CardTitle>
                <CardDescription>
                  KPIs techniques pour ajuster volume et contenu
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <span className="text-muted-foreground">Delivrabilite</span>
                  <span className="text-right font-semibold tabular-nums">
                    {stats.deliverabilityPct}%
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <span className="text-muted-foreground">Taux de rebond</span>
                  <span className="text-right font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {stats.bounceRatePct}%
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <span className="text-muted-foreground">Echecs d&apos;envoi</span>
                  <span className="text-right font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {stats.failRatePct}%
                  </span>
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <span className="text-muted-foreground">Clics / livres</span>
                  <span className="text-right font-semibold tabular-nums">
                    {stats.clickRateOfDelivered}%
                  </span>
                </div>
                {Number(stats.bounceRatePct) > 3 ? (
                  <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 sm:col-span-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Rebonds eleves : verifier listes, double opt-in et warm-up du domaine.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

      {stats.activeCampaignsDetail.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Campagnes actives</CardTitle>
              <CardDescription>
                Volume et engagement par campagne en cours
              </CardDescription>
            </div>
            <Link
              href="/campaigns"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Tout voir
            </Link>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Campagne</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Envoyes</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Livres</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Ouverts</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Clics</th>
                  <th className="pb-2 pr-4 font-medium tabular-nums">Reponses</th>
                  <th className="pb-2 font-medium tabular-nums">Rebonds</th>
                </tr>
              </thead>
              <tbody>
                {stats.activeCampaignsDetail.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Plafond {c.dailyLimit}/j
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{c.sentCount}</td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {c.deliveredCount}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{c.openCount}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{c.clickCount}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{c.replyCount}</td>
                    <td className="py-2.5 tabular-nums text-amber-700 dark:text-amber-400">
                      {c.bounceCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {stats.lastScrape && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Dernier scraping</CardTitle>
              <CardDescription>
                Alimentation du pipe — dernier job en base
              </CardDescription>
            </div>
            <Link
              href="/scraping"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Scraping
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {SCRAPE_LABELS[stats.lastScrape.status] ??
                    stats.lastScrape.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {stats.lastScrape.resultsCount} prospect(s) importes
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.lastScrape.createdAt.toLocaleString("fr-FR")}
                {stats.lastScrape.completedAt
                  ? ` · termine ${stats.lastScrape.completedAt.toLocaleString("fr-FR")}`
                  : ""}
              </p>
              {stats.lastScrape.errorMessage ? (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {stats.lastScrape.errorMessage.slice(0, 160)}
                  {stats.lastScrape.errorMessage.length > 160 ? "…" : ""}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Prospects par pays</CardTitle>
              <CardDescription>Top 10 des pays</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardCharts
                type="country"
                data={stats.prospectsByCountry}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Prospects par statut</CardTitle>
              <CardDescription>Repartition actuelle</CardDescription>
            </CardHeader>
            <CardContent>
              <DashboardCharts
                type="status"
                data={stats.prospectsByStatus}
              />
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
