import { normalizeCountryToIso2 } from "@/lib/prospect-language";

const COCOA_KEYWORDS = [
  "cocoa", "cacao", "chocolate", "chocolat", "chocolatier", "cocoa butter", "beurre de cacao",
  "cocoa powder", "poudre de cacao", "cocoa mass", "cocoa liquor", "masse de cacao",
  "cocoa beans", "feves de cacao",
];

const COFFEE_KEYWORDS = [
  "coffee", "cafe", "green coffee", "cafe vert", "coffee roaster", "torrefacteur", "torrefaction", "roastery",
];

const B2B_KEYWORDS = [
  "manufacturer", "supplier", "exporter", "importer", "distributor", "wholesaler", "wholesale",
  "trader", "trading", "broker", "brokerage", "factory", "industrial", "industry", "processing",
  "processor", "bulk", "b2b", "commodity", "commodities", "ingredients", "fabricant", "fournisseur",
  "exportateur", "importateur", "grossiste", "negociant", "negoce", "courtier", "usine",
];

/** Signes d'un commerce de détail (le café en tant que lieu n'en fait pas partie). */
const RETAIL_KEYWORDS = [
  "boutique", "shop", "retail", "store", "bakery", "patisserie", "boulangerie", "restaurant",
  "coffee shop", "salon de the", "magasin",
];

/** Marchés prioritaires (codes ISO 3166-1 alpha-2). */
const TARGET_COUNTRIES = new Set([
  "BE", "NL", "DE", "FR", "GB", "CH", "IT", "ES", "TR", "AE", "SA", "EG", "MA", "TN", "PL", "PT",
  "US", "CA",
]);

const RELEVANT_CATEGORIES = [
  "food", "chocolate", "cocoa", "coffee", "confectionery", "ingredient", "cosmetic", "manufactur",
  "trading", "commodity", "broker", "import", "export", "wholesale",
];

export interface ScoreInput {
  description?: string | null;
  categoryName?: string | null;
  country?: string | null;
  email?: string | null;
  website?: string | null;
  title?: string | null;
}

export type LeadGrade = "A" | "B" | "C" | "D";

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Correspondance sur mots entiers (« shop » ne correspond pas à « workshop »). */
export function containsKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(kw)}([^\\p{L}\\p{N}]|$)`, "u").test(text));
}

function analyzedText(input: ScoreInput): string {
  return normalizeText([input.description, input.categoryName, input.title].filter(Boolean).join(" "));
}

export function calculateLeadScore(input: ScoreInput): {
  score: number;
  grade: LeadGrade;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];
  const text = analyzedText(input);

  if (containsKeyword(text, COCOA_KEYWORDS)) {
    score += 30;
    reasons.push("+30 : mention cacao/chocolat");
  } else if (containsKeyword(text, COFFEE_KEYWORDS)) {
    score += 20;
    reasons.push("+20 : mention café");
  }

  if (containsKeyword(text, B2B_KEYWORDS)) {
    score += 15;
    reasons.push("+15 : profil B2B");
  }

  if (containsKeyword(text, RETAIL_KEYWORDS)) {
    score -= 20;
    reasons.push("-20 : profil commerce de détail");
  }

  const iso = normalizeCountryToIso2(input.country);
  if (TARGET_COUNTRIES.has(iso)) {
    score += 20;
    reasons.push("+20 : marché prioritaire");
  }

  if (input.email) {
    score += 15;
    reasons.push("+15 : email public trouvé");
  }

  if (!input.website) {
    score -= 20;
    reasons.push("-20 : pas de site web");
  }

  if (input.categoryName && RELEVANT_CATEGORIES.some((c) => normalizeText(input.categoryName!).includes(c))) {
    score += 20;
    reasons.push("+20 : catégorie Google Maps pertinente");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFromScore(score), reasons };
}

export function gradeFromScore(score: number): LeadGrade {
  if (score >= 60) return "A";
  if (score >= 35) return "B";
  if (score >= 15) return "C";
  return "D";
}

export function priorityFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" {
  const grade = gradeFromScore(score);
  if (grade === "A") return "HIGH";
  if (grade === "B") return "MEDIUM";
  return "LOW";
}

const CLIENT_TYPE_RULES: { keywords: string[]; type: string }[] = [
  { keywords: ["importer", "importateur", "import"], type: "importer" },
  { keywords: ["distributor", "distributeur", "distribution"], type: "distributor" },
  { keywords: ["manufacturer", "fabricant", "factory", "usine", "manufacturing", "processing", "processor"], type: "manufacturer" },
  { keywords: ["trader", "trading", "negoce", "negociant", "broker", "brokerage", "courtier", "trade house"], type: "trader" },
  { keywords: ["wholesaler", "grossiste", "wholesale", "bulk", "en gros"], type: "wholesaler" },
  { keywords: ["retailer", "detaillant", "retail", "shop", "boutique", "store", "magasin"], type: "retailer" },
];

const PRODUCT_RULES: { keywords: string[]; product: string }[] = [
  { keywords: ["cocoa beans", "feves de cacao", "cacao beans", "raw cocoa"], product: "cocoa_beans" },
  { keywords: ["cocoa butter", "beurre de cacao", "cacao butter"], product: "cocoa_butter" },
  { keywords: ["cocoa powder", "poudre de cacao", "cacao powder"], product: "cocoa_powder" },
  { keywords: ["cocoa mass", "cocoa liquor", "masse de cacao", "pate de cacao"], product: "cocoa_mass" },
  { keywords: ["cosmetic", "cosmetics", "cosmetique", "beauty", "skin care", "skincare"], product: "cosmetics" },
  { keywords: ["chocolate", "chocolat", "confectionery", "confiserie", "praline"], product: "food_chocolate" },
  { keywords: ["green coffee", "cafe vert"], product: "green_coffee" },
  { keywords: ["coffee", "cafe", "roaster", "torrefacteur"], product: "coffee_beans" },
];

export function inferClientType(input: ScoreInput): string | null {
  const text = analyzedText(input);
  return CLIENT_TYPE_RULES.find((rule) => containsKeyword(text, rule.keywords))?.type ?? null;
}

export function inferProduct(input: ScoreInput): string | null {
  const text = analyzedText(input);
  return PRODUCT_RULES.find((rule) => containsKeyword(text, rule.keywords))?.product ?? null;
}
