/** Libellés français pour l'affichage des critères de segment (UI). */

export const FILTER_KEY_LABELS: Record<string, string> = {
  countries: "Pays",
  country: "Pays",
  sectors: "Secteurs",
  sector: "Secteur",
  clientTypes: "Types de client",
  clientType: "Type de client",
  products: "Produits",
  product: "Produit",
  priorities: "Priorités",
  priority: "Priorité",
  languages: "Langues",
  language: "Langue",
  statuses: "Statuts",
  status: "Statut",
  minScore: "Score minimum",
};

const SECTOR_LABELS: Record<string, string> = {
  food: "Agroalimentaire",
  chocolate: "Chocolat",
  cosmetics: "Cosmétiques",
};

const CLIENT_TYPE_LABELS: Record<string, string> = {
  manufacturer: "Fabricant",
  importer: "Importateur",
  distributor: "Distributeur",
  trader: "Trader",
};

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValueForFilterKey(key: string, value: string): string {
  const v = value.trim();
  if (!v) return v;
  const sectorKeys = new Set(["sector", "sectors"]);
  const clientKeys = new Set(["clientType", "clientTypes"]);
  if (sectorKeys.has(key)) return SECTOR_LABELS[v] ?? v;
  if (clientKeys.has(key)) return CLIENT_TYPE_LABELS[v] ?? v;
  return v;
}

export function formatSegmentFilterChips(
  filters: Record<string, unknown> | null | undefined
): { label: string; text: string }[] {
  if (!filters || typeof filters !== "object") return [];
  const chips: { label: string; text: string }[] = [];

  for (const [key, raw] of Object.entries(filters)) {
    if (raw === undefined || raw === null) continue;

    if (key === "minScore") {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isNaN(n)) {
        chips.push({ label: FILTER_KEY_LABELS.minScore, text: String(n) });
      }
      continue;
    }

    const label = FILTER_KEY_LABELS[key] ?? humanizeKey(key);
    const parts = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean)
      : String(raw)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    if (parts.length === 0) continue;
    const text = parts.map((p) => formatValueForFilterKey(key, p)).join(" · ");
    chips.push({ label, text });
  }

  return chips;
}
