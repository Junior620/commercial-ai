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
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Mail,
  Play,
  Pause,
  Eye,
  Pencil,
  Trash2,
  Send,
  MailOpen,
  MessageCircleReply,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { cn } from "@/lib/utils";
import { PRODUCT_LABELS } from "@/lib/product-catalog";
import { AIBadge } from "@/components/ui/ai-badge";

interface Campaign {
  id: string;
  name: string;
  product: string | null;
  language: string;
  tone: string;
  status: string;
  sentCount: number;
  openCount: number;
  replyCount: number;
  createdAt: string;
  segment?: { name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT:
    "border-border bg-muted/80 text-foreground dark:bg-muted/50",
  ACTIVE:
    "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
  PAUSED:
    "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  COMPLETED:
    "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
};

function formatCampaignStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Brouillon",
    ACTIVE: "Active",
    PAUSED: "En pause",
    COMPLETED: "Terminée",
  };
  return map[status] ?? status;
}

function formatProductLabel(product: string | null): string {
  if (!product) return "Tous produits";
  const key = product.trim();
  if (PRODUCT_LABELS[key]) return PRODUCT_LABELS[key];
  return key.replace(/_/g, " ");
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) setCampaigns(await res.json());
    } catch {
      // ignore
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchCampaigns();
    } catch {
      // ignore
    }
  };

  const deleteCampaign = async (c: Campaign) => {
    if (
      !confirm(
        `Supprimer la campagne « ${c.name} » ? Tous les e-mails associés seront supprimés.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Campagne supprimée");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedCampaigns = campaigns.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageTitle
          title="Campagnes"
          description="Gérez vos campagnes d'emailing et vos performances"
          icon={Mail}
        />
        <Link href="/campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle campagne
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-lg font-medium">Aucune campagne</p>
            <p className="text-sm">
              Créez votre première campagne pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedCampaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="border-border/80 transition-shadow hover:border-border hover:shadow-md"
            >
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="min-w-0 flex-1 text-base font-semibold leading-snug">
                    <span className="line-clamp-2" title={campaign.name}>
                      {campaign.name}
                    </span>
                  </CardTitle>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        STATUS_STYLES[campaign.status]
                      )}
                    >
                      {formatCampaignStatus(campaign.status)}
                    </Badge>
                    <AIBadge
                      label="Emails IA"
                      size="xs"
                      variant="soft"
                      title="Emails rediges par IA"
                    />
                  </div>
                </div>
                <CardDescription
                  className="line-clamp-2 text-xs leading-relaxed"
                  title={`${campaign.segment?.name || "Sans segment"} — ${formatProductLabel(campaign.product)}`}
                >
                  <span className="text-muted-foreground">
                    {campaign.segment?.name || "Sans segment"}
                  </span>
                  <span className="text-muted-foreground/70"> · </span>
                  <span>{formatProductLabel(campaign.product)}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-3 sm:gap-3 sm:px-3">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <Send
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">
                      {campaign.sentCount}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Envoyés
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <MailOpen
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">
                      {campaign.openCount}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Ouverts
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <MessageCircleReply
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden
                    />
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">
                      {campaign.replyCount}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                      Réponses
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="min-w-0 flex-1"
                  >
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="sm"
                    >
                      <Eye className="h-4 w-4 shrink-0" />
                      Voir
                    </Button>
                  </Link>
                  <div className="flex shrink-0 items-center justify-end gap-1.5">
                    <Link href={`/campaigns/${campaign.id}/edit`}>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    {(campaign.status === "ACTIVE" ||
                      campaign.status === "PAUSED") && (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        title={
                          campaign.status === "ACTIVE"
                            ? "Mettre en pause"
                            : "Reprendre"
                        }
                        onClick={() =>
                          toggleStatus(campaign.id, campaign.status)
                        }
                      >
                        {campaign.status === "ACTIVE" ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer"
                      onClick={() => deleteCampaign(campaign)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={campaigns.length}
            itemLabel="campagnes"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
