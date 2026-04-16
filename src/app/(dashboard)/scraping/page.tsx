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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Play, Loader2, Activity, StopCircle } from "lucide-react";
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

interface ScrapingProgress {
  phase: string;
  percent: number;
  detail?: string;
  runs?: { runId: string; label: string }[];
  updatedAt?: string;
}

interface ScrapingJob {
  id: string;
  status: string;
  resultsCount: number;
  createdAt: string;
  keywords: string[];
  progress?: ScrapingProgress | null;
  errorMessage?: string | null;
}

interface LiveRunRow {
  runId: string;
  label: string;
  apifyStatus: string;
}

function labelApifyStatus(status: string): string {
  const map: Record<string, string> = {
    RUNNING: "En cours",
    READY: "En file",
    SUCCEEDED: "Termine",
    FAILED: "Echec",
    ABORTED: "Annule",
    "TIMED-OUT": "Timeout",
    NO_TOKEN: "Cle Apify absente",
    ERROR: "Erreur API",
    "?": "—",
    "…": "—",
  };
  return map[status] ?? status;
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
  const [progressJobId, setProgressJobId] = useState<string | null>(null);
  const [liveDetail, setLiveDetail] = useState<{
    job: ScrapingJob;
    liveRuns: LiveRunRow[];
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const hasRunningJob = jobs.some((j) => j.status === "RUNNING");

  useEffect(() => {
    if (!hasRunningJob) return;
    const t = setInterval(() => {
      fetchJobs();
    }, 4000);
    return () => clearInterval(t);
  }, [hasRunningJob]);

  useEffect(() => {
    if (!progressJobId) {
      setLiveDetail(null);
      return;
    }
    async function tick() {
      try {
        const res = await fetch(`/api/scraping/${progressJobId}`);
        if (res.ok) {
          setLiveDetail(await res.json());
        }
      } catch {
        // ignore
      }
    }
    tick();
    const iv = setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [progressJobId]);

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

  const cancelScrapingJob = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      const res = await fetch(`/api/scraping/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" ? data.error : "Annulation impossible"
        );
        return;
      }
      toast.success("Scraping annulé");
      await fetchJobs();
      if (progressJobId === jobId) {
        setLiveDetail((prev) =>
          prev && prev.job.id === jobId
            ? { ...prev, job: { ...prev.job, ...data, status: "CANCELLED" } }
            : prev
        );
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setCancellingId(null);
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
                {jobs.map((job) => {
                  const showProgress =
                    job.status === "RUNNING" ||
                    job.progress != null ||
                    job.status === "FAILED" ||
                    job.status === "CANCELLED";
                  return (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => showProgress && setProgressJobId(job.id)}
                      onKeyDown={(e) => {
                        if (
                          showProgress &&
                          (e.key === "Enter" || e.key === " ")
                        ) {
                          e.preventDefault();
                          setProgressJobId(job.id);
                        }
                      }}
                      className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        showProgress
                          ? "cursor-pointer hover:bg-muted/50"
                          : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {Array.isArray(job.keywords)
                            ? `${job.keywords.length} keywords`
                            : "Scraping"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString("fr-FR")}
                        </p>
                        {job.status === "RUNNING" &&
                          typeof job.progress?.percent === "number" && (
                            <div className="mt-2 max-w-md">
                              <Progress
                                value={Math.min(100, job.progress.percent)}
                                className="h-1.5"
                              />
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {job.progress.phase}
                                {job.progress.detail
                                  ? ` — ${job.progress.detail}`
                                  : ""}
                              </p>
                            </div>
                          )}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                        <span className="text-sm font-medium">
                          {job.resultsCount} resultats
                        </span>
                        {showProgress && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProgressJobId(job.id);
                            }}
                          >
                            <Activity className="h-3.5 w-3.5" />
                            Progression
                          </Button>
                        )}
                        {job.status === "RUNNING" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                            disabled={cancellingId === job.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelScrapingJob(job.id);
                            }}
                          >
                            {cancellingId === job.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <StopCircle className="h-3.5 w-3.5" />
                            )}
                            Annuler
                          </Button>
                        )}
                        <Badge
                          variant={
                            job.status === "COMPLETED"
                              ? "default"
                              : job.status === "RUNNING"
                                ? "secondary"
                                : job.status === "FAILED"
                                  ? "destructive"
                                  : job.status === "CANCELLED"
                                    ? "outline"
                                    : "outline"
                          }
                          className={
                            showProgress ? "cursor-pointer" : undefined
                          }
                          onClick={(e) => {
                            if (showProgress) {
                              e.stopPropagation();
                              setProgressJobId(job.id);
                            }
                          }}
                        >
                          {job.status === "CANCELLED"
                            ? "ANNULE"
                            : job.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={progressJobId !== null}
        onOpenChange={(open) => {
          if (!open) setProgressJobId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Progression du scraping
            </DialogTitle>
            <DialogDescription>
              Mise a jour automatique toutes les 3 secondes tant qu un job est
              actif.
            </DialogDescription>
          </DialogHeader>
          {liveDetail?.job ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Job</p>
                <p className="font-mono text-xs break-all">{liveDetail.job.id}</p>
              </div>
              {typeof liveDetail.job.progress?.percent === "number" && (
                <div className="space-y-2">
                  <Progress
                    value={Math.min(100, liveDetail.job.progress.percent)}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {liveDetail.job.progress.phase}
                    </p>
                    {liveDetail.job.progress.detail && (
                      <p className="text-sm text-muted-foreground">
                        {liveDetail.job.progress.detail}
                      </p>
                    )}
                    {liveDetail.job.progress.updatedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier update :{" "}
                        {new Date(
                          liveDetail.job.progress.updatedAt
                        ).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {liveDetail.job.status === "CANCELLED" && (
                <p className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                  {liveDetail.job.progress?.detail ??
                    "Ce scraping a ete arrete sur demande."}
                </p>
              )}
              {liveDetail.job.status === "FAILED" &&
                liveDetail.job.errorMessage && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {liveDetail.job.errorMessage}
                  </p>
                )}
              {liveDetail.job.status === "RUNNING" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  disabled={cancellingId === liveDetail.job.id}
                  onClick={() => cancelScrapingJob(liveDetail.job.id)}
                >
                  {cancellingId === liveDetail.job.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4" />
                  )}
                  Annuler le scraping
                </Button>
              )}
              {liveDetail.liveRuns.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Executions Apify par zone
                  </p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zone</TableHead>
                          <TableHead className="text-right">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveDetail.liveRuns.map((r) => (
                          <TableRow key={r.runId}>
                            <TableCell className="text-sm">{r.label}</TableCell>
                            <TableCell className="text-right text-sm">
                              {labelApifyStatus(r.apifyStatus)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    RUNNING / READY = encore en cours cote Apify. Termine quand
                    tout est en « Termine » (SUCCEEDED).
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Resultats en base : {liveDetail.job.resultsCount} prospect(s)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
