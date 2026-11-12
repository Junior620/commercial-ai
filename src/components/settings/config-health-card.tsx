"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Check = { id: string; label: string; status: "ok" | "warning" | "error" | "unknown"; blocking: boolean; detail: string };
type Health = { checks: Check[]; blockers: Check[]; ready: boolean; strictCountries: string[] };

const ICONS = {
  ok: { icon: CheckCircle2, className: "text-success", label: "Conforme" },
  warning: { icon: AlertTriangle, className: "text-warning-foreground dark:text-warning", label: "À compléter" },
  error: { icon: XCircle, className: "text-destructive", label: "Bloquant" },
  unknown: { icon: CircleHelp, className: "text-muted-foreground", label: "Non vérifié" },
} as const;

/** État de la configuration : ce qui empêche (ou non) d'envoyer des emails. */
export function ConfigHealthCard({ isAdmin }: { isAdmin: boolean }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health/config", { cache: "no-store" });
      if (res.ok) setHealth(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/health/test-email", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Envoi impossible");
      toast.success(
        data.simulated
          ? "Envoi simulé : aucune clé Resend n'est configurée sur ce serveur."
          : `Email d'essai envoyé à ${data.to}. Vérifiez la signature, le pied de page et le lien de désinscription.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className={cn(health && !health.ready && "border-destructive/40")}>
      <CardHeader>
        <CardTitle>État de la configuration</CardTitle>
        <CardDescription>
          {health === null
            ? "Vérification en cours…"
            : health.ready
              ? "Tout ce qui est nécessaire à l'envoi est en place."
              : `${health.blockers.length} point(s) bloquant(s) : aucun email ne part et aucune campagne ne peut être activée tant qu'ils ne sont pas réglés.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {health === null ? (
          <Skeleton className="h-40" />
        ) : (
          <ul className="divide-y rounded-md border">
            {health.checks.map((c) => {
              const meta = ICONS[c.status];
              const Icon = meta.icon;
              return (
                <li key={c.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {c.label}
                      <span className="sr-only"> : {meta.label}</span>
                    </p>
                    <p className={cn("break-words text-xs", c.status === "error" ? "text-destructive" : "text-muted-foreground")}>{c.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {health ? (
          <p className="text-xs text-muted-foreground">
            Pays à accord préalable ({health.strictCountries.join(", ") || "aucun"}) : seules les adresses génériques (contact@, info@, achats@…)
            sont contactées, avec un message court et sans relance. Liste modifiable par la variable STRICT_OPTIN_COUNTRIES du serveur.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Vérifier à nouveau
          </Button>
          {isAdmin ? (
            <Button type="button" variant="outline" onClick={sendTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              M&apos;envoyer un email d&apos;essai
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
