import { prisma } from "@/lib/prisma";
import { parseSerpOrganic, type SerpResult } from "@/lib/serp";
import { isStrictOptInCountry } from "@/lib/compliance";
import { normalizeCompanyName } from "@/lib/dedup";

/**
 * Décideurs d'une entreprise prospect (achats, approvisionnement, direction), trouvés à la demande.
 *
 * Méthode : recherche Google limitée aux profils LinkedIn publics, via Bright Data (SERP),
 * puis lecture du nom et du poste dans le titre des résultats.
 * Règles : aucune adresse email n'est devinée ; indisponible dans les pays à accord préalable ;
 * réservé au cœur de cible ; 3 contacts au plus par entreprise.
 */

export const MAX_CONTACTS_PER_PROSPECT = 3;

/** Postes recherchés, par ordre d'intérêt pour un fournisseur de fèves et dérivés de cacao. */
const ROLE_PATTERNS: { pattern: RegExp; rank: number }[] = [
  { pattern: /\b(purchas|procure|buyer|sourcing|supply chain|category manager|raw material)/i, rank: 0 },
  { pattern: /\b(achat|acheteu|approvisionnement|sourcing)/i, rank: 0 },
  { pattern: /\b(einkauf|beschaffung|eink[äa]ufer)/i, rank: 0 },
  { pattern: /\b(compras|aprovisionamiento|inkoop|acquisti)/i, rank: 0 },
  { pattern: /\b(r&d|research|product development|recherche|d[ée]veloppement produit|innovation)/i, rank: 1 },
  { pattern: /\b(production|plant manager|operations|usine|responsable de production)/i, rank: 2 },
  { pattern: /\b(ceo|founder|co-founder|owner|managing director|general manager|g[ée]rant|fondat|pr[ée]sident|directeur g[ée]n[ée]ral|gesch[äa]ftsf[üu]hrer|inhaber|director general)/i, rank: 3 },
];

export function roleRank(title: string | null | undefined): number | null {
  if (!title) return null;
  const hit = ROLE_PATTERNS.find((r) => r.pattern.test(title));
  return hit ? hit.rank : null;
}

export function decisionMakerQuery(company: string): string {
  const name = company.replace(/["“”]/g, "").trim();
  return `site:linkedin.com/in "${name}" (purchasing OR procurement OR buyer OR sourcing OR achats OR einkauf OR compras OR "managing director" OR CEO OR founder)`;
}

export interface FoundContact {
  name: string;
  title: string | null;
  linkedinUrl: string;
  rank: number;
}

/** Adresse publique d'un profil LinkedIn (sans paramètres), ou null si ce n'en est pas un. */
export function linkedinProfileUrl(link: string): string | null {
  try {
    const url = new URL(link);
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/in\/([^/?#]+)/i);
    return match ? `https://www.linkedin.com/in/${decodeURIComponent(match[1]).toLowerCase()}` : null;
  } catch {
    return null;
  }
}

/**
 * Lit « Prénom Nom - Poste - Entreprise | LinkedIn » (séparateurs variables).
 * Renvoie null si le résultat ne nomme pas l'entreprise recherchée.
 */
export function parseLinkedinResult(result: SerpResult, company: string): FoundContact | null {
  const linkedinUrl = linkedinProfileUrl(result.link);
  if (!linkedinUrl) return null;

  const cleaned = result.title.replace(/\s*[|·]\s*LinkedIn.*$/i, "").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+[-–—|]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const name = parts[0];
  // Un vrai nom : 2 à 4 mots, sans chiffres ni mots de poste.
  const words = name.split(" ");
  if (words.length < 2 || words.length > 4 || /\d/.test(name) || roleRank(name) !== null || name.length > 60) return null;

  const target = normalizeCompanyName(company);
  const haystack = normalizeCompanyName(`${cleaned} ${result.description}`);
  const significant = target.split(" ").filter((w) => w.length >= 3);
  if (!target || (significant.length ? !significant.every((w) => haystack.includes(w)) : !haystack.includes(target))) return null;

  const title = parts
    .slice(1)
    .filter((p) => normalizeCompanyName(p) !== target)
    .join(" · ")
    .slice(0, 160) || null;
  const rank = roleRank(`${title ?? ""} ${result.description}`);
  if (rank === null) return null;
  return { name, title, linkedinUrl, rank };
}

/** Garde les meilleurs contacts distincts, par ordre d'intérêt. */
export function pickContacts(results: SerpResult[], company: string, max = MAX_CONTACTS_PER_PROSPECT): FoundContact[] {
  const seen = new Set<string>();
  return results
    .map((r) => parseLinkedinResult(r, company))
    .filter((c): c is FoundContact => c !== null)
    .filter((c) => (seen.has(c.linkedinUrl) ? false : (seen.add(c.linkedinUrl), true)))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, max);
}

// ─── Recherche ───────────────────────────────────────────────────

const serpZone = () => process.env.BRIGHTDATA_SERP_ZONE?.trim() || "";
const token = () => process.env.BRIGHTDATA_API_TOKEN?.trim() || "";

export const decisionMakersConfigured = () => !!(token() && serpZone());

export type Eligibility = { ok: true } | { ok: false; reason: string };

export function checkEligibility(p: { targetFit: string; country: string | null; status: string; prospectType: string }): Eligibility {
  if (p.prospectType !== "COMMERCIAL") return { ok: false, reason: "Réservé aux prospects commerciaux." };
  if (p.targetFit !== "CORE") return { ok: false, reason: "Réservé aux prospects cœur de cible." };
  if (p.status === "UNSUBSCRIBED" || p.status === "COLD") return { ok: false, reason: "Ce prospect ne souhaite plus être contacté." };
  if (isStrictOptInCountry(p.country)) {
    return { ok: false, reason: "Pays à accord préalable : seules les adresses génériques de l'entreprise sont utilisées." };
  }
  return { ok: true };
}

async function searchGoogle(query: string): Promise<SerpResult[]> {
  const params = new URLSearchParams({ q: query, hl: "en", num: "20", brd_json: "1" });
  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone: serpZone(), url: `https://www.google.com/search?${params}`, format: "raw" }),
  });
  if (!response.ok) {
    const detail = response.status === 401 ? "clé Bright Data refusée" : `réponse ${response.status}`;
    throw new Error(`Recherche impossible (${detail}).`);
  }
  return parseSerpOrganic(JSON.parse(await response.text()));
}

/** Cherche et enregistre les décideurs d'un prospect. Remplace les contacts trouvés précédemment. */
export async function findDecisionMakers(prospectId: string): Promise<{ contacts: FoundContact[] }> {
  if (!decisionMakersConfigured()) throw new Error("BRIGHTDATA_API_TOKEN et BRIGHTDATA_SERP_ZONE doivent être configurés.");
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
    select: { company: true, targetFit: true, country: true, status: true, prospectType: true },
  });
  if (!prospect) throw new Error("Prospect introuvable");
  const eligibility = checkEligibility(prospect);
  if (!eligibility.ok) throw new Error(eligibility.reason);

  const contacts = pickContacts(await searchGoogle(decisionMakerQuery(prospect.company)), prospect.company);
  await prisma.$transaction([
    prisma.prospectContact.deleteMany({ where: { prospectId } }),
    ...(contacts.length
      ? [
          prisma.prospectContact.createMany({
            data: contacts.map((c) => ({ prospectId, name: c.name, title: c.title, linkedinUrl: c.linkedinUrl })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);
  return { contacts };
}
