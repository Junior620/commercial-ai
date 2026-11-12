import { NonRetriableError } from "inngest";
import { inngest, EVENTS, type ScrapingRequestedData } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { APP_TIMEZONE } from "@/lib/time";
import {
  checkBounceCircuitBreaker,
  deliverEmail,
  getDailyQuota,
  getSendingSettings,
  pickSendableEmailIds,
  releaseStaleReservations,
  type DeliveryOutcome,
} from "@/lib/sending";
import { getConfigHealth } from "@/lib/config-health";
import { raiseAlert, resolveAlerts, type AlertKind } from "@/lib/alerts";
import {
  abortApifyRun,
  friendlyApifyError,
  getRunState,
  readEnrichmentRun,
  startEnrichmentRun,
  type EnrichmentKind,
} from "@/lib/apify";
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
  cleanEnrichment,
  fallbackBatch,
  fetchMapsPlaces,
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
  workerTargets,
  mergeWorkerResults,
  MAPS_PROVIDER_LABELS,
  type MapsProvider,
  type RunEntry,
} from "@/lib/scraping/pipeline";
import { brightDataConfigured } from "@/lib/brightdata";
import { cancelWorkerJob, getWorkerJob, startWorkerJob, workerConfigured, workerHealth } from "@/lib/scraping/worker-client";

const MAX_EMAILS_PER_BATCH = 20;

