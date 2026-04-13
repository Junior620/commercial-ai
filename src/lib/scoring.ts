const COCOA_KEYWORDS = [
  "cocoa",
  "cacao",
  "chocolate",
  "cocoa butter",
  "beurre de cacao",
  "cocoa powder",
  "poudre de cacao",
  "cocoa mass",
  "cocoa liquor",
  "cocoa beans",
  "feves de cacao",
  "chocolat",
];

const B2B_KEYWORDS = [
  "manufacturer",
  "supplier",
  "exporter",
  "importer",
  "distributor",
  "wholesaler",
  "trader",
  "factory",
  "industrial",
  "processing",
  "bulk",
  "B2B",
  "fabricant",
  "fournisseur",
  "exportateur",
  "importateur",
  "grossiste",
];

const RETAIL_KEYWORDS = [
  "boutique",
  "shop",
  "retail",
  "store",
  "bakery",
  "patisserie",
  "cafe",
  "restaurant",
];

const TARGET_COUNTRIES = [
  "Belgium",
  "Netherlands",
  "Germany",
  "France",
  "UK",
  "Switzerland",
  "Italy",
  "Spain",
  "Turkey",
  "UAE",
  "Saudi Arabia",
  "Egypt",
  "Morocco",
  "Tunisia",
  "Poland",
  "Portugal",
];

interface ScoreInput {
  description?: string | null;
  categoryName?: string | null;
  country?: string | null;
  email?: string | null;
  website?: string | null;
  title?: string | null;
}

export function calculateLeadScore(input: ScoreInput): {
  score: number;
  grade: "A" | "B" | "C" | "D";
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  const textToAnalyze = [
    input.description,
    input.categoryName,
    input.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasCocoa = COCOA_KEYWORDS.some((kw) =>
    textToAnalyze.includes(kw.toLowerCase())
  );
  if (hasCocoa) {
    score += 30;
    reasons.push("+30 : mention cacao/chocolat");
  }

  const hasB2B = B2B_KEYWORDS.some((kw) =>
    textToAnalyze.includes(kw.toLowerCase())
  );
  if (hasB2B) {
    score += 10;
    reasons.push("+10 : profil B2B");
  }

  const isRetail = RETAIL_KEYWORDS.some((kw) =>
    textToAnalyze.includes(kw.toLowerCase())
  );
  if (isRetail) {
    score -= 20;
    reasons.push("-20 : profil retail/local");
  }

  if (
    input.country &&
    TARGET_COUNTRIES.some(
      (c) => c.toLowerCase() === input.country!.toLowerCase()
    )
  ) {
    score += 20;
    reasons.push("+20 : pays cible");
  }

  if (input.email) {
    score += 15;
    reasons.push("+15 : email public trouve");
  }

  if (!input.website) {
    score -= 30;
    reasons.push("-30 : pas de site web");
  }

  if (input.categoryName) {
    const cat = input.categoryName.toLowerCase();
    const relevantCategories = [
      "food",
      "chocolate",
      "cocoa",
      "confectionery",
      "ingredient",
      "cosmetic",
      "manufacturing",
    ];
    if (relevantCategories.some((rc) => cat.includes(rc))) {
      score += 20;
      reasons.push("+20 : categorie Maps pertinente");
    }
  }

  let grade: "A" | "B" | "C" | "D";
  if (score >= 60) grade = "A";
  else if (score >= 30) grade = "B";
  else if (score >= 0) grade = "C";
  else grade = "D";

  return { score, grade, reasons };
}
