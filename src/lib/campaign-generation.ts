import { prisma } from "@/lib/prisma";
import { generateEmail, generateFollowUp, type EmailTone } from "@/lib/claude";
import { resolveCampaignLanguage } from "@/lib/prospect-language";
import { DO_NOT_CONTACT_STATUSES, TARGETABLE_STATUSES } from "@/lib/sending";
import { FOLLOW_UP_TYPES, SEQUENCE, computeDueFollowUps, type DueFollowUp } from "@/lib/followups";
import { CORE_PRODUCT_IDS, PRODUCT_LABELS } from "@/lib/product-catalog";
import { classifyTarget } from "@/lib/targeting";
import { checkOutreachAllowed, strictOptInCountries } from "@/lib/compliance";
import { validateEmailAddress } from "@/lib/email-validation";
import { companyKey } from "@/lib/dedup";
import {
  buildProspectWhereFromFilters,
  hasTargetingCriteria,
  normalizeSegmentFilters,
} from "@/lib/segment-filters-normalize";
import type { Prisma } from "@/generated/prisma/client";

export const MAX_TARGETS_PER_GENERATION = 2000;


export function sanitizeContactName(contact: string | null | undefined, company: string): string {
  const fallback = `${company} team`;
  const cleaned = (contact || "").trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return fallback;
  if (cleaned.includes("@") || /^\+?\d[\d\s\-().]{5,}$/.test(cleaned) || /^[\d@.]+$/.test(cleaned)) {
    return fallback;
  }
  // Le scraping renvoie parfois le nom de l'entreprise comme contact.
  if (cleaned.toLowerCase() === company.trim().toLowerCase()) return fallback;
  return cleaned;
}

function campaignProductLabel(product: string | null | undefined): string {
  if (!product || product === "all") return "fèves de cacao et produits dérivés (beurre, poudre, masse)";
  return PRODUCT_LABELS[product] || product;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

const COFFEE_PRODUCT_IDS = ["coffee_beans", "green_coffee", "ground_coffee", "instant_coffee"];
const RESELLER_TYPES = ["importer", "distributor", "wholesaler", "trader"];

/**
 * Critères de ciblage d'une campagne :
 * - jamais de prospects hors cible ;
 * - produit cacao précis (ex. beurre) : prospects qui en ont besoin, ou revendeurs B2B du cœur de cible ;
 * - café : prospects café uniquement ;
 * - gamme complète : cœur de cible et secondaires.
 */
export function buildCampaignTargetWhere(opts: {
  segmentId?: string | null;
  segmentFilters?: unknown;
  product?: string | null;
  /** Campagne en cours (absente pour un simple aperçu) */
  campaignId?: string | null;
  minDaysBetweenCampaigns?: number;
}): Prisma.ProspectWhereInput {
  let segmentWhere: Prisma.ProspectWhereInput = {};
  if (opts.segmentId) {
    const filters = normalizeSegmentFilters((opts.segmentFilters ?? {}) as Record<string, unknown>);
    segmentWhere = hasTargetingCriteria(filters)
      ? { OR: [buildProspectWhereFromFilters(filters), { segmentLinks: { some: { segmentId: opts.segmentId } } }] }
      : { segmentLinks: { some: { segmentId: opts.segmentId } } };
  }

  let productWhere: Prisma.ProspectWhereInput = {};
  const product = opts.product && opts.product !== "all" ? opts.product : null;
  if (product && (CORE_PRODUCT_IDS as readonly string[]).includes(product)) {
    productWhere = {
      OR: [
        { productNeeds: { has: product } },
        { product },
        { targetFit: "CORE", clientType: { in: RESELLER_TYPES } },
      ],
    };
  } else if (product && COFFEE_PRODUCT_IDS.includes(product)) {
    productWhere = {
      OR: [{ product: { in: COFFEE_PRODUCT_IDS } }, { sector: { contains: "coffee", mode: "insensitive" } }],
    };
  }

  const cutoff = new Date(Date.now() - (opts.minDaysBetweenCampaigns ?? 30) * 24 * 60 * 60 * 1000);
  const otherCampaign = opts.campaignId ? { campaignId: { not: opts.campaignId } } : {};

  return {
    AND: [
      segmentWhere,
      productWhere,
      {
        prospectType: "COMMERCIAL",
        targetFit: { not: "OUT_OF_SCOPE" },
        status: { in: TARGETABLE_STATUSES },
        emailInvalidReason: null,
        // Pas de sollicitation récente par une autre campagne…
        OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: cutoff } }],
        // …ni de séquence en cours ou prête à partir ailleurs.
        emails: {
          none: {
            ...otherCampaign,
            OR: [{ campaign: { status: "ACTIVE" } }, { status: { in: ["PENDING", "SENDING"] }, approvedAt: { not: null } }],
          },
        },
      },
    ],
  };
}

