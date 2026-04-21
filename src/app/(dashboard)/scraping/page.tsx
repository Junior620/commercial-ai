"use client";

import { useState, useEffect, useCallback } from "react";
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
import { AIBadge } from "@/components/ui/ai-badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SCRAPING_PRODUCT_OPTIONS } from "@/lib/product-catalog";
import { ListPagination } from "@/components/shared/list-pagination";

const KEYWORD_CATEGORIES = [
  { id: "buyer", label: "Acheteurs (buyers)" },
  { id: "trader", label: "Traders cacao/café" },
  { id: "general", label: "Sociétés générales cacao/café" },
  { id: "product", label: "Produits spécifiques" },
  { id: "agri_tech", label: "Agri-Tech & télédétection" },
  { id: "finance_risk", label: "Finance, assurance & risque" },
  { id: "machinery_packaging", label: "Machines & emballage" },
  { id: "compliance_traceability", label: "Conformité & traçabilité" },
  { id: "circular_bioeconomy", label: "Bioéconomie circulaire" },
  { id: "linkedin_role", label: "Rôles LinkedIn" },
  { id: "linkedin_combo", label: "LinkedIn combo" },
];

const COUNTRIES = [
  "Bulgaria",
  "Belgium",
  "China",
  "Finland",
  "Egypt",
  "France",
  "Germany",
  "Greece",
  "Italy",
  "Indonesia",
  "Japan",
  "Lithuania",
  "Malaysia",
  "Mexico",
  "Morocco",
  "Netherlands",
  "Nigeria",
  "Poland",
  "Portugal",
  "Russia",
  "Saudi Arabia",
  "South Korea",
  "Spain",
  "Switzerland",
  "Tunisia",
  "Turkey",
  "UAE",
  "UK",
  "USA",
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

function formatJobStatus(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "Terminé",
    RUNNING: "En cours",
    FAILED: "Échec",
    CANCELLED: "Annulé",
    PENDING: "En attente",
  };
  return map[status] ?? status;
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
  const HISTORY_PAGE_SIZE = 10;
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
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [runningJobsCount, setRunningJobsCount] = useState(0);
  const [progressJobId, setProgressJobId] = useState<string | null>(null);
  const [liveDetail, setLiveDetail] = useState<{
    job: ScrapingJob;
    liveRuns: LiveRunRow[];
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(
    async (targetPage = historyPage) => {
      try {
        const res = await fetch(
          `/api/scraping?page=${targetPage}&pageSize=${HISTORY_PAGE_SIZE}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // compat temporaire si ancienne forme de payload
          setJobs(data);
          setHistoryTotal(data.length);
          setHistoryTotalPages(1);
          setRunningJobsCount(data.some((j) => j.status === "RUNNING") ? 1 : 0);
          return;
        }
        setJobs(Array.isArray(data.items) ? data.items : []);
        setHistoryTotal(typeof data.total === "number" ? data.total : 0);
        setHistoryTotalPages(
          typeof data.totalPages === "number" && data.totalPages > 0
            ? data.totalPages
            : 1
        );
        setRunningJobsCount(
          typeof data.runningCount === "number" ? data.runningCount : 0
        );
      } catch {
        // ignore
      }
    },
    [historyPage]
  );

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const hasRunningJob = runningJobsCount > 0;

  useEffect(() => {
    if (!hasRunningJob) return;
    const t = setInterval(() => {
      fetchJobs(historyPage);
    }, 4000);
    return () => clearInterval(t);
  }, [hasRunningJob, historyPage, fetchJobs]);

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
      await fetchJobs(historyPage);
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
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Erreur de lancement"
        );
      }
      const job = payload;
      toast.success(`Scraping lance ! Job ID: ${job.id}`);
      setHistoryPage(1);
      await fetchJobs(1);
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
      <div className="flex items-start justify-between gap-3">
        <PageTitle
          title="Scraping"
          description="Recherche automatique de prospects via Google Maps et enrichissement email"
          icon={Search}
        />
        <AIBadge
          label="Enrichissement IA"
          size="sm"
          variant="soft"
          className="mt-1"
          title="Emails, sites et donnees enrichis par IA"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="lg:sticky lg:top-4 lg:z-10 shadow-sm">
          <CardHeader>
            <CardTitle>Configuration du scraping</CardTitle>
            <CardDescription>
              Choisissez les catégories de mots-clés, le produit et
              éventuellement les pays. Les mots-clés viennent de votre jeu
              prédéfini + lignes personnalisées ci-dessous.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">
                Catégories de mots-clés
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {KEYWORD_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2">
                    <Checkbox
                      id={cat.id}
                      checked={selectedCategories.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <label
                      htmlFor={cat.id}
                      className="cursor-pointer text-sm leading-snug"
                    >
                      {cat.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Produit cible</Label>
              <Select
                value={selectedProduct}
                onValueChange={(v) => setSelectedProduct(v ?? "all")}
              >
                <SelectTrigger className="h-10 w-full min-w-0 max-w-full">
                  <SelectValue placeholder="Choisir un produit" />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="min-w-[min(100%,18rem)]"
                >
                  {SCRAPING_PRODUCT_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Label className="text-sm font-semibold">
                  Pays cibles (optionnel)
                </Label>
                {selectedCountries.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedCountries.length} pays sélectionné
                    {selectedCountries.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Laisser vide pour ne pas restreindre par pays.
              </p>
              <div className="rounded-lg border border-border/80 bg-muted/25 p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                  {COUNTRIES.map((country) => (
                    <div
                      key={country}
                      className="flex min-w-0 items-center gap-2"
                    >
                      <Checkbox
                        id={`country-${country}`}
                        checked={selectedCountries.includes(country)}
                        onCheckedChange={() => toggleCountry(country)}
                      />
                      <label
                        htmlFor={`country-${country}`}
                        className="cursor-pointer truncate text-sm leading-snug"
                        title={country}
                      >
                        {country}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Mots-clés personnalisés
              </Label>
              <Textarea
                className="min-h-[100px] resize-y text-sm"
                placeholder="Un mot-clé par ligne…"
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Max. résultats par mot-clé
              </Label>
              <Input
                type="number"
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
                min="10"
                max="500"
                className="max-w-[12rem]"
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

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Historique des scrapings</CardTitle>
            <CardDescription>
              Derniers lancements : cliquez une ligne pour voir la progression ou
              le message d&apos;erreur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Search className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p>Aucun scraping effectué</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => {
                  const showProgress =
                    job.status === "RUNNING" ||
                    job.progress != null ||
                    job.status === "FAILED" ||
                    job.status === "CANCELLED";
                  const keywordCount = Array.isArray(job.keywords)
                    ? job.keywords.length
                    : 0;
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
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                        showProgress && "cursor-pointer hover:bg-muted/50",
                        job.status === "FAILED" &&
                          "border-destructive/30 bg-destructive/[0.03]"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {keywordCount > 0
                            ? `${keywordCount} mot${keywordCount > 1 ? "s" : ""}-clé${keywordCount > 1 ? "s" : ""}`
                            : "Aucun mot-clé"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(job.createdAt).toLocaleString("fr-FR")}
                        </p>
                        {job.status === "FAILED" &&
                          keywordCount === 0 &&
                          !job.errorMessage && (
                            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                              Lancement sans mots-clés — vérifiez la config ou
                              les catégories.
                            </p>
                          )}
                        {job.status === "FAILED" && job.errorMessage && (
                          <p
                            className="mt-1 line-clamp-2 text-xs text-destructive"
                            title={job.errorMessage}
                          >
                            {job.errorMessage}
                          </p>
                        )}
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
                        <span className="text-sm font-medium tabular-nums">
                          {job.resultsCount} résultat
                          {job.resultsCount !== 1 ? "s" : ""}
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
                          {formatJobStatus(job.status)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {historyTotal > 0 && (
              <div className="mt-4">
                <ListPagination
                  page={historyPage}
                  totalPages={historyTotalPages}
                  totalItems={historyTotal}
                  itemLabel="jobs scraping"
                  onPageChange={setHistoryPage}
                />
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
