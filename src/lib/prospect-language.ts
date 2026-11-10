/**
 * Pays et langue des prospects.
 *
 * - `normalizeCountryToIso2` : convertit un nom de pays (EN/FR) ou un code en ISO 3166-1 alpha-2.
 *   Google Maps (Apify) renvoie déjà `countryCode` ; les imports CSV contiennent souvent des noms.
 * - `inferProspectLanguageFromCountry` : langue de prospection probable (fr | en | es | pt | de).
 * - `resolveCampaignLanguage` : langue finale d'un email (campagne > prospect > pays).
 */

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  france: "FR", monaco: "MC", luxembourg: "LU", belgium: "BE", belgique: "BE",
  senegal: "SN", mali: "ML", "burkina faso": "BF", niger: "NE", togo: "TG",
  benin: "BJ", guinea: "GN", guinee: "GN", cameroon: "CM", cameroun: "CM",
  "ivory coast": "CI", "cote d ivoire": "CI", "cote divoire": "CI",
  gabon: "GA", congo: "CG", "republic of the congo": "CG",
  "democratic republic of the congo": "CD", "rd congo": "CD", rdc: "CD",
  rwanda: "RW", burundi: "BI", djibouti: "DJ", madagascar: "MG", haiti: "HT",
  chad: "TD", tchad: "TD", "central african republic": "CF",
  morocco: "MA", maroc: "MA", algeria: "DZ", algerie: "DZ", tunisia: "TN", tunisie: "TN",
  mauritius: "MU", "ile maurice": "MU",
  ghana: "GH", nigeria: "NG", kenya: "KE", "south africa": "ZA", "afrique du sud": "ZA",
  egypt: "EG", egypte: "EG", ethiopia: "ET", uganda: "UG", tanzania: "TZ",
  spain: "ES", espagne: "ES", espana: "ES", mexico: "MX", mexique: "MX",
  colombia: "CO", colombie: "CO", argentina: "AR", argentine: "AR", peru: "PE", perou: "PE",
  ecuador: "EC", equateur: "EC", chile: "CL", chili: "CL",
  brazil: "BR", bresil: "BR", brasil: "BR", portugal: "PT",
  germany: "DE", allemagne: "DE", deutschland: "DE", austria: "AT", autriche: "AT",
  osterreich: "AT", switzerland: "CH", suisse: "CH", schweiz: "CH",
  "united kingdom": "GB", uk: "GB", england: "GB", "royaume uni": "GB",
  usa: "US", us: "US", "united states": "US", "etats unis": "US", canada: "CA",
  netherlands: "NL", "pays bas": "NL", holland: "NL", italy: "IT", italie: "IT", italia: "IT",
  ireland: "IE", irlande: "IE", sweden: "SE", denmark: "DK", norway: "NO", finland: "FI",
  poland: "PL", pologne: "PL", greece: "GR", turkey: "TR", turquie: "TR",
  "united arab emirates": "AE", uae: "AE", "emirats arabes unis": "AE",
  "saudi arabia": "SA", "arabie saoudite": "SA", israel: "IL", lebanon: "LB", liban: "LB",
  singapore: "SG", singapour: "SG", malaysia: "MY", malaisie: "MY", indonesia: "ID",
  indonesie: "ID", india: "IN", inde: "IN", japan: "JP", japon: "JP", china: "CN",
  chine: "CN", "south korea": "KR", "coree du sud": "KR", australia: "AU", australie: "AU",
  "new zealand": "NZ",
};

