import { isIP } from "node:net";
import { emailMatchesDomain, extractContactName, extractEmails, rankEmails } from "../../src/lib/email-extractor";
import { renderPage } from "./browser";
import { serpSearch, unlock } from "./brightdata";
import { fetchPage, type PageResult } from "./fetcher";
import { isPathAllowed, robotsFor } from "./robots";

export interface CrawlOptions {
  /** Pages lues par site, accueil compris */
  maxPagesPerSite: number;
  /** Autorise le navigateur pour les sites construits en JavaScript */
  render: boolean;
}

/** Crédit restant du job pour les appels payants (partagé entre tous les sites). */
export interface Budget {
  unlocker: number;
  serp: number;
}

export type Via = "direct" | "browser" | "unlocker" | "serp";

export interface SiteResult {
  url: string;
  domain: string | null;
  /** Adresses trouvées, la meilleure en premier */
  emails: string[];
  contactName: string | null;
  phone: string | null;
  description: string | null;
  pagesRead: number;
  /** Moyens qui ont réellement rapporté du contenu */
  via: Via[];
  /** Le site a refusé le service et n'a pas pu être débloqué */
  blocked: boolean;
  error: string | null;
}

// ─── Lecture du HTML (fonctions pures) ───────────────────────────

/** Adresse racine d'un site (« acme.fr/page » → « https://acme.fr »). */
export function siteRoot(raw: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

const LINK_PRIORITY: { pattern: RegExp; rank: number }[] = [
  { pattern: /contact|kontakt|contacto|contatt|nous-joindre|get-in-touch|reach-us/i, rank: 0 },
  { pattern: /impressum|imprint|mentions-legales|legal-notice|aviso-legal|colofon/i, rank: 1 },
  { pattern: /about|a-propos|qui-sommes|ueber-uns|uber-uns|over-ons|sobre|quienes-somos|chi-siamo|company|entreprise|unternehmen/i, rank: 2 },
  { pattern: /team|equipe|equipo|mitarbeiter|people|staff/i, rank: 3 },
];

/** Liens internes vers les pages où une entreprise publie ses coordonnées, les plus utiles d'abord. */
export function findContactLinks(html: string, base: string, max = 6): string[] {
  if (!html) return [];
  const origin = new URL(base).origin;
  const found = new Map<string, number>();
  const anchor = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null) {
    const href = match[1].trim();
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    const label = `${href} ${match[2].replace(/<[^>]+>/g, " ")}`;
    const priority = LINK_PRIORITY.find((p) => p.pattern.test(label));
    if (!priority) continue;
    try {
      const resolved = new URL(href, base);
      if (resolved.origin !== origin || /\.(pdf|jpe?g|png|zip|docx?)$/i.test(resolved.pathname)) continue;
      resolved.hash = "";
      const key = resolved.href;
      if (key === `${origin}/` || key === origin) continue;
      found.set(key, Math.min(found.get(key) ?? 9, priority.rank));
    } catch {
      // lien mal formé
    }
  }
  return [...found.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([url]) => url);
}

/** Pages habituelles, essayées quand l'accueil ne donne aucun lien utile. */
const DEFAULT_PATHS = ["/contact", "/contact-us", "/kontakt", "/impressum", "/about", "/a-propos"];

