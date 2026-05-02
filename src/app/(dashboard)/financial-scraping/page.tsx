"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/layout/page-title";
import { Search, Play, Loader2, Activity, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ListPagination } from "@/components/shared/list-pagination";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const FINANCIAL_CATEGORIES = [
  { id: "bank_trade_finance", label: "Banques & trade finance" },
  { id: "dfi_multilateral", label: "DFI / Multilatéraux" },
  { id: "impact_fund_esg", label: "Impact funds / ESG" },
  { id: "commodity_fund_hedge", label: "Commodity funds / hedge funds" },
  { id: "corporate_strategic", label: "Investisseurs corporate stratégiques" },
  { id: "vc_pe_agritech", label: "VC / PE agritech" },
  { id: "family_office_angel", label: "Family offices / angels" },
  { id: "agency_program", label: "Agences & programmes internationaux" },
] as const;

const COUNTRIES = [
  "Cameroon",
  "France",
  "UK",
  "Spain",
  "USA",
  "Saudi Arabia",
  "Russia",
  "Switzerland",
  "Netherlands",
  "Germany",
  "Nigeria",
  "Japan",
  "China",
  "Belgium",
  "Italy",
  "Luxembourg",
  "Singapore",
  "Mauritius",
  "Morocco",
];

type Job = {
  id: string;
  status: string;
  resultsCount: number;
  createdAt: string;
  keywords: string[];
  progress?: {
    phase: string;
    percent: number;
    detail?: string;
    meta?: {
      mapsChunkErrors?: number;
      fallbackGlobalRuns?: number;
    };
    updatedAt?: string;
  } | null;
  errorMessage?: string | null;
};

type LiveRun = {
  runId: string;
  label: string;
  apifyStatus: string;
};

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
    COMPLETED: "Terminé",
    SUCCEEDED: "Terminé",
    FAILED: "Échec",
    ABORTED: "Annulé",
    "TIMED-OUT": "Timeout",
    NO_TOKEN: "Clé Apify absente",
    ERROR: "Erreur API",
    "?": "—",
    "…": "—",
  };
  return map[status] ?? status;
}

