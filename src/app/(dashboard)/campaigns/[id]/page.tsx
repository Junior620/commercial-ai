"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Play, Pause, Bot, Send, RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";

interface CampaignDetail {
  id: string;
  name: string;
  product: string | null;
  language: string;
  tone: string;
  status: string;
  maxFollowUps: number;
  followUpDelayDays: number;
  dailyLimit: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
  segment: { name: string; id: string } | null;
  emails: Array<{
    id: string;
    subject: string;
    status: string;
    type: string;
    sentAt: string | null;
    prospect: { company: string; email: string; contact: string | null };
  }>;
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.ok) setCampaign(await res.json());
    } catch {
      // ignore
    }
  };

  const handleGenerateEmails = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur generation");
      const result = await res.json();
      toast.success(`${result.generated} emails generes par l'IA`);
      fetchCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendBatch = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur envoi");
      const result = await res.json();
      toast.success(`${result.sent} emails envoyes`);
      fetchCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async () => {
    if (!campaign) return;
    const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchCampaign();
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    SENT: "bg-blue-100 text-blue-800",
    DELIVERED: "bg-green-100 text-green-800",
    OPENED: "bg-purple-100 text-purple-800",
    CLICKED: "bg-indigo-100 text-indigo-800",
    BOUNCED: "bg-red-100 text-red-800",
    REPLIED: "bg-emerald-100 text-emerald-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle
          title={campaign.name}
          description={`${campaign.segment?.name || "Sans segment"} — ${campaign.language.toUpperCase()} — ${campaign.tone}`}
          icon={BarChart3}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerateEmails}
            disabled={generating}
          >
            <Bot className="mr-2 h-4 w-4" />
            {generating ? "Generation..." : "Generer emails IA"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSendBatch}
            disabled={sending}
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Envoi..." : "Envoyer le lot"}
          </Button>
          <Button variant="outline" onClick={toggleStatus}>
            {campaign.status === "ACTIVE" ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {campaign.status === "ACTIVE" ? "Pause" : "Activer"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Envoyes", value: campaign.sentCount },
          { label: "Ouverts", value: campaign.openCount },
          { label: "Reponses", value: campaign.replyCount },
          { label: "Rebonds", value: campaign.bounceCount },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emails de la campagne</CardTitle>
          <CardDescription>{campaign.emails.length} emails</CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.emails.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun email genere. Cliquez sur &quot;Generer emails IA&quot; pour commencer.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoye le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaign.emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {email.prospect.company}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {email.prospect.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {email.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{email.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[email.status] || ""}
                        >
                          {email.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleString("fr-FR")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
