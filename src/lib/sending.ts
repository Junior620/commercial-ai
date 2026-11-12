import { prisma } from "@/lib/prisma";
import { startOfTodayInTimeZone } from "@/lib/time";
import { resolveCampaignLanguage } from "@/lib/prospect-language";
import { EmailSendError, buildEmailHtml, buildEmailText, buildUnsubscribeHeaders, sendEmail } from "@/lib/resend";
import { decideSend } from "@/lib/send-rules";
import { validateEmailAddress } from "@/lib/email-validation";
import { raiseAlert } from "@/lib/alerts";
import type { EmailStatus, ProspectStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

/** Statuts d'un email effectivement parti. */
export const SENT_STATUSES: EmailStatus[] = ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED", "BOUNCED"];

/** Prospects à ne plus solliciter. */
export const DO_NOT_CONTACT_STATUSES: ProspectStatus[] = ["UNSUBSCRIBED", "COLD"];

/** Prospects éligibles à un premier email. */
export const TARGETABLE_STATUSES: ProspectStatus[] = ["NEW", "CONTACTED"];

/** Un email réservé depuis plus longtemps est considéré comme bloqué (crash du worker). */
const STALE_SENDING_MS = 30 * 60 * 1000;
/** Une adresse est revérifiée (MX) au-delà de ce délai. */
const EMAIL_CHECK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export async function getSendingSettings() {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return {
    dailyLimit: Math.max(0, settings?.dailyEmailLimit ?? 50),
    spacingSeconds: Math.max(0, settings?.emailSpacingSeconds ?? 30),
    companyAddress: settings?.companyAddress ?? null,
    minDaysBetweenCampaigns: Math.max(0, settings?.minDaysBetweenCampaigns ?? 30),
    bounceThresholdPct: settings?.alertBouncePctThreshold ?? 5,
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
 * Coupe-circuit : si trop d'emails rebondissent sur 7 jours, toutes les campagnes
 * actives passent en pause, le temps de nettoyer les listes.
 */
export async function checkBounceCircuitBreaker(): Promise<{ tripped: boolean; rate: number }> {
  const since = new Date(Date.now() - 7 * DAY);
  const [sent, bounced, { bounceThresholdPct }] = await Promise.all([
    prisma.email.count({ where: { sentAt: { gte: since }, status: { in: SENT_STATUSES } } }),
    prisma.email.count({ where: { sentAt: { gte: since }, status: "BOUNCED" } }),
    getSendingSettings(),
  ]);
  const rate = sent > 0 ? (bounced / sent) * 100 : 0;
  if (sent < 20 || rate < bounceThresholdPct) return { tripped: false, rate };

  const { count } = await prisma.campaign.updateMany({ where: { status: "ACTIVE" }, data: { status: "PAUSED" } });
  await raiseAlert(
    "bounce",
    `Envois suspendus : ${rate.toFixed(1)} % de rebonds sur 7 jours (seuil ${bounceThresholdPct} %). ${count} campagne(s) mise(s) en pause. Vérifiez la qualité des adresses avant de reprendre.`
  );
  return { tripped: true, rate };
}

/** Clause commune : emails qui peuvent partir (approuvés, campagne active, prospect joignable et dans la cible). */
function sendableWhere(minDaysBetweenCampaigns: number): Prisma.EmailWhereInput {
  const cutoff = new Date(Date.now() - minDaysBetweenCampaigns * DAY);
  return {
    status: "PENDING",
    approvedAt: { not: null },
    campaign: { status: "ACTIVE" },
    prospect: {
      status: { notIn: DO_NOT_CONTACT_STATUSES },
      prospectType: "COMMERCIAL",
      targetFit: { not: "OUT_OF_SCOPE" },
      emailInvalidReason: null,
    },
    AND: [
      { OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }] },
      // Premier contact : pas si le prospect vient d'être sollicité (par une autre campagne).
      { OR: [{ type: { not: "INITIAL" } }, { prospect: { OR: [{ lastContactedAt: null }, { lastContactedAt: { lt: cutoff } }] } }] },
    ],
  };
}

/**
 * Sélectionne les prochains emails envoyables, dans la limite du quota global
 * et du quota journalier de chaque campagne. Un seul email par destinataire.
 */
export async function pickSendableEmailIds(max: number): Promise<string[]> {
  if (max <= 0) return [];
  const { minDaysBetweenCampaigns } = await getSendingSettings();

  const candidates = await prisma.email.findMany({
    where: sendableWhere(minDaysBetweenCampaigns),
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
    (await prisma.suppression.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((s) => s.email)
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

export type DeliveryOutcome = "sent" | "skipped" | "failed" | "retry" | "blocked";

/**
 * Réserve puis envoie un email. Sûr en cas d'appels concurrents ou rejoués :
 * la réservation atomique PENDING → SENDING garantit un seul envoi,
 * et la clé d'idempotence Resend couvre les reprises après crash.
 * Toutes les règles d'envoi sont revérifiées au dernier moment (voir send-rules.ts).
 */
export async function deliverEmail(emailId: string): Promise<DeliveryOutcome> {
  const reserved = await prisma.email.updateMany({
    where: { id: emailId, status: "PENDING", approvedAt: { not: null } },
    data: { status: "SENDING" },
  });
  if (reserved.count !== 1) return "skipped";

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { prospect: true, campaign: true },
  });
  if (!email) return "skipped";

  const release = (status: EmailStatus) => prisma.email.update({ where: { id: emailId }, data: { status } });
  const settings = await getSendingSettings();

  const [suppressed, previousInCampaign] = await Promise.all([
    isSuppressed(email.prospect.email),
    prisma.email.count({ where: { campaignId: email.campaignId, prospectId: email.prospectId, sentAt: { not: null } } }),
  ]);
  const decision = decideSend({
    emailType: email.type,
    approvedAt: email.approvedAt,
    campaignStatus: email.campaign.status,
    prospect: email.prospect,
    suppressed,
    contactedByThisCampaign: previousInCampaign > 0,
    minDaysBetweenCampaigns: settings.minDaysBetweenCampaigns,
  });
  if (!decision.send) {
    await release(decision.action === "hold" ? "PENDING" : "FAILED");
    return "skipped";
  }

  // Vérification de l'adresse (MX) si elle n'a pas été contrôlée récemment.
  const checkedAt = email.prospect.emailCheckedAt?.getTime() ?? 0;
  if (Date.now() - checkedAt > EMAIL_CHECK_TTL_MS) {
    const verdict = await validateEmailAddress(email.prospect.email);
    if (!verdict.valid && verdict.transient) {
      await release("PENDING");
      return "retry";
    }
    await prisma.prospect.update({
      where: { id: email.prospectId },
      data: { emailCheckedAt: new Date(), emailInvalidReason: verdict.valid ? null : verdict.reason },
    });
    if (!verdict.valid) {
      await release("FAILED");
      return "failed";
    }
  }

  const language = resolveCampaignLanguage(email.campaign.language, email.prospect.language, email.prospect.country);
  const contentOptions = { to: email.prospect.email, language, companyAddress: settings.companyAddress };

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
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sending] échec de l'email ${email.id} :`, message);
    if (err instanceof EmailSendError) {
      // Refus de Resend : temporaire (429, 5xx) → on réessaiera ; définitif → cet email est abandonné.
      await release(err.retryable ? "PENDING" : "FAILED");
      return err.retryable ? "retry" : "failed";
    }
    // Autre erreur (configuration incomplète…) : l'email reste en attente et le lot s'arrête.
    await release("PENDING");
    await raiseAlert("send", `Envoi interrompu : ${message}`);
    return "blocked";
  }
}
