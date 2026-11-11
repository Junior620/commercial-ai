"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/layout/page-title";
import { CampaignForm, toCampaignPayload, type CampaignFormValues } from "@/components/campaigns/campaign-form";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [initial, setInitial] = useState<CampaignFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) {
        toast.error("Campagne introuvable");
        router.push("/campaigns");
        return;
      }
      const c = await res.json();
      setInitial({
        name: c.name ?? "",
        segmentId: c.segmentId ?? "",
        product: c.product ?? "all",
        language: c.language ?? "auto",
        tone: c.tone ?? "FORMAL",
        maxFollowUps: String(c.maxFollowUps ?? 2),
        followUpDelayDays: String(c.followUpDelayDays ?? 4),
        dailyLimit: String(c.dailyLimit ?? 50),
      });
    })();
  }, [id, router]);

  const save = async (values: CampaignFormValues) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCampaignPayload(values)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      toast.success("Campagne mise à jour");
      router.push(`/campaigns/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Modifier la campagne"
        description="Les emails déjà rédigés ne sont pas réécrits : seuls les prochains suivront ces réglages."
        icon={Pencil}
      />
      {initial ? (
        <CampaignForm initial={initial} submitLabel="Enregistrer" submitting={submitting} onSubmit={save} />
      ) : (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      )}
    </div>
  );
}
