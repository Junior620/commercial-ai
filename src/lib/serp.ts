/**
 * Lecture des résultats d'une recherche Google renvoyés par Bright Data (SERP).
 * Fichier sans dépendance : partagé par l'application et par le service de lecture (worker/).
 */

export interface SerpResult {
  title: string;
  link: string;
  description: string;
}

/** Résultats naturels d'une réponse SERP (les noms de champs varient selon le format demandé). */
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
