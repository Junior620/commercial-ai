import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "agent-commercial" });

/**
 * Message lisible quand une tâche n'a pas pu être confiée à Inngest.
 * La réponse d'Inngest ne contient aucun secret : on la montre pour savoir quoi corriger.
 */
export function queueErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const reason = raw.replace(/\s+/g, " ").slice(0, 200);
  if (process.env.NODE_ENV !== "production") {
    return `Les tâches de fond ne répondent pas (${reason}). En local, lancez « pnpm dev:jobs » puis réessayez.`;
  }
  if (/event key not found|401|403/i.test(raw)) {
    return `Inngest refuse la clé d'envoi (${reason}). Vérifiez INNGEST_EVENT_KEY dans Vercel (environnement Production), puis redéployez.`;
  }
  if (/event key|no key/i.test(raw)) {
    return `Clé d'envoi Inngest absente (${reason}). Ajoutez INNGEST_EVENT_KEY dans Vercel (Production), puis redéployez.`;
  }
  return `Les tâches de fond ne répondent pas (${reason}).`;
}

/** Noms des événements applicatifs. */
export const EVENTS = {
  sendRequested: "email/send.requested",
  generateRequested: "campaign/generate.requested",
  generateProspect: "campaign/generate.prospect",
  followUpRequested: "campaign/followup.requested",
  scrapingRequested: "scraping/requested",
} as const;

export interface ScrapingRequestedData {
  jobId: string;
  keywords: string[];
  countries: string[];
  maxResults: number;
  /** Importer aussi les fiches hors cible (commerces de détail, cafés…) */
  includeOutOfScope?: boolean;
}
