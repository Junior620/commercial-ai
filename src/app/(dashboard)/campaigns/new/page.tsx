"use client";

import { useState, useEffect } from "react";
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
import { Sparkles } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";
import { CAMPAIGN_PRODUCT_OPTIONS } from "@/lib/product-catalog";

interface Segment {
  id: string;
  name: string;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => r.json())
      .then(setSegments)
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!formData.name) {
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
          maxFollowUps: parseInt(formData.maxFollowUps),
          followUpDelayDays: parseInt(formData.followUpDelayDays),
          dailyLimit: parseInt(formData.dailyLimit),
          segmentId: formData.segmentId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erreur de creation");
      const campaign = await res.json();
      toast.success("Campagne creee");
      router.push(`/campaigns/${campaign.id}`);
    } catch {
      toast.error("Erreur lors de la creation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageTitle
        title="Nouvelle campagne"
        description="Configurez les paramètres de votre campagne d'emailing"
        icon={Sparkles}
      />

      <Card>
        <CardHeader>
          <CardTitle>Parametres de la campagne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Nom de la campagne *</Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Ex: Prospection beurre de cacao Europe Q2 2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Segment cible</Label>
            <Select
              value={formData.segmentId}
              onValueChange={(v) =>
                setFormData({ ...formData, segmentId: v ?? "" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un segment" />
              </SelectTrigger>
              <SelectContent>
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
              <Label>Produit a promouvoir</Label>
              <Select
                value={formData.product}
                onValueChange={(v) =>
                  setFormData({ ...formData, product: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectionner" />
                </SelectTrigger>
                <SelectContent>
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
                <SelectItem value="TECHNICAL">
                  Technique & precis
                </SelectItem>
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
                max="5"
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
                max="30"
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
                max="200"
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
              placeholder="Votre nom&#10;Titre&#10;Entreprise&#10;Tel: +xxx"
              rows={4}
            />
          </div>

          <Button
            onClick={handleCreate}
            disabled={loading}
            className="w-full"
          >
            {loading ? "Creation..." : "Creer la campagne"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