export interface TargetResolution {
  ids: string[];
  total: number;
  core: number;
  excluded: { strictCountry: number; duplicateDomain: number; suppressed: number };
}

/**
 * Résout la liste finale des prospects ciblés par une campagne :
 * critères en base, puis liste d'exclusion, pays à accord préalable (adresses génériques
 * uniquement) et un seul prospect par entreprise (domaine), le mieux noté.
 */
export async function resolveCampaignTargets(opts: {
  segmentId?: string | null;
  product?: string | null;
  campaignId?: string | null;
}): Promise<TargetResolution> {
  const [segment, settings] = await Promise.all([
    opts.segmentId ? prisma.segment.findUnique({ where: { id: opts.segmentId }, select: { filters: true } }) : null,
    prisma.appSettings.findUnique({ where: { id: "default" }, select: { minDaysBetweenCampaigns: true } }),
  ]);
  const where = buildCampaignTargetWhere({
    segmentId: opts.segmentId,
    segmentFilters: segment?.filters,
    product: opts.product,
    campaignId: opts.campaignId,
    minDaysBetweenCampaigns: settings?.minDaysBetweenCampaigns ?? 30,
  });

  const prospects = await prisma.prospect.findMany({
    where: opts.campaignId ? { AND: [where, { emails: { none: { campaignId: opts.campaignId, type: "INITIAL" } } }] } : where,
    select: { id: true, email: true, country: true, website: true, targetFit: true },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: MAX_TARGETS_PER_GENERATION,
  });

  const [suppressedRows, alreadyInCampaign] = await Promise.all([
    prisma.suppression.findMany({ where: { email: { in: prospects.map((p) => p.email.toLowerCase()) } }, select: { email: true } }),
    opts.campaignId
      ? prisma.prospect.findMany({
          where: { emails: { some: { campaignId: opts.campaignId } } },
          select: { email: true, website: true },
        })
      : [],
  ]);
  const suppressed = new Set(suppressedRows.map((s) => s.email));
  // Entreprises déjà présentes dans la campagne : on n'y ajoute pas un second contact.
  const seenCompanies = new Set(alreadyInCampaign.map((p) => companyKey(p)).filter(Boolean) as string[]);

  const excluded = { strictCountry: 0, duplicateDomain: 0, suppressed: 0 };
  const kept: typeof prospects = [];
  for (const p of prospects) {
    if (suppressed.has(p.email.toLowerCase())) {
      excluded.suppressed++;
      continue;
    }
    if (!checkOutreachAllowed(p.email, p.country).allowed) {
      excluded.strictCountry++;
      continue;
    }
    const key = companyKey(p);
    if (key && seenCompanies.has(key)) {
      excluded.duplicateDomain++;
      continue;
    }
    if (key) seenCompanies.add(key);
    kept.push(p);
  }

  return { ids: kept.map((p) => p.id), total: kept.length, core: kept.filter((p) => p.targetFit === "CORE").length, excluded };
}

/** Nombre de prospects qu'une campagne ciblerait (aperçu dans le formulaire). */
export async function countCampaignTargets(opts: { segmentId?: string | null; product?: string | null }) {
  const { total, core, excluded } = await resolveCampaignTargets(opts);
  return { total, core, excluded };
}

/** Prospects à qui générer un premier email pour cette campagne. */
export async function listGenerationTargets(campaignId: string): Promise<string[]> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, select: { segmentId: true, product: true } });
  if (!campaign) return [];
  return (await resolveCampaignTargets({ segmentId: campaign.segmentId, product: campaign.product, campaignId })).ids;
}

