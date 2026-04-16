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
import { Plus, Mail, Play, Pause, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

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
        `Supprimer la campagne « ${c.name} » ? Tous les emails associes seront supprimes.`
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
      toast.success("Campagne supprimee");
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
              Creez votre premiere campagne pour commencer
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedCampaigns.map((campaign) => (
            <Card key={campaign.id} className="border-border/70 transition-colors hover:border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <Badge
                    variant="secondary"
                    className={STATUS_COLORS[campaign.status] || ""}
                  >
                    {campaign.status}
                  </Badge>
                </div>
                <CardDescription>
                  {campaign.segment?.name || "Sans segment"} —{" "}
                  {campaign.product || "Tous produits"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-bold">{campaign.sentCount}</p>
                    <p className="text-xs text-muted-foreground">Envoyes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{campaign.openCount}</p>
                    <p className="text-xs text-muted-foreground">Ouverts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{campaign.replyCount}</p>
                    <p className="text-xs text-muted-foreground">Reponses</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/campaigns/${campaign.id}`} className="min-w-0 flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <Eye className="mr-2 h-3 w-3" />
                      Voir
                    </Button>
                  </Link>
                  <Link href={`/campaigns/${campaign.id}/edit`}>
                    <Button variant="outline" size="sm" title="Modifier">
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </Link>
                  {(campaign.status === "ACTIVE" ||
                    campaign.status === "PAUSED") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toggleStatus(campaign.id, campaign.status)
                      }
                    >
                      {campaign.status === "ACTIVE" ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    title="Supprimer"
                    onClick={() => deleteCampaign(campaign)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
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
