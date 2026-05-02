"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FINANCIAL_ALL_PRODUCT,
  isFinancialSegmentFilters,
} from "@/lib/financial-campaigns";

type Segment = {
  id: string;
  name: string;
  filters?: unknown;
};

export default function NewFinancialCampaignPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    segmentId: "",
    language: "auto",
    tone: "FORMAL",
    maxFollowUps: "2",
    followUpDelayDays: "4",
    dailyLimit: "50",
    signature: "",
  });

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => r.json())
      .then((rows: Segment[]) =>
        setSegments(rows.filter((s) => isFinancialSegmentFilters(s.filters)))
      )
      .catch(() => {});
  }, []);

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === formData.segmentId),
    [segments, formData.segmentId]
  );

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          segmentId: formData.segmentId || undefined,
          product: FINANCIAL_ALL_PRODUCT,
          maxFollowUps: parseInt(formData.maxFollowUps, 10),
          followUpDelayDays: parseInt(formData.followUpDelayDays, 10),
          dailyLimit: parseInt(formData.dailyLimit, 10),
        }),
      });
      if (!res.ok) throw new Error("Erreur de creation");
      const created = await res.json();
      toast.success("Campagne financiere creee");
      router.push(`/campaigns/${created.id}`);
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle
        title="Nouvelle campagne financiere"
        description="Cible uniquement des segments financiers"
        icon={Sparkles}
      />
      <Card>
        <CardHeader>
          <CardTitle>Parametres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Nom de la campagne *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Outreach DFI/Impact Funds Q2"
            />
          </div>
          <div className="space-y-2">
            <Label>Segment financier (optionnel)</Label>
            <Select
              value={formData.segmentId || "__all_financial__"}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  segmentId: v === "__all_financial__" ? "" : (v ?? ""),
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Tous les prospects financiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_financial__">
                  Tous les prospects financiers
                </SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {segments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucun segment financier detecte. Pas bloquant: la campagne peut
                cibler automatiquement tous les prospects financiers.
              </p>
            )}
            {selectedSegment && (
              <p className="text-xs text-muted-foreground">
                Segment selectionne : {selectedSegment.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Langue</Label>
              <Select
                value={formData.language}
                onValueChange={(v) =>
                  setFormData({ ...formData, language: v ?? "auto" })
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
            <div className="space-y-2">
              <Label>Ton</Label>
              <Select
                value={formData.tone}
                onValueChange={(v) => setFormData({ ...formData, tone: v ?? "FORMAL" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FORMAL">Formel</SelectItem>
                  <SelectItem value="FRIENDLY">Amical</SelectItem>
                  <SelectItem value="TECHNICAL">Technique</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Max relances</Label>
              <Input
                type="number"
                min="0"
                max="5"
                value={formData.maxFollowUps}
                onChange={(e) =>
                  setFormData({ ...formData, maxFollowUps: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Delai relance</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={formData.followUpDelayDays}
                onChange={(e) =>
                  setFormData({ ...formData, followUpDelayDays: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Limite/jour</Label>
              <Input
                type="number"
                min="1"
                max="200"
                value={formData.dailyLimit}
                onChange={(e) =>
                  setFormData({ ...formData, dailyLimit: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Signature</Label>
            <Textarea
              rows={4}
              value={formData.signature}
              onChange={(e) =>
                setFormData({ ...formData, signature: e.target.value })
              }
            />
          </div>

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Creation..." : "Creer la campagne financiere"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

