"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Search, Play, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";

const KEYWORD_CATEGORIES = [
  { id: "buyer", label: "Acheteurs (buyers)" },
  { id: "general", label: "General (cocoa companies)" },
  { id: "product", label: "Produits specifiques" },
  { id: "linkedin_role", label: "Roles LinkedIn" },
  { id: "linkedin_combo", label: "LinkedIn combo" },
];

const COUNTRIES = [
  "Belgium",
  "Egypt",
  "France",
  "Germany",
  "Italy",
  "Morocco",
  "Netherlands",
  "Poland",
  "Portugal",
  "Saudi Arabia",
  "Spain",
  "Switzerland",
  "Tunisia",
  "Turkey",
  "UAE",
  "UK",
];

const PRODUCTS = [
  { id: "all", label: "Tous les produits" },
  { id: "cocoa beans", label: "Feves de cacao" },
  { id: "cocoa butter", label: "Beurre de cacao" },
  { id: "cocoa powder", label: "Poudre de cacao" },
  { id: "cocoa mass/liquor", label: "Masse de cacao" },
  { id: "derivatives", label: "Derives" },
  { id: "cosmetics", label: "Cosmetiques" },
  { id: "food/chocolate", label: "Alimentation/Chocolat" },
];

interface ScrapingJob {
  id: string;
  status: string;
  resultsCount: number;
  createdAt: string;
  keywords: string[];
}

export default function ScrapingPage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "buyer",
    "general",
  ]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("all");
  const [customKeywords, setCustomKeywords] = useState("");
  const [maxResults, setMaxResults] = useState("100");
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch("/api/scraping");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch {
      // ignore
    }
  };

  const handleStartScraping = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: selectedCategories,
          countries: selectedCountries.length > 0 ? selectedCountries : undefined,
          product: selectedProduct !== "all" ? selectedProduct : undefined,
          customKeywords: customKeywords
            .split("\n")
            .filter((k) => k.trim()),
          maxResults: parseInt(maxResults),
        }),
      });
      if (!res.ok) throw new Error("Erreur de lancement");
      const job = await res.json();
      toast.success(`Scraping lance ! Job ID: ${job.id}`);
      setJobs([job, ...jobs]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setIsRunning(false);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCountry = (country: string) => {
    setSelectedCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Scraping"
        description="Recherche automatique de prospects via Google Maps et enrichissement email"
        icon={Search}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration du scraping</CardTitle>
            <CardDescription>
              Selectionnez les criteres de recherche depuis votre fichier de
              keywords
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Categories de keywords
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {KEYWORD_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={cat.id}
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <label htmlFor={cat.id} className="text-sm">
                      {cat.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Produit cible</Label>
              <Select
                value={selectedProduct}
                onValueChange={(v) => setSelectedProduct(v ?? "all")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Pays cibles (optionnel)
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {COUNTRIES.map((country) => (
                  <div key={country} className="flex items-center space-x-2">
                    <Checkbox
                      id={`country-${country}`}
                      checked={selectedCountries.includes(country)}
                      onCheckedChange={() => toggleCountry(country)}
                    />
                    <label
                      htmlFor={`country-${country}`}
                      className="text-sm"
                    >
                      {country}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Keywords personnalises
              </Label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y"
                placeholder="Un keyword par ligne..."
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Max resultats par keyword
              </Label>
              <Input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                min="10"
                max="500"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleStartScraping}
              disabled={isRunning || selectedCategories.length === 0}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping en cours...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Lancer le scraping
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique des scrapings</CardTitle>
            <CardDescription>
              Jobs de scraping precedents et en cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Aucun scraping effectue</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {Array.isArray(job.keywords)
                          ? `${job.keywords.length} keywords`
                          : "Scraping"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString("fr-FR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {job.resultsCount} resultats
                      </span>
                      <Badge
                        variant={
                          job.status === "COMPLETED"
                            ? "default"
                            : job.status === "RUNNING"
                              ? "secondary"
                              : job.status === "FAILED"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
