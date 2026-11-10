import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AIBadge } from "@/components/ui/ai-badge";
import { CountUp } from "@/components/ui/count-up";
import {
  Activity,
  Brain,
  Flame,
  Mail,
  PenLine,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TimelineColor =
  | "violet"
  | "emerald"
  | "amber"
  | "sky"
  | "rose"
  | "indigo";

type TimelineEvent = {
  id: string;
  title: string;
  description: string;
  icon: typeof Brain;
  color: TimelineColor;
  at?: Date;
  badge?: string;
};

const COLOR_STYLES: Record<TimelineColor, { dot: string; ring: string; icon: string }> = {
  violet: {
    dot: "bg-primary",
    ring: "ring-primary/40",
    icon: "text-primary dark:text-primary",
  },
  emerald: {
    dot: "bg-success",
    ring: "ring-success/40",
    icon: "text-success dark:text-success",
  },
  amber: {
    dot: "bg-warning",
    ring: "ring-warning/40",
    icon: "text-warning dark:text-warning",
  },
  sky: {
    dot: "bg-info",
    ring: "ring-info/40",
    icon: "text-info dark:text-info",
  },
  rose: {
    dot: "bg-destructive",
    ring: "ring-destructive/40",
    icon: "text-destructive dark:text-destructive",
  },
  indigo: {
    dot: "bg-primary",
    ring: "ring-primary/40",
    icon: "text-primary dark:text-primary",
  },
};

function relativeTime(date: Date | null | undefined): string {
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "a l instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR");
}

export type AITimelineData = {
  prospectsScoredDay: number;
  hotProspectsDay: number;
  emailsGeneratedDay: number;
  emailsRepliedDay: number;
  emailsOpenedWeek: number;
  lastScrape: {
    id: string;
    status: string;
    resultsCount: number;
    completedAt: Date | null;
    createdAt: Date;
  } | null;
  lastCampaign: {
    id: string;
    name: string;
    status: string;
    updatedAt: Date;
  } | null;
  lastReply: {
    id: string;
    classification: string;
    createdAt: Date;
  } | null;
  lastHotProspect: {
    id: string;
    company: string;
    score: number;
    updatedAt: Date;
  } | null;
};

/**
 * À appeler depuis la page Dashboard **après** getStats / getDashboardExtras pour éviter
 * des requêtes Prisma concurrentes (saturation du pool session Supabase, EMAXCONNSESSION).
 */
export async function loadAITimelineData(): Promise<AITimelineData> {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const prospectsScoredDay = await prisma.prospect.count({
    where: { createdAt: { gte: dayAgo } },
  });
  const hotProspectsDay = await prisma.prospect.count({
    where: { createdAt: { gte: dayAgo }, score: { gte: 60 } },
  });
  const emailsGeneratedDay = await prisma.email.count({
    where: { createdAt: { gte: dayAgo } },
  });
  const emailsRepliedDay = await prisma.email.count({
    where: { repliedAt: { gte: dayAgo } },
  });
  const emailsOpenedWeek = await prisma.email.count({
    where: { openedAt: { gte: weekAgo } },
  });
  const lastScrape = await prisma.scrapingJob.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      resultsCount: true,
      completedAt: true,
      createdAt: true,
    },
  });
  const lastCampaign = await prisma.campaign.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, status: true, updatedAt: true },
  });
  const lastReply = await prisma.response.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, classification: true, createdAt: true },
  });
  const lastHotProspect = await prisma.prospect.findFirst({
    where: { score: { gte: 60 } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, company: true, score: true, updatedAt: true },
  });

  return {
    prospectsScoredDay,
    hotProspectsDay,
    emailsGeneratedDay,
    emailsRepliedDay,
    emailsOpenedWeek,
    lastScrape,
    lastCampaign,
    lastReply,
    lastHotProspect,
  };
}

