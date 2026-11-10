import { NonRetriableError } from "inngest";
import { inngest, EVENTS, type ScrapingRequestedData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/time";
import {
  deliverEmail,
  getDailyQuota,
  getSendingSettings,
  pickSendableEmailIds,
  releaseStaleReservations,
} from "@/lib/sending";
import {
  generateFollowUpEmail,
  generateInitialEmail,
  listDueFollowUps,
  listGenerationTargets,
} from "@/lib/campaign-generation";
import {
  SCRAPING_LIMITS,
  abortRuns,
  chunk,
  contactInfoBatch,
  fallbackBatch,
  fetchMapsPlaces,
  googleSearchBatch,
  googleSearchQuery,
  importPlaces,
  isJobCancelled,
  markJobFailed,
  mergeByDomain,
  mergeFallback,
  mergeGoogleResults,
  persistProgress,
  pollMapsRuns,
  sitesWithoutEmail,
  startMapsRuns,
  websiteCrawlerBatch,
} from "@/lib/scraping/pipeline";

const MAX_EMAILS_PER_BATCH = 20;

// ─── Envoi ───────────────────────────────────────────────────────

/**
 * Seul chemin d'envoi de l'application : cron en heures ouvrées + déclenchement manuel.
 * Une seule exécution à la fois ; un step par email et une pause entre chaque envoi.
 */
export const sendPendingEmails = inngest.createFunction(
  {
    id: "send-pending-emails",
    name: "Envoi des emails en attente",
    concurrency: { limit: 1 },
    triggers: [{ cron: `TZ=${APP_TIMEZONE} */15 8-18 * * 1-5` }, { event: EVENTS.sendRequested }],
  },
  async ({ step }) => {
    await step.run("release-stale", () => releaseStaleReservations());

    const plan = await step.run("plan-batch", async () => {
      const quota = await getDailyQuota();
      const { spacingSeconds } = await getSendingSettings();
      const ids = await pickSendableEmailIds(Math.min(quota.remaining, MAX_EMAILS_PER_BATCH));
      return { ids, spacingSeconds, remaining: quota.remaining };
    });

    if (plan.remaining <= 0) return { sent: 0, reason: "Limite quotidienne atteinte" };

    const outcomes: Record<string, number> = { sent: 0, skipped: 0, failed: 0, retry: 0 };
    for (let i = 0; i < plan.ids.length; i++) {
      const outcome = await step.run(`deliver-${plan.ids[i]}`, () => deliverEmail(plan.ids[i]));
      outcomes[outcome]++;
      if (outcome === "sent" && plan.spacingSeconds > 0 && i < plan.ids.length - 1) {
        await step.sleep(`spacing-${i}`, `${plan.spacingSeconds}s`);
      }
    }
    return outcomes;
  }
);

// ─── Génération des premiers emails ──────────────────────────────

export const generateCampaignEmails = inngest.createFunction(
  {
    id: "generate-campaign-emails",
    name: "Génération IA d'une campagne",
    concurrency: { limit: 1, key: "event.data.campaignId" },
    triggers: [{ event: EVENTS.generateRequested }],
  },
  async ({ event, step }) => {
    const campaignId = String(event.data?.campaignId || "");
    if (!campaignId) throw new NonRetriableError("campaignId manquant");

    const targets = await step.run("list-targets", () => listGenerationTargets(campaignId));
    for (const [i, ids] of chunk(targets, 200).entries()) {
      await step.sendEvent(
        `fan-out-${i}`,
        ids.map((prospectId) => ({ name: EVENTS.generateProspect, data: { campaignId, prospectId } }))
      );
    }
    return { queued: targets.length };
  }
);

export const generateProspectEmail = inngest.createFunction(
  {
    id: "generate-prospect-email",
    name: "Génération IA d'un email",
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: EVENTS.generateProspect }],
  },
  async ({ event, step }) => {
    const { campaignId, prospectId } = event.data as { campaignId: string; prospectId: string };
    return step.run("generate", () => generateInitialEmail(campaignId, prospectId));
  }
);

// ─── Relances ────────────────────────────────────────────────────

