"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MailOpen, MessageCircleReply, Pause, Pencil, Play, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { PRODUCT_LABELS } from "@/lib/product-catalog";

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

const PAGE_SIZE = 9;

function formatProductLabel(product: string | null): string {
  if (!product || product === "all") return "Tous produits";
  return PRODUCT_LABELS[product.trim()] ?? product.replace(/_/g, " ");
}

function Metric({ icon: Icon, value, label }: { icon: typeof Send; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      <p data-slot="kpi-value" className="text-xl font-semibold">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default function CampaignsPage() {
  const confirm = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) throw new Error();
      setCampaigns(await res.json());
      setError(false);
    } catch {
      setError(true);
      setCampaigns((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleStatus = async (c: Campaign) => {
    const status = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const res = await fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Mise à jour impossible");
      return;
    }
    toast.success(status === "ACTIVE" ? "Campagne reprise" : "Campagne en pause");
    fetchCampaigns();
  };

  const deleteCampaign = async (c: Campaign) => {
    const ok = await confirm({
      title: `Supprimer « ${c.name} » ?`,
      description: "Tous les emails de la campagne et leur historique seront supprimés. Cette action est définitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/campaigns/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Suppression impossible");
      return;
    }
    setCampaigns((prev) => (prev ?? []).filter((x) => x.id !== c.id));
    toast.success("Campagne supprimée");
  };

  const list = campaigns ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Campagnes"
        description="Préparez, relisez et suivez vos campagnes d'emails."
        icon={Mail}
        actions={
          <Link href="/campaigns/new" className={buttonVariants()}>
            <Plus className="h-4 w-4" />
            Nouvelle campagne
          </Link>
        }
      />

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les campagnes.{" "}
          <button type="button" className="font-medium underline" onClick={fetchCampaigns}>
            Réessayer
          </button>
        </p>
      ) : null}

      {campaigns === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-60 rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 && !error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Mail className="mb-3 h-8 w-8 text-primary" />
            <p className="text-lg font-medium">Aucune campagne</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Une campagne cible un segment de prospects avec un produit, une langue et un ton.
            </p>
            <Link href="/campaigns/new" className={buttonVariants({ className: "mt-5" })}>
              <Plus className="h-4 w-4" />
              Créer une campagne
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginated.map((campaign) => (
              <Card key={campaign.id} className="transition-colors hover:border-primary/30">
                <CardHeader className="space-y-2 pb-1">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="min-w-0 flex-1 text-base font-semibold leading-snug">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="line-clamp-2 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {campaign.name}
                      </Link>
                    </CardTitle>
                    <StatusBadge kind="campaign" value={campaign.status} />
                  </div>
                  <CardDescription className="line-clamp-2 text-xs">
                    {campaign.segment?.name || "Tous les prospects"} · {formatProductLabel(campaign.product)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 px-2 py-3">
                    <Metric icon={Send} value={campaign.sentCount} label="Envoyés" />
                    <Metric icon={MailOpen} value={campaign.openCount} label="Ouverts" />
                    <Metric icon={MessageCircleReply} value={campaign.replyCount} label="Réponses" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/campaigns/${campaign.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}>
                      Ouvrir
                    </Link>
                    <Link
                      href={`/campaigns/${campaign.id}/edit`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                      aria-label={`Modifier ${campaign.name}`}
                      title="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {campaign.status === "ACTIVE" || campaign.status === "PAUSED" ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={campaign.status === "ACTIVE" ? "Mettre en pause" : "Reprendre"}
                        title={campaign.status === "ACTIVE" ? "Mettre en pause" : "Reprendre"}
                        onClick={() => toggleStatus(campaign)}
                      >
                        {campaign.status === "ACTIVE" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Supprimer ${campaign.name}`}
                      title="Supprimer"
                      onClick={() => deleteCampaign(campaign)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <ListPagination
            page={safePage}
            totalPages={totalPages}
            totalItems={list.length}
            itemLabel="campagnes"
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
