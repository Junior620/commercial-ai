/**
 * Contrôle d'un déploiement : à lancer après chaque mise en ligne.
 * Lecture seule, aucune donnée modifiée, aucun email envoyé.
 *
 * Usage :
 *   pnpm check-deploy                                   # adresse de NEXT_PUBLIC_APP_URL (.env)
 *   pnpm check-deploy -- https://commercial-ai.exemple.com
 */

import "dotenv/config";

const base = (process.argv.slice(2).find((a) => /^https?:\/\//.test(a)) || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");

type Probe = {
  label: string;
  path: string;
  init?: RequestInit;
  expect: (res: Response, body: string) => true | string;
};

const status = (...allowed: number[]) => (res: Response) =>
  allowed.includes(res.status) ? true : `statut ${res.status} (attendu : ${allowed.join(" ou ")})`;

const probes: Probe[] = [
  { label: "Page de connexion", path: "/login", expect: status(200) },
  {
    label: "En-têtes de sécurité",
    path: "/login",
    expect: (res) => {
      const missing = ["content-security-policy", "x-frame-options", "x-content-type-options"].filter((h) => !res.headers.get(h));
      if (missing.length) return `en-têtes absents : ${missing.join(", ")}`;
      return res.headers.get("x-powered-by") ? "l'en-tête x-powered-by est encore présent" : true;
    },
  },
  { label: "API protégée (401 sans session)", path: "/api/prospects", expect: status(401) },
  { label: "Tableau de bord protégé (redirection vers la connexion)", path: "/", init: { redirect: "manual" }, expect: status(307, 302) },
  {
    label: "Webhook Resend (refusé sans signature)",
    path: "/api/webhooks/resend",
    init: { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    expect: status(400, 401),
  },
  { label: "Page de désinscription", path: "/unsubscribe", expect: status(200) },
  {
    label: "Désinscription en un clic (jeton invalide refusé)",
    path: "/api/unsubscribe?t=invalide",
    init: { method: "POST" },
    expect: status(400),
  },
  {
    label: "Logo des emails",
    path: "/email-logo.png",
    expect: (res) => (res.status === 200 && (res.headers.get("content-type") || "").startsWith("image/") ? true : `statut ${res.status}`),
  },
  { label: "Point d'entrée Inngest", path: "/api/inngest", expect: status(200, 401) },
  { label: "Page de confirmation d'accès", path: "/auth/confirm", expect: status(200) },
];

async function main() {
  if (!/^https?:\/\//.test(base)) {
    throw new Error("Adresse manquante : passez-la en argument ou définissez NEXT_PUBLIC_APP_URL.");
  }
  console.log(`Contrôle de ${base}\n`);

  let failures = 0;
  for (const probe of probes) {
    let verdict: true | string;
    try {
      const res = await fetch(`${base}${probe.path}`, { ...probe.init, signal: AbortSignal.timeout(15000) });
      verdict = probe.expect(res, "");
    } catch (err) {
      verdict = err instanceof Error ? err.message : String(err);
    }
    if (verdict === true) console.log(`  OK      ${probe.label}`);
    else {
      failures++;
      console.log(`  ÉCHEC   ${probe.label} : ${verdict}`);
    }
  }

  console.log(failures === 0 ? "\nTout est en ordre." : `\n${failures} contrôle(s) en échec.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
