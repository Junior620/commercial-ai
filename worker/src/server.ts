import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { browserStatus, closeBrowser } from "./browser";
import { serpConfigured, unlockerConfigured } from "./brightdata";
import { config, VERSION } from "./config";
import { cancelJob, createJob, getJob, loadJobs, purgeOldJobs, queueState, type Job, type JobOptions } from "./jobs";

/**
 * Service de lecture des sites d'entreprises (emails et coordonnées publiques).
 *
 *   POST   /v1/jobs       { urls: string[], options? }  → { id }
 *   GET    /v1/jobs/:id                                 → avancement, puis résultats
 *   DELETE /v1/jobs/:id                                 → annulation
 *   GET    /health                                      → état (détails avec le jeton)
 *
 * Tous les appels, sauf /health, exigent « Authorization: Bearer <WORKER_TOKEN> ».
 */

const MAX_BODY_BYTES = 512 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(payload);
}

function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization || "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
  const expected = Buffer.from(config.token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Corps trop volumineux"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("JSON invalide"));
      }
    });
    req.on("error", reject);
  });
}

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
};

function parseOptions(raw: unknown): JobOptions {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    maxPagesPerSite: clamp(o.maxPagesPerSite, 5, 1, 8),
    render: o.render !== false,
    maxUnlocker: clamp(o.maxUnlocker, 0, 0, 500),
    maxSerp: clamp(o.maxSerp, 0, 0, 200),
  };
}

function summary(job: Job, withResults: boolean) {
  const finished = job.status === "done" || job.status === "cancelled" || job.status === "failed";
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    done: job.done,
    stats: job.stats,
    error: job.error,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    ...(finished || withResults ? { results: job.results } : {}),
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "GET" && path === "/health") {
    if (!authorized(req)) return send(res, 200, { ok: true, version: VERSION });
    return send(res, 200, {
      ok: true,
      version: VERSION,
      ...queueState(),
      browser: await browserStatus(),
      brightdata: { unlocker: unlockerConfigured(), serp: serpConfigured() },
    });
  }

  if (!path.startsWith("/v1/")) return send(res, 404, { error: "Introuvable" });
  if (!authorized(req)) return send(res, 401, { error: "Jeton manquant ou invalide" });

  if (req.method === "POST" && path === "/v1/jobs") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err instanceof Error ? err.message : "Requête invalide" });
    }
    const urls = (body as { urls?: unknown })?.urls;
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > config.maxUrlsPerJob) {
      return send(res, 400, { error: `« urls » doit contenir entre 1 et ${config.maxUrlsPerJob} adresses` });
    }
    if (!urls.every((u) => typeof u === "string" && u.length > 3 && u.length <= 300)) {
      return send(res, 400, { error: "Chaque adresse doit être une chaîne de 300 caractères au plus" });
    }
    const job = createJob(urls as string[], parseOptions((body as { options?: unknown }).options));
    return send(res, 202, { id: job.id, status: job.status, total: job.total });
  }

  const match = path.match(/^\/v1\/jobs\/([0-9a-f-]{36})$/);
  if (match && req.method === "GET") {
    const job = getJob(match[1]);
    if (!job) return send(res, 404, { error: "Job introuvable ou expiré" });
    return send(res, 200, summary(job, url.searchParams.get("partial") === "1"));
  }
  if (match && req.method === "DELETE") {
    return cancelJob(match[1]) ? send(res, 200, { ok: true }) : send(res, 404, { error: "Job introuvable ou expiré" });
  }

  return send(res, 404, { error: "Introuvable" });
}

export function start(): void {
  if (config.token.length < 24) {
    console.error("WORKER_TOKEN manquant ou trop court (24 caractères minimum). Arrêt.");
    process.exit(1);
  }
  loadJobs();
  setInterval(purgeOldJobs, 60 * 60 * 1000).unref();

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error("[server]", err);
      if (!res.headersSent) send(res, 500, { error: "Erreur interne" });
    });
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.listen(config.port, config.host, () => {
    console.log(`[server] lecture des sites v${VERSION} sur ${config.host}:${config.port}`);
  });

  const stop = () => {
    server.close();
    void closeBrowser().finally(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

start();
