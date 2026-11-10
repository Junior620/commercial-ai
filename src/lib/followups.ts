import type { EmailStatus, EmailType } from "@/generated/prisma/enums";

export const FOLLOW_UP_TYPES: EmailType[] = ["FOLLOWUP_1", "FOLLOWUP_2", "FOLLOWUP_3"];
export const SEQUENCE: EmailType[] = ["INITIAL", ...FOLLOW_UP_TYPES];

/** Statuts d'un email effectivement parti (sans dépendance à la base). */
const SENT: EmailStatus[] = ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED", "BOUNCED"];

export interface SequenceEmail {
  prospectId: string;
  type: EmailType;
  status: EmailStatus;
  sentAt: Date | null;
  repliedAt: Date | null;
}

export interface DueFollowUp {
  prospectId: string;
  followUpNumber: number;
}

/**
 * Détermine les relances à créer pour une campagne.
 * Une relance n n'est due que si l'email de rang n-1 est parti depuis au moins
 * `delayDays` jours, sans réponse, sans rebond, et qu'aucune étape suivante n'existe déjà.
 */
export function computeDueFollowUps(
  emails: SequenceEmail[],
  opts: { delayDays: number; maxFollowUps: number; now?: Date; excludedProspectIds?: Set<string> }
): DueFollowUp[] {
  const now = opts.now ?? new Date();
  const maxFollowUps = Math.min(Math.max(opts.maxFollowUps, 0), FOLLOW_UP_TYPES.length);
  if (maxFollowUps === 0) return [];

  const byProspect = new Map<string, SequenceEmail[]>();
  for (const e of emails) {
    const list = byProspect.get(e.prospectId) ?? [];
    list.push(e);
    byProspect.set(e.prospectId, list);
  }

  const due: DueFollowUp[] = [];
  for (const [prospectId, list] of byProspect) {
    if (opts.excludedProspectIds?.has(prospectId)) continue;
    if (list.some((e) => e.status === "REPLIED" || e.repliedAt || e.status === "BOUNCED")) continue;

    const last = list.reduce((a, b) => (SEQUENCE.indexOf(b.type) > SEQUENCE.indexOf(a.type) ? b : a));
    const stage = SEQUENCE.indexOf(last.type); // 0 = INITIAL
    if (stage >= maxFollowUps) continue;
    if (!last.sentAt || !SENT.includes(last.status)) continue;

    const dueAt = last.sentAt.getTime() + opts.delayDays * 24 * 60 * 60 * 1000;
    if (dueAt > now.getTime()) continue;

    due.push({ prospectId, followUpNumber: stage + 1 });
  }
  return due;
}

