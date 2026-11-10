/** Libellés et couleurs partagés par toute l'interface (une seule source de vérité). */

export const PROSPECT_STATUS_LABELS: Record<string, string> = {
  NEW: "Nouveau",
  CONTACTED: "Contacté",
  IN_DISCUSSION: "En discussion",
  CONVERTED: "Client",
  COLD: "Ne plus contacter",
  UNSUBSCRIBED: "Désinscrit",
};

export const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
};

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  PENDING: "À relire",
  SENDING: "Envoi…",
  SENT: "Envoyé",
  DELIVERED: "Délivré",
  OPENED: "Ouvert",
  CLICKED: "Cliqué",
  REPLIED: "Répondu",
  BOUNCED: "Rebond",
  FAILED: "Échec / annulé",
};

export const EMAIL_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Premier contact",
  FOLLOWUP_1: "Relance 1",
  FOLLOWUP_2: "Relance 2",
  FOLLOWUP_3: "Relance 3",
};

export const SCRAPING_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  RUNNING: "En cours",
  COMPLETED: "Terminé",
  FAILED: "Échec",
  CANCELLED: "Annulé",
};

export const RESPONSE_CLASSIFICATION_LABELS: Record<string, string> = {
  POSITIVE: "Intéressé",
  INFO_REQUEST: "Demande d'informations",
  PRICE_REQUEST: "Demande de prix",
  MEETING_REQUEST: "Demande de rendez-vous",
  NEGATIVE: "Refus poli",
  NO_INTEREST: "Pas intéressé",
  UNSUBSCRIBE: "Désinscription",
  UNKNOWN: "À qualifier",
};

export const TONE_LABELS: Record<string, string> = {
  FORMAL: "Formel",
  FRIENDLY: "Chaleureux",
  TECHNICAL: "Technique",
  PREMIUM: "Premium",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Automatique (selon le pays)",
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
  pt: "Portugais",
  de: "Allemand",
  ar: "Arabe",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand" | "sun";

/** Classes Tailwind par tonalité (tokens de la charte, compatibles mode sombre). */
export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info/10 text-info border-info/25",
  success: "bg-success/10 text-success border-success/25",
  warning: "bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  brand: "bg-primary/10 text-primary border-primary/25",
  sun: "bg-sun/20 text-sun-foreground border-sun/40 dark:text-sun",
};

export const STATUS_TONES: Record<string, Tone> = {
  // Prospects
  NEW: "info",
  CONTACTED: "sun",
  IN_DISCUSSION: "brand",
  CONVERTED: "success",
  COLD: "neutral",
  UNSUBSCRIBED: "danger",
  // Priorités
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "neutral",
  // Campagnes
  DRAFT: "neutral",
  ACTIVE: "success",
  PAUSED: "warning",
  COMPLETED: "brand",
  // Emails
  PENDING: "sun",
  SENDING: "info",
  SENT: "info",
  DELIVERED: "brand",
  OPENED: "success",
  CLICKED: "success",
  REPLIED: "success",
  BOUNCED: "danger",
  FAILED: "danger",
  // Scraping
  RUNNING: "info",
  CANCELLED: "neutral",
};

export type LabelKind = "prospect" | "priority" | "campaign" | "email" | "scraping" | "response";

const LABELS_BY_KIND: Record<LabelKind, Record<string, string>> = {
  prospect: PROSPECT_STATUS_LABELS,
  priority: PRIORITY_LABELS,
  campaign: CAMPAIGN_STATUS_LABELS,
  email: EMAIL_STATUS_LABELS,
  scraping: SCRAPING_STATUS_LABELS,
  response: RESPONSE_CLASSIFICATION_LABELS,
};

export function statusLabel(kind: LabelKind, value: string | null | undefined): string {
  if (!value) return "—";
  return LABELS_BY_KIND[kind][value] ?? value;
}

/** Couleurs des graphiques, alignées sur la charte (variables CSS). */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];
