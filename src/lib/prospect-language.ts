/**
 * Devine la langue de prospection a partir du code pays ISO 3166-1 alpha-2
 * renvoye par Google Maps / Apify. Les codes correspondent aux valeurs du
 * formulaire Prospects (en, fr, es, pt, de).
 */
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

export function inferProspectLanguageFromCountry(
  countryCode: string | undefined | null
): string {
  if (!countryCode || typeof countryCode !== "string") return "en";
  const c = countryCode.trim().toUpperCase();
  if (!c || c === "UNKNOWN") return "en";
  return ISO2_TO_LANGUAGE[c] ?? "en";
}