export const scheduleFollowUps = inngest.createFunction(
  {
    id: "schedule-follow-ups",
    name: "Planification des relances",
    concurrency: { limit: 1 },
    triggers: [{ cron: `TZ=${APP_TIMEZONE} 0 8 * * 1-5` }],
  },
  async ({ step }) => {
    const campaigns = await step.run("active-campaigns", () =>
      prisma.campaign.findMany({ where: { status: "ACTIVE", maxFollowUps: { gt: 0 } }, select: { id: true } })
    );

    let queued = 0;
    for (const { id } of campaigns) {
      const due = await step.run(`due-${id}`, () => listDueFollowUps(id));
      for (const [i, batch] of chunk(due, 200).entries()) {
        await step.sendEvent(
          `followups-${id}-${i}`,
          batch.map((d) => ({ name: EVENTS.followUpRequested, data: { campaignId: id, ...d } }))
        );
      }
      queued += due.length;
    }
    return { campaigns: campaigns.length, queued };
  }
);

export const generateFollowUp = inngest.createFunction(
  {
    id: "generate-follow-up",
    name: "Génération IA d'une relance",
    concurrency: { limit: 5 },
    retries: 2,
    triggers: [{ event: EVENTS.followUpRequested }],
  },
  async ({ event, step }) => {
    const { campaignId, prospectId, followUpNumber } = event.data as {
      campaignId: string;
      prospectId: string;
      followUpNumber: number;
    };
    return step.run("generate", () => generateFollowUpEmail(campaignId, prospectId, followUpNumber));
  }
);

// ─── Scraping ────────────────────────────────────────────────────

