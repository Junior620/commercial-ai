import { promises as dns } from "node:dns";

/**
 * Contrôle de la configuration nécessaire pour envoyer des emails sans danger.
 * Un contrôle « bloquant » en échec empêche d'activer une campagne et d'envoyer.
 */

export type CheckStatus = "ok" | "warning" | "error" | "unknown";

export interface ConfigCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** true : tant que ce contrôle échoue, aucun email ne part */
  blocking: boolean;
  detail: string;
}

export interface ConfigHealth {
  checks: ConfigCheck[];
  blockers: ConfigCheck[];
  ready: boolean;
}

const env = (name: string) => process.env[name]?.trim() || "";

function check(id: string, label: string, ok: boolean, blocking: boolean, okDetail: string, koDetail: string): ConfigCheck {
  return { id, label, status: ok ? "ok" : blocking ? "error" : "warning", blocking, detail: ok ? okDetail : koDetail };
}

/** Contrôles immédiats (variables d'environnement et réglages). */
export function staticChecks(opts: { companyAddress?: string | null }): ConfigCheck[] {
  const appUrl = env("NEXT_PUBLIC_APP_URL");
  const publicUrl = /^https:\/\//.test(appUrl) && !/localhost|127\.0\.0\.1/.test(appUrl);
  const address = opts.companyAddress?.trim() || env("COMPANY_ADDRESS");

  return [
    check("resend_key", "Clé Resend", !!env("RESEND_API_KEY"), true, "Configurée", "RESEND_API_KEY manquante : aucun email ne peut partir."),
    check("from", "Adresse d'expédition", /@/.test(env("RESEND_FROM_EMAIL")), true, env("RESEND_FROM_EMAIL"), "RESEND_FROM_EMAIL manquante."),
    check(
      "app_url",
      "Adresse publique de l'application",
      publicUrl,
      true,
      appUrl,
      `NEXT_PUBLIC_APP_URL doit être une adresse https publique (valeur actuelle : ${appUrl || "vide"}). Les liens de désinscription des emails en dépendent.`
    ),
    check(
      "unsubscribe_secret",
      "Secret des liens de désinscription",
      env("UNSUBSCRIBE_SECRET").length >= 16,
      true,
      "Configuré",
      "UNSUBSCRIBE_SECRET manquant (chaîne aléatoire d'au moins 16 caractères)."
    ),
    check(
      "postal_address",
      "Adresse postale en pied d'email",
      !!address,
      true,
      address,
      "Adresse postale de l'entreprise manquante (Paramètres > Mentions légales). Obligatoire, notamment pour les États-Unis."
    ),
    check(
      "webhook_secret",
      "Secret du webhook Resend",
      !!env("RESEND_WEBHOOK_SECRET"),
      true,
      "Configuré",
      "RESEND_WEBHOOK_SECRET manquant : les rebonds et plaintes ne seraient pas traités."
    ),
    check(
      "sender",
      "Identité de l'expéditeur",
      !!env("SENDER_NAME") && !!env("SENDER_COMPANY"),
      false,
      `${env("SENDER_NAME")} · ${env("SENDER_COMPANY")}`,
      "SENDER_NAME et SENDER_COMPANY recommandés pour la signature."
    ),
    check("anthropic", "Clé Anthropic (rédaction)", !!env("ANTHROPIC_API_KEY"), false, "Configurée", "ANTHROPIC_API_KEY manquante : la rédaction ne fonctionnera pas."),
    check(
      "inngest",
      "Tâches de fond (Inngest)",
      process.env.NODE_ENV !== "production" || (!!env("INNGEST_EVENT_KEY") && !!env("INNGEST_SIGNING_KEY")),
      false,
      process.env.NODE_ENV === "production" ? "Clés configurées" : "En local : lancer « pnpm dev:jobs »",
      "INNGEST_EVENT_KEY et INNGEST_SIGNING_KEY manquantes : ni envoi ni rédaction en production."
    ),
    check("apify", "Clé Apify (recherche)", !!env("APIFY_API_TOKEN"), false, "Configurée", "APIFY_API_TOKEN manquante : la recherche de prospects ne fonctionnera pas."),
  ];
}

