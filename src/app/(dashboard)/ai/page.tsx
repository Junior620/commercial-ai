"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Bot, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import { AIBadge } from "@/components/ui/ai-badge";
import { AIBanner } from "@/components/ui/ai-banner";
import { HowAIWorks } from "@/components/ai/how-ai-works";
import { CAMPAIGN_PRODUCT_OPTIONS } from "@/lib/product-catalog";

export default function AIPage() {
  const [params, setParams] = useState({
    prospectName: "",
    companyName: "",
    country: "",
    sector: "",
    product: "",
    language: "en",
    tone: "FORMAL",
    campaignProduct: "cocoa_butter",
    customInstructions: "",
  });
  const [result, setResult] = useState<{
    subject: string;
    body: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!params.prospectName || !params.companyName) {
      toast.error("Nom du prospect et entreprise requis");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error("Erreur de génération");
      const data = await res.json();
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Objet: ${result.subject}\n\n${result.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageTitle
          title="Agent IA"
          description="Générez des emails commerciaux personnalisés avec Claude"
          icon={Bot}
        />
        <AIBadge label="Claude 3.5" size="md" variant="solid" className="mt-1" />
      </div>

      <AIBanner
        title="Studio de rédaction IA"
        description="Décrivez le prospect, choisissez le ton et la langue : l’IA rédige un email personnalisé, naturel et prêt à envoyer."
      />

      <HowAIWorks />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paramètres de génération</CardTitle>
            <CardDescription>
              Renseignez le profil du prospect pour générer un e-mail
              personnalisé.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label>Nom du contact *</Label>
                <Input
                  value={params.prospectName}
                  onChange={(e) =>
                    setParams({ ...params, prospectName: e.target.value })
                  }
                  placeholder="John Smith"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Entreprise *</Label>
                <Input
                  value={params.companyName}
                  onChange={(e) =>
                    setParams({ ...params, companyName: e.target.value })
                  }
                  placeholder="Choco Industries"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label>Pays</Label>
                <Input
                  value={params.country}
                  onChange={(e) =>
                    setParams({ ...params, country: e.target.value })
                  }
                  placeholder="Belgium"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Secteur</Label>
                <Input
                  value={params.sector}
                  onChange={(e) =>
                    setParams({ ...params, sector: e.target.value })
                  }
                  placeholder="Chocolate manufacturing"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label>Produit à promouvoir</Label>
                <Select
                  value={params.campaignProduct}
                  onValueChange={(v) =>
                    setParams({ ...params, campaignProduct: v ?? "cocoa_butter" })
                  }
                >
                  <SelectTrigger className="h-10 w-full min-w-0">
                    <SelectValue placeholder="Choisir un produit" />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="min-w-[min(100%,18rem)]"
                  >
                    {CAMPAIGN_PRODUCT_OPTIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Langue</Label>
                <Select
                  value={params.language}
                  onValueChange={(v) =>
                    setParams({ ...params, language: v ?? "en" })
                  }
                >
                  <SelectTrigger className="h-10 w-full min-w-0">
                    <SelectValue placeholder="Choisir une langue" />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="min-w-[min(100%,16rem)]"
                  >
                    <SelectItem value="en">Anglais</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="es">Espagnol</SelectItem>
                    <SelectItem value="pt">Portugais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <Label>Ton</Label>
              <Select
                value={params.tone}
                onValueChange={(v) =>
                  setParams({ ...params, tone: v ?? "FORMAL" })
                }
              >
                <SelectTrigger className="h-10 w-full min-w-0">
                  <SelectValue placeholder="Choisir un ton" />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="min-w-[min(100%,16rem)]"
                >
                  <SelectItem value="FORMAL">Formel</SelectItem>
                  <SelectItem value="FRIENDLY">Amical</SelectItem>
                  <SelectItem value="TECHNICAL">Technique</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Instructions supplémentaires</Label>
              <Textarea
                value={params.customInstructions}
                onChange={(e) =>
                  setParams({
                    ...params,
                    customInstructions: e.target.value,
                  })
                }
                placeholder="Ex: Mentionner notre certification bio..."
                rows={3}
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours…
                </>
              ) : (
                <>
                  <Bot className="mr-2 h-4 w-4" />
                  Générer l&apos;e-mail
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Aperçu de l&apos;e-mail</CardTitle>
                <AIBadge label="Généré par IA" size="xs" variant="soft" />
              </div>
              {result && (
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copié" : "Copier"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    OBJET
                  </p>
                  <p className="font-semibold text-lg">{result.subject}</p>
                </div>
                <div className="border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    CORPS DU MAIL
                  </p>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/50 p-4 rounded-lg">
                    {result.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bot className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-sm text-center">
                  Remplissez les paramètres et cliquez sur « Générer l&apos;e-mail
                  ».
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
