/**
 * Devine la langue de prospection a partir du pays :
 * - code ISO alpha-2 (Google Maps via Apify: countryCode)
 * - ou nom de pays EN/FR comme dans la liste seed (financial-seed-list.ts)
 *
 * Valeurs correspondant au champ Prospect.language : en | fr | es | pt | de
 */
function normalizeCountryKey(country: string): string {
  return country
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ISO2_TO_LANGUAGE: Record<string, string> = {
  // Francais
  FR: "fr",
  MC: "fr",
  LU: "fr",
  BE: "fr",
  GF: "fr",
  GP: "fr",
  MQ: "fr",
  RE: "fr",
  YT: "fr",
  PM: "fr",
  BL: "fr",
  MF: "fr",
  WF: "fr",
  PF: "fr",
  NC: "fr",
  // Afrique francophone
  SN: "fr",
  CI: "fr",
  CM: "fr",
  ML: "fr",
  BF: "fr",
  NE: "fr",
  TG: "fr",
  BJ: "fr",
  GN: "fr",
  MG: "fr",
  CD: "fr",
  CG: "fr",
  GA: "fr",
  TD: "fr",
  BI: "fr",
  DJ: "fr",
  RW: "fr",
  CF: "fr",
  HT: "fr",
  // Maghreb : francais tres present en B2B
  MA: "fr",
  DZ: "fr",
  TN: "fr",
  // Espagnol
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  PE: "es",
  CL: "es",
  EC: "es",
  GT: "es",
  HN: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  BO: "es",
  PY: "es",
  UY: "es",
  VE: "es",
  CU: "es",
  DO: "es",
  PR: "es",
  // Portugais
  PT: "pt",
  BR: "pt",
  AO: "pt",
  MZ: "pt",
  GW: "pt",
  CV: "pt",
  ST: "pt",
  TL: "pt",
  // Allemand
  DE: "de",
  AT: "de",
  LI: "de",
  CH: "de",
};

/** Pays libelles (après normalizeCountryKey) -> langue probable B2B */
const COUNTRY_NAME_TO_LANGUAGE: Record<string, string> = {
  france: "fr",
  monaco: "fr",
  luxembourg: "fr",
  belgium: "fr",
  belgique: "fr",
  senegal: "fr",
  mali: "fr",
  "burkina faso": "fr",
  niger: "fr",
  togo: "fr",
  benin: "fr",
  guinea: "fr",
  cameroon: "fr",
  cameroun: "fr",
  "ivory coast": "fr",
  "cote d ivoire": "fr",
  "cote divoire": "fr",
  gabon: "fr",
  "republic of the congo": "fr",
  congo: "fr",
  "democratic republic of the congo": "fr",
  rwanda: "fr",
  burundi: "fr",
  djibouti: "fr",
  madagascar: "fr",
  haiti: "fr",
  morocco: "fr",
  maroc: "fr",
  algeria: "fr",
  algerie: "fr",
  tunisia: "fr",
  tunisie: "fr",
  mauritius: "en",
  spain: "es",
  espana: "es",
  mexico: "es",
  colombia: "es",
  argentina: "es",
  brazil: "pt",
  brasil: "pt",
  portugal: "pt",
  germany: "de",
  deutschland: "de",
  austria: "de",
  osterreich: "de",
  "united kingdom": "en",
  uk: "en",
  england: "en",
  usa: "en",
  us: "en",
  "united states": "en",
  netherlands: "en",
  singapore: "en",
  kenya: "en",
  nigeria: "en",
  "south africa": "en",
  india: "en",
  japan: "en",
  china: "en",
  italy: "en",
  italia: "en",
  switzerland: "en",
  schweiz: "en",
  suisse: "fr",
};

export function inferProspectLanguageFromCountry(
  countryRaw: string | undefined | null
): string {
  if (!countryRaw || typeof countryRaw !== "string") return "en";
  const trimmed = countryRaw.trim();
  if (!trimmed || trimmed.toUpperCase() === "UNKNOWN") return "en";

  if (/^[a-z]{2}$/i.test(trimmed)) {
    const c = trimmed.toUpperCase();
    return ISO2_TO_LANGUAGE[c] ?? "en";
  }

  const key = normalizeCountryKey(trimmed);
  if (key && COUNTRY_NAME_TO_LANGUAGE[key]) {
    return COUNTRY_NAME_TO_LANGUAGE[key];
  }

  /** Heuristique très courte (ex : "Paris, FR" avec nom long) */
  const tokens = key.split(/\s+/);
  const lastTok = tokens[tokens.length - 1];
  if (lastTok && /^[a-z]{2}$/i.test(lastTok)) {
    const c = lastTok.toUpperCase();
    if (ISO2_TO_LANGUAGE[c]) return ISO2_TO_LANGUAGE[c];
  }

  return "en";
}
