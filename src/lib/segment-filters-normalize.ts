/**
 * Unifie les filtres segment (singulier / pluriel) pour l'enregistrement
 * et la recherche de prospects (API).
 */
export function normalizeSegmentFilters(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const f: Record<string, unknown> = { ...raw };

  const promote = (singular: string, plural: string) => {
    if (f[plural] != null) return;
    if (f[singular] == null) return;
    const v = f[singular];
    delete f[singular];
    f[plural] = Array.isArray(v) ? v : [v];
  };

  promote("country", "countries");
  promote("sector", "sectors");
  promote("clientType", "clientTypes");
  promote("product", "products");
  promote("priority", "priorities");
  promote("language", "languages");
  promote("status", "statuses");
  promote("prospectType", "prospectTypes");

  const arrayKeys = [
    "countries",
    "sectors",
    "clientTypes",
    "products",
    "priorities",
    "languages",
    "statuses",
    "prospectTypes",
  ] as const;

  for (const key of arrayKeys) {
    const v = f[key];
    if (v == null) continue;
    if (Array.isArray(v)) {
      f[key] = v.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof v === "string") {
      f[key] = v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  if (f.minScore != null) {
    const n =
      typeof f.minScore === "number"
        ? f.minScore
        : parseInt(String(f.minScore), 10);
    if (!Number.isNaN(n)) f.minScore = n;
    else delete f.minScore;
  }

  return f;
}

export function buildProspectWhereFromFilters(
  filters: Record<string, unknown>
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  const countries = filters.countries as string[] | undefined;
  if (countries?.length) where.country = { in: countries };

  const sectors = filters.sectors as string[] | undefined;
  if (sectors?.length) where.sector = { in: sectors };

  const clientTypes = filters.clientTypes as string[] | undefined;
  if (clientTypes?.length) where.clientType = { in: clientTypes };

  const products = filters.products as string[] | undefined;
  if (products?.length) where.product = { in: products };

  const priorities = filters.priorities as string[] | undefined;
  if (priorities?.length) where.priority = { in: priorities };

  const languages = filters.languages as string[] | undefined;
  if (languages?.length) where.language = { in: languages };

  const statuses = filters.statuses as string[] | undefined;
  if (statuses?.length) where.status = { in: statuses };

  const prospectTypes = filters.prospectTypes as string[] | undefined;
  if (prospectTypes?.length) where.prospectType = { in: prospectTypes };

  if (filters.minScore != null) {
    const n =
      typeof filters.minScore === "number"
        ? filters.minScore
        : parseInt(String(filters.minScore), 10);
    if (!Number.isNaN(n)) where.score = { gte: n };
  }

  return where;
}
