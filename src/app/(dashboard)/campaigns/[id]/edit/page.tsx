"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil, RefreshCw } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { CAMPAIGN_PRODUCT_OPTIONS } from "@/lib/product-catalog";

interface Segment {
  id: string;
  name: string;
}

export default function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    segmentId: "",
    product: "",
    language: "en",
    tone: "FORMAL",
    maxFollowUps: "2",
    followUpDelayDays: "4",
    dailyLimit: "50",
    signature: "",
  });

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => r.json())
      .then(setSegments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/campaigns/${id}`);
        if (!res.ok) throw new Error("Introuvable");
        const c = await res.json();
        if (cancelled) return;
        setFormData({
          name: c.name ?? "",
          segmentId: c.segmentId ?? "",
          product: c.product ?? "",
          language: c.language ?? "auto",
          tone: c.tone ?? "FORMAL",
          maxFollowUps: String(c.maxFollowUps ?? 2),
          followUpDelayDays: String(c.followUpDelayDays ?? 4),
          dailyLimit: String(c.dailyLimit ?? 50),
          signature: c.signature ?? "",
        });
      } catch {
        toast.error("Campagne introuvable");
        router.push("/campaigns");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          maxFollowUps: parseInt(formData.maxFollowUps, 10),
          followUpDelayDays: parseInt(formData.followUpDelayDays, 10),
          dailyLimit: parseInt(formData.dailyLimit, 10),
          segmentId: formData.segmentId ? formData.segmentId : null,
          product: formData.product || null,
          language: formData.language,
          tone: formData.tone,
          signature: formData.signature || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Campagne mise a jour");
      router.push(`/campaigns/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Modifier la campagne"
        description="Mettez a jour les parametres de la campagne"
        icon={Pencil}
      />

      <Card>
        <CardHeader>
          <CardTitle>Parametres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Nom de la campagne *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Segment cible</Label>
            <Select
              value={formData.segmentId || "__all__"}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  segmentId: v === "__all__" ? "" : (v ?? ""),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les prospects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous les prospects</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Produit</Label>
              <Select
                value={formData.product || "__p_none__"}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    product: v === "__p_none__" ? "" : (v ?? ""),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__p_none__">Non defini</SelectItem>
                  {CAMPAIGN_PRODUCT_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Langue</Label>
              <Select
                value={formData.language}
                onValueChange={(v) =>
                  setFormData({ ...formData, language: v ?? "en" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (langue du prospect)</SelectItem>
                  <SelectItem value="en">Anglais</SelectItem>
                  <SelectItem value="fr">Francais</SelectItem>
                  <SelectItem value="es">Espagnol</SelectItem>
                  <SelectItem value="pt">Portugais</SelectItem>
                  <SelectItem value="de">Allemand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ton commercial</Label>
            <Select
              value={formData.tone}
              onValueChange={(v) =>
                setFormData({ ...formData, tone: v ?? "FORMAL" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FORMAL">Formel & professionnel</SelectItem>
                <SelectItem value="FRIENDLY">Amical & chaleureux</SelectItem>
                <SelectItem value="TECHNICAL">Technique & precis</SelectItem>
                <SelectItem value="PREMIUM">Premium & exclusif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max relances</Label>
              <Input
                type="number"
                value={formData.maxFollowUps}
                onChange={(e) =>
                  setFormData({ ...formData, maxFollowUps: e.target.value })
                }
                min="0"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label>Delai relance (jours)</Label>
              <Input
                type="number"
                value={formData.followUpDelayDays}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    followUpDelayDays: e.target.value,
                  })
                }
                min="1"
                max="60"
              />
            </div>
            <div className="space-y-2">
              <Label>Limite/jour</Label>
              <Input
                type="number"
                value={formData.dailyLimit}
                onChange={(e) =>
                  setFormData({ ...formData, dailyLimit: e.target.value })
                }
                min="1"
                max="500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Signature email</Label>
            <Textarea
              value={formData.signature}
              onChange={(e) =>
                setFormData({ ...formData, signature: e.target.value })
              }
              rows={4}
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/campaigns/${id}`)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
