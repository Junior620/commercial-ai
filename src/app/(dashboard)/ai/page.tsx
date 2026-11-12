"use client";

import { useState } from "react";
import { Bot, Check, Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductOptions } from "@/components/shared/product-options";
import { PageTitle } from "@/components/layout/page-title";
import { AIBadge } from "@/components/ui/ai-badge";
import { CAMPAIGN_PRODUCT_OPTIONS, PRODUCT_LABELS, productItems } from "@/lib/product-catalog";
import { LANGUAGE_LABELS, TONE_LABELS } from "@/lib/labels";

const LANGUAGES = ["fr", "en", "es", "pt", "de"];

export default function AIPage() {
  const [params, setParams] = useState({
    prospectName: "",
    companyName: "",
    country: "",
    sector: "",
    language: "fr",
    tone: "FORMAL",
    campaignProduct: "cocoa_butter",
    customInstructions: "",
  });
  const [result, setResult] = useState<{ subject: string; body: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (key: keyof typeof params) => (value: string) => setParams((p) => ({ ...p, [key]: value }));

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...params,
          campaignProduct: PRODUCT_LABELS[params.campaignProduct] ?? params.campaignProduct,
          campaignProductId: params.campaignProduct,
          customInstructions: params.customInstructions || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "La rédaction a échoué");
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(`Objet : ${result.subject}\n\n${result.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Assistant de rédaction"
        description="Rédigez un email ponctuel pour un prospect, hors campagne. Relisez toujours le texte avant de l'utiliser."
        icon={Bot}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Le prospect</CardTitle>
            <CardDescription>Plus le profil est précis, plus l&apos;email sera pertinent.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-contact">Nom du contact *</Label>
                  <Input id="ai-contact" required value={params.prospectName} onChange={(e) => set("prospectName")(e.target.value)} placeholder="Marie Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-company">Entreprise *</Label>
                  <Input id="ai-company" required value={params.companyName} onChange={(e) => set("companyName")(e.target.value)} placeholder="Chocolaterie Durand" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-country">Pays</Label>
                  <Input id="ai-country" value={params.country} onChange={(e) => set("country")(e.target.value)} placeholder="Belgique" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-sector">Activité</Label>
                  <Input id="ai-sector" value={params.sector} onChange={(e) => set("sector")(e.target.value)} placeholder="Fabricant de chocolat" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-product">Produit à proposer</Label>
                  <Select items={productItems(CAMPAIGN_PRODUCT_OPTIONS)} value={params.campaignProduct} onValueChange={(v) => v && set("campaignProduct")(v)}>
                    <SelectTrigger id="ai-product" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <ProductOptions options={CAMPAIGN_PRODUCT_OPTIONS} />
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-language">Langue de l&apos;email</Label>
                  <Select items={LANGUAGE_LABELS} value={params.language} onValueChange={(v) => v && set("language")(v)}>
                    <SelectTrigger id="ai-language" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l} value={l}>
                          {LANGUAGE_LABELS[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-tone">Ton</Label>
                <Select items={TONE_LABELS} value={params.tone} onValueChange={(v) => v && set("tone")(v)}>
                  <SelectTrigger id="ai-tone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TONE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-instructions">Consignes particulières</Label>
                <Textarea
                  id="ai-instructions"
                  value={params.customInstructions}
                  onChange={(e) => set("customInstructions")(e.target.value)}
                  placeholder="Ex. : rappeler notre rencontre au salon, proposer un échantillon."
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !params.prospectName || !params.companyName}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {loading ? "Rédaction en cours…" : "Rédiger l'email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card aria-live="polite">
          <CardHeader className="flex flex-row items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Proposition</CardTitle>
              {result ? <AIBadge size="xs" label="Proposé par l'assistant" /> : null}
            </div>
            {result ? (
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copié" : "Copier"}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Objet</p>
                  <p className="text-lg font-semibold">{result.subject}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Message</p>
                  <div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-relaxed">{result.body}</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <Bot className="mb-4 h-10 w-10 opacity-40" />
                <p className="max-w-xs text-sm">Décrivez le prospect, puis cliquez sur « Rédiger l&apos;email ».</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
