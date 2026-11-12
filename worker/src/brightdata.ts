import { config } from "./config";

/**
 * Bright Data, utilisé en secours :
 * - Web Unlocker : relit une page qu'un site a refusée au service (facturé au succès) ;
 * - SERP : recherche Google, pour retrouver l'adresse d'un site resté sans email.
 * Les deux passent par POST https://api.brightdata.com/request avec le nom de la zone.
 */

const ENDPOINT = "https://api.brightdata.com/request";

export const unlockerConfigured = () => !!(config.brightdata.token && config.brightdata.unlockerZone);
export const serpConfigured = () => !!(config.brightdata.token && config.brightdata.serpZone);

async function request(zone: string, url: string, timeoutMs: number): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Authorization: `Bearer ${config.brightdata.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone, url, format: "raw" }),
  });
}

/** Relit une page via Web Unlocker. Renvoie "" si le déblocage échoue. */
export async function unlock(url: string): Promise<string> {
  if (!unlockerConfigured()) return "";
  try {
    const response = await request(config.brightdata.unlockerZone, url, 60_000);
    // Le vrai résultat est dans x-brd-status-code ; le code HTTP externe vaut 200 dès que la requête est acceptée.
    const inner = Number(response.headers.get("x-brd-status-code") || response.status);
    if (!response.ok || inner < 200 || inner >= 300 || response.headers.get("x-brd-error")) {
      await response.body?.cancel().catch(() => undefined);
      return "";
    }
    return (await response.text()).slice(0, 1_500_000);
  } catch {
    return "";
  }
}

export interface SerpResult {
  title: string;
  link: string;
  description: string;
}

/** Lit les résultats naturels d'une réponse SERP (les noms de champs varient selon le format). */
export function parseSerpOrganic(payload: unknown): SerpResult[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as Record<string, unknown>;
  const list = (Array.isArray(data.organic) ? data.organic : Array.isArray(data.results) ? data.results : []) as Record<string, unknown>[];
  return list
    .map((item) => ({
      title: String(item.title ?? ""),
      link: String(item.link ?? item.url ?? ""),
      description: String(item.description ?? item.snippet ?? ""),
    }))
    .filter((r) => r.link || r.description);
}

/** Recherche Google. Renvoie [] si la recherche échoue. */
export async function serpSearch(query: string, opts: { hl?: string; num?: number } = {}): Promise<SerpResult[]> {
  if (!serpConfigured()) return [];
  const params = new URLSearchParams({ q: query, hl: opts.hl || "en", num: String(opts.num || 10), brd_json: "1" });
  try {
    const response = await request(config.brightdata.serpZone, `https://www.google.com/search?${params}`, 45_000);
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return [];
    }
    return parseSerpOrganic(JSON.parse(await response.text()));
  } catch {
    return [];
  }
}
