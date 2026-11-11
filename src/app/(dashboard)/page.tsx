import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  LayoutDashboard,
  Mail,
  MailOpen,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/components/layout/page-title";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountryChart } from "@/components/dashboard/charts";
import { loadDashboard } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { PROSPECT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("fr-FR")} %`);
const COUNTRY = new Intl.DisplayNames(["fr"], { type: "region" });
const countryName = (c: string) => {
  try {
    return /^[A-Z]{2}$/.test(c) ? COUNTRY.of(c) ?? c : c;
  } catch {
    return c;
  }
};

function greeting(name: string | null, email: string): string {
  const first = (name?.trim().split(/\s+/)[0] || email.split("@")[0].split(/[._-]/)[0] || "").trim();
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "Africa/Douala" }).format(new Date()));
  const hello = hour >= 18 ? "Bonsoir" : "Bonjour";
  return first ? `${hello} ${first.charAt(0).toUpperCase()}${first.slice(1)}` : hello;
}

const KPI_TONES = {
  brand: "bg-primary/10 text-primary",
  sun: "bg-sun/20 text-sun-foreground dark:text-sun",
  info: "bg-info/10 text-info",
  success: "bg-success/10 text-success",
};

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
  tone: keyof typeof KPI_TONES;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-colors group-hover:border-primary/30">
        <CardContent className="flex items-start gap-4">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", KPI_TONES[tone])}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p data-slot="kpi-value" className="mt-0.5 text-[28px] font-semibold leading-tight tracking-tight">
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: "ghost", size: "sm", className: "-mr-2 -mt-1 text-primary" })}>
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function Goal({ label, current, target }: { label: string; current: number; target: number }) {
  const p = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-semibold">{current}</span>
          <span className="text-muted-foreground"> / {target}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        {p > 0 ? <div className={cn("h-full rounded-full", p >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${p}%` }} /> : null}
      </div>
    </div>
  );
}

const PIPELINE_COLORS: Record<string, string> = {
  NEW: "bg-info",
  CONTACTED: "bg-sun",
  IN_DISCUSSION: "bg-primary",
  CONVERTED: "bg-success",
};

const ALERT_STYLES = {
  info: { box: "border-sun/50 bg-sun/15", icon: Info, button: "bg-[#26300F] text-[#F8F3EA] hover:bg-[#26300F]/90" },
  warning: { box: "border-warning/40 bg-warning/10", icon: AlertTriangle, button: "" },
  danger: { box: "border-destructive/30 bg-destructive/10 text-destructive", icon: AlertTriangle, button: "" },
};

