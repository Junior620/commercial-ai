"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPAIGN_PRODUCT_OPTIONS } from "@/lib/product-catalog";
import { LANGUAGE_LABELS } from "@/lib/labels";

export type CampaignFormValues = {
  name: string;
  segmentId: string;
  product: string;
  language: string;
  tone: string;
  maxFollowUps: string;
  followUpDelayDays: string;
  dailyLimit: string;
};

export const EMPTY_CAMPAIGN: CampaignFormValues = {
  name: "",
  segmentId: "",
  product: "all",
  language: "auto",
  tone: "FORMAL",
  maxFollowUps: "2",
  followUpDelayDays: "4",
  dailyLimit: "50",
};

const TONES = [
  { value: "FORMAL", label: "Formel et professionnel" },
  { value: "FRIENDLY", label: "Chaleureux" },
  { value: "TECHNICAL", label: "Technique et précis" },
  { value: "PREMIUM", label: "Premium" },
];

const ALL = "__all__";

/** Convertit le formulaire en corps d'API (création ou modification). */
export function toCampaignPayload(v: CampaignFormValues) {
  return {
    name: v.name.trim(),
    segmentId: v.segmentId || null,
    product: v.product || null,
    language: v.language,
    tone: v.tone,
    maxFollowUps: Number(v.maxFollowUps),
    followUpDelayDays: Number(v.followUpDelayDays),
    dailyLimit: Number(v.dailyLimit),
  };
}

/** Formulaire commun à la création et à la modification d'une campagne. */
export function CampaignForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: {
  initial: CampaignFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: CampaignFormValues) => void;
}) {
  const [values, setValues] = useState(initial);
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const set = (key: keyof CampaignFormValues) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSegments(Array.isArray(data) ? data : []))
      .catch(() => setSegments([]));
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Ciblage et message</CardTitle>
          <CardDescription>
            L&apos;assistant rédige un email par prospect selon ces réglages. Tout reste modifiable avant l&apos;envoi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Nom de la campagne *</Label>
            <Input
              id="campaign-name"
              required
              maxLength={120}
              value={values.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="Ex. : Beurre de cacao, chocolatiers Benelux, T1 2027"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-segment">Segment ciblé</Label>
            <Select value={values.segmentId || ALL} onValueChange={(v) => set("segmentId")(!v || v === ALL ? "" : v)}>
              <SelectTrigger id="campaign-segment" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les prospects (nouveaux et contactés)</SelectItem>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Les prospects désinscrits, à ne plus contacter ou déjà clients sont toujours exclus.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-product">Produit à proposer</Label>
              <Select value={values.product || "all"} onValueChange={(v) => v && set("product")(v)}>
                <SelectTrigger id="campaign-product" className="w-full">
                  <SelectValue />
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
            <div className="space-y-1.5">
              <Label htmlFor="campaign-language">Langue</Label>
              <Select value={values.language} onValueChange={(v) => v && set("language")(v)}>
                <SelectTrigger id="campaign-language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["auto", "fr", "en", "es", "pt", "de"].map((l) => (
                    <SelectItem key={l} value={l}>
                      {LANGUAGE_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="campaign-tone">Ton</Label>
            <Select value={values.tone} onValueChange={(v) => v && set("tone")(v)}>
              <SelectTrigger id="campaign-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rythme</CardTitle>
          <CardDescription>Le quota global défini dans Paramètres s&apos;applique en plus de la limite de la campagne.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-followups">Relances maximum</Label>
            <Input id="campaign-followups" type="number" min={0} max={3} value={values.maxFollowUps} onChange={(e) => set("maxFollowUps")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-delay">Jours entre deux emails</Label>
            <Input id="campaign-delay" type="number" min={1} max={60} value={values.followUpDelayDays} onChange={(e) => set("followUpDelayDays")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-limit">Emails par jour</Label>
            <Input id="campaign-limit" type="number" min={1} max={500} value={values.dailyLimit} onChange={(e) => set("dailyLimit")(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={submitting || !values.name.trim()}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
