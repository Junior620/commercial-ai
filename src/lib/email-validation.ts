import { promises as dns } from "node:dns";

/**
 * Vérification d'une adresse avant de lui écrire : syntaxe, domaines jetables ou factices,
 * et présence d'un serveur de messagerie (enregistrement MX) sur le domaine.
 * Réduit les rebonds, qui abîment la réputation du domaine expéditeur.
 */

const SYNTAX = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

const BLOCKED_DOMAINS = new Set([
  "example.com", "example.org", "example.net", "test.com", "domain.com", "email.com", "yourdomain.com", "sentry.io",
  "wixpress.com", "mailinator.com", "yopmail.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "trashmail.com",
  "sharklasers.com", "getnada.com", "maildrop.cc",
]);

const BLOCKED_LOCAL = /^(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce|bounces|abuse|unsubscribe|privacy|dpo|gdpr|rgpd)$/i;

export type EmailCheck = { valid: true } | { valid: false; reason: string; transient?: boolean };

export function checkEmailSyntax(email: string): EmailCheck {
  const value = email.trim().toLowerCase();
  if (!SYNTAX.test(value) || value.includes("..")) return { valid: false, reason: "Adresse mal formée" };
  const [local, domain] = value.split("@");
  if (BLOCKED_DOMAINS.has(domain)) return { valid: false, reason: "Domaine factice ou jetable" };
  if (BLOCKED_LOCAL.test(local)) return { valid: false, reason: "Adresse technique (no-reply, abuse…)" };
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(domain)) return { valid: false, reason: "Faux positif (nom de fichier)" };
  return { valid: true };
}

type MxResult = { ok: boolean; reason?: string; transient?: boolean; at: number };
const mxCache = new Map<string, MxResult>();
const MX_TTL_MS = 6 * 60 * 60 * 1000;

async function lookupMx(domain: string): Promise<MxResult> {
  const cached = mxCache.get(domain);
  if (cached && Date.now() - cached.at < MX_TTL_MS) return cached;

  let result: MxResult;
  try {
    const records = await dns.resolveMx(domain);
    const usable = records.filter((r) => r.exchange && r.exchange !== ".");
    result = usable.length ? { ok: true, at: Date.now() } : { ok: false, reason: "Le domaine ne reçoit pas d'emails (MX nul)", at: Date.now() };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      // Pas de MX : certains domaines reçoivent sur leur enregistrement A (rare). On vérifie qu'il existe.
      try {
        await dns.resolve4(domain);
        result = { ok: true, at: Date.now() };
      } catch (e) {
        const c = (e as NodeJS.ErrnoException).code;
        result =
          c === "ENOTFOUND" || c === "ENODATA"
            ? { ok: false, reason: "Le domaine n'existe pas ou ne reçoit pas d'emails", at: Date.now() }
            : { ok: false, reason: "Vérification du domaine impossible pour le moment", transient: true, at: Date.now() };
      }
    } else {
      // Panne DNS, délai dépassé… : on ne condamne pas l'adresse.
      result = { ok: false, reason: "Vérification du domaine impossible pour le moment", transient: true, at: Date.now() };
    }
  }
  if (!result.transient) mxCache.set(domain, result);
  return result;
}

/** Vérification complète. Une panne DNS renvoie `transient: true` : à réessayer, sans rejeter l'adresse. */
export async function validateEmailAddress(email: string): Promise<EmailCheck> {
  const syntax = checkEmailSyntax(email);
  if (!syntax.valid) return syntax;
  const domain = email.trim().toLowerCase().split("@")[1];
  const mx = await lookupMx(domain);
  if (mx.ok) return { valid: true };
  return { valid: false, reason: mx.reason ?? "Domaine invalide", transient: mx.transient };
}

/** Vérifie une liste d'adresses avec une concurrence limitée. */
export async function validateEmailAddresses(emails: string[], concurrency = 8): Promise<Map<string, EmailCheck>> {
  const out = new Map<string, EmailCheck>();
  const queue = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let email = queue.shift(); email; email = queue.shift()) {
        out.set(email, await validateEmailAddress(email));
      }
    })
  );
  return out;
}
