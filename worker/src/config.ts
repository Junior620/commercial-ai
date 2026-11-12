/**
 * Réglages du service de lecture des sites (variables d'environnement).
 * Aucune valeur secrète par défaut : sans WORKER_TOKEN, le service refuse de démarrer.
 */

const int = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
};

const env = (name: string) => process.env[name]?.trim() || "";

export const config = {
  port: int(process.env.PORT, 8090, 1, 65535),
  host: env("HOST") || "0.0.0.0",
  token: env("WORKER_TOKEN"),
  dataDir: env("DATA_DIR") || "./.worker-data",
  /** Sites lus en parallèle (une seule requête à la fois par site) */
  siteConcurrency: int(process.env.SITE_CONCURRENCY, 6, 1, 20),
  /** Pages de navigateur ouvertes en même temps */
  maxBrowserPages: int(process.env.MAX_BROWSER_PAGES, 4, 0, 8),
  /** « msedge » ou « chrome » pour utiliser un navigateur déjà installé (développement local) */
  browserChannel: env("BROWSER_CHANNEL"),
  maxRunningJobs: int(process.env.MAX_RUNNING_JOBS, 2, 1, 5),
  maxUrlsPerJob: 500,
  jobTtlMs: 24 * 60 * 60 * 1000,
  /** Délai minimal entre deux requêtes vers le même site */
  perHostDelayMs: int(process.env.PER_HOST_DELAY_MS, 1000, 0, 10_000),
  userAgent: "Mozilla/5.0 (compatible; SCPBProspectBot/1.0; +https://ste-scpb.com)",
  botName: "scpbprospectbot",
  brightdata: {
    token: env("BRIGHTDATA_API_TOKEN"),
    unlockerZone: env("BRIGHTDATA_UNLOCKER_ZONE"),
    serpZone: env("BRIGHTDATA_SERP_ZONE"),
  },
};

export const VERSION = "1.0.0";
