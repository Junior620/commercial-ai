import { containsKeyword, normalizeText } from "@/lib/text-match";

/**
 * Référentiel de ciblage SCPB : acheteurs de fèves de cacao et de produits
 * transformés (beurre, masse/liqueur, poudre).
 *
 * - CORE : transformateurs et revendeurs B2B (chocolaterie industrielle, confiserie,
 *   biscuiterie, glaces, cosmétique, broyeurs, importateurs et négociants).
 * - SECONDARY : petits volumes (artisans chocolatiers, bean-to-bar artisanal),
 *   café professionnel (torréfacteurs, grossistes en café), profils B2B incertains.
 * - OUT_OF_SCOPE : commerces de détail, restauration, services sans lien, concurrents
 *   (exportateurs, producteurs, plantations, coopératives de cacao).
 */

export type TargetFit = "CORE" | "SECONDARY" | "OUT_OF_SCOPE";
export type CocoaProduct = "cocoa_beans" | "cocoa_butter" | "cocoa_mass" | "cocoa_powder";
export type BuyerType =
  | "industrial"
  | "artisan"
  | "cosmetics"
  | "distributor"
  | "coffee"
  | "retail"
  | "competitor"
  | "unknown";

export const COCOA_PRODUCTS: CocoaProduct[] = ["cocoa_beans", "cocoa_butter", "cocoa_mass", "cocoa_powder"];

export const TARGET_FIT_LABELS: Record<TargetFit, string> = {
  CORE: "Cœur de cible",
  SECONDARY: "Secondaire",
  OUT_OF_SCOPE: "Hors cible",
};

export const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  industrial: "Industriel transformateur",
  artisan: "Artisan chocolatier",
  cosmetics: "Cosmétique",
  distributor: "Importateur / distributeur",
  coffee: "Café professionnel",
  retail: "Commerce de détail",
  competitor: "Concurrent (producteur / exportateur)",
  unknown: "À qualifier",
};

export interface TargetInput {
  title?: string | null;
  categoryName?: string | null;
  description?: string | null;
}

export interface TargetResult {
  fit: TargetFit;
  buyerType: BuyerType;
  productNeeds: CocoaProduct[];
  reasons: string[];
}

// ─── Vocabulaire (normalisé à la comparaison) ─────────────────────

const COCOA = ["cocoa", "cacao", "kakao", "cacau", "chocolate", "chocolat", "schokolade", "cioccolato", "chocolatier", "chocolaterie"];
const PRODUCT_TERMS: Record<CocoaProduct, string[]> = {
  cocoa_beans: ["cocoa beans", "cacao beans", "feves de cacao", "feve de cacao", "kakaobohnen", "granos de cacao", "bean to bar", "bean-to-bar", "cocoa grinding", "cocoa grinder", "cocoa processing", "broyage"],
  cocoa_butter: ["cocoa butter", "cacao butter", "beurre de cacao", "kakaobutter", "manteca de cacao", "burro di cacao"],
  cocoa_mass: ["cocoa mass", "cocoa liquor", "cocoa paste", "masse de cacao", "pate de cacao", "liqueur de cacao", "kakaomasse", "couverture"],
  cocoa_powder: ["cocoa powder", "poudre de cacao", "kakaopulver", "cacao en polvo", "cacao in polvere"],
};

