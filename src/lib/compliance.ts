import { normalizeCountryToIso2 } from "@/lib/prospect-language";

/**
 * Pays où la prospection par email exige en principe un accord préalable, même entre
 * professionnels. Règle appliquée : n'écrire qu'aux adresses génériques de l'entreprise.
 *
 * Ce n'est pas un avis juridique : la liste est à confirmer avec un conseil et
 * se règle par la variable STRICT_OPTIN_COUNTRIES (codes ISO2 séparés par des virgules).
 */
const DEFAULT_STRICT_COUNTRIES = ["DE", "ES", "NL"];

export function strictOptInCountries(): string[] {
  const raw = process.env.STRICT_OPTIN_COUNTRIES;
  if (raw === undefined) return DEFAULT_STRICT_COUNTRIES;
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

export function isStrictOptInCountry(country: string | null | undefined): boolean {
  return strictOptInCountries().includes(normalizeCountryToIso2(country));
}

/** Préfixes d'adresses d'entreprise (non nominatives). */
const GENERIC_PREFIXES = [
  "info", "infos", "contact", "kontakt", "contacto", "sales", "vente", "ventes", "ventas", "verkauf", "vertrieb", "export",
  "import", "office", "hello", "hallo", "hola", "bonjour", "mail", "email", "post", "admin", "service", "support", "team",
  "commercial", "comercial", "business", "trade", "trading", "purchasing", "purchase", "procurement", "achat", "achats",
  "einkauf", "compras", "inkoop", "order", "orders", "bestellung", "pedidos", "enquiry", "enquiries", "inquiry", "inquiries",
  "anfrage", "general", "reception", "accueil", "direction", "secretariat", "marketing", "customerservice", "kundenservice",
  "klantenservice", "welcome", "shop", "store", "b2b", "wholesale", "partner", "partners",
];

/** true si l'adresse est une boîte d'entreprise (info@, contact@, sales@…) et non celle d'une personne. */
export function isGenericAddress(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (!local) return false;
  return GENERIC_PREFIXES.some((p) => local === p || local.startsWith(p));
}

export type ComplianceVerdict = { allowed: true; strict: boolean } | { allowed: false; strict: true; reason: string };

/** Peut-on envoyer un email de prospection à cette adresse, dans ce pays ? */
export function checkOutreachAllowed(email: string, country: string | null | undefined): ComplianceVerdict {
  if (!isStrictOptInCountry(country)) return { allowed: true, strict: false };
  if (isGenericAddress(email)) return { allowed: true, strict: true };
  return {
    allowed: false,
    strict: true,
    reason: "Pays à accord préalable : seules les adresses génériques d'entreprise (info@, contact@…) sont contactées.",
  };
}
