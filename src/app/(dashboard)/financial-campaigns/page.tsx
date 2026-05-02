"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AIBadge } from "@/components/ui/ai-badge";
import {
  isFinancialCampaignProduct,
  isFinancialSegmentFilters,
} from "@/lib/financial-campaigns";

type Campaign = {
  id: string;
  name: string;
  product?: string | null;
  status: string;
  sentCount: number;
  openCount: number;
  replyCount: number;
  segmentId?: string | null;
  segment?: { name: string } | null;
};

type Segment = {
  id: string;
  filters?: unknown;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "border-border bg-muted/80 text-foreground",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-950",
  PAUSED: "border-amber-200 bg-amber-50 text-amber-950",
  COMPLETED: "border-sky-200 bg-sky-50 text-sky-950",
};

function formatCampaignStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "Brouillon",
    ACTIVE: "Active",
    PAUSED: "En pause",
    COMPLETED: "Terminee",
  };
  return map[status] ?? status;
}

export default function FinancialCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [financialSegmentIds, setFinancialSegmentIds] = useState<Set<string>>(
    new Set()
  );
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 9;

  useEffect(() => {
    async function load() {
      try {
        const [segmentsRes, campaignsRes] = await Promise.all([
          fetch("/api/segments"),
          fetch("/api/campaigns"),
        ]);
        if (!segmentsRes.ok || !campaignsRes.ok) return;
        const segments = (await segmentsRes.json()) as Segment[];
        const allCampaigns = (await campaignsRes.json()) as Campaign[];
        const ids = new Set(
          segments
            .filter((s) => isFinancialSegmentFilters(s.filters))
            .map((s) => s.id)
        );
        setFinancialSegmentIds(ids);
        setCampaigns(
          allCampaigns.filter(
            (c) =>
              (!!c.segmentId && ids.has(String(c.segmentId))) ||
              isFinancialCampaignProduct(c.product ?? null)
          )
        );
      } catch {
        // ignore
      }
    }
    void load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(campaigns.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const items = useMemo(
    () => campaigns.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [campaigns, safePage]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageTitle
          title="Campagnes financieres"
          description="Campagnes dediees aux segments financiers"
          icon={Mail}
        />
        <Link href="/financial-campaigns/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle campagne fin.
          </Button>
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Aucune campagne financiere pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((campaign) => (
              <Card key={campaign.id} className="border-border/80">
                <CardContent className="space-y-4 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-semibold leading-snug">{campaign.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {campaign.segment?.name || "Segment financier"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide",
                          STATUS_STYLES[campaign.status]
                        )}
                      >
                        {formatCampaignStatus(campaign.status)}
                      </Badge>
                      <AIBadge label="Finance" size="xs" variant="soft" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 rounded-lg border px-3 py-2 text-center">
                    <div>
                      <p className="text-lg font-bold">{campaign.sentCount}</p>
                      <p className="text-[10px] text-muted-foreground">Envoyes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{campaign.openCount}</p>
                      <p className="text-[10px] text-muted-foreground">Ouverts</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{campaign.replyCount}</p>
                      <p className="text-[10px] text-muted-foreground">Reponses</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/campaigns/${campaign.id}`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        Voir
                      </Button>
                    </Link>
                    <Link href={`/campaigns/${campaign.id}/edit`} className="flex-1">
                      <Button variant="outline" className="w-full" size="sm">
                        Modifier
                      </Button>
                    </Link>
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

