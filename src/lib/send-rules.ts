import { checkOutreachAllowed } from "@/lib/compliance";

/**
 * Règles d'envoi, sans accès à la base (testables).
 * Un email ne part que si TOUTES les conditions sont réunies.
 */

export interface SendCandidate {
  emailType: string; // INITIAL | FOLLOWUP_n
  approvedAt: Date | null;
  campaignStatus: string;
  prospect: {
    email: string;
    country: string | null;
    status: string;
    prospectType: string;
    targetFit: string;
    emailInvalidReason: string | null;
    lastContactedAt: Date | null;
  };
  suppressed: boolean;
  /** Dernier email envoyé à ce prospect dans CETTE campagne (pour distinguer une relance d'un nouveau contact) */
  contactedByThisCampaign: boolean;
  minDaysBetweenCampaigns: number;
  now?: Date;
}

export type SendDecision =
  | { send: true }
  /** hold : on réessaiera plus tard (l'email reste en attente) ; cancel : l'email ne partira jamais */
  | { send: false; action: "hold" | "cancel"; reason: string };

const DAY = 24 * 60 * 60 * 1000;

export function decideSend(c: SendCandidate): SendDecision {
  const now = c.now ?? new Date();
  const p = c.prospect;

  if (c.suppressed) return { send: false, action: "cancel", reason: "Adresse dans la liste d'exclusion" };
  if (p.status === "UNSUBSCRIBED" || p.status === "COLD") {
    return { send: false, action: "cancel", reason: "Prospect désinscrit ou à ne plus contacter" };
  }
  if (p.prospectType !== "COMMERCIAL") return { send: false, action: "cancel", reason: "Prospect hors périmètre commercial" };
  if (p.targetFit === "OUT_OF_SCOPE") return { send: false, action: "cancel", reason: "Prospect hors cible" };
  if (p.emailInvalidReason) return { send: false, action: "cancel", reason: `Adresse invalide : ${p.emailInvalidReason}` };

  const compliance = checkOutreachAllowed(p.email, p.country);
  if (!compliance.allowed) return { send: false, action: "cancel", reason: compliance.reason };
  // Pays à accord préalable : un seul message, pas de relance.
  if (compliance.strict && c.emailType !== "INITIAL") {
    return { send: false, action: "cancel", reason: "Pays à accord préalable : pas de relance" };
  }

  if (c.campaignStatus !== "ACTIVE") return { send: false, action: "hold", reason: "Campagne non active" };
  if (!c.approvedAt) return { send: false, action: "hold", reason: "Email non approuvé" };

  // Un prospect contacté récemment par une AUTRE campagne n'est pas resollicité tout de suite.
  if (
    c.emailType === "INITIAL" &&
    !c.contactedByThisCampaign &&
    p.lastContactedAt &&
    now.getTime() - p.lastContactedAt.getTime() < c.minDaysBetweenCampaigns * DAY
  ) {
    return { send: false, action: "hold", reason: "Prospect contacté récemment par une autre campagne" };
  }

  return { send: true };
}
