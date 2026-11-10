import { prisma } from "@/lib/prisma";
import { startOfTodayInTimeZone } from "@/lib/time";
import { resolveCampaignLanguage } from "@/lib/prospect-language";
import {
  EmailSendError,
  buildEmailHtml,
  buildEmailText,
  buildUnsubscribeHeaders,
  sendEmail,
} from "@/lib/resend";
import type { EmailStatus, ProspectStatus } from "@/generated/prisma/enums";

/** Statuts d'un email effectivement parti. */
export const SENT_STATUSES: EmailStatus[] = ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED", "BOUNCED"];

/** Prospects à ne plus solliciter. */
export const DO_NOT_CONTACT_STATUSES: ProspectStatus[] = ["UNSUBSCRIBED", "COLD"];

/** Prospects éligibles à un premier email. */
export const TARGETABLE_STATUSES: ProspectStatus[] = ["NEW", "CONTACTED"];

/** Un email réservé depuis plus longtemps est considéré comme bloqué (crash du worker). */
const STALE_SENDING_MS = 30 * 60 * 1000;

export async function getSendingSettings() {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return {
    dailyLimit: Math.max(0, settings?.dailyEmailLimit ?? 50),
    spacingSeconds: Math.max(0, settings?.emailSpacingSeconds ?? 30),
    companyAddress: settings?.companyAddress ?? null,
  };
}

/** Quota global du jour (fuseau métier), partagé par toutes les campagnes. */
export async function getDailyQuota() {
  const { dailyLimit } = await getSendingSettings();
  const sentToday = await prisma.email.count({
    where: { sentAt: { gte: startOfTodayInTimeZone() }, status: { in: SENT_STATUSES } },
  });
  return { dailyLimit, sentToday, remaining: Math.max(0, dailyLimit - sentToday) };
}

export async function isSuppressed(email: string): Promise<boolean> {
  const row = await prisma.suppression.findUnique({ where: { email: email.trim().toLowerCase() } });
  return !!row;
}

/** Ajoute une adresse à la liste de suppression et marque le prospect. */
export async function suppressEmail(
  email: string,
  reason: string,
  prospectStatus: ProspectStatus = "UNSUBSCRIBED"
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await prisma.$transaction([
    prisma.suppression.upsert({
      where: { email: normalized },
      update: {},
      create: { email: normalized, reason },
    }),
    prisma.prospect.updateMany({
      where: { email: { equals: normalized, mode: "insensitive" } },
      data: { status: prospectStatus },
    }),
    // Les emails non encore partis vers cette adresse sont annulés.
    prisma.email.updateMany({
      where: {
        status: "PENDING",
        prospect: { email: { equals: normalized, mode: "insensitive" } },
      },
      data: { status: "FAILED" },
    }),
  ]);
}

/** Remet en file les emails restés « SENDING » après un crash. */
export async function releaseStaleReservations(): Promise<number> {
  const { count } = await prisma.email.updateMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(Date.now() - STALE_SENDING_MS) } },
    data: { status: "PENDING" },
  });
  return count;
}

/**
 * Sélectionne les prochains emails envoyables :
 * campagne ACTIVE, prospect joignable, hors liste de suppression,
 * dans la limite du quota global et du quota journalier de chaque campagne.
 */
