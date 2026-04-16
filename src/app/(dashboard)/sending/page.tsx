"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Send, Loader2, MailOpen, MailCheck, MailX, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";

interface SendingStats {
  pendingEmails: number;
  sentToday: number;
  deliveredToday: number;
  openedToday: number;
  bouncedToday: number;
  failedToday: number;
  openRate: number;
  bounceRate: number;
  dailyLimit: number;
  activeCampaigns: number;
  updatedAt: string;
}

export default function SendingPage() {
  const [stats, setStats] = useState<SendingStats | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 8000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/sending/stats");
      if (res.ok) setStats(await res.json());
    } catch {
      // ignore
    }
  };

  const handleSendBatch = async () => {
    setIsSending(true);
    try {
      const res = await fetch("/api/sending/batch", { method: "POST" });
      if (!res.ok) throw new Error("Erreur");
      const result = await res.json();
      toast.success(`${result.sent} emails envoyes`);
      fetchStats();
    } catch {
      toast.error("Erreur d'envoi");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Envoi d'emails"
        description="Contrôle de l'envoi progressif, quotas et cadence"
        icon={Send}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.pendingEmails ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Envoyes aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.sentToday ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Limite quotidienne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.dailyLimit ?? 50}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Campagnes actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {stats?.activeCampaigns ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Livres aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{stats?.deliveredToday ?? 0}</p>
            <MailCheck className="h-5 w-5 text-emerald-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Ouverts aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{stats?.openedToday ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                Taux d&apos;ouverture: {stats?.openRate ?? 0}%
              </p>
            </div>
            <MailOpen className="h-5 w-5 text-indigo-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Rebonds aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{stats?.bouncedToday ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                Taux de rebond: {stats?.bounceRate ?? 0}%
              </p>
            </div>
            <MailX className="h-5 w-5 text-red-600" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Failed aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-2xl font-bold">{stats?.failedToday ?? 0}</p>
            <CircleAlert className="h-5 w-5 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Quota journalier</CardTitle>
            <CardDescription>
              {stats.sentToday} / {stats.dailyLimit} emails envoyes
              aujourd&apos;hui
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={(stats.sentToday / stats.dailyLimit) * 100}
              className="h-3"
            />
            <div className="mt-4 flex gap-4">
              <Button
                onClick={handleSendBatch}
                disabled={isSending || stats.sentToday >= stats.dailyLimit}
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                {isSending ? "Envoi en cours..." : "Envoyer un lot"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Derniere mise a jour: {new Date(stats.updatedAt).toLocaleTimeString("fr-FR")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
