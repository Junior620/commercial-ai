"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert, Clock, Loader2, MailCheck, MailOpen, MailX, Send, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/layout/page-title";
import { cn } from "@/lib/utils";

interface SendingStats {
  pendingEmails: number;
  pendingReady: number;
  sentToday: number;
  deliveredToday: number;
  openedToday: number;
  bouncedToday: number;
  failedToday: number;
  openRate: number;
  bounceRate: number;
  dailyLimit: number;
  remainingToday: number;
  activeCampaigns: number;
  suppressed: number;
  updatedAt: string;
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "text-muted-foreground",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Send;
  tone?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p data-slot="kpi-value" className="mt-1 text-2xl font-semibold">
            {value}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className={cn("h-5 w-5 shrink-0", tone)} aria-hidden />
      </CardContent>
    </Card>
  );
}

export default function SendingPage() {
  const [stats, setStats] = useState<SendingStats | null>(null);
  const [error, setError] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/sending/stats");
      if (!res.ok) throw new Error();
      setStats(await res.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const handleSendBatch = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/sending/batch", { method: "POST" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Envoi impossible");
      if (result.queued) toast.success("Lot lancé : les emails partent un par un, avec l'espacement configuré.");
      else toast.info(result.message || "Rien à envoyer pour le moment.");
      fetchStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'envoi");
    } finally {
      setIsSending(false);
    }
  };

  const quotaPct = stats && stats.dailyLimit > 0 ? Math.min(100, (stats.sentToday / stats.dailyLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Envoi"
        description="Cadence d'envoi, quota quotidien et santé de la délivrabilité."
        icon={Send}
        actions={
          <Button onClick={handleSendBatch} disabled={isSending || !stats || stats.remainingToday <= 0 || stats.pendingReady === 0}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer un lot maintenant
          </Button>
        }
      />

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Statistiques indisponibles pour le moment.
        </p>
      ) : null}

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Quota du jour</CardTitle>
              <CardDescription>
                {stats.sentToday} / {stats.dailyLimit} emails envoyés aujourd&apos;hui · {stats.remainingToday} restant(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={quotaPct} className="h-2.5" aria-label="Quota quotidien utilisé" />
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                L&apos;envoi est automatique toutes les 15 minutes, du lundi au vendredi de 8 h à 19 h (heure de Douala),
                pour les campagnes actives. Le bouton ci-dessus déclenche simplement un lot immédiat.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Prêts à partir" value={stats.pendingReady} hint={`Approuvés, campagne active · ${stats.pendingEmails} en attente au total`} icon={Clock} />
            <Stat label="Délivrés aujourd'hui" value={stats.deliveredToday} icon={MailCheck} tone="text-success" />
            <Stat label="Ouverts aujourd'hui" value={stats.openedToday} hint={`Taux d'ouverture : ${stats.openRate} %`} icon={MailOpen} tone="text-primary" />
            <Stat label="Campagnes actives" value={stats.activeCampaigns} icon={Send} />
            <Stat
              label="Rebonds aujourd'hui"
              value={stats.bouncedToday}
              hint={`Taux de rebond : ${stats.bounceRate} %`}
              icon={MailX}
              tone={stats.bounceRate >= 5 ? "text-destructive" : "text-muted-foreground"}
            />
            <Stat label="Échecs / annulés aujourd'hui" value={stats.failedToday} icon={CircleAlert} tone="text-warning" />
            <Stat
              label="Adresses exclues"
              value={stats.suppressed}
              hint="Désinscriptions, plaintes, rebonds définitifs"
              icon={ShieldBan}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Dernière mise à jour : {new Date(stats.updatedAt).toLocaleTimeString("fr-FR")}
          </p>
        </>
      )}
    </div>
  );
}
