type FinancialScoreInput = {
  title?: string | null;
  description?: string | null;
  categoryName?: string | null;
  website?: string | null;
  country?: string | null;
};

type FinancialCategory =
  | "bank"
  | "dfi"
  | "impact_fund"
  | "commodity_fund"
  | "corporate"
  | "vc_pe"
  | "family_office"
  | "agency";

const POSITIVE_KEYWORDS = [
  "trade finance",
  "commodity",
  "impact",
  "agribusiness",
  "cocoa",
  "coffee",
  "africa",
  "agritech",
  "esg",
  "sustainable",
];

const CATEGORY_RULES: Array<{ category: FinancialCategory; patterns: RegExp[] }> = [
  {
    category: "bank",
    patterns: [/bank/i, /banque/i, /trade finance/i, /letter of credit/i],
  },
  {
    category: "dfi",
    patterns: [/development finance/i, /\bifc\b/i, /\bafdb\b/i, /proparco/i, /\bfmo\b/i, /\bdeg\b/i, /\bbii\b/i],
  },
  {
    category: "impact_fund",
    patterns: [/impact fund/i, /blended finance/i, /smallholder/i, /inclusive finance/i],
  },
  {
    category: "commodity_fund",
    patterns: [/hedge fund/i, /structured trade finance/i, /commodity fund/i, /trading fund/i],
  },
  {
    category: "corporate",
    patterns: [/cargill/i, /nestle/i, /barry callebaut/i, /olam|ofi/i, /volcafe/i, /sucafina/i],
  },
  {
    category: "vc_pe",
    patterns: [/venture capital/i, /\bvc\b/i, /private equity/i, /series [a-c]/i, /seed fund/i],
  },
  {
    category: "family_office",
    patterns: [/family office/i, /angel network/i, /business angel/i],
  },
  {
    category: "agency",
    patterns: [/international .*organization/i, /\bicco\b/i, /\bico\b/i, /programme|program/i, /multilateral/i],
  },
];

export function inferFinancialCategory(input: FinancialScoreInput): FinancialCategory | null {
  const text = [input.title, input.description, input.categoryName, input.website]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return null;
}

export function calculateFinancialLeadScore(input: FinancialScoreInput): {
  score: number;
  grade: "A" | "B" | "C" | "D";
  reasons: string[];
  financialCategory: FinancialCategory | null;
} {
  const text = [input.title, input.description, input.categoryName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;
  const reasons: string[] = [];

  const positiveHits = POSITIVE_KEYWORDS.filter((kw) => text.includes(kw));
  if (positiveHits.length > 0) {
    const points = Math.min(35, positiveHits.length * 6);
    score += points;
    reasons.push(`+${points} : signaux finance/agri (${positiveHits.length})`);
  }

  if (input.website) {
    score += 15;
    reasons.push("+15 : site web disponible");
  } else {
    score -= 20;
    reasons.push("-20 : pas de site web");
  }

  const financialCategory = inferFinancialCategory(input);
  if (financialCategory) {
    score += 25;
    reasons.push("+25 : categorie financiere detectee");
  }

  let grade: "A" | "B" | "C" | "D";
  if (score >= 60) grade = "A";
  else if (score >= 35) grade = "B";
  else if (score >= 10) grade = "C";
  else grade = "D";

  return { score, grade, reasons, financialCategory };
}
