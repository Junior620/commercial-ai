import { normalizeSegmentFilters } from "@/lib/segment-filters-normalize";

export const FINANCIAL_ALL_PRODUCT = "financial_all_prospects";

export function isFinancialSegmentFilters(filters: unknown): boolean {
  const normalized = normalizeSegmentFilters(
    filters && typeof filters === "object"
      ? (filters as Record<string, unknown>)
      : {}
  );

  const prospectTypes = Array.isArray(normalized.prospectTypes)
    ? (normalized.prospectTypes as unknown[]).map((v) =>
        String(v).trim().toUpperCase()
      )
    : [];
  if (prospectTypes.includes("FINANCIAL")) return true;

  const clientTypes = Array.isArray(normalized.clientTypes)
    ? (normalized.clientTypes as unknown[]).map((v) =>
        String(v).trim().toLowerCase()
      )
    : [];
  return clientTypes.includes("financial_partner");
}

export function isFinancialCampaignProduct(product: string | null | undefined): boolean {
  return (product || "").trim().toLowerCase() === FINANCIAL_ALL_PRODUCT;
}

