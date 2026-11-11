import { normalizeCountryToIso2 } from "@/lib/prospect-language";
import { classifyTarget, primaryProduct, type BuyerType, type CocoaProduct, type TargetFit } from "@/lib/targeting";
import { containsKeyword, normalizeText } from "@/lib/text-match";

export { containsKeyword } from "@/lib/text-match";

const PRODUCT_MENTIONS = [
  "cocoa beans", "cacao beans", "feves de cacao", "cocoa butter", "beurre de cacao", "cocoa mass", "cocoa liquor",
  "masse de cacao", "cocoa powder", "poudre de cacao", "couverture", "bean to bar", "bean-to-bar",
];

const B2B_KEYWORDS = [
  "manufacturer", "manufacturing", "factory", "industrial", "industry", "processing", "processor", "importer", "import",
  "distributor", "wholesaler", "wholesale", "trader", "trading", "broker", "ingredients", "fabricant", "usine",
  "importateur", "distributeur", "grossiste", "negociant", "b2b",
];

/** Marchés prioritaires (codes ISO 3166-1 alpha-2). */
const TARGET_COUNTRIES = new Set([
  "BE", "NL", "DE", "FR", "GB", "CH", "IT", "ES", "TR", "AE", "SA", "EG", "MA", "TN", "PL", "PT", "US", "CA",
]);

export interface ScoreInput {
  description?: string | null;
  categoryName?: string | null;
  country?: string | null;
  email?: string | null;
  website?: string | null;
  title?: string | null;
}

export type LeadGrade = "A" | "B" | "C" | "D";

export interface LeadScore {
  score: number;
  grade: LeadGrade;
  reasons: string[];
  fit: TargetFit;
  buyerType: BuyerType;
  productNeeds: CocoaProduct[];
}

/**
 * Score de 0 à 100 orienté vers l'offre SCPB (fèves, beurre, masse, poudre).
 * L'adéquation à la cible plafonne le score : un commerce de détail ne peut pas être prioritaire.
 */
export function calculateLeadScore(input: ScoreInput): LeadScore {
  const target = classifyTarget(input);
  const text = normalizeText([input.description, input.categoryName, input.title].filter(Boolean).join(" "));
  const reasons = [...target.reasons];
  let score = 0;

  if (containsKeyword(text, PRODUCT_MENTIONS)) {
    score += 30;
    reasons.push("+30 : mentionne fèves, beurre, masse ou poudre de cacao");
  }
  if (target.productNeeds.length > 0 && target.buyerType !== "artisan") {
    score += 25;
    reasons.push("+25 : usage transformateur des dérivés du cacao");
  } else if (target.productNeeds.length > 0) {
    score += 15;
    reasons.push("+15 : utilise des dérivés du cacao (petits volumes)");
  }
  if (containsKeyword(text, B2B_KEYWORDS)) {
    score += 15;
    reasons.push("+15 : profil acheteur B2B");
  }
  if (TARGET_COUNTRIES.has(normalizeCountryToIso2(input.country))) {
    score += 15;
    reasons.push("+15 : marché prioritaire");
  }
  if (input.email) {
    score += 10;
    reasons.push("+10 : email trouvé");
  }
  if (input.website) {
    score += 5;
    reasons.push("+5 : site web");
  }

  const cap = target.fit === "OUT_OF_SCOPE" ? 15 : target.fit === "SECONDARY" ? 55 : 100;
  if (score > cap) reasons.push(`plafonné à ${cap} (${target.fit === "OUT_OF_SCOPE" ? "hors cible" : "cible secondaire"})`);
  score = Math.max(0, Math.min(cap, score));

  return { score, grade: gradeFromScore(score), reasons, fit: target.fit, buyerType: target.buyerType, productNeeds: target.productNeeds };
}

export function gradeFromScore(score: number): LeadGrade {
  if (score >= 60) return "A";
  if (score >= 35) return "B";
  if (score >= 15) return "C";
  return "D";
}

export function priorityFromScore(score: number, fit: TargetFit = "CORE"): "HIGH" | "MEDIUM" | "LOW" {
  if (fit === "OUT_OF_SCOPE") return "LOW";
  const grade = gradeFromScore(score);
  if (grade === "A") return "HIGH";
  if (grade === "B") return "MEDIUM";
  return "LOW";
}

const CLIENT_TYPE_BY_BUYER: Partial<Record<BuyerType, string>> = {
  industrial: "manufacturer",
  cosmetics: "manufacturer",
  artisan: "manufacturer",
  distributor: "distributor",
  retail: "retailer",
};

const CLIENT_TYPE_RULES: { keywords: string[]; type: string }[] = [
  { keywords: ["importer", "importateur", "import"], type: "importer" },
  { keywords: ["trader", "trading", "negoce", "negociant", "broker", "brokerage", "courtier", "trade house"], type: "trader" },
  { keywords: ["wholesaler", "grossiste", "wholesale", "bulk", "en gros"], type: "wholesaler" },
  { keywords: ["distributor", "distributeur", "distribution"], type: "distributor" },
  { keywords: ["manufacturer", "fabricant", "factory", "usine", "manufacturing", "processing", "processor"], type: "manufacturer" },
  { keywords: ["retailer", "detaillant", "retail", "shop", "boutique", "store", "magasin"], type: "retailer" },
];

export function inferClientType(input: ScoreInput): string | null {
  const text = normalizeText([input.description, input.categoryName, input.title].filter(Boolean).join(" "));
  const byKeyword = CLIENT_TYPE_RULES.find((rule) => containsKeyword(text, rule.keywords))?.type;
  if (byKeyword) return byKeyword;
  return CLIENT_TYPE_BY_BUYER[classifyTarget(input).buyerType] ?? null;
}

/** Produit principal à proposer (fèves, beurre, masse ou poudre), ou null si hors cible. */
export function inferProduct(input: ScoreInput): string | null {
  const target = classifyTarget(input);
  if (target.fit === "OUT_OF_SCOPE") return null;
  if (target.buyerType === "coffee") return "coffee_beans";
  return primaryProduct(target);
}