async function txt(name: string): Promise<string[] | null> {
  try {
    return (await dns.resolveTxt(name)).map((parts) => parts.join(""));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENOTFOUND" || code === "ENODATA" ? [] : null; // null = vérification impossible
  }
}

/** Contrôles DNS du domaine d'envoi (DMARC, SPF, DKIM Resend). */
export async function dnsChecks(): Promise<ConfigCheck[]> {
  const domain = env("RESEND_FROM_EMAIL").split("@")[1];
  if (!domain) return [];
  const [dmarc, spfRoot, dkim] = await Promise.all([txt(`_dmarc.${domain}`), txt(`send.${domain}`), txt(`resend._domainkey.${domain}`)]);
  const unknown = (id: string, label: string): ConfigCheck => ({
    id,
    label,
    status: "unknown",
    blocking: false,
    detail: "Vérification DNS impossible pour le moment.",
  });

  const out: ConfigCheck[] = [];
  if (dmarc === null) out.push(unknown("dmarc", "DMARC"));
  else {
    const records = dmarc.filter((r) => /^v=DMARC1/i.test(r));
    out.push(
      records.length === 1
        ? { id: "dmarc", label: "DMARC", status: "ok", blocking: true, detail: records[0] }
        : {
            id: "dmarc",
            label: "DMARC",
            status: "error",
            blocking: true,
            detail:
              records.length === 0
                ? `Aucun enregistrement DMARC sur _dmarc.${domain}. Gmail et Yahoo l'exigent.`
                : `${records.length} enregistrements DMARC sur _dmarc.${domain} : il n'en faut qu'un seul, sinon DMARC est ignoré.`,
          }
    );
  }
  if (spfRoot === null) out.push(unknown("spf", "SPF (sous-domaine d'envoi)"));
  else
    out.push(
      check(
        "spf",
        "SPF (sous-domaine d'envoi)",
        spfRoot.some((r) => /^v=spf1/i.test(r)),
        false,
        `send.${domain} : présent`,
        `Aucun SPF sur send.${domain} : vérifiez le domaine dans Resend.`
      )
    );
  if (dkim === null) out.push(unknown("dkim", "DKIM Resend"));
  else out.push(check("dkim", "DKIM Resend", dkim.length > 0, true, "Présent", `Aucune clé DKIM sur resend._domainkey.${domain} : domaine non vérifié dans Resend.`));
  return out;
}

let reachCache: { url: string; ok: boolean; at: number } | null = null;

/** Le site public répond-il ? (les liens de désinscription et le webhook en dépendent) */
export async function reachabilityCheck(): Promise<ConfigCheck | null> {
  const appUrl = env("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
  if (!/^https:\/\//.test(appUrl)) return null;
  if (!reachCache || reachCache.url !== appUrl || Date.now() - reachCache.at > 5 * 60 * 1000) {
    let ok = false;
    try {
      const res = await fetch(`${appUrl}/unsubscribe`, { redirect: "manual", signal: AbortSignal.timeout(6000) });
      ok = res.status < 400;
    } catch {
      ok = false;
    }
    reachCache = { url: appUrl, ok, at: Date.now() };
  }
  return check(
    "reachable",
    "Site public joignable",
    reachCache.ok,
    true,
    `${appUrl} répond`,
    `${appUrl} ne répond pas : les liens de désinscription des emails seraient morts. Vérifiez le déploiement et le DNS.`
  );
}

/** Contrôle complet. `deep` ajoute les vérifications réseau (DNS, site joignable). */
export async function getConfigHealth(opts: { companyAddress?: string | null; deep?: boolean }): Promise<ConfigHealth> {
  const checks = staticChecks(opts);
  if (opts.deep) {
    const [dnsResults, reach] = await Promise.all([dnsChecks(), reachabilityCheck()]);
    if (reach) checks.splice(3, 0, reach);
    checks.push(...dnsResults);
  }
  const blockers = checks.filter((c) => c.blocking && c.status === "error");
  return { checks, blockers, ready: blockers.length === 0 };
}
