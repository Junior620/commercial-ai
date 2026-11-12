import { config } from "./config";
import { assertPublicUrl, GuardError } from "./guard";

export interface PageResult {
  /** Code HTTP final (0 si la requête n'a pas abouti) */
  status: number;
  html: string;
  finalUrl: string;
  /** Le site a refusé un robot (403, 429, page de vérification…) : candidat au déblocage */
  blocked: boolean;
  error?: string;
}

const MAX_PAGE_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;

const BLOCK_MARKERS = [
  /just a moment\.\.\./i,
  /attention required!?\s*\|\s*cloudflare/i,
  /cf-browser-verification|cf_chl_opt|challenge-platform/i,
  /please verify you are (?:a )?human/i,
  /verify(?:ing)? you are human/i,
  /unusual traffic from your computer/i,
  /access denied[\s\S]{0,200}(?:reference #|akamai|permission to access)/i,
  /request unsuccessful\. incapsula/i,
  /px-captcha|perimeterx|datadome/i,
  /enable javascript and cookies to continue/i,
];

/** Le site a-t-il servi une page de blocage au lieu de son contenu ? */
export function looksBlocked(status: number, html: string): boolean {
  if (status === 401 || status === 403 || status === 429 || status === 503) return true;
  if (status >= 200 && status < 300 && html.length < 60_000) {
    return BLOCK_MARKERS.some((re) => re.test(html));
  }
  return false;
}

// ─── Une requête à la fois par site, espacées ────────────────────

const hostQueue = new Map<string, Promise<void>>();

/** Attend son tour pour ce site (au moins `perHostDelayMs` entre deux requêtes). */
export function waitForHost(host: string): Promise<void> {
  const previous = hostQueue.get(host) ?? Promise.resolve();
  const turn = previous.then(() => undefined);
  const next = turn.then(() => new Promise<void>((resolve) => setTimeout(resolve, config.perHostDelayMs)));
  hostQueue.set(host, next);
  if (hostQueue.size > 2000) {
    for (const key of [...hostQueue.keys()].slice(0, 1000)) hostQueue.delete(key);
  }
  return turn;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    received += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

/** Lecture simple d'une page publique, redirections contrôlées une à une. */
export async function fetchPage(url: string, timeoutMs = 12_000): Promise<PageResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let current = url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const target = await assertPublicUrl(current);
      await waitForHost(target.host);
      const response = await fetch(target.href, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": config.userAgent,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,de;q=0.7,es;q=0.6",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) return { status: response.status, html: "", finalUrl: current, blocked: false, error: "Redirection sans destination" };
        current = new URL(location, current).href;
        continue;
      }
      const type = response.headers.get("content-type") || "";
      const readable = !type || /text\/html|text\/plain|application\/xhtml/i.test(type);
      const html = readable ? await readLimited(response, MAX_PAGE_BYTES) : "";
      if (!readable) await response.body?.cancel().catch(() => undefined);
      const blocked = looksBlocked(response.status, html);
      return {
        status: response.status,
        html: response.ok && !blocked ? html : "",
        finalUrl: current,
        blocked,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    }
    return { status: 0, html: "", finalUrl: current, blocked: false, error: "Trop de redirections" };
  } catch (err) {
    if (err instanceof GuardError) return { status: 0, html: "", finalUrl: current, blocked: false, error: err.message };
    const aborted = err instanceof Error && err.name === "AbortError";
    // Un délai dépassé est souvent un refus silencieux : candidat au déblocage.
    return { status: 0, html: "", finalUrl: current, blocked: aborted, error: aborted ? "Délai dépassé" : "Site injoignable" };
  } finally {
    clearTimeout(timer);
  }
}
