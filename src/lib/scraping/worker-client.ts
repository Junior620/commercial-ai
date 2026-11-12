/**
 * Client du service de lecture des sites (installé sur le VPS, voir worker/).
 * Sans SCRAPER_WORKER_URL et SCRAPER_WORKER_TOKEN, l'application n'y fait jamais appel
 * et garde ses passes Apify.
 */

const baseUrl = () => (process.env.SCRAPER_WORKER_URL?.trim() || "").replace(/\/+$/, "");
const token = () => process.env.SCRAPER_WORKER_TOKEN?.trim() || "";

export const workerConfigured = () => /^https?:\/\//.test(baseUrl()) && token().length > 0;

export interface WorkerSiteResult {
  url: string;
  domain: string | null;
  emails: string[];
  contactName: string | null;
  phone: string | null;
  description: string | null;
  pagesRead: number;
  via: string[];
  blocked: boolean;
  error: string | null;
}

export interface WorkerJob {
  id: string;
  status: "queued" | "running" | "done" | "cancelled" | "failed";
  total: number;
  done: number;
  stats: { withEmail: number; blocked: number; rendered: number; unlockerUsed: number; serpUsed: number };
  error: string | null;
  results?: WorkerSiteResult[];
}

export interface WorkerJobOptions {
  maxPagesPerSite?: number;
  render?: boolean;
  /** Pages débloquées via Bright Data, au plus */
  maxUnlocker?: number;
  /** Recherches web payantes, au plus */
  maxSerp?: number;
}

async function call(path: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  return fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

export interface WorkerHealth {
  ok: boolean;
  detail: string;
  browser?: boolean;
  unlocker?: boolean;
  serp?: boolean;
}

/** Le service répond-il, et le jeton est-il accepté ? */
export async function workerHealth(): Promise<WorkerHealth> {
  if (!workerConfigured()) return { ok: false, detail: "Non configuré" };
  try {
    const response = await call("/health", {}, 6000);
    if (!response.ok) return { ok: false, detail: `Réponse ${response.status}` };
    const data = (await response.json()) as {
      ok?: boolean;
      version?: string;
      browser?: { available?: boolean };
      brightdata?: { unlocker?: boolean; serp?: boolean };
    };
    // Sans jeton valide, /health ne renvoie que { ok, version } : les détails prouvent que le jeton est accepté.
    if (!data.ok || !data.brightdata) return { ok: false, detail: "Jeton refusé par le service" };
    return {
      ok: true,
      detail: `Version ${data.version ?? "?"}`,
      browser: !!data.browser?.available,
      unlocker: !!data.brightdata.unlocker,
      serp: !!data.brightdata.serp,
    };
  } catch {
    return { ok: false, detail: "Injoignable" };
  }
}

export async function startWorkerJob(urls: string[], options: WorkerJobOptions): Promise<string> {
  const response = await call("/v1/jobs", { method: "POST", body: JSON.stringify({ urls, options }) });
  if (!response.ok) throw new Error(`Service de lecture : ${response.status} ${(await response.text().catch(() => "")).slice(0, 200)}`);
  const data = (await response.json()) as { id?: string };
  if (!data.id) throw new Error("Service de lecture : identifiant de job absent");
  return data.id;
}

/** État d'un job. `partial` renvoie les résultats déjà obtenus même s'il n'est pas terminé. */
export async function getWorkerJob(id: string, partial = false): Promise<WorkerJob> {
  const response = await call(`/v1/jobs/${encodeURIComponent(id)}${partial ? "?partial=1" : ""}`, {}, 30_000);
  if (!response.ok) throw new Error(`Service de lecture : ${response.status}`);
  return (await response.json()) as WorkerJob;
}

export async function cancelWorkerJob(id: string): Promise<void> {
  try {
    const response = await call(`/v1/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
    await response.body?.cancel().catch(() => undefined);
  } catch {
    // service injoignable : le job expirera de lui-même
  }
}
