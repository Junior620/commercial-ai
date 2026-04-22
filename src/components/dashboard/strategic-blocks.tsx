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
import type { DashboardExtra } from "@/lib/dashboard-extras";
import { DashboardCharts } from "@/components/dashboard/charts";
import {
  Bell,
  Download,
  LayoutList,
  ShieldCheck,
  ListTodo,
  Layers,
} from "lucide-react";

function TargetRow({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const pct =
    target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">
          {current} / {target}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            ({pct}%)
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 100 ? "bg-emerald-500" : "bg-primary"
          )}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  );
}

export function StrategicDashboardSections({
  extras,
}: {
  extras: DashboardExtra;
}) {
  return (
    <>
      {extras.alerts.length > 0 && (
        <Card className="border-amber-200/80 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-amber-600" />
              Alertes
            </CardTitle>
            <CardDescription>
              Evenements a traiter en priorite
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {extras.alerts.map((a, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  a.level === "danger"
                    ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100"
                    : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
                )}
              >
                {a.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Objectifs (7 jours)</CardTitle>
              <CardDescription>
                Cadence vs cibles definies dans Parametres
              </CardDescription>
            </div>
            <Link
              href="/settings"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Regler
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <TargetRow
              label="Emails partis"
              current={extras.progress.weeklyEmailsSent}
              target={extras.targets.weeklyEmail}
            />
            <TargetRow
              label="Nouveaux prospects"
              current={extras.progress.weeklyNewProspects}
              target={extras.targets.weeklyProspects}
            />
            <TargetRow
              label="Reponses marquees"
              current={extras.progress.weeklyRepliesMarked}
              target={extras.targets.weeklyReplies}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume & plafond jour</CardTitle>
            <CardDescription>
              Emails partis par jour (7j) — limite configuree :{" "}
              {extras.dailyCap}/j
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Aujourd&apos;hui</span>
              <span className="font-semibold tabular-nums">
                {extras.sentToday} / {extras.dailyCap}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
              {extras.sendVolumeByDay.map((d) => (
                <div key={d.day} className="space-y-1">
                  <div className="truncate" title={d.day}>
                    {d.day.slice(5)}
                  </div>
                  <div
                    className="mx-auto flex h-14 w-full max-w-[28px] items-end justify-center rounded bg-muted"
                    title={`${d.count} emails`}
                  >
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{
                        height: `${Math.max(
                          8,
                          Math.min(
                            100,
                            (d.count /
                              Math.max(
                                1,
                                ...extras.sendVolumeByDay.map((x) => x.count)
                              )) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="tabular-nums font-medium text-foreground">
                    {d.count}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="h-4 w-4" />A traiter en priorite
            </CardTitle>
            <CardDescription>
              Nouveaux scores eleves sans envoi, et contactes sans nouvelles
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Nouveaux chauds (score ≥ 50, pas d&apos;envoi)
              </p>
              <ul className="space-y-2 text-sm">
                {extras.hotNewNoOutreach.length === 0 ? (
                  <li className="text-muted-foreground">Rien a signaler</li>
                ) : (
                  extras.hotNewNoOutreach.map((p) => (
                    <li key={p.id}>
                      <Link
                        href="/prospects"
                        className="font-medium text-primary hover:underline"
                      >
                        {p.company}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {p.country} · {p.score}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Contactes (&gt; 30j sans lastContact)
              </p>
              <ul className="space-y-2 text-sm">
                {extras.staleContacted.length === 0 ? (
                  <li className="text-muted-foreground">Rien a signaler</li>
                ) : (
                  extras.staleContacted.map((p) => (
                    <li key={p.id}>
                      <Link
                        href="/prospects"
                        className="font-medium text-primary hover:underline"
                      >
                        {p.company}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        ·{" "}
                        {p.lastContactedAt
                          ? new Date(p.lastContactedAt).toLocaleDateString(
                              "fr-FR"
                            )
                          : "jamais"}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4" />
                Segments enregistres
              </CardTitle>
              <CardDescription>
                Raccourcis vers la page Segments pour cibler une campagne
              </CardDescription>
            </div>
            <Link
              href="/segments"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Gerer
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {extras.segments.length === 0 ? (
                <li className="text-muted-foreground">
                  Aucun segment — en creer sur la page Segments
                </li>
              ) : (
                extras.segments.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary">
                      {s.liveProspectsCount} prospects
                    </Badge>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-sky-600" />
            Checklist domaine (delivrabilite)
          </CardTitle>
          <CardDescription>
            A verifier periodiquement chez votre fournisseur (ex. Resend)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>SPF, DKIM et domaine d&apos;envoi verifies</li>
            <li>Sous-domaine de tracking (open / click) en DNS OK</li>
            <li>DMARC en <code className="text-xs">p=none</code> puis durcissement progressif</li>
            <li>Webhook Resend vers <code className="text-xs">/api/webhooks/resend</code> pour livraisons</li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Exports CSV
            </CardTitle>
            <CardDescription>
              Telechargement depuis votre session connectee
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a
              href="/api/export?type=prospects"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Tous les prospects
            </a>
            <a
              href="/api/export?type=bounced"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Emails en rebond
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" />
              Hygiene & rebonds recents
            </CardTitle>
            <CardDescription>
              Taux rebond 30j :{" "}
              <span className="font-semibold text-foreground">
                {extras.bounceRate30}%
              </span>{" "}
              ({extras.bounced30} / {extras.attempted30} tentatives avec date
              d&apos;envoi)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Derniers rebonds
            </p>
            <ul className="space-y-1.5 text-sm">
              {extras.recentBouncedSamples.length === 0 ? (
                <li className="text-muted-foreground">Aucun rebond en base</li>
              ) : (
                extras.recentBouncedSamples.map((e) => (
                  <li key={e.id} className="truncate">
                    <span className="font-medium">
                      {e.prospect.company}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      — {e.prospect.email}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {extras.prospectsBySource.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutList className="h-4 w-4" />
              Origine des prospects (source)
            </CardTitle>
            <CardDescription>
              Alimentation du pipe : scraping, import, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardCharts
              type="source"
              data={extras.prospectsBySource.map((s) => ({
                source: s.source,
                count: s.count,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
