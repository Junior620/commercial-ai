import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "agent-commercial" });

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
