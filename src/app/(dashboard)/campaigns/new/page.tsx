"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import { CampaignForm, EMPTY_CAMPAIGN, toCampaignPayload, type CampaignFormValues } from "@/components/campaigns/campaign-form";

function NewCampaign() {
  const router = useRouter();
  const product = useSearchParams().get("product");
  const [submitting, setSubmitting] = useState(false);

  const create = async (values: CampaignFormValues) => {
    setSubmitting(true);
    try {
      const payload = toCampaignPayload(values);
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, segmentId: payload.segmentId ?? undefined, product: payload.product ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Création impossible");
      toast.success("Campagne créée. Lancez maintenant la rédaction des emails.");
      router.push(`/campaigns/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="Nouvelle campagne" description="Choisissez la cible, le produit et le ton. La rédaction vient ensuite." icon={Mail} />
      <CampaignForm initial={{ ...EMPTY_CAMPAIGN, ...(product ? { product } : {}) }} submitLabel="Créer la campagne" submitting={submitting} onSubmit={create} />
    </div>
  );
}

export default function NewCampaignPage() {
  return (
    <Suspense>
      <NewCampaign />
    </Suspense>
  );
}
