import { prisma } from "@/lib/prisma";
import { generateEmail, generateFollowUp, type EmailTone } from "@/lib/claude";
import { resolveCampaignLanguage } from "@/lib/prospect-language";
import { DO_NOT_CONTACT_STATUSES, TARGETABLE_STATUSES } from "@/lib/sending";
import { FOLLOW_UP_TYPES, SEQUENCE, computeDueFollowUps, type DueFollowUp } from "@/lib/followups";
import { PRODUCT_LABELS } from "@/lib/product-catalog";
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

/** Prospects à qui générer un premier email pour cette campagne. */
export async function listGenerationTargets(campaignId: string): Promise<string[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { segmentId: true, segment: { select: { filters: true } } },
  });
  if (!campaign) return [];

  // Segment : critères évalués à la volée (inclut les prospects ajoutés depuis sa création).
  let segmentWhere: Prisma.ProspectWhereInput = {};
  if (campaign.segmentId) {
    const filters = normalizeSegmentFilters((campaign.segment?.filters ?? {}) as Record<string, unknown>);
    segmentWhere = hasTargetingCriteria(filters)
      ? { OR: [buildProspectWhereFromFilters(filters), { segmentLinks: { some: { segmentId: campaign.segmentId } } }] }
      : { segmentLinks: { some: { segmentId: campaign.segmentId } } };
  }

  const prospects = await prisma.prospect.findMany({
    where: {
      AND: [
        segmentWhere,
        {
          prospectType: "COMMERCIAL",
          status: { in: TARGETABLE_STATUSES },
          emails: { none: { campaignId, type: "INITIAL" } },
        },
      ],
    },
    select: { id: true, email: true },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: MAX_TARGETS_PER_GENERATION,
  });

  const suppressed = new Set(
    (
      await prisma.suppression.findMany({
        where: { email: { in: prospects.map((p) => p.email.toLowerCase()) } },
        select: { email: true },
      })
    ).map((s) => s.email)
  );
  return prospects.filter((p) => !suppressed.has(p.email.toLowerCase())).map((p) => p.id);
}

/** Génère et enregistre (PENDING) le premier email d'un prospect. Idempotent. */
export async function generateInitialEmail(campaignId: string, prospectId: string): Promise<"created" | "skipped"> {
  const [campaign, prospect] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.prospect.findUnique({ where: { id: prospectId } }),
  ]);
  if (!campaign || !prospect || DO_NOT_CONTACT_STATUSES.includes(prospect.status)) return "skipped";

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
  const [blocked, replied] = await Promise.all([
    prisma.prospect.findMany({
      where: { id: { in: prospectIds }, status: { in: [...DO_NOT_CONTACT_STATUSES, "IN_DISCUSSION", "CONVERTED"] } },
      select: { id: true },
    }),
    prisma.response.findMany({ where: { prospectId: { in: prospectIds } }, select: { prospectId: true } }),
  ]);
  const excluded = new Set([...blocked.map((p) => p.id), ...replied.map((r) => r.prospectId)]);

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
