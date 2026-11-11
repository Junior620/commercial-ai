import { toCsv } from "@/lib/csv";

export interface Prospect {
  id: string;
  company: string;
  contact: string | null;
  email: string;
  phone: string | null;
  country: string;
  sector: string | null;
  clientType: string | null;
  product: string | null;
  status: string;
  language: string;
  priority: string;
  score: number;
  website: string | null;
  source: string | null;
  notes: string | null;
  targetFit?: "CORE" | "SECONDARY" | "OUT_OF_SCOPE";
  productNeeds?: string[];
  createdAt?: string;
}

export const FIT_LABELS: Record<string, string> = {
  CORE: "Cœur de cible",
  SECONDARY: "Secondaire",
  OUT_OF_SCOPE: "Hors cible",
};

export const FIT_CLASSES: Record<string, string> = {
  CORE: "border-primary/30 bg-[linear-gradient(90deg,oklch(0.687_0.134_117.7/0.18),oklch(0.687_0.134_117.7/0.06))] text-primary",
  SECONDARY: "border-sun/40 bg-sun/15 text-sun-foreground dark:text-sun",
  OUT_OF_SCOPE: "border-border bg-muted text-muted-foreground",
};

export const NEED_LABELS: Record<string, string> = {
  cocoa_beans: "Fèves",
  cocoa_butter: "Beurre",
  cocoa_mass: "Masse",
  cocoa_powder: "Poudre",
};

export const CLIENT_TYPE_LABELS: Record<string, string> = {
  importer: "Importateur",
  distributor: "Distributeur",
  manufacturer: "Fabricant",
  trader: "Négociant",
  wholesaler: "Grossiste",
  retailer: "Détaillant",
};

export const SOURCE_LABELS: Record<string, string> = {
  apify_google_maps: "Google Maps",
  csv_import: "Import CSV",
  manual: "Saisie manuelle",
};

const COUNTRY_NAMES = typeof Intl !== "undefined" ? new Intl.DisplayNames(["fr"], { type: "region" }) : null;

/** « CM » → « Cameroun » ; laisse tel quel un nom déjà saisi en clair. */
export function countryName(value: string): string {
  if (/^[A-Z]{2}$/.test(value) && COUNTRY_NAMES) {
    try {
      return COUNTRY_NAMES.of(value) ?? value;
    } catch {
      return value;
    }
  }
  return value;
}

export function scoreTone(score: number): string {
  if (score >= 60) return "text-success";
  if (score >= 35) return "text-warning";
  return "text-muted-foreground";
}

/** Export CSV côté navigateur (cellules protégées contre l'injection de formules). */
export function downloadProspectsCsv(rows: Prospect[], filename: string) {
  const headers = ["company", "contact", "email", "phone", "country", "sector", "clientType", "product", "status", "priority", "score", "website"] as const;
  const csv = toCsv(
    [...headers],
    rows.map((p) => headers.map((h) => String(p[h] ?? "")))
  );
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
