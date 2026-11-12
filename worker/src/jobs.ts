import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";
import { crawlSite, type Budget, type CrawlOptions, type SiteResult } from "./crawl";

export type JobStatus = "queued" | "running" | "done" | "cancelled" | "failed";

export interface JobOptions extends CrawlOptions {
  /** Pages payantes débloquées via Bright Data, au plus */
  maxUnlocker: number;
  /** Recherches web payantes, au plus */
  maxSerp: number;
}

export interface JobStats {
  withEmail: number;
  blocked: number;
  rendered: number;
  unlockerUsed: number;
  serpUsed: number;
}

export interface Job {
  id: string;
  status: JobStatus;
  createdAt: string;
  finishedAt: string | null;
  total: number;
  done: number;
  options: JobOptions;
  stats: JobStats;
  error: string | null;
  results: SiteResult[];
}

interface LiveJob extends Job {
  urls: string[];
  cancelRequested: boolean;
}

const jobs = new Map<string, LiveJob>();
const queue: string[] = [];
let running = 0;

const fileOf = (id: string) => join(config.dataDir, `${id}.json`);

function persist(job: LiveJob): void {
  try {
    const { urls: _urls, cancelRequested: _cancel, ...stored } = job;
    void _urls;
    void _cancel;
    writeFileSync(fileOf(job.id), JSON.stringify(stored));
  } catch (err) {
    console.warn("[jobs] sauvegarde impossible :", err instanceof Error ? err.message : err);
  }
}

/** Recharge les jobs terminés (et marque en échec ceux qu'un redémarrage a interrompus). */
export function loadJobs(): void {
  mkdirSync(config.dataDir, { recursive: true });
  for (const name of readdirSync(config.dataDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const stored = JSON.parse(readFileSync(join(config.dataDir, name), "utf8")) as Job;
      const interrupted = stored.status === "queued" || stored.status === "running";
      jobs.set(stored.id, {
        ...stored,
        status: interrupted ? "failed" : stored.status,
        error: interrupted ? "Service redémarré pendant la lecture" : stored.error,
        urls: [],
        cancelRequested: false,
      });
    } catch {
      // fichier illisible : ignoré
    }
  }
}

/** Efface les jobs de plus de 24 heures (mémoire et disque). */
export function purgeOldJobs(): void {
  const limit = Date.now() - config.jobTtlMs;
  for (const [id, job] of jobs) {
    if (Date.parse(job.createdAt) < limit && job.status !== "running" && job.status !== "queued") {
      jobs.delete(id);
      rmSync(fileOf(id), { force: true });
    }
  }
}

async function run(job: LiveJob): Promise<void> {
  job.status = "running";
  const budget: Budget = { unlocker: job.options.maxUnlocker, serp: job.options.maxSerp };
  const pending = [...job.urls];

  const worker = async () => {
    for (let url = pending.shift(); url !== undefined; url = pending.shift()) {
      if (job.cancelRequested) return;
      const result = await crawlSite(url, job.options, budget, () => job.cancelRequested);
      job.results.push(result);
      job.done++;
      if (result.emails.length) job.stats.withEmail++;
      if (result.blocked) job.stats.blocked++;
      if (result.via.includes("browser")) job.stats.rendered++;
      job.stats.unlockerUsed = job.options.maxUnlocker - budget.unlocker;
      job.stats.serpUsed = job.options.maxSerp - budget.serp;
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(config.siteConcurrency, job.urls.length) }, worker));
    job.status = job.cancelRequested ? "cancelled" : "done";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : "Erreur inattendue";
  }
  job.finishedAt = new Date().toISOString();
  persist(job);
}

function pump(): void {
  while (running < config.maxRunningJobs && queue.length > 0) {
    const job = jobs.get(queue.shift()!);
    if (!job || job.status !== "queued") continue;
    running++;
    void run(job).finally(() => {
      running--;
      pump();
    });
  }
}

export function createJob(urls: string[], options: JobOptions): Job {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, config.maxUrlsPerJob);
  const job: LiveJob = {
    id: randomUUID(),
    status: "queued",
    createdAt: new Date().toISOString(),
    finishedAt: null,
    total: unique.length,
    done: 0,
    options,
    stats: { withEmail: 0, blocked: 0, rendered: 0, unlockerUsed: 0, serpUsed: 0 },
    error: null,
    results: [],
    urls: unique,
    cancelRequested: false,
  };
  jobs.set(job.id, job);
  queue.push(job.id);
  pump();
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) ?? null;
}

export function cancelJob(id: string): boolean {
  const job = jobs.get(id);
  if (!job) return false;
  if (job.status === "queued") {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    persist(job);
  } else if (job.status === "running") {
    job.cancelRequested = true;
  }
  return true;
}

export function queueState(): { running: number; queued: number } {
  return { running, queued: queue.length };
}