export const runScrapingJob = inngest.createFunction(
  {
    id: "run-scraping-job",
    name: "Scraping de prospects",
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: EVENTS.scrapingRequested }],
    onFailure: async ({ event, error }: { event: { data: { event: { data: ScrapingRequestedData } } }; error: Error }) => {
      await markJobFailed(event.data.event.data.jobId, error.message);
    },
  },
  async ({ event, step }) => {
    const { jobId, keywords, countries, maxResults } = event.data as ScrapingRequestedData;
    const L = SCRAPING_LIMITS;

    const stopIfCancelled = async (label: string, runs: { runId: string; label: string }[] = []) => {
      const cancelled = await step.run(`cancel-check-${label}`, () => isJobCancelled(jobId));
      if (cancelled) {
        if (runs.length) await step.run(`abort-runs-${label}`, () => abortRuns(runs));
        return true;
      }
      return false;
    };

    // Phase 1 : Google Maps (lancement non bloquant, puis interrogation périodique)
    const runs = await step.run("maps-start", async () => {
      await persistProgress(jobId, {
        phase: "Préparation",
        percent: 3,
        detail: `${keywords.length} mot(s)-clé, ${countries.length ? `${countries.length} pays` : "sans filtre pays"}`,
      });
      const started = await startMapsRuns(keywords, countries, maxResults);
      await persistProgress(jobId, {
        phase: "Recherche Google Maps",
        percent: 10,
        detail: `${started.length} recherche(s) lancée(s)`,
        runs: started,
      });
      return started;
    });

    for (let attempt = 0; attempt < L.mapsPoll.maxAttempts; attempt++) {
      if (await stopIfCancelled(`maps-${attempt}`, runs)) return { cancelled: true };
      const { done } = await step.run(`maps-poll-${attempt}`, () => pollMapsRuns(runs));
      if (done) break;
      if (attempt === L.mapsPoll.maxAttempts - 1) {
        await step.run("maps-timeout", () => abortRuns(runs));
        throw new NonRetriableError("Délai dépassé pour la recherche Google Maps");
      }
      await step.sleep(`maps-wait-${attempt}`, `${L.mapsPoll.intervalSeconds}s`);
    }

    const maps = await step.run("maps-fetch", async () => {
      const result = await fetchMapsPlaces(runs);
      if (result.places.length === 0 && result.errors.length > 0) {
        throw new NonRetriableError(result.errors.join(" | "));
      }
      await persistProgress(jobId, {
        phase: "Résultats Google Maps",
        percent: 30,
        detail: `${result.places.length} fiche(s) récupérée(s)${result.errors.length ? ` (${result.errors.length} erreur(s))` : ""}`,
        runs,
      });
      return result;
    });
    const places = maps.places;

    // Phases 2 et 3 : Contact Info Scraper (standard puis approfondi)
    const contactPhases = [
      { key: "contact", source: "apify" as const, cfg: L.contact, percent: 40, label: "Pages contact des sites" },
      { key: "deep", source: "deep-apify" as const, cfg: L.deepContact, percent: 50, label: "Exploration approfondie des sites" },
    ];
    for (const phase of contactPhases) {
      const batches = chunk(sitesWithoutEmail(places, phase.cfg.maxSites), phase.cfg.chunk);
      for (const [i, urls] of batches.entries()) {
        if (await stopIfCancelled(`${phase.key}-${i}`)) return { cancelled: true };
        const found = await step.run(`${phase.key}-${i}`, async () => {
          await persistProgress(jobId, { phase: phase.label, percent: phase.percent, detail: `Lot ${i + 1}/${batches.length}`, runs });
          try {
            return await contactInfoBatch(urls, phase.cfg.requestsPerUrl);
          } catch (e) {
            console.error(`[scraping] ${phase.key} lot ${i} :`, e);
            return {};
          }
        });
        mergeByDomain(places, found, phase.source);
      }
    }

    // Phase 4 : Google Search (emails vérifiés contre le domaine du site)
    const searchTargets = places.filter((p) => p.emails.length === 0 && p.domain).slice(0, L.googleSearch.maxQueries);
    for (const [i, batch] of chunk(searchTargets, L.googleSearch.chunk).entries()) {
      if (await stopIfCancelled(`google-${i}`)) return { cancelled: true };
      const results = await step.run(`google-${i}`, async () => {
        await persistProgress(jobId, { phase: "Recherche web d'emails", percent: 60, detail: `Lot ${i + 1}`, runs });
        try {
          return await googleSearchBatch(batch.map(googleSearchQuery));
        } catch (e) {
          console.error(`[scraping] google lot ${i} :`, e);
          return {};
        }
      });
      mergeGoogleResults(places, results);
    }

    // Phase 5 : Website Content Crawler
    for (const [i, urls] of chunk(sitesWithoutEmail(places, L.websiteCrawler.maxSites), L.websiteCrawler.chunk).entries()) {
      if (await stopIfCancelled(`crawler-${i}`)) return { cancelled: true };
      const found = await step.run(`crawler-${i}`, async () => {
        await persistProgress(jobId, { phase: "Lecture du contenu des sites", percent: 70, detail: `Lot ${i + 1}`, runs });
        try {
          return await websiteCrawlerBatch(urls);
        } catch (e) {
          console.error(`[scraping] crawler lot ${i} :`, e);
          return {};
        }
      });
      mergeByDomain(places, found, "web-crawler");
    }

    // Phase 6 : lecture directe (accueil, /contact, /about) + nom du contact
    const fallbackUrls = [
      ...new Set(
        places
          .filter((p) => p.place.website && (p.emails.length === 0 || !p.contactName))
          .map((p) => p.place.website!)
      ),
    ].slice(0, L.fallback.maxSites);
    for (const [i, urls] of chunk(fallbackUrls, L.fallback.chunk).entries()) {
      if (await stopIfCancelled(`fallback-${i}`)) return { cancelled: true };
      const results = await step.run(`fallback-${i}`, async () => {
        await persistProgress(jobId, { phase: "Lecture directe des sites", percent: 80, detail: `Lot ${i + 1}`, runs });
        return fallbackBatch(urls);
      });
      mergeFallback(places, results);
    }

    // Phase 7 : import
    return step.run("import", async () => {
      if (await isJobCancelled(jobId)) return { cancelled: true };
      const { created, withEmail } = await importPlaces(places);
      await prisma.scrapingJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: {
          status: "COMPLETED",
          resultsCount: created,
          completedAt: new Date(),
          progress: {
            phase: "Terminé",
            percent: 100,
            detail: `${created} prospect(s) créé(s) sur ${places.length} fiche(s), ${withEmail} avec email`,
            runs,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      return { created, places: places.length, withEmail };
    });
  }
);

export const functions = [
  sendPendingEmails,
  generateCampaignEmails,
  generateProspectEmail,
  scheduleFollowUps,
  generateFollowUp,
  runScrapingJob,
];