export default async function DashboardPage() {
  const [data, { user }] = [await loadDashboard(), await getCurrentUser()];
  const { kpis, health, sending } = data;
  const pipelineTotal = Math.max(1, data.pipeline.reduce((s, p) => s + p.value, 0));
  const volumeMax = Math.max(1, ...sending.volumeByDay.map((d) => d.count));
  const hasSends = health.sent30 > 0 || sending.volumeByDay.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <PageTitle
        title={user ? greeting(user.name, user.email) : "Tableau de bord"}
        description="Voici où en est la prospection cette semaine."
        icon={LayoutDashboard}
        actions={
          <>
            <Link href="/scraping" className={buttonVariants({ variant: "outline" })}>
              <Search className="h-4 w-4" />
              Trouver des prospects
            </Link>
            <Link href="/campaigns/new" className={buttonVariants()}>
              <Plus className="h-4 w-4" />
              Nouvelle campagne
            </Link>
          </>
        }
      />

      {data.alerts.length > 0 ? (
        <ul className="space-y-2" aria-label="Points d'attention">
          {data.alerts.map((a, i) => {
            const style = ALERT_STYLES[a.level];
            return (
              <li key={i} className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3.5 text-sm sm:flex-row sm:items-center", style.box)}>
                <style.icon className="hidden h-5 w-5 shrink-0 sm:block" aria-hidden />
                <span className="flex-1">{a.message}</span>
                {a.href ? (
                  <Link href={a.href} className={buttonVariants({ size: "sm", variant: a.level === "info" ? "default" : "outline", className: cn("shrink-0", style.button) })}>
                    {a.cta ?? "Voir"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Prospects" value={kpis.totalProspects.toLocaleString("fr-FR")} hint={`+${kpis.newProspects7d} sur 7 jours`} icon={Users} tone="brand" href="/prospects" />
        <Kpi
          label="Emails envoyés (7 j)"
          value={kpis.sent7d}
          hint={kpis.sentTrend === null ? `${data.pendingReviewTotal} prêt(s) à relire` : `${kpis.sentTrend >= 0 ? "+" : ""}${kpis.sentTrend} % vs semaine précédente`}
          icon={Send}
          tone="sun"
          href="/sending"
        />
        <Kpi label="Taux d'ouverture" value={fmtPct(kpis.openRate)} hint="Sur 30 jours, ouverts / délivrés" icon={MailOpen} tone="info" href="/campaigns" />
        <Kpi label="Réponses (7 j)" value={kpis.replies7d} hint={`Taux de réponse 30 j : ${fmtPct(kpis.replyRate)}`} icon={MessageSquare} tone="success" href="/responses" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Pipeline commercial</CardTitle>
              <CardDescription>{pipelineTotal.toLocaleString("fr-FR")} prospects joignables, par étape</CardDescription>
            </div>
            <CardLink href="/prospects">Prospects</CardLink>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
              {data.pipeline.map((row) =>
                row.value > 0 ? (
                  <div key={row.status} className={PIPELINE_COLORS[row.status]} style={{ width: `${(row.value / pipelineTotal) * 100}%` }} />
                ) : null
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.pipeline.map((row) => (
                <div key={row.status} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={cn("h-2.5 w-2.5 rounded-full", PIPELINE_COLORS[row.status])} aria-hidden />
                    {PROSPECT_STATUS_LABELS[row.status]}
                  </dt>
                  <dd className="mt-1 flex items-baseline gap-1.5">
                    <span data-slot="kpi-value" className="text-xl font-semibold">
                      {row.value}
                    </span>
                    <span className="text-xs text-muted-foreground">{Math.round((row.value / pipelineTotal) * 100)} %</span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Objectifs de la semaine</CardTitle>
              <CardDescription>7 jours glissants</CardDescription>
            </div>
            <CardLink href="/settings">Modifier</CardLink>
          </CardHeader>
          <CardContent className="space-y-4">
            <Goal label="Emails envoyés" current={kpis.sent7d} target={data.targets.emails} />
            <Goal label="Nouveaux prospects" current={kpis.newProspects7d} target={data.targets.prospects} />
            <Goal label="Réponses" current={kpis.replies7d} target={data.targets.replies} />
          </CardContent>
        </Card>
      </div>

      {hasSends ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Envois des 7 derniers jours</CardTitle>
                <CardDescription>
                  Aujourd&apos;hui : {sending.sentToday} / {sending.dailyCap} (quota quotidien)
                </CardDescription>
              </div>
              <CardLink href="/sending">Envoi</CardLink>
            </CardHeader>
            <CardContent>
              <ol className="grid h-40 grid-cols-7 items-end gap-3" aria-label="Volume d'envoi par jour">
                {sending.volumeByDay.map((d) => {
                  const label = new Date(`${d.day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short" });
                  return (
                    <li key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5">
                      <span className="text-xs font-semibold tabular-nums">{d.count || ""}</span>
                      <span className="w-full max-w-10 rounded-t-md bg-chart-1" style={{ height: `${Math.max(3, (d.count / volumeMax) * 100)}%` }} aria-hidden />
                      <span className="text-xs capitalize text-muted-foreground">
                        {label}
                        <span className="sr-only"> : {d.count} email(s)</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Santé des envois</CardTitle>
              <CardDescription>{health.sent30} email(s) envoyé(s) sur 30 jours</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Délivrabilité", value: fmtPct(health.deliverability) },
                {
                  label: "Rebonds",
                  value: fmtPct(health.bounceRate),
                  danger: health.bounceRate !== null && health.bounceRate >= health.bounceThreshold,
                },
                { label: "Échecs", value: String(health.failed30) },
                { label: "Adresses exclues", value: String(health.suppressed) },
              ].map((r) => (
                <div key={r.label} className="rounded-lg border bg-muted/30 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", r.danger && "text-destructive")}>{r.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              icon={Send}
              title="Aucun envoi pour l'instant"
              text={`Les statistiques d'envoi (volume, délivrabilité, rebonds) apparaîtront ici dès qu'une campagne sera active. Quota actuel : ${sending.dailyCap} emails par jour.`}
              action={
                data.campaignsToReview[0] ? (
                  <Link href={`/campaigns/${data.campaignsToReview[0].id}`} className={buttonVariants()}>
                    Relire et activer « {data.campaignsToReview[0].name} »
                  </Link>
                ) : (
                  <Link href="/campaigns/new" className={buttonVariants()}>
                    <Plus className="h-4 w-4" />
                    Créer une campagne
                  </Link>
                )
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Campagnes</CardTitle>
              <CardDescription>
                {data.activeCampaigns.length} active(s) · {data.campaignsToReview.length} en attente de relecture
              </CardDescription>
            </div>
            <CardLink href="/campaigns">Toutes</CardLink>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.campaignsToReview.length === 0 && data.activeCampaigns.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="Aucune campagne en cours"
                text="Créez une campagne pour un segment : l'assistant rédige un email par prospect."
                action={
                  <Link href="/campaigns/new" className={buttonVariants({ variant: "outline" })}>
                    <Plus className="h-4 w-4" />
                    Créer une campagne
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {data.campaignsToReview.map((c) => (
                  <li key={c.id}>
                    <Link href={`/campaigns/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sun/20 text-sun-foreground dark:text-sun">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {c.segment ?? "Tous les prospects"} · {c.pending} email(s) à relire
                        </span>
                      </span>
                      <StatusBadge kind="campaign" value={c.status} />
                    </Link>
                  </li>
                ))}
                {data.activeCampaigns.map((c) => (
                  <li key={c.id}>
                    <Link href={`/campaigns/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                        <Send className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {c.sentCount} envoyé(s) · {c.openCount} ouvert(s) · {c.replyCount} réponse(s)
                        </span>
                      </span>
                      <StatusBadge kind="campaign" value="ACTIVE" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Prospects à saisir</CardTitle>
              <CardDescription>Les mieux notés, jamais contactés</CardDescription>
            </div>
            <CardLink href="/prospects">Voir tout</CardLink>
          </CardHeader>
          <CardContent>
            {data.hotNotContacted.length === 0 ? (
              <EmptyState icon={Sparkles} title="Rien à signaler" text="Tous les prospects bien notés ont déjà été contactés." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {data.hotNotContacted.map((p) => (
                  <li key={p.id}>
                    <Link href={`/prospects?search=${encodeURIComponent(p.company)}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {p.company.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.company}</span>
                        <span className="block truncate text-xs text-muted-foreground">{countryName(p.country)}</span>
                      </span>
                      <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success tabular-nums" title="Score sur 100">
                        {p.score}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {data.inDiscussion.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5" /> En discussion
                </p>
                <ul className="flex flex-wrap gap-2">
                  {data.inDiscussion.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/prospects?search=${encodeURIComponent(p.company)}`}
                        className="inline-flex rounded-full border bg-card px-3 py-1 text-xs font-medium hover:border-primary/40"
                      >
                        {p.company}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Prospects par pays</CardTitle>
            <CardDescription>Les 8 pays les plus représentés</CardDescription>
          </CardHeader>
          <CardContent>
            <CountryChart data={data.byCountry} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Dernière recherche</CardTitle>
              <CardDescription>Collecte de prospects</CardDescription>
            </div>
            <CardLink href="/scraping">Ouvrir</CardLink>
          </CardHeader>
          <CardContent>
            {data.lastScrape ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <StatusBadge kind="scraping" value={data.lastScrape.status} />
                  <span className="text-xs text-muted-foreground">
                    {data.lastScrape.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p data-slot="kpi-value" className="text-3xl font-semibold">
                    {data.lastScrape.resultsCount}
                  </p>
                  <p className="text-sm text-muted-foreground">prospect(s) importé(s)</p>
                </div>
                {data.lastScrape.errorMessage ? <p className="line-clamp-3 text-xs text-destructive">{data.lastScrape.errorMessage}</p> : null}
                <Link href="/scraping" className={buttonVariants({ variant: "outline", className: "w-full" })}>
                  <Search className="h-4 w-4" />
                  Lancer une nouvelle recherche
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={Search}
                title="Aucune recherche"
                text="Collectez des chocolatiers, importateurs et industriels sur Google Maps."
                action={
                  <Link href="/scraping" className={buttonVariants({ variant: "outline" })}>
                    Lancer une recherche
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
