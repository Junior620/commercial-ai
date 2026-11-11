import type { Prisma } from "@/generated/prisma/client";
import type { Priority, ProspectStatus, TargetFit } from "@/generated/prisma/enums";
import { normalizeCountryToIso2 } from "@/lib/prospect-language";

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
  promote("targetFit", "targetFits");
  promote("productNeed", "productNeeds");

  const arrayKeys = [
    "countries",
    "sectors",
    "clientTypes",
    "products",
    "priorities",
    "languages",
    "statuses",
    "prospectTypes",
    "targetFits",
    "productNeeds",
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

const VALID_STATUSES = new Set(["NEW", "CONTACTED", "IN_DISCUSSION", "CONVERTED", "COLD", "UNSUBSCRIBED"]);
const VALID_PRIORITIES = new Set(["HIGH", "MEDIUM", "LOW"]);
const VALID_FITS = new Set(["CORE", "SECONDARY", "OUT_OF_SCOPE"]);

/** true si le segment définit au moins un critère de ciblage. */
export function hasTargetingCriteria(filters: Record<string, unknown>): boolean {
  return Object.keys(buildProspectWhereFromFilters(filters)).some((k) => k !== "prospectType");
}

/**
 * Traduit les filtres d'un segment en clause Prisma.
 * Les valeurs d'énumération inconnues sont ignorées (au lieu de provoquer une erreur 500)
 * et les pays sont comparés sous leur forme saisie et en code ISO2.
 */
export function buildProspectWhereFromFilters(filters: Record<string, unknown>): Prisma.ProspectWhereInput {
  const where: Prisma.ProspectWhereInput = {};
  const list = (key: string) => (filters[key] as string[] | undefined)?.filter(Boolean) ?? [];

  const countries = list("countries");
  if (countries.length) {
    where.country = { in: [...new Set([...countries, ...countries.map(normalizeCountryToIso2)])] };
  }
  // Secteur Google Maps (« Chocolate factory »…) : « contient », insensible à la casse
  const and: Prisma.ProspectWhereInput[] = [];
  const sectors = list("sectors");
  if (sectors.length) and.push({ OR: sectors.map((s) => ({ sector: { contains: s, mode: "insensitive" as const } })) });
  const productNeeds = list("productNeeds");
  if (productNeeds.length) and.push({ productNeeds: { hasSome: productNeeds } });
  const clientTypes = list("clientTypes");
  if (clientTypes.length) where.clientType = { in: clientTypes };
  const products = list("products");
  if (products.length) where.product = { in: products };
  const languages = list("languages");
  if (languages.length) where.language = { in: languages };

  const priorities = list("priorities").filter((p) => VALID_PRIORITIES.has(p));
  if (priorities.length) where.priority = { in: priorities as Priority[] };
  const statuses = list("statuses").filter((s) => VALID_STATUSES.has(s));
  if (statuses.length) where.status = { in: statuses as ProspectStatus[] };
  const fits = list("targetFits").filter((f) => VALID_FITS.has(f));
  if (fits.length) where.targetFit = { in: fits as TargetFit[] };
  if (and.length) where.AND = and;

  if (filters.minScore != null) {
    const n = typeof filters.minScore === "number" ? filters.minScore : parseInt(String(filters.minScore), 10);
    if (!Number.isNaN(n)) where.score = { gte: n };
  }

  // Le module financier a été retiré : un segment ne cible que des prospects commerciaux.
  where.prospectType = "COMMERCIAL";
  return where;
}