/** Génère et enregistre (PENDING) le premier email d'un prospect. Idempotent. */
export async function generateInitialEmail(campaignId: string, prospectId: string): Promise<"created" | "skipped"> {
  const [campaign, prospect] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.prospect.findUnique({ where: { id: prospectId } }),
  ]);
  if (!campaign || !prospect || DO_NOT_CONTACT_STATUSES.includes(prospect.status)) return "skipped";
  if (prospect.targetFit === "OUT_OF_SCOPE" || prospect.prospectType !== "COMMERCIAL") return "skipped";
  if (prospect.emailInvalidReason) return "skipped";
  const compliance = checkOutreachAllowed(prospect.email, prospect.country);
  if (!compliance.allowed) return "skipped";

  // Adresse vérifiée (syntaxe + MX) avant de dépenser une rédaction.
  if (!prospect.emailCheckedAt) {
    const verdict = await validateEmailAddress(prospect.email);
    if (!verdict.valid && !verdict.transient) {
      await prisma.prospect.update({
        where: { id: prospectId },
        data: { emailCheckedAt: new Date(), emailInvalidReason: verdict.reason },
      });
      return "skipped";
    }
    if (verdict.valid) await prisma.prospect.update({ where: { id: prospectId }, data: { emailCheckedAt: new Date() } });
  }

  const existing = await prisma.email.findFirst({
    where: { campaignId, prospectId, type: "INITIAL" },
    select: { id: true },
  });
  if (existing) return "skipped";

  const content = await generateEmail({
    prospectName: sanitizeContactName(prospect.contact, prospect.company),
    companyName: prospect.company,
    country: prospect.country,
    sector: prospect.sector || "",
    product: prospect.product || "",
    language: resolveCampaignLanguage(campaign.language, prospect.language, prospect.country),
    tone: campaign.tone as EmailTone,
    campaignProduct: campaignProductLabel(campaign.product),
    campaignProductId: campaign.product || "all",
    productNeeds: prospect.productNeeds,
    buyerType: classifyTarget({ title: prospect.company, categoryName: prospect.sector }).buyerType,
    sober: compliance.strict,
  });

  try {
    await prisma.email.create({
      data: {
        campaignId,
        prospectId,
        subject: content.subject,
        body: content.body,
        type: "INITIAL",
        status: "PENDING",
      },
    });
    return "created";
  } catch (err) {
    if (isUniqueViolation(err)) return "skipped";
    throw err;
  }
}

// ─── Relances ────────────────────────────────────────────────────

export type { DueFollowUp };

export async function listDueFollowUps(campaignId: string): Promise<DueFollowUp[]> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "ACTIVE") return [];

  const emails = await prisma.email.findMany({
    where: { campaignId },
    select: { prospectId: true, type: true, status: true, sentAt: true, repliedAt: true },
  });
  const prospectIds = [...new Set(emails.map((e) => e.prospectId))];
  const [blocked, replied, strictCandidates] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        id: { in: prospectIds },
        OR: [
          { status: { in: [...DO_NOT_CONTACT_STATUSES, "IN_DISCUSSION", "CONVERTED"] } },
          { targetFit: "OUT_OF_SCOPE" },
          { prospectType: { not: "COMMERCIAL" } },
          { emailInvalidReason: { not: null } },
        ],
      },
      select: { id: true },
    }),
    prisma.response.findMany({ where: { prospectId: { in: prospectIds } }, select: { prospectId: true } }),
    // Pays à accord préalable : un seul message, pas de relance.
    prisma.prospect.findMany({
      where: { id: { in: prospectIds }, country: { in: strictOptInCountries() } },
      select: { id: true },
    }),
  ]);
  const excluded = new Set([...blocked.map((p) => p.id), ...replied.map((r) => r.prospectId), ...strictCandidates.map((p) => p.id)]);

  return computeDueFollowUps(emails, {
    delayDays: campaign.followUpDelayDays,
    maxFollowUps: campaign.maxFollowUps,
    excludedProspectIds: excluded,
  });
}

/** Génère et enregistre une relance. Idempotent grâce à la contrainte d'unicité. */
export async function generateFollowUpEmail(
  campaignId: string,
  prospectId: string,
  followUpNumber: number
): Promise<"created" | "skipped"> {
  const type = FOLLOW_UP_TYPES[followUpNumber - 1];
  if (!type) return "skipped";

  const [campaign, prospect, previous] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.prospect.findUnique({ where: { id: prospectId } }),
    prisma.email.findFirst({
      where: { campaignId, prospectId, type: SEQUENCE[followUpNumber - 1] },
    }),
  ]);
  if (!campaign || !prospect || !previous) return "skipped";

  const content = await generateFollowUp({
    originalSubject: previous.subject,
    originalBody: previous.body,
    followUpNumber,
    prospectName: sanitizeContactName(prospect.contact, prospect.company),
    language: resolveCampaignLanguage(campaign.language, prospect.language, prospect.country),
    tone: campaign.tone as EmailTone,
  });

  try {
    await prisma.email.create({
      data: { campaignId, prospectId, subject: content.subject, body: content.body, type, status: "PENDING" },
    });
    return "created";
  } catch (err) {
    if (isUniqueViolation(err)) return "skipped";
    throw err;
  }
}