export function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** La page n'a presque pas de texte : son contenu est sans doute produit par JavaScript. */
export function needsRendering(html: string): boolean {
  if (!html) return true;
  const text = visibleText(html);
  if (text.length < 250) return true;
  return text.length < 800 && /<div[^>]+id=["'](root|app|__next|__nuxt)["']/i.test(html);
}

export function extractPhone(html: string): string | null {
  const tel = html.match(/href\s*=\s*["']tel:([+\d][\d\s().-]{6,22})["']/i);
  return tel ? tel[1].replace(/\s+/g, " ").trim() : null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** Courte présentation de l'activité (balise description, sinon titre). */
export function extractDescription(html: string): string | null {
  const meta =
    html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']{10,600})["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']{10,600})["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i);
  const title = html.match(/<title[^>]*>([^<]{3,200})<\/title>/i);
  const raw = meta?.[1] || title?.[1];
  return raw ? decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, 300) : null;
}

// ─── Parcours d'un site ──────────────────────────────────────────

const SITE_TIMEOUT_MS = 120_000;

export async function crawlSite(rawUrl: string, options: CrawlOptions, budget: Budget, isCancelled: () => boolean): Promise<SiteResult> {
  const root = siteRoot(rawUrl);
  const result: SiteResult = {
    url: rawUrl,
    domain: root ? new URL(root).hostname.replace(/^www\./, "").toLowerCase() : null,
    emails: [],
    contactName: null,
    phone: null,
    description: null,
    pagesRead: 0,
    via: [],
    blocked: false,
    error: null,
  };
  if (!root) {
    result.error = "Adresse invalide";
    return result;
  }

  const deadline = Date.now() + SITE_TIMEOUT_MS;
  const expired = () => isCancelled() || Date.now() > deadline;
  const emails = new Set<string>();
  const via = new Set<Via>();
  let sawBlock = false;
  let robotsRefused = false;
  let lastError: string | null = null;

  const absorb = (html: string, source: Via) => {
    if (!html) return false;
    result.pagesRead++;
    via.add(source);
    for (const email of extractEmails(html)) emails.add(email);
    result.contactName ??= extractContactName(html);
    result.phone ??= extractPhone(html);
    result.description ??= extractDescription(html);
    return true;
  };

  /** Lit une page : robots.txt, lecture simple, puis déblocage payant si le site refuse. */
  const readPage = async (url: string): Promise<{ html: string; page: PageResult | null }> => {
    const target = new URL(url);
    const rules = await robotsFor(target.origin);
    if (!isPathAllowed(rules, target.pathname + target.search)) {
      robotsRefused = true;
      return { html: "", page: null };
    }
    const page = await fetchPage(url);
    if (page.error) lastError = page.error;
    if (page.html) {
      absorb(page.html, "direct");
      return { html: page.html, page };
    }
    if (page.blocked) {
      sawBlock = true;
      if (budget.unlocker > 0) {
        budget.unlocker--;
        const unlocked = await unlock(url);
        if (absorb(unlocked, "unlocker")) return { html: unlocked, page };
      }
    }
    return { html: "", page };
  };

  try {
    // 1. Accueil : l'adresse donnée, puis avec ou sans « www », puis en http (site sans certificat)
    let home = await readPage(root);
    let base = root;
    const { host, hostname } = new URL(root);
    const isNamedHost = isIP(hostname.replace(/^\[|\]$/g, "")) === 0;
    const variants = [
      isNamedHost ? root.replace(host, host.startsWith("www.") ? host.slice(4) : `www.${host}`) : null,
      root.startsWith("https://") ? root.replace(/^https:/, "http:") : null,
    ].filter((v): v is string => !!v);
    for (const variant of variants) {
      if (home.html || home.page?.blocked || expired()) break;
      const retry = await readPage(variant);
      if (retry.html || retry.page?.blocked) {
        home = retry;
        base = variant;
      }
    }
    if (home.page?.finalUrl) {
      const final = siteRoot(home.page.finalUrl);
      if (final) base = final;
    }

    // 2. Pages de coordonnées
    const links = findContactLinks(home.html, base);
    const candidates = (links.length ? links : home.html || sawBlock ? DEFAULT_PATHS.map((p) => `${base}${p}`) : []).slice(
      0,
      Math.max(0, options.maxPagesPerSite - 1)
    );
    for (const link of candidates) {
      if (expired()) break;
      // Une adresse du domaine déjà trouvée et deux pages lues : inutile d'insister.
      if (result.pagesRead >= 2 && [...emails].some((e) => emailMatchesDomain(e, result.domain))) break;
      await readPage(link);
    }

    // 3. Navigateur, si le site est construit en JavaScript et qu'aucune adresse n'est sortie
    if (emails.size === 0 && options.render && !robotsRefused && !expired() && (needsRendering(home.html) || result.pagesRead === 0)) {
      for (const url of [base, ...candidates.slice(0, 1)]) {
        if (expired() || emails.size > 0) break;
        const rendered = await renderPage(url);
        if (absorb(rendered, "browser") && url === base && candidates.length === 0) {
          for (const link of findContactLinks(rendered, base, 2)) {
            if (expired() || emails.size > 0) break;
            absorb(await renderPage(link), "browser");
          }
        }
      }
    }

    // 4. Recherche web : seulement une adresse appartenant au domaine du site
    if (emails.size === 0 && result.domain && budget.serp > 0 && !expired()) {
      budget.serp--;
      const hits = await serpSearch(`"${result.domain}" email contact`);
      const found = hits
        .flatMap((hit) => extractEmails(`${hit.title} ${hit.description}`))
        .filter((email) => emailMatchesDomain(email, result.domain));
      if (found.length) {
        via.add("serp");
        for (const email of found) emails.add(email);
      }
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Erreur de lecture";
  }

  result.emails = rankEmails([...emails], result.domain ?? undefined).slice(0, 10);
  result.via = [...via];
  result.blocked = sawBlock && result.pagesRead === 0;
  if (!result.error && result.pagesRead === 0) {
    result.error = robotsRefused ? "Lecture interdite par robots.txt" : result.blocked ? "Site protégé contre les robots" : lastError || "Site illisible";
  }
  return result;
}
