import type { Browser } from "playwright-core";
import { isPrivateHost } from "../../src/lib/email-extractor";
import { config } from "./config";
import { assertPublicUrl } from "./guard";

/**
 * Navigateur sans fenêtre, pour les sites construits en JavaScript.
 * Lancé à la première utilisation ; si aucun navigateur n'est disponible,
 * le service continue en lecture simple.
 */

let browserPromise: Promise<Browser | null> | null = null;
let sandboxed = true;

async function launch(): Promise<Browser | null> {
  if (config.maxBrowserPages === 0) return null;
  try {
    const { chromium } = await import("playwright-core");
    const base = { headless: true, channel: config.browserChannel || undefined, args: ["--disable-dev-shm-usage", "--disable-gpu"] };
    try {
      return await chromium.launch(base);
    } catch (err) {
      // Dans un conteneur, le bac à sable de Chromium n'est pas toujours autorisé par le noyau.
      console.warn("[browser] lancement avec bac à sable impossible, nouvel essai sans :", err instanceof Error ? err.message.split("\n")[0] : err);
      sandboxed = false;
      return await chromium.launch({ ...base, chromiumSandbox: false });
    }
  } catch (err) {
    console.warn("[browser] navigateur indisponible :", err instanceof Error ? err.message.split("\n")[0] : err);
    return null;
  }
}

function getBrowser(): Promise<Browser | null> {
  if (!browserPromise) {
    browserPromise = launch().then((browser) => {
      browser?.on("disconnected", () => {
        browserPromise = null;
      });
      return browser;
    });
  }
  return browserPromise;
}

export async function browserStatus(): Promise<{ available: boolean; sandboxed: boolean }> {
  return { available: (await getBrowser()) !== null, sandboxed };
}

// ─── Nombre de pages limité ──────────────────────────────────────

let active = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (active < config.maxBrowserPages) {
    active++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function release(): void {
  const next = waiting.shift();
  if (next) next();
  else active--;
}

const SKIPPED_RESOURCES = new Set(["image", "media", "font", "stylesheet"]);

/** Rend une page dans le navigateur et renvoie son HTML final, ou "" en cas d'échec. */
export async function renderPage(url: string, timeoutMs = 25_000): Promise<string> {
  const browser = await getBrowser();
  if (!browser) return "";
  try {
    await assertPublicUrl(url);
  } catch {
    return "";
  }

  await acquire();
  const context = await browser.newContext({ userAgent: config.userAgent, locale: "en-US" }).catch(() => null);
  if (!context) {
    release();
    return "";
  }
  try {
    const page = await context.newPage();
    // Aucune requête vers une adresse interne, même déclenchée par la page elle-même.
    await page.route("**/*", (route) => {
      const request = route.request();
      let host = "";
      try {
        host = new URL(request.url()).hostname;
      } catch {
        return route.abort();
      }
      if (isPrivateHost(host) || SKIPPED_RESOURCES.has(request.resourceType())) return route.abort();
      return route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => undefined);
    return (await page.content()).slice(0, 1_500_000);
  } catch {
    return "";
  } finally {
    await context.close().catch(() => undefined);
    release();
  }
}

export async function closeBrowser(): Promise<void> {
  const browser = browserPromise ? await browserPromise.catch(() => null) : null;
  browserPromise = null;
  await browser?.close().catch(() => undefined);
}
