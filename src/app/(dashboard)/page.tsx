import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Info,
  LayoutDashboard,
  Mail,
  MailOpen,
  MessageSquare,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageTitle } from "@/components/layout/page-title";
import { StatusBadge } from "@/components/shared/status-badge";
import { CountryChart } from "@/components/dashboard/charts";
import { loadDashboard } from "@/lib/dashboard";
import { PROSPECT_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tableau de bord" };

const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("fr-FR")} %`);

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" aria-hidden />
        </div>
        <p data-slot="kpi-value" className="text-3xl font-semibold tracking-tight">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Progress({ label, current, target }: { label: string; current: number; target: number }) {
  const p = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {current} / {target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cn("h-full rounded-full", p >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${Math.max(p, 2)}%` }} />
      </div>
    </div>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone?: "danger" | "ok" }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", tone === "danger" && "text-destructive", tone === "ok" && "text-success")}>
        {value}
      </span>
    </div>
  );
}

const ALERT_STYLES = {
  info: { box: "border-sun/40 bg-sun/15", icon: Info },
  warning: { box: "border-warning/40 bg-warning/10", icon: AlertTriangle },
  danger: { box: "border-destructive/30 bg-destructive/10 text-destructive", icon: AlertTriangle },
};

export default async function DashboardPage() {
  const data = await loadDashboard();
  const { kpis, health, sending } = data;
  const pipelineMax = Math.max(1, ...data.pipeline.map((p) => p.value));
  const volumeMax = Math.max(1, ...sending.volumeByDay.map((d) => d.count));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Tableau de bord"
        description="Où en est la prospection cette semaine."
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
              <li key={i} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", style.box)}>
                <style.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1">{a.message}</span>
                {a.href ? (
                  <Link href={a.href} className="shrink-0 font-medium underline-offset-4 hover:underline">
                    Voir
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Prospects" value={kpis.totalProspects.toLocaleString("fr-FR")} hint={`+${kpis.newProspects7d} sur 7 jours`} icon={Users} />
        <Kpi
          label="Emails envoyés (7 j)"
          value={kpis.sent7d}
          hint={kpis.sentTrend === null ? "Pas d'envoi la semaine précédente" : `${kpis.sentTrend >= 0 ? "+" : ""}${kpis.sentTrend} % vs semaine précédente`}
          icon={Mail}
        />
        <Kpi label="Taux d'ouverture (30 j)" value={fmtPct(kpis.openRate)} hint="Ouverts / délivrés, selon le suivi" icon={MailOpen} />
        <Kpi label="Réponses (7 j)" value={kpis.replies7d} hint={`Taux de réponse sur 30 j : ${fmtPct(kpis.replyRate)}`} icon={MessageSquare} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Objectifs de la semaine</CardTitle>
              <CardDescription>7 jours glissants</CardDescription>
            </div>
            <Link href="/settings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Modifier
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress label="Emails envoyés" current={kpis.sent7d} target={data.targets.emails} />
            <Progress label="Nouveaux prospects" current={kpis.newProspects7d} target={data.targets.prospects} />
            <Progress label="Réponses" current={kpis.replies7d} target={data.targets.replies} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Envois des 7 derniers jours</CardTitle>
            <CardDescription>
              Aujourd&apos;hui : {sending.sentToday} / {sending.dailyCap} (quota quotidien)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid h-36 grid-cols-7 items-end gap-2" aria-label="Volume d'envoi par jour">
              {sending.volumeByDay.map((d) => {
                const label = new Date(`${d.day}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "short" });
                return (
                  <li key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5">
                    <span className="text-xs font-medium tabular-nums">{d.count}</span>
                    <span
                      className="w-full max-w-9 rounded-t bg-chart-1"
                      style={{ height: `${Math.max(4, (d.count / volumeMax) * 100)}%` }}
                      aria-hidden
                    />
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
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Pipeline commercial</CardTitle>
              <CardDescription>Statut des prospects</CardDescription>
            </div>
            <Link href="/prospects" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Prospects
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.pipeline.map((row) => (
              <div key={row.status} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{PROSPECT_STATUS_LABELS[row.status]}</span>
                  <span className="font-medium tabular-nums">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.value / pipelineMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Santé des envois</CardTitle>
              <CardDescription>{health.sent30} email(s) envoyé(s) sur 30 jours</CardDescription>
            </div>
            <Link href="/sending" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Envoi
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <HealthRow label="Délivrabilité" value={fmtPct(health.deliverability)} />
            <HealthRow
              label="Taux de rebond"
              value={fmtPct(health.bounceRate)}
              tone={health.bounceRate !== null && health.bounceRate >= health.bounceThreshold ? "danger" : undefined}
            />
            <HealthRow label="Échecs / annulés" value={String(health.failed30)} />
            <HealthRow label="Adresses exclues" value={String(health.suppressed)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>À traiter</CardTitle>
            <CardDescription>Prospects prometteurs et échanges en cours</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Bien notés, jamais contactés</p>
              {data.hotNotContacted.length === 0 ? (
                <p className="text-sm text-muted-foreground">Rien à signaler.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.hotNotContacted.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <Link href={`/prospects?search=${encodeURIComponent(p.company)}`} className="truncate font-medium hover:underline">
                        {p.company}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {p.country} · {p.score}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">En discussion</p>
              {data.inDiscussion.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun échange en cours.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {data.inDiscussion.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <Link href={`/prospects?search=${encodeURIComponent(p.company)}`} className="truncate font-medium hover:underline">
                        {p.company}
                      </Link>
                      <span className="shrink-0 text-xs text-muted-foreground">{p.updatedAt.toLocaleDateString("fr-FR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Campagnes actives</CardTitle>
              <CardDescription>Résultats cumulés</CardDescription>
            </div>
            <Link href="/campaigns" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Toutes
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.activeCampaigns.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aucune campagne active.{" "}
                <Link href="/campaigns/new" className="font-medium text-primary underline-offset-4 hover:underline">
                  Créer une campagne
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th scope="col" className="pb-2 pr-3 font-medium">Campagne</th>
                      <th scope="col" className="pb-2 pr-3 text-right font-medium">Envoyés</th>
                      <th scope="col" className="pb-2 pr-3 text-right font-medium">Ouverts</th>
                      <th scope="col" className="pb-2 pr-3 text-right font-medium">Réponses</th>
                      <th scope="col" className="pb-2 text-right font-medium">Rebonds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activeCampaigns.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-right">{c.sentCount}</td>
                        <td className="py-2.5 pr-3 text-right">{c.openCount}</td>
                        <td className="py-2.5 pr-3 text-right">{c.replyCount}</td>
                        <td className={cn("py-2.5 text-right", c.bounceCount > 0 && "text-destructive")}>{c.bounceCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
            <Link href="/scraping" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Ouvrir
            </Link>
          </CardHeader>
          <CardContent>
            {data.lastScrape ? (
              <div className="space-y-2 text-sm">
                <StatusBadge kind="scraping" value={data.lastScrape.status} />
                <p>
                  <span className="font-semibold">{data.lastScrape.resultsCount}</span> prospect(s) importé(s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Lancée le {data.lastScrape.createdAt.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {data.lastScrape.errorMessage ? (
                  <p className="line-clamp-3 text-xs text-destructive">{data.lastScrape.errorMessage}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune recherche lancée pour l&apos;instant.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