export default function FinancialScrapingPage() {
  const [categories, setCategories] = useState<string[]>([
    "bank_trade_finance",
    "impact_fund_esg",
  ]);
  const [countries, setCountries] = useState<string[]>([]);
  const [customKeywords, setCustomKeywords] = useState("");
  const [maxResults, setMaxResults] = useState("100");
  const [maxKeywords, setMaxKeywords] = useState("200");
  const [includeSeeds, setIncludeSeeds] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [runningCount, setRunningCount] = useState(0);
  const [progressJobId, setProgressJobId] = useState<string | null>(null);
  const [liveDetail, setLiveDetail] = useState<{
    job: Job;
    liveRuns: LiveRun[];
  } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async (targetPage = page) => {
    const res = await fetch(`/api/financial-scraping?page=${targetPage}&pageSize=10`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs(Array.isArray(data.items) ? data.items : []);
    setTotalItems(typeof data.total === "number" ? data.total : 0);
    setTotalPages(typeof data.totalPages === "number" ? data.totalPages : 1);
    setRunningCount(typeof data.runningCount === "number" ? data.runningCount : 0);
  }, [page]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (runningCount <= 0) return;
    const timer = setInterval(() => void fetchJobs(page), 4000);
    return () => clearInterval(timer);
  }, [runningCount, page, fetchJobs]);

  useEffect(() => {
    if (!progressJobId) {
      setLiveDetail(null);
      return;
    }
    async function tick() {
      try {
        const res = await fetch(`/api/financial-scraping/${progressJobId}`);
        if (res.ok) {
          const data = await res.json();
          setLiveDetail(data);
        }
      } catch {
        // ignore
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 3000);
    return () => clearInterval(timer);
  }, [progressJobId]);

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleCountry = (country: string) => {
    setCountries((prev) =>
      prev.includes(country)
        ? prev.filter((c) => c !== country)
        : [...prev, country]
    );
  };

  const start = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/financial-scraping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories,
          countries,
          customKeywords: customKeywords
            .split("\n")
            .map((k) => k.trim())
            .filter(Boolean),
          maxResults: Number(maxResults),
          maxKeywords: Number(maxKeywords),
          includeSeeds,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Erreur de lancement");
      const usedKeywords = Number(payload?.execution?.usedKeywords);
      const requestedKeywords = Number(payload?.execution?.requestedKeywords);
      const maxResultsPerKeyword = Number(payload?.execution?.maxResultsPerKeyword);
      if (
        Number.isFinite(usedKeywords) &&
        Number.isFinite(requestedKeywords) &&
        Number.isFinite(maxResultsPerKeyword)
      ) {
        toast.success(
          `Scraping lancé (${usedKeywords}/${requestedKeywords} mots-clés utilisés, max ${maxResultsPerKeyword}/mot-clé)`
        );
      } else {
        toast.success("Scraping financier lancé");
      }
      setPage(1);
      await fetchJobs(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setIsRunning(false);
    }
  };

  const cancelScrapingJob = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      const res = await fetch(`/api/financial-scraping/${jobId}`, {
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
      toast.success("Scraping financier annulé");
      await fetchJobs(page);
      if (progressJobId === jobId) {
        setLiveDetail((prev) =>
          prev && prev.job.id === jobId
            ? { ...prev, job: { ...prev.job, ...data, status: "CANCELLED" } }
            : prev
        );
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle
        title="Scraping financiers"
        description="Crawl dédié aux banques, fonds, DFI, VC et acteurs financiers liés cacao/café"
        icon={Search}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Sélectionnez les catégories financières, les pays et la seed list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Catégories financières</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FINANCIAL_CATEGORIES.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={categories.includes(cat.id)}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pays cibles (optionnel)</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COUNTRIES.map((country) => (
                  <label key={country} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={countries.includes(country)}
                      onCheckedChange={() => toggleCountry(country)}
                    />
                    {country}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mots-clés personnalisés</Label>
              <Textarea
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
                placeholder="Un mot-clé par ligne"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Max. résultats / mot-clé</Label>
                <Input
                  type="number"
                  min="10"
                  max="500"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Max. mots-clés utilisés</Label>
                <Input
                  type="number"
                  min="10"
                  max="500"
                  value={maxKeywords}
                  onChange={(e) => setMaxKeywords(e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={includeSeeds}
                onCheckedChange={(v) => setIncludeSeeds(v === true)}
              />
              Inclure la seed list curatée
            </label>

            <Button
              className="w-full"
              onClick={start}
              disabled={isRunning || categories.length === 0}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Lancer le scraping financier
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique financier</CardTitle>
            <CardDescription>Suivi des jobs de scraping financiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun job financier.</p>
            ) : (
              jobs.map((job) => {
                const showProgress =
                  job.status === "RUNNING" ||
                  job.progress != null ||
                  job.status === "FAILED" ||
                  job.status === "CANCELLED";
                const keywordCount = Array.isArray(job.keywords) ? job.keywords.length : 0;
                return (
                  <div
                    key={job.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => showProgress && setProgressJobId(job.id)}
                    onKeyDown={(e) => {
                      if (showProgress && (e.key === "Enter" || e.key === " ")) {
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
                        {keywordCount} mot(s)-clé(s)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(job.createdAt).toLocaleString("fr-FR")}
                      </p>
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
                              {job.progress.detail ? ` — ${job.progress.detail}` : ""}
                            </p>
                          </div>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
                      <span className="text-sm tabular-nums">{job.resultsCount} résultat(s)</span>
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
                          className="h-7 gap-1 border-destructive/40 text-xs text-destructive hover:bg-destructive/10"
                          disabled={cancellingId === job.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void cancelScrapingJob(job.id);
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
                                : "outline"
                        }
                        className={showProgress ? "cursor-pointer" : undefined}
                        onClick={(e) => {
                          if (!showProgress) return;
                          e.stopPropagation();
                          setProgressJobId(job.id);
                        }}
                      >
                        {formatJobStatus(job.status)}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
            {totalItems > 0 ? (
              <ListPagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                itemLabel="jobs financiers"
                onPageChange={setPage}
              />
            ) : null}
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
              Mise à jour automatique toutes les 3 secondes tant qu un job est actif.
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
                  <Progress value={Math.min(100, liveDetail.job.progress.percent)} />
                  <div>
                    <p className="text-sm font-medium">{liveDetail.job.progress.phase}</p>
                    {typeof liveDetail.job.progress.meta?.fallbackGlobalRuns === "number" &&
                      liveDetail.job.progress.meta.fallbackGlobalRuns > 0 && (
                        <p className="text-xs text-amber-600">
                          Fallback global anti-429 active :{" "}
                          {liveDetail.job.progress.meta.fallbackGlobalRuns} lot(s)
                        </p>
                      )}
                    {typeof liveDetail.job.progress.meta?.mapsChunkErrors === "number" &&
                      liveDetail.job.progress.meta.mapsChunkErrors > 0 && (
                        <p className="text-xs text-destructive">
                          Lots Maps en erreur (429/proxy) :{" "}
                          {liveDetail.job.progress.meta.mapsChunkErrors}
                        </p>
                      )}
                    {liveDetail.job.progress.detail && (
                      <p className="text-sm text-muted-foreground">
                        {liveDetail.job.progress.detail}
                      </p>
                    )}
                    {liveDetail.job.progress.updatedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dernier update :{" "}
                        {new Date(liveDetail.job.progress.updatedAt).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {liveDetail.job.status === "CANCELLED" && (
                <p className="rounded-md border border-muted bg-muted/40 p-3 text-sm text-muted-foreground">
                  {liveDetail.job.progress?.detail ??
                    "Ce scraping financier a été arrêté sur demande."}
                </p>
              )}
              {liveDetail.job.status === "FAILED" && liveDetail.job.errorMessage && (
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
                  onClick={() => void cancelScrapingJob(liveDetail.job.id)}
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
                  <p className="mb-2 text-sm font-medium">Executions Apify par zone</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zone</TableHead>
                          <TableHead className="text-right">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveDetail.liveRuns.map((run) => (
                          <TableRow key={run.runId}>
                            <TableCell className="text-sm">{run.label}</TableCell>
                            <TableCell className="text-right text-sm">
                              {labelApifyStatus(run.apifyStatus)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    RUNNING / READY = encore en cours cote Apify. Termine quand tout est en
                    « Termine » (SUCCEEDED).
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
