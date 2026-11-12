import type { ScrapedPlace } from "@/lib/apify";
import { normalizeCountryToIso2 } from "@/lib/prospect-language";

/**
 * Bright Data, source de secours pour Google Maps (API « Web Scraper », asynchrone) :
 *   POST /datasets/v3/trigger            → { snapshot_id }
 *   GET  /datasets/v3/progress/{id}      → { status: starting | running | ready | failed | canceled }
 *   GET  /datasets/v3/snapshot/{id}      → fiches (202 tant que ce n'est pas prêt)
 * Même schéma « lancer puis interroger » qu'Apify : aucune étape n'attend la fin d'une collecte.
 */

const API = "https://api.brightdata.com";
/** Jeu « Google Maps full information » */
const MAPS_DATASET = process.env.BRIGHTDATA_MAPS_DATASET_ID?.trim() || "gd_m8ebnr0q2qlklc02fz";

const token = () => process.env.BRIGHTDATA_API_TOKEN?.trim() || "";

export const brightDataConfigured = () => token().length > 0;

export class BrightDataError extends Error {}

/** Appel authentifié, avec nouvel essai sur les réponses 429 (attente croissante, « Retry-After » respecté). */
async function call(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  if (!brightDataConfigured()) throw new BrightDataError("BRIGHTDATA_API_TOKEN non configuré");
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (response.status !== 429 || attempt >= 2) return response;
    const retryAfter = Number(response.headers.get("retry-after"));
    await response.body?.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, Math.min(15_000, (retryAfter > 0 ? retryAfter : 2 ** (attempt + 1)) * 1000)));
  }
}

async function failure(response: Response, context: string): Promise<BrightDataError> {
  const text = (await response.text().catch(() => "")).slice(0, 300);
  const hint =
    response.status === 401 ? "clé refusée, vérifiez BRIGHTDATA_API_TOKEN" : response.status === 429 ? "trop de collectes en cours" : text || "réponse inattendue";
  return new BrightDataError(`Bright Data (${context}) : ${response.status} ${hint}`);
}

/** Lance une recherche Google Maps (un mot-clé × un pays par entrée) et renvoie l'identifiant de la collecte. */
export async function startMapsDiscovery(inputs: { keyword: string; country: string }[], limitPerInput: number): Promise<string> {
  const params = new URLSearchParams({
    dataset_id: MAPS_DATASET,
    type: "discover_new",
    discover_by: "location",
    include_errors: "true",
    limit_per_input: String(Math.max(1, Math.floor(limitPerInput))),
  });
  const response = await call(`/datasets/v3/trigger?${params}`, { method: "POST", body: JSON.stringify(inputs) });
  if (!response.ok) throw await failure(response, "lancement");
  const data = (await response.json().catch(() => ({}))) as { snapshot_id?: string };
  if (!data.snapshot_id) throw new BrightDataError("Bright Data (lancement) : identifiant de collecte absent");
  return data.snapshot_id;
}

export type SnapshotStatus = "starting" | "running" | "ready" | "failed" | "canceled" | "unknown";

export async function getSnapshotStatus(snapshotId: string): Promise<SnapshotStatus> {
  try {
    const response = await call(`/datasets/v3/progress/${encodeURIComponent(snapshotId)}`);
    if (!response.ok) return response.status === 404 ? "failed" : "unknown";
    const data = (await response.json()) as { status?: string };
    return (["starting", "running", "ready", "failed", "canceled"] as const).find((s) => s === data.status) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Fiches d'une collecte terminée. */
export async function fetchSnapshot(snapshotId: string): Promise<Record<string, unknown>[]> {
  const response = await call(`/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}?format=json`, {}, 60_000);
  if (response.status === 202 || response.status === 409) {
    await response.body?.cancel().catch(() => undefined);
    throw new BrightDataError("Bright Data : collecte pas encore prête");
  }
  if (!response.ok) throw await failure(response, "lecture");
  const data = await response.json().catch(() => []);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

/** Annule une collecte en cours (sans effet si elle est déjà terminée). */
export async function cancelSnapshot(snapshotId: string): Promise<void> {
  try {
    const response = await call(`/datasets/v3/snapshot/${encodeURIComponent(snapshotId)}/cancel`, { method: "POST" }, 15_000);
    await response.body?.cancel().catch(() => undefined);
  } catch {
    // collecte déjà terminée ou introuvable
  }
}

const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** Convertit une fiche Google Maps de Bright Data vers le format commun de l'application. */
export function mapBrightDataPlace(item: Record<string, unknown>): ScrapedPlace | null {
  const title = text(item.name);
  // Avec include_errors, une ligne en erreur n'a pas de nom : on l'écarte.
  if (!title || item.error || item.permanently_closed === true) return null;
  const categories = Array.isArray(item.all_categories) ? (item.all_categories as unknown[]).filter((c) => typeof c === "string") : [];
  return {
    title,
    website: text(item.open_website) ?? text(item.website),
    phone: text(item.phone_number),
    address: text(item.address),
    country: text(item.country_code)?.toUpperCase() ?? (text(item.country) ? normalizeCountryToIso2(text(item.country)) || undefined : undefined),
    categoryName: text(item.category) ?? (categories[0] as string | undefined),
    url: text(item.url),
    description: text(item.description)?.slice(0, 400),
    totalScore: typeof item.rating === "number" ? item.rating : undefined,
  };
}

/** Code pays attendu par Bright Data (ISO 2 lettres), ou null si le pays n'est pas reconnu. */
export function brightDataCountry(country: string | null | undefined): string | null {
  const iso = normalizeCountryToIso2(country);
  return iso && /^[A-Z]{2}$/.test(iso) ? iso : null;
}