/** Usages qui consomment des dérivés du cacao. */
const CHOCOLATE_MAKING = ["chocolate factory", "chocolate manufacturer", "chocolate maker", "chocolate manufacturing", "chocolaterie industrielle", "fabricant de chocolat", "schokoladenfabrik", "confectionery", "confiserie", "praline", "couverture"];
const POWDER_USES = ["biscuit", "biscuits", "cookie manufacturer", "bakery", "industrial bakery", "wholesale bakery", "boulangerie industrielle", "patisserie industrielle", "ice cream manufacturer", "glacier", "dairy", "dairy supplier", "beverage", "drinks", "cereal", "frozen food", "dessert manufacturer"];
const COSMETICS = ["cosmetic", "cosmetics", "cosmetique", "skin care", "skincare", "beauty product", "beauty products", "soap", "aromatherapy", "flavours", "fragrances", "pharmaceutical", "kosmetik"];
const B2B = ["manufacturer", "manufacturing", "factory", "fabricant", "usine", "industry", "industrie", "processing", "processor", "producer of", "importer", "import", "importateur", "distributor", "distributeur", "wholesaler", "wholesale", "grossiste", "trader", "trading", "negociant", "broker", "supplier", "fournisseur", "b2b", "ingredients", "cash carry"];
const IMPORT_TRADE = ["importer", "import export", "importateur", "trader", "trading", "negociant", "broker", "commodities", "commodity"];
const COMPETITOR = ["exporter", "exportateur", "export of cocoa", "plantation", "planteur", "farm", "farmers", "cooperative", "cooperativa", "producer", "producteur", "estate"];
const COFFEE = ["coffee", "cafe", "kaffee", "espresso"];

/** Catégories Google Maps de commerce de détail / restauration / services sans lien. */
const RETAIL_CATEGORIES = [
  "coffee shop", "cafe", "coffee store", "chocolate cafe", "grocery store", "supermarket", "department store", "candy store",
  "gourmet grocery store", "convenience store", "health food store", "organic food store", "organic shop", "natural goods store",
  "warehouse store", "warehouse club", "store", "outlet store", "shopping mall", "spice store", "cheese shop", "cookie shop",
  "dessert shop", "donut shop", "cake shop", "sweet shop", "confectionery store", "ice cream shop", "pastry shop", "patisserie",
  "bakery", "restaurant", "sandwich shop", "hotel", "event venue", "museum", "tourist attraction", "cosmetics store",
  "beauty supply store", "health and beauty shop", "drug store", "vitamin supplements store", "liquor store", "gift basket store",
  "home goods store", "furniture store", "hardware store", "home improvement store", "garden center", "kitchen supply store",
  "cutlery store", "print shop", "hair salon", "culinary school", "cooking school", "community center", "farmers market",
  "produce market", "charcuterie", "asian grocery store", "indian grocery store", "baking supply store", "mobile caterer",
  "animal feed shop", "non profit organization", "association organization", "investment service", "gold dealer", "consultant",
  "e commerce service", "cleaning products supplier", "meat wholesaler", "brewery", "dairy farm", "wholesale food store",
];

const CHOCOLATE_RETAIL = ["chocolate shop", "chocolatier shop", "boutique"];
const ARTISAN = ["chocolate artisan", "artisan", "chocolatier", "craft chocolate", "handmade"];

function categoryIs(category: string, list: string[]): boolean {
  if (!category) return false;
  const c = category.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  return list.some((item) => c === item || c.endsWith(` ${item}`));
}