const ISO2_TO_LANGUAGE: Record<string, string> = {
  // Francophonie (Europe, DOM-TOM, Afrique, Maghreb où le français domine en B2B)
  FR: "fr", MC: "fr", LU: "fr", BE: "fr", GF: "fr", GP: "fr", MQ: "fr", RE: "fr",
  YT: "fr", PM: "fr", BL: "fr", MF: "fr", WF: "fr", PF: "fr", NC: "fr",
  SN: "fr", CI: "fr", CM: "fr", ML: "fr", BF: "fr", NE: "fr", TG: "fr", BJ: "fr",
  GN: "fr", MG: "fr", CD: "fr", CG: "fr", GA: "fr", TD: "fr", BI: "fr", DJ: "fr",
  RW: "fr", CF: "fr", HT: "fr", MA: "fr", DZ: "fr", TN: "fr",
  // Hispanophonie
  ES: "es", MX: "es", AR: "es", CO: "es", PE: "es", CL: "es", EC: "es", GT: "es",
  HN: "es", SV: "es", NI: "es", CR: "es", PA: "es", BO: "es", PY: "es", UY: "es",
  VE: "es", CU: "es", DO: "es", PR: "es",
  // Lusophonie
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt", GW: "pt", CV: "pt", ST: "pt", TL: "pt",
  // Germanophonie (la Suisse est multilingue : anglais par défaut)
  DE: "de", AT: "de", LI: "de",
};

/** Renvoie un code ISO2 en majuscules, ou la valeur nettoyée si le pays est inconnu. */
export function normalizeCountryToIso2(countryRaw: string | null | undefined): string {
  if (!countryRaw || typeof countryRaw !== "string") return "";
  const trimmed = countryRaw.trim();
  if (!trimmed) return "";
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();

  const key = normalizeKey(trimmed);
  if (COUNTRY_NAME_TO_ISO2[key]) return COUNTRY_NAME_TO_ISO2[key];

  // « Paris, FR » ou « Abidjan, Côte d'Ivoire »
  const parts = key.split(" ");
  const last = parts[parts.length - 1];
  if (last && /^[a-z]{2}$/.test(last)) return last.toUpperCase();
  for (let i = 0; i < parts.length; i++) {
    const tail = parts.slice(i).join(" ");
    if (COUNTRY_NAME_TO_ISO2[tail]) return COUNTRY_NAME_TO_ISO2[tail];
  }
  return trimmed;
}

export function inferProspectLanguageFromCountry(
  countryRaw: string | undefined | null
): string {
  const iso = normalizeCountryToIso2(countryRaw);
  if (!/^[A-Z]{2}$/.test(iso)) return "en";
  return ISO2_TO_LANGUAGE[iso] ?? "en";
}

const SUPPORTED_LANGUAGES = new Set(["fr", "en", "es", "pt", "de", "ar", "it", "nl"]);

export function normalizeLanguage(value: string | null | undefined): string {
  const raw = (value || "").trim().toLowerCase().replace("_", "-");
  if (!raw) return "";
  if (raw === "auto") return "auto";
  const aliases: Record<string, string> = {
    french: "fr", francais: "fr", français: "fr",
    english: "en", anglais: "en",
    spanish: "es", espagnol: "es",
    portuguese: "pt", portugais: "pt",
    german: "de", allemand: "de",
    arabic: "ar", arabe: "ar",
  };
  if (aliases[raw]) return aliases[raw];
  const code = raw.slice(0, 2);
  return SUPPORTED_LANGUAGES.has(code) ? code : "";
}

/**
 * Langue d'un email : la langue fixée sur la campagne l'emporte ; en mode « auto »,
 * on prend celle du prospect, corrigée par le pays si elle vaut « en » par défaut.
 */
export function resolveCampaignLanguage(
  campaignLanguage: string | null | undefined,
  prospectLanguage: string | null | undefined,
  country: string | null | undefined
): string {
  const campaignLang = normalizeLanguage(campaignLanguage);
  if (campaignLang && campaignLang !== "auto") return campaignLang;

  const inferred = inferProspectLanguageFromCountry(country);
  const prospectLang = normalizeLanguage(prospectLanguage);
  if (!prospectLang || prospectLang === "auto") return inferred;
  // Beaucoup de prospects ont été importés avec « en » par défaut.
  if (prospectLang === "en" && inferred !== "en") return inferred;
  return prospectLang;
}
