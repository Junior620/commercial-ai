import type { EmailStatus } from "@/generated/prisma/enums";

/** Ordre de progression d'un email envoyé. BOUNCED / FAILED sont terminaux. */
const RANK: Record<EmailStatus, number> = {
  PENDING: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  OPENED: 4,
  CLICKED: 5,
  REPLIED: 6,
  BOUNCED: 100,
  FAILED: 100,
};

export type CampaignCounter = "deliveredCount" | "openCount" | "clickCount" | "bounceCount";

export interface EmailEventState {
  status: EmailStatus;
  deliveredAt: Date | null;
  openedAt: Date | null;
  clickedAt: Date | null;
}

export interface EmailEventEffect {
  /** Champs à mettre à jour sur l'email (vide = rien à faire). */
  update: Partial<{ status: EmailStatus; deliveredAt: Date; openedAt: Date; clickedAt: Date }>;
  increments: CampaignCounter[];
  /** Adresse à ajouter à la liste de suppression. */
  suppress?: { reason: string; prospectStatus: "UNSUBSCRIBED" | "COLD" };
}

export function normalizeEventType(type: string | undefined): string {
  return (type || "").toLowerCase().replace(/^email\./, "");
}

/** Ne fait jamais régresser un statut (ex. « opened » reçu après « replied »). */
function promote(current: EmailStatus, target: EmailStatus): EmailStatus | null {
  if (RANK[current] >= 100) return null;
  return RANK[target] > RANK[current] ? target : null;
}

/**
 * Calcule l'effet d'un événement Resend sur un email, de façon idempotente
 * et indépendante de l'ordre d'arrivée des événements.
 */
export function computeEmailEventEffect(
  state: EmailEventState,
  eventType: string,
  opts: { bounceType?: string; now?: Date } = {}
): EmailEventEffect {
  const now = opts.now ?? new Date();
  const effect: EmailEventEffect = { update: {}, increments: [] };
  const evt = normalizeEventType(eventType);

  const setStatus = (target: EmailStatus) => {
    const next = promote(state.status, target);
    if (next) effect.update.status = next;
  };

  switch (evt) {
    case "sent":
    case "delivery_delayed":
      setStatus("SENT");
      break;

    case "delivered":
      setStatus("DELIVERED");
      if (!state.deliveredAt && RANK[state.status] < 100) {
        effect.update.deliveredAt = now;
        effect.increments.push("deliveredCount");
      }
      break;

    case "opened":
      setStatus("OPENED");
      if (!state.openedAt && RANK[state.status] < 100) {
        effect.update.openedAt = now;
        effect.increments.push("openCount");
      }
      break;

    case "clicked":
      setStatus("CLICKED");
      if (RANK[state.status] < 100) {
        if (!state.openedAt) {
          effect.update.openedAt = now;
          effect.increments.push("openCount");
        }
        if (!state.clickedAt) {
          effect.update.clickedAt = now;
          effect.increments.push("clickCount");
        }
      }
      break;

    case "bounced": {
      if (state.status !== "BOUNCED" && state.status !== "REPLIED") {
        effect.update.status = "BOUNCED";
        effect.increments.push("bounceCount");
      }
      const transient = (opts.bounceType || "").toLowerCase() === "transient";
      if (!transient) effect.suppress = { reason: "hard bounce", prospectStatus: "COLD" };
      break;
    }

    case "complained":
      effect.suppress = { reason: "spam complaint", prospectStatus: "UNSUBSCRIBED" };
      break;

    case "failed":
    case "canceled":
    case "suppressed":
      if (RANK[state.status] <= RANK.SENT) effect.update.status = "FAILED";
      if (evt === "suppressed") effect.suppress = { reason: "resend suppression list", prospectStatus: "COLD" };
      break;
  }

  return effect;
}
