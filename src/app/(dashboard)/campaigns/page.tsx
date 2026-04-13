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
import { Plus, Mail, Play, Pause, Eye } from "lucide-react";
import Link from "next/link";
import { PageTitle } from "@/components/layout/page-title";

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
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
                <div className="flex gap-2">
                  <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <Eye className="mr-2 h-3 w-3" />
                      Voir
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