/** Échec définitif d'une tâche de fond : alerte visible sur le tableau de bord. */
function alertOnFailure(kind: AlertKind, label: string) {
  return async ({ error }: { error: Error }) => {
    await raiseAlert(kind, `${label} : ${error.message}`);
  };
}

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
    onFailure: alertOnFailure("send", "L'envoi des emails a échoué"),
  },
  async ({ step }) => {
    await step.run("release-stale", () => releaseStaleReservations());

    // Rien ne part tant que la configuration est incomplète (liens de désinscription, DMARC, webhook…).
    const config = await step.run("config-check", async () => {
      const { companyAddress } = await getSendingSettings();
      const health = await getConfigHealth({ companyAddress, deep: true });
      if (health.ready) {
        await resolveAlerts("config");
      } else {
        await raiseAlert("config", `Envois bloqués : ${health.blockers.map((b) => b.detail).join(" · ")}`);
      }
      return { ready: health.ready, blockers: health.blockers.map((b) => b.label) };
    });
    if (!config.ready) return { sent: 0, reason: "Configuration incomplète", blockers: config.blockers };

    const breaker = await step.run("bounce-check", () => checkBounceCircuitBreaker());
    if (breaker.tripped) return { sent: 0, reason: `Taux de rebond trop élevé (${breaker.rate.toFixed(1)} %)` };

    const plan = await step.run("plan-batch", async () => {
      const quota = await getDailyQuota();
      const { spacingSeconds } = await getSendingSettings();
      const ids = await pickSendableEmailIds(Math.min(quota.remaining, MAX_EMAILS_PER_BATCH));
      return { ids, spacingSeconds, remaining: quota.remaining };
    });

    if (plan.remaining <= 0) return { sent: 0, reason: "Limite quotidienne atteinte" };

    const outcomes: Record<DeliveryOutcome, number> = { sent: 0, skipped: 0, failed: 0, retry: 0, blocked: 0 };
    for (let i = 0; i < plan.ids.length; i++) {
      const outcome = await step.run(`deliver-${plan.ids[i]}`, () => deliverEmail(plan.ids[i]));
      outcomes[outcome]++;
      // Erreur de configuration : inutile d'essayer les suivants, une alerte a été levée.
      if (outcome === "blocked") break;
      if (outcome === "sent" && plan.spacingSeconds > 0 && i < plan.ids.length - 1) {
        await step.sleep(`spacing-${i}`, `${plan.spacingSeconds}s`);
      }
    }
    if (outcomes.sent > 0 && outcomes.blocked === 0) await step.run("resolve-send-alert", () => resolveAlerts("send"));
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
    onFailure: alertOnFailure("generate", "La préparation de la rédaction a échoué"),
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
    onFailure: alertOnFailure("generate", "La rédaction d'un email a échoué"),
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
    onFailure: alertOnFailure("generate", "La planification des relances a échoué"),
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
    onFailure: alertOnFailure("generate", "La rédaction d'une relance a échoué"),
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
      const message = friendlyApifyError(error.message);
      await markJobFailed(event.data.event.data.jobId, message);
      await raiseAlert("scraping", `La recherche de prospects a échoué : ${message}`);
    },
  },
  async ({ event, step }) => {
    const { jobId, keywords, countries, maxResults, includeOutOfScope } = event.data as ScrapingRequestedData;
    const L = SCRAPING_LIMITS;

    const warnings: string[] = [];
    const warn = (message: string | null | undefined) => {
      if (message && !warnings.includes(message)) warnings.push(message);
    };

    const stopIfCancelled = async (label: string, runs: RunEntry[] = []) => {
      const cancelled = await step.run(`cancel-check-${label}`, () => isJobCancelled(jobId));
      if (cancelled) {
        if (runs.length) await step.run(`abort-runs-${label}`, () => abortRuns(runs));
        return true;
      }
      return false;
    };

    // Phase 1 : Google Maps (lancement non bloquant, puis interrogation périodique)
    const collectMaps = async (tag: string, only?: MapsProvider) => {
      const runs = await step.run(`${tag}-start`, async () => {
        if (!only) {
          await persistProgress(jobId, {
            phase: "Préparation",
            percent: 3,
            detail: `${keywords.length} mot(s)-clé, ${countries.length ? `${countries.length} pays` : "sans filtre pays"}`,
          });
        }
        const started = await startMapsRuns(keywords, countries, maxResults, only);
        const sources = [...new Set(started.map((r) => MAPS_PROVIDER_LABELS[r.provider ?? "apify"]))].join(" + ");
        await persistProgress(jobId, {
          phase: "Recherche Google Maps",
          percent: 10,
          detail: `${started.length} recherche(s) lancée(s) par ${sources}`,
          runs: started,
        });
        return started;
      });

      for (let attempt = 0; attempt < L.mapsPoll.maxAttempts; attempt++) {
        if (await stopIfCancelled(`${tag}-${attempt}`, runs)) return null;
        const { done } = await step.run(`${tag}-poll-${attempt}`, () => pollMapsRuns(runs));
        if (done) break;
        if (attempt === L.mapsPoll.maxAttempts - 1) {
          await step.run(`${tag}-timeout`, () => abortRuns(runs));
          throw new NonRetriableError("Délai dépassé pour la recherche Google Maps");
        }
        await step.sleep(`${tag}-wait-${attempt}`, `${L.mapsPoll.intervalSeconds}s`);
      }

      const fetched = await step.run(`${tag}-fetch`, async () => {
        const result = await fetchMapsPlaces(runs);
        await persistProgress(jobId, {
          phase: "Résultats Google Maps",
          percent: 30,
          detail: `${result.places.length} fiche(s) récupérée(s)${result.errors.length ? ` (${result.errors.length} erreur(s))` : ""}`,
          runs,
        });
        return result;
      });
      return { runs, places: fetched.places, errors: fetched.errors };
    };

    let maps = await collectMaps("maps");
    if (!maps) return { cancelled: true };
    if (maps.places.length === 0 && maps.errors.length > 0) {
      // La source principale n'a renvoyé que des erreurs : on refait la recherche avec le secours.
      const apifyOnly = maps.runs.every((r) => (r.provider ?? "apify") === "apify");
      if (!apifyOnly || !brightDataConfigured() || countries.length === 0) {
        throw new NonRetriableError(maps.errors.map(friendlyApifyError).join(" | "));
      }
      warn(`Google Maps par Apify en échec (${friendlyApifyError(maps.errors[0])}) : recherche refaite par Bright Data`);
      maps = await collectMaps("maps-secours", "brightdata");
      if (!maps) return { cancelled: true };
      if (maps.places.length === 0 && maps.errors.length > 0) throw new NonRetriableError(maps.errors.join(" | "));
    }
    const runs = maps.runs;
    const places = maps.places;
    for (const run of runs) warn(run.note);
    const mapsSources = [...new Set(runs.map((r) => MAPS_PROVIDER_LABELS[r.provider ?? "apify"]))].join(" + ");

    // Phase 2 : lecture des sites par le service du VPS (emails, contact, téléphone, présentation)
    let sitesSource = "Apify";
    let enrichWithApify = true;
    const workerState = await step.run("worker-check", async () => (workerConfigured() ? workerHealth() : { ok: false, detail: "Non configuré" }));
    if (workerState.ok) {
      const urls = workerTargets(places, L.worker.maxSites);
      const started = await step.run("worker-start", async () => {
        if (await isJobCancelled(jobId)) return { id: null, cancelled: true, error: null };
        if (urls.length === 0) return { id: null, cancelled: false, error: null };
        await persistProgress(jobId, {
          phase: "Lecture des sites",
          percent: 40,
          detail: `${urls.length} site(s) confié(s) au service de lecture`,
          runs,
        });
        try {
          const id = await startWorkerJob(urls, {
            maxPagesPerSite: L.worker.maxPagesPerSite,
            render: true,
            maxUnlocker: L.brightdata.maxUnlocker,
            maxSerp: L.brightdata.maxSerp,
          });
          return { id, cancelled: false, error: null };
        } catch (e) {
          return { id: null, cancelled: false, error: e instanceof Error ? e.message : String(e) };
        }
      });
      if (started.cancelled) return { cancelled: true };

      if (urls.length === 0) {
        enrichWithApify = false;
        sitesSource = "aucun site à lire";
      } else if (!started.id) {
        warn(`Service de lecture (VPS) indisponible (${started.error ?? "démarrage refusé"}) : passes Apify utilisées`);
      } else {
        const workerJobId = started.id;
        let finished = false;
        for (let attempt = 0; attempt < L.worker.maxAttempts && !finished; attempt++) {
          await step.sleep(`worker-wait-${attempt}`, `${L.worker.pollSeconds}s`);
          const poll = await step.run(`worker-poll-${attempt}`, async () => {
            if (await isJobCancelled(jobId)) {
              await cancelWorkerJob(workerJobId);
              return "cancelled" as const;
            }
            try {
              const job = await getWorkerJob(workerJobId);
              const over = job.status === "done" || job.status === "failed" || job.status === "cancelled";
              if (!over) {
                await persistProgress(jobId, {
                  phase: "Lecture des sites",
                  percent: 40 + Math.round((40 * job.done) / Math.max(1, job.total)),
                  detail: `${job.done}/${job.total} site(s) lus · ${job.stats.withEmail} avec email`,
                  runs,
                });
              }
              return over ? ("finished" as const) : ("running" as const);
            } catch {
              return "unreachable" as const;
            }
          });
          if (poll === "cancelled") return { cancelled: true };
          finished = poll === "finished";
        }

        const read = await step.run("worker-read", async () => {
          try {
            if (!finished) await cancelWorkerJob(workerJobId);
            const job = await getWorkerJob(workerJobId, true);
            return { ok: true, results: job.results ?? [], stats: job.stats };
          } catch {
            return { ok: false, results: [], stats: null };
          }
        });
        if (read.ok && read.stats) {
          mergeWorkerResults(places, read.results);
          enrichWithApify = false;
          const paid = [
            read.stats.unlockerUsed ? `${read.stats.unlockerUsed} page(s) débloquée(s)` : "",
            read.stats.serpUsed ? `${read.stats.serpUsed} recherche(s) web` : "",
          ].filter(Boolean);
          sitesSource = `VPS (${read.results.length} site(s) lus${paid.length ? `, ${paid.join(", ")} par Bright Data` : ""})`;
          if (!finished) warn("Lecture des sites arrêtée après 30 minutes : résultats partiels");
        } else {
          warn("Service de lecture (VPS) injoignable en cours de traitement : passes Apify utilisées");
        }
      }
    } else if (workerConfigured()) {
      warn(`Service de lecture (VPS) injoignable (${workerState.detail}) : passes Apify utilisées`);
    }

    /**
     * Enrichissement par un traitement Apify : lancé, interrogé toutes les 30 s, puis lu.
     * Aucune étape n'attend la fin du traitement : une coupure ne relance donc rien de payant.
     * Un échec d'enrichissement n'arrête pas la recherche (les fiches restent sans email).
     */
    const enrich = async (
      kind: EnrichmentKind,
      key: string,
      payload: string[],
      progress: { phase: string; percent: number; detail: string }
    ): Promise<Record<string, string[]> | null> => {
      const started = await step.run(`${key}-start`, async () => {
        if (await isJobCancelled(jobId)) return { runId: null, error: null, cancelled: true };
        await persistProgress(jobId, { ...progress, runs });
        try {
          return { runId: await startEnrichmentRun(kind, payload), error: null, cancelled: false };
        } catch (e) {
          const message = friendlyApifyError(e instanceof Error ? e.message : String(e));
          console.error(`[scraping] ${key} :`, message);
          return { runId: null, error: message, cancelled: false };
        }
      });
      if (started.cancelled) return null;
      if (!started.runId) {
        warn(started.error);
        return {};
      }
      const runId = started.runId;

      for (let attempt = 0; attempt < L.enrichPoll.maxAttempts; attempt++) {
        await step.sleep(`${key}-wait-${attempt}`, `${L.enrichPoll.intervalSeconds}s`);
        const state = await step.run(`${key}-poll-${attempt}`, async () => {
          if (await isJobCancelled(jobId)) {
            await abortApifyRun(runId);
            return { done: true, cancelled: true };
          }
          const last = attempt === L.enrichPoll.maxAttempts - 1;
          const { done } = await getRunState(runId);
          // Délai dépassé : on arrête le traitement et on garde ce qu'il a déjà trouvé.
          if (!done && last) await abortApifyRun(runId);
          return { done: done || last, cancelled: false };
        });
        if (state.cancelled) return null;
        if (state.done) break;
      }

      return step.run(`${key}-read`, async () => {
        try {
          return cleanEnrichment(await readEnrichmentRun(kind, runId));
        } catch (e) {
          console.error(`[scraping] ${key} lecture :`, e);
          return {};
        }
      });
    };

    // Secours : passes Apify (pages contact, recherche web, contenu des sites), puis lecture directe
    const contactPhases = enrichWithApify ? [
      { key: "contact", kind: "contact" as const, source: "apify" as const, cfg: L.contact, percent: 40, label: "Pages contact des sites" },
      { key: "deep", kind: "deep-contact" as const, source: "deep-apify" as const, cfg: L.deepContact, percent: 50, label: "Exploration approfondie des sites" },
    ] : [];
    for (const phase of contactPhases) {
      const batches = chunk(sitesWithoutEmail(places, phase.cfg.maxSites), phase.cfg.chunk);
      for (const [i, urls] of batches.entries()) {
        const found = await enrich(phase.kind, `${phase.key}-${i}`, urls, {
          phase: phase.label,
          percent: phase.percent,
          detail: `Lot ${i + 1}/${batches.length}`,
        });
        if (!found) return { cancelled: true };
        mergeByDomain(places, found, phase.source);
      }
    }

    // Phase 4 : Google Search (emails vérifiés contre le domaine du site)
    const searchTargets = enrichWithApify ? places.filter((p) => p.emails.length === 0 && p.domain).slice(0, L.googleSearch.maxQueries) : [];
    for (const [i, batch] of chunk(searchTargets, L.googleSearch.chunk).entries()) {
      const results = await enrich("search", `google-${i}`, batch.map(googleSearchQuery), {
        phase: "Recherche web d'emails",
        percent: 60,
        detail: `Lot ${i + 1}`,
      });
      if (!results) return { cancelled: true };
      mergeGoogleResults(places, results);
    }

    // Phase 5 : Website Content Crawler
    const crawlerSites = enrichWithApify ? sitesWithoutEmail(places, L.websiteCrawler.maxSites) : [];
    for (const [i, urls] of chunk(crawlerSites, L.websiteCrawler.chunk).entries()) {
      const found = await enrich("content", `crawler-${i}`, urls, {
        phase: "Lecture du contenu des sites",
        percent: 70,
        detail: `Lot ${i + 1}`,
      });
      if (!found) return { cancelled: true };
      mergeByDomain(places, found, "web-crawler");
    }

    // Phase 6 : lecture directe (accueil, /contact, /about) + nom du contact
    const fallbackUrls = enrichWithApify
      ? [
          ...new Set(
            places
              .filter((p) => p.place.website && (p.emails.length === 0 || !p.contactName))
              .map((p) => p.place.website!)
          ),
        ].slice(0, L.fallback.maxSites)
      : [];
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
      const { created, withEmail, outOfScope, invalid } = await importPlaces(places, { includeOutOfScope });
      await prisma.scrapingJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: {
          status: "COMPLETED",
          resultsCount: created,
          completedAt: new Date(),
          progress: {
            phase: "Terminé",
            percent: 100,
            detail: `${created} prospect(s) créé(s) sur ${places.length} fiche(s) · ${withEmail} retenu(s) avec email${outOfScope ? ` · ${outOfScope} écarté(s) car hors cible (commerces, cafés, concurrents)` : ""}${invalid ? ` · ${invalid} adresse(s) invalide(s) écartée(s)` : ""} · Sources : Google Maps par ${mapsSources}, sites par ${sitesSource}${warnings.length ? ` · À noter : ${warnings.join(" ; ")}` : ""}`,
            runs,
            updatedAt: new Date().toISOString(),
          },
        },
      });
      await resolveAlerts("scraping");
      // Une bascule sur un secours reste signalée sur le tableau de bord jusqu'à ce qu'elle soit lue.
      if (warnings.length) await raiseAlert("scraping", `Recherche terminée avec un secours : ${warnings.join(" ; ")}`);
      return { created, places: places.length, withEmail, outOfScope, invalid, mapsSources, sitesSource };
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