export async function pickSendableEmailIds(max: number): Promise<string[]> {
  if (max <= 0) return [];

  const candidates = await prisma.email.findMany({
    where: {
      status: "PENDING",
      campaign: { status: "ACTIVE" },
      prospect: { status: { notIn: DO_NOT_CONTACT_STATUSES } },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
    },
    select: {
      id: true,
      campaignId: true,
      campaign: { select: { dailyLimit: true } },
      prospect: { select: { email: true } },
    },
    orderBy: [{ type: "desc" }, { createdAt: "asc" }], // relances d'abord, puis FIFO
    take: max * 4,
  });
  if (candidates.length === 0) return [];

  const emails = [...new Set(candidates.map((c) => c.prospect.email.toLowerCase()))];
  const suppressed = new Set(
    (await prisma.suppression.findMany({ where: { email: { in: emails } }, select: { email: true } })).map(
      (s) => s.email
    )
  );

  const sentTodayByCampaign = new Map<string, number>();
  const grouped = await prisma.email.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { in: [...new Set(candidates.map((c) => c.campaignId))] },
      sentAt: { gte: startOfTodayInTimeZone() },
      status: { in: SENT_STATUSES },
    },
    _count: { _all: true },
  });
  for (const g of grouped) sentTodayByCampaign.set(g.campaignId, g._count._all);

  const picked: string[] = [];
  const seenRecipients = new Set<string>();
  for (const c of candidates) {
    if (picked.length >= max) break;
    const recipient = c.prospect.email.toLowerCase();
    if (suppressed.has(recipient) || seenRecipients.has(recipient)) continue;
    const used = sentTodayByCampaign.get(c.campaignId) ?? 0;
    if (c.campaign.dailyLimit > 0 && used >= c.campaign.dailyLimit) continue;
    sentTodayByCampaign.set(c.campaignId, used + 1);
    seenRecipients.add(recipient);
    picked.push(c.id);
  }
  return picked;
}

export type DeliveryOutcome = "sent" | "skipped" | "failed" | "retry";

/**
 * Réserve puis envoie un email. Sûr en cas d'appels concurrents ou rejoués :
 * la réservation atomique PENDING → SENDING garantit un seul envoi,
 * et la clé d'idempotence Resend couvre les reprises après crash.
 */
export async function deliverEmail(emailId: string): Promise<DeliveryOutcome> {
  const reserved = await prisma.email.updateMany({
    where: { id: emailId, status: "PENDING" },
    data: { status: "SENDING" },
  });
  if (reserved.count !== 1) return "skipped";

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { prospect: true, campaign: true },
  });
  if (!email) return "skipped";

  const release = (status: EmailStatus) =>
    prisma.email.update({ where: { id: emailId }, data: { status } });

  // Dernières vérifications, au plus près de l'envoi.
  if (
    email.campaign.status !== "ACTIVE" ||
    DO_NOT_CONTACT_STATUSES.includes(email.prospect.status) ||
    (await isSuppressed(email.prospect.email))
  ) {
    await release(email.campaign.status !== "ACTIVE" ? "PENDING" : "FAILED");
    return "skipped";
  }

  const { companyAddress } = await getSendingSettings();
  const language = resolveCampaignLanguage(email.campaign.language, email.prospect.language, email.prospect.country);
  const contentOptions = { to: email.prospect.email, language, companyAddress };

  try {
    const result = await sendEmail({
      to: email.prospect.email,
      subject: email.subject,
      html: buildEmailHtml(email.body, contentOptions),
      text: buildEmailText(email.body, contentOptions),
      headers: buildUnsubscribeHeaders(email.prospect.email),
      idempotencyKey: email.id,
      tags: [
        { name: "app_email_id", value: email.id },
        { name: "campaign_id", value: email.campaignId },
      ],
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.email.update({
        where: { id: email.id },
        data: { status: "SENT", sentAt: now, resendId: result.id },
      }),
      prisma.campaign.update({
        where: { id: email.campaignId },
        data: { sentCount: { increment: 1 } },
      }),
      prisma.prospect.update({
        where: { id: email.prospectId },
        data: {
          lastContactedAt: now,
          ...(email.prospect.status === "NEW" ? { status: "CONTACTED" } : {}),
        },
      }),
    ]);
    return "sent";
  } catch (err) {
    const retryable = err instanceof EmailSendError ? err.retryable : true;
    console.error(`[sending] échec de l'email ${email.id} :`, err instanceof Error ? err.message : err);
    await release(retryable ? "PENDING" : "FAILED");
    return retryable ? "retry" : "failed";
  }
}