function productsFromText(text: string): CocoaProduct[] {
  return COCOA_PRODUCTS.filter((p) => containsKeyword(text, PRODUCT_TERMS[p]));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** Classe une entreprise selon son adéquation à l'offre fèves / beurre / masse / poudre. */
export function classifyTarget(input: TargetInput): TargetResult {
  const category = normalizeText(input.categoryName || "");
  const text = normalizeText([input.title, input.categoryName, input.description].filter(Boolean).join(" "));
  const mentioned = productsFromText(text);
  // « Kaoka », « ChocoSol », « Chocolow » : marques du cacao sans mot-clé isolé
  const cocoa = containsKeyword(text, COCOA) || mentioned.length > 0 || /choco|cacao|cocoa|kakao|cacau/.test(normalizeText(input.title || ""));
  const ingredients = containsKeyword(text, ["ingredient", "ingredients", "ingredienten", "zutaten", "ingredientes"]) || /ingredient/.test(text);
  const strongB2B = containsKeyword(text, ["wholesale", "production", "manufacturer", "manufacturing", "factory", "industrial", "industry", "usine", "fabricant", "b2b"]);
  const b2b = containsKeyword(text, B2B);
  const reasons: string[] = [];
  const result = (fit: TargetFit, buyerType: BuyerType, needs: CocoaProduct[]): TargetResult => ({
    fit,
    buyerType,
    productNeeds: unique([...mentioned, ...needs]),
    reasons,
  });

  // 1. Concurrents : producteurs / exportateurs de cacao (sans profil acheteur)
  if (cocoa && containsKeyword(text, COMPETITOR) && !containsKeyword(text, [...IMPORT_TRADE, "manufacturer", "factory", "fabricant", "chocolatier"])) {
    reasons.push("producteur ou exportateur de cacao (concurrent)");
    return result("OUT_OF_SCOPE", "competitor", []);
  }

  // 1 bis. Associations, organisations : pas des acheteurs
  if (categoryIs(category, ["association organization", "non profit organization", "community center", "museum"])) {
    reasons.push("organisation ou association (pas un acheteur)");
    return result("OUT_OF_SCOPE", "retail", []);
  }

  // 1 ter. Torréfacteurs (même classés « café ») : café professionnel, secondaire
  if (containsKeyword(text, COFFEE) && !cocoa && containsKeyword(text, ["roastery", "roaster", "roasters", "torrefacteur", "green coffee", "cafe vert", "coffee wholesaler"])) {
    reasons.push("torréfacteur / grossiste en café");
    return result("SECONDARY", "coffee", []);
  }

  // 1 quater. Commerce de détail et restauration, sauf activité de production ou de gros affichée
  if (categoryIs(category, RETAIL_CATEGORIES) && !strongB2B && !containsKeyword(text, COSMETICS)) {
    reasons.push("commerce de détail ou service sans lien avec l'achat de matières premières");
    return result("OUT_OF_SCOPE", "retail", []);
  }

  // 2. Cosmétique : beurre de cacao
  if (containsKeyword(text, COSMETICS)) {
    if (categoryIs(category, RETAIL_CATEGORIES)) {
      reasons.push("magasin de cosmétiques (détail)");
      return result("OUT_OF_SCOPE", "retail", []);
    }
    reasons.push("cosmétique : utilise du beurre de cacao");
    return result("CORE", "cosmetics", ["cocoa_butter"]);
  }

  // 3. Chocolaterie industrielle et confiserie : masse + beurre (+ fèves si bean-to-bar)
  if (containsKeyword(text, CHOCOLATE_MAKING) && !categoryIs(category, [...RETAIL_CATEGORIES, ...CHOCOLATE_RETAIL])) {
    const artisan = containsKeyword(text, ["chocolate artisan", "artisan", "artisanal", "handmade", "craft"]);
    reasons.push(artisan ? "chocolaterie artisanale" : "chocolaterie / confiserie : masse et beurre de cacao");
    const needs: CocoaProduct[] = ["cocoa_mass", "cocoa_butter"];
    if (containsKeyword(text, ["bean to bar", "bean-to-bar", "craft"])) needs.push("cocoa_beans");
    if (containsKeyword(text, ["confectionery", "confiserie", "praline"])) needs.push("cocoa_powder");
    return result(artisan ? "SECONDARY" : "CORE", artisan ? "artisan" : "industrial", needs);
  }

  // 4. Importateurs, négociants, distributeurs B2B
  if (categoryIs(category, ["importer", "import export company", "exporter", "wholesaler", "food products supplier", "agricultural product wholesaler", "confectionery wholesaler", "food broker", "catering food and drink supplier", "catering supplier", "beverage distributor", "wholesale grocer", "business to business service", "warehouse", "cash carry"]) || containsKeyword(text, IMPORT_TRADE)) {
    if (containsKeyword(text, COFFEE) && !cocoa) {
      reasons.push("négoce de café");
      return result("SECONDARY", "coffee", []);
    }
    if (cocoa || ingredients) {
      reasons.push(cocoa ? "importateur / distributeur de produits cacao" : "distributeur d'ingrédients alimentaires");
      return result("CORE", "distributor", cocoa ? COCOA_PRODUCTS : ["cocoa_powder", "cocoa_butter"]);
    }
    reasons.push("distributeur alimentaire B2B (cacao à confirmer)");
    return result("SECONDARY", "distributor", ["cocoa_powder", "cocoa_butter"]);
  }

  // 5. Industrie alimentaire utilisatrice de poudre (biscuits, glaces, boulangerie industrielle…)
  if (containsKeyword(text, POWDER_USES) && (b2b || categoryIs(category, ["manufacturer", "food manufacturer", "food processing company", "food producer", "frozen food manufacturer", "food manufacturing supply", "wholesale bakery", "dairy supplier"]))) {
    reasons.push("industrie alimentaire : poudre de cacao");
    return result("CORE", "industrial", ["cocoa_powder"]);
  }
  if (categoryIs(category, ["manufacturer", "food manufacturer", "food processing company", "food producer", "frozen food manufacturer", "food manufacturing supply", "wholesale bakery", "dairy supplier"])) {
    if (cocoa || ingredients) {
      reasons.push(cocoa ? "industriel alimentaire du chocolat" : "fabricant d'ingrédients alimentaires");
      return result("CORE", "industrial", cocoa ? ["cocoa_mass", "cocoa_butter", "cocoa_powder"] : ["cocoa_powder", "cocoa_butter"]);
    }
    reasons.push("industriel alimentaire (usage du cacao à confirmer)");
    return result("SECONDARY", "industrial", ["cocoa_powder"]);
  }

  // 6. Café professionnel (torréfacteurs, grossistes) : secondaire ; café de détail : hors cible
  if (containsKeyword(text, COFFEE) && !cocoa) {
    if (categoryIs(category, ["coffee roastery", "coffee roasters", "coffee wholesaler"]) || containsKeyword(text, ["roastery", "roaster", "torrefacteur", "green coffee", "cafe vert", "coffee wholesaler"])) {
      reasons.push("torréfacteur / grossiste en café");
      return result("SECONDARY", "coffee", []);
    }
    reasons.push("café ou coffee shop (détail)");
    return result("OUT_OF_SCOPE", "retail", []);
  }

  // 7. Chocolatiers artisans (y compris boutiques qui fabriquent)
  if (categoryIs(category, ["chocolate artisan"]) || (categoryIs(category, CHOCOLATE_RETAIL) && containsKeyword(text, ["chocolatier", "artisan", "bean to bar", "bean-to-bar", "craft", "handmade", "fabrication", "atelier"]))) {
    reasons.push("artisan chocolatier : petits volumes");
    const needs: CocoaProduct[] = ["cocoa_mass", "cocoa_butter"];
    if (containsKeyword(text, ["bean to bar", "bean-to-bar", "craft"])) needs.push("cocoa_beans");
    return result("SECONDARY", "artisan", needs);
  }

  // 8. Commerce de détail et services sans lien
  if (categoryIs(category, [...RETAIL_CATEGORIES, ...CHOCOLATE_RETAIL])) {
    reasons.push("commerce de détail ou service sans lien avec l'achat de matières premières");
    return result("OUT_OF_SCOPE", "retail", []);
  }

  // 9. Indéterminé : on garde, la mention du cacao départage
  if (cocoa && b2b) {
    reasons.push("entreprise B2B liée au cacao");
    return result("CORE", "unknown", mentioned.length ? [] : ["cocoa_mass", "cocoa_powder"]);
  }
  reasons.push(cocoa ? "liée au cacao, profil à qualifier" : "profil à qualifier");
  return result("SECONDARY", "unknown", []);
}

/** Produit principal à proposer selon les besoins détectés. */
export function primaryProduct(result: TargetResult): CocoaProduct | null {
  if (result.productNeeds.length === 0) return null;
  const order: Record<BuyerType, CocoaProduct[]> = {
    cosmetics: ["cocoa_butter"],
    artisan: ["cocoa_mass", "cocoa_beans", "cocoa_butter"],
    industrial: ["cocoa_mass", "cocoa_powder", "cocoa_butter", "cocoa_beans"],
    distributor: ["cocoa_beans", "cocoa_powder", "cocoa_butter", "cocoa_mass"],
    coffee: [],
    retail: [],
    competitor: [],
    unknown: COCOA_PRODUCTS,
  };
  return order[result.buyerType].find((p) => result.productNeeds.includes(p)) ?? result.productNeeds[0];
}