export function AITimeline({ data }: { data: AITimelineData | null }) {
  if (!data) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader>
          <CardTitle className="text-sm">Activité de l&apos;IA</CardTitle>
          <CardDescription className="text-xs">
            Impossible de charger les indicateurs pour le moment (réessayer plus tard).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const events: TimelineEvent[] = [];

  if (data.lastScrape) {
    events.push({
      id: `scrape-${data.lastScrape.id}`,
      title: `Scraping IA ${data.lastScrape.status === "COMPLETED" ? "terminé" : "en cours"}`,
      description: `${data.lastScrape.resultsCount} prospect(s) detectes et enrichis automatiquement`,
      icon: Radar,
      color: "sky",
      at: data.lastScrape.completedAt ?? data.lastScrape.createdAt,
      badge: data.lastScrape.status === "COMPLETED" ? "Terminé" : "Actif",
    });
  }

  if (data.prospectsScoredDay > 0) {
    events.push({
      id: "scored",
      title: `L'IA a score ${data.prospectsScoredDay} prospect(s)`,
      description: "Scoring automatique base sur secteur, pays, site web et signaux",
      icon: Brain,
      color: "violet",
      badge: "Scoring",
    });
  }

  if (data.hotProspectsDay > 0) {
    events.push({
      id: "hot",
      title: `${data.hotProspectsDay} lead(s) chaud(s) detecte(s)`,
      description:
        data.lastHotProspect
          ? `Ex. ${data.lastHotProspect.company} · score ${data.lastHotProspect.score}`
          : "Score >= 60 — a prioriser dans vos campagnes",
      icon: Flame,
      color: "rose",
      at: data.lastHotProspect?.updatedAt,
      badge: "Priorité",
    });
  }

  if (data.emailsGeneratedDay > 0) {
    events.push({
      id: "drafted",
      title: `L'IA a redige ${data.emailsGeneratedDay} email(s)`,
      description:
        "Objets et corps personnalisés selon le secteur, le pays et la langue du prospect",
      icon: PenLine,
      color: "indigo",
      badge: "Rédaction",
    });
  }

  if (data.emailsOpenedWeek > 0) {
    events.push({
      id: "opened",
      title: `${data.emailsOpenedWeek} ouverture(s) trackee(s) cette semaine`,
      description: "L'IA ajuste le timing et les relances en fonction des signaux",
      icon: TrendingUp,
      color: "emerald",
      badge: "Engagement",
    });
  }

  if (data.emailsRepliedDay > 0 && data.lastReply) {
    events.push({
      id: "replied",
      title: `${data.emailsRepliedDay} réponse(s) entrante(s) aujourd hui`,
      description: "Classification automatique des réponses (intéressé, refus, OOO...)",
      icon: Mail,
      color: "amber",
      at: data.lastReply.createdAt,
      badge: "Réponses",
    });
  }

  if (data.lastCampaign) {
    events.push({
      id: `campaign-${data.lastCampaign.id}`,
      title: `Campagne suivie : ${data.lastCampaign.name}`,
      description: `Statut ${data.lastCampaign.status.toLowerCase()} — l'IA relance et adapte le rythme d'envoi`,
      icon: Target,
      color: "indigo",
      at: data.lastCampaign.updatedAt,
    });
  }

  if (events.length === 0) {
    events.push({
      id: "idle",
      title: "IA prete",
      description:
        "Lancez un scraping ou une campagne pour voir l'IA travailler en temps reel.",
      icon: Sparkles,
      color: "violet",
    });
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/60 via-background to-primary/60 dark:border-primary/30 dark:from-primary/30 dark:via-background dark:to-primary/30">
      <CardHeader className="flex flex-col gap-2.5 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Activity className="h-4 w-4 text-primary" />
            Activité de l&apos;IA
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Ce que l&apos;IA a fait pour vous récemment
          </CardDescription>
        </div>
        <AIBadge label="Temps réel" size="xs" variant="solid" animated />
      </CardHeader>
      <CardContent>
        <ol className="relative ml-1 border-l border-border/70 pl-5 sm:ml-2 sm:pl-6">
          {events.map((ev, idx) => {
            const styles = COLOR_STYLES[ev.color];
            const Icon = ev.icon;
            return (
              <li
                key={ev.id}
                className={cn(
                  "relative pb-5 last:pb-0",
                  idx !== events.length - 1 && ""
                )}
              >
                <span
                  className={cn(
                    "absolute -left-[33px] top-1 flex h-5 w-5 items-center justify-center rounded-full ring-4",
                    styles.ring,
                    "bg-background"
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", styles.dot)} />
                </span>
                <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/70 p-2.5 shadow-sm backdrop-blur sm:p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={cn("h-4 w-4", styles.icon)} />
                      <span className="min-w-0 break-words text-xs font-semibold leading-tight sm:text-sm">
                        {ev.title}
                      </span>
                    </div>
                    {ev.badge ? (
                      <span className="shrink-0 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {ev.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-foreground/75 sm:text-xs">
                    {ev.description}
                  </p>
                  {ev.at ? (
                    <p className="text-[10px] uppercase tracking-wide text-foreground/60">
                      {relativeTime(ev.at)}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-center text-xs sm:grid-cols-3">
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Users className="h-3 w-3" /> Scorés 24h
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums">
              <CountUp value={data.prospectsScoredDay} />
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <PenLine className="h-3 w-3" /> Rédigés 24h
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums">
              <CountUp value={data.emailsGeneratedDay} />
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Flame className="h-3 w-3" /> Chauds 24h
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums">
              <CountUp value={data.hotProspectsDay} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AITimeline;
