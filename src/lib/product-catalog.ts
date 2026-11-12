/**
 * Catalogue produits. L'offre prioritaire de SCPB : fèves de cacao et produits
 * transformés (beurre, masse, poudre). Le café reste disponible en secondaire.
 */

export type ProductOption = { id: string; label: string; group: "core" | "secondary" };

/** Libellés par identifiant, pour l'affichage de la valeur choisie dans un sélecteur. */
export function productItems(options: ProductOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.id, o.label]));
}

export const CAMPAIGN_PRODUCT_OPTIONS: ProductOption[] = [
  { id: "all", label: "Fèves et dérivés (gamme complète)", group: "core" },
  { id: "cocoa_beans", label: "Fèves de cacao", group: "core" },
  { id: "cocoa_butter", label: "Beurre de cacao", group: "core" },
  { id: "cocoa_mass", label: "Masse (liqueur) de cacao", group: "core" },
  { id: "cocoa_powder", label: "Poudre de cacao", group: "core" },
  { id: "coffee_beans", label: "Grains de café", group: "secondary" },
  { id: "green_coffee", label: "Café vert", group: "secondary" },
  { id: "ground_coffee", label: "Café moulu", group: "secondary" },
  { id: "instant_coffee", label: "Café soluble", group: "secondary" },
];

export const SCRAPING_PRODUCT_OPTIONS: ProductOption[] = [
  { id: "all", label: "Fèves et dérivés (gamme complète)", group: "core" },
  { id: "cocoa beans", label: "Fèves de cacao", group: "core" },
  { id: "cocoa butter", label: "Beurre de cacao", group: "core" },
  { id: "cocoa mass/liquor", label: "Masse de cacao", group: "core" },
  { id: "cocoa powder", label: "Poudre de cacao", group: "core" },
  { id: "derivatives", label: "Revendeurs d'ingrédients cacao", group: "core" },
  { id: "coffee beans", label: "Grains de café", group: "secondary" },
  { id: "green coffee", label: "Café vert", group: "secondary" },
];

/** Produits du cœur de cible (identifiants des prospects et des campagnes). */
export const CORE_PRODUCT_IDS = ["cocoa_beans", "cocoa_butter", "cocoa_mass", "cocoa_powder"] as const;

export const PRODUCT_LABELS: Record<string, string> = {
  cocoa_beans: "Fèves de cacao",
  cocoa_butter: "Beurre de cacao",
  cocoa_powder: "Poudre de cacao",
  cocoa_mass: "Masse de cacao",
  cocoa_liquor: "Masse de cacao",
  derivatives: "Dérivés du cacao",
  cosmetics: "Cosmétiques",
  food_chocolate: "Chocolat et confiserie",
  coffee_beans: "Grains de café",
  green_coffee: "Café vert",
  ground_coffee: "Café moulu",
  instant_coffee: "Café soluble",
  all: "Fèves et dérivés",
};
