# Cloudflare + Supabase Playbook (pour ce repo)

Ce document donne un plan d integration concret pour `agent-commercial`:

- Frontend/SSR Next.js conserve sur runtime Node (Vercel ou serveur Node)
- Cloudflare en couche edge (DNS, CDN, WAF, rate limiting)
- Supabase pour DB/Auth/Storage, avec pool transactionnel recommande

---

## 1) Architecture cible

```txt
Utilisateur
  -> Cloudflare (DNS proxied + WAF + cache static + rate-limit)
  -> App Next.js (Node runtime)
  -> Supabase (Postgres/Auth/Storage)
```

Objectif: ameliorer latence front + securite + couts reseau sans casser les routes lourdes.

---

## 2) Ce qu on garde cote Node (important)

Routes/API a garder sur runtime Node (pas edge worker):

- `POST /api/scraping`
- `GET/POST /api/financial-scraping`
- `POST /api/campaigns/[id]/generate`
- `POST /api/campaigns/[id]/send`
- toutes routes Prisma-heavy (`/api/prospects`, `/api/campaigns`, `/api/segments`, dashboard server components)

Raison: ces routes utilisent Prisma/pg, orchestrent scraping/IA, et sont plus stables en Node.

---

## 3) Phase 1 - Quick wins Cloudflare

## 3.1 DNS / SSL

1. Mettre le domaine en `Proxied` (orange cloud).
2. SSL/TLS mode: `Full (strict)`.
3. Activer `Always Use HTTPS`.
4. Activer `Automatic HTTPS Rewrites`.

## 3.2 Caching rules (Cloudflare dashboard)

### Rule A - Cache static assets agressif

- If:
  - URI Path starts with `/_next/static/`
  - OR URI Path starts with `/images/`
  - OR URI Path equals `/favicon.ico`
  - OR URI Path equals `/logo.png`
- Then:
  - Cache eligibility: `Eligible for cache`
  - Edge TTL: `1 month`
  - Browser TTL: `1 day` a `1 week`

### Rule B - Bypass API

- If URI Path starts with `/api/`
- Then Cache eligibility: `Bypass cache`

### Rule C - Bypass pages dashboard/auth

- If URI Path starts with `/login`
  - OR `/campaigns`
  - OR `/financial-campaigns`
  - OR `/prospects`
  - OR `/financial-prospects`
  - OR `/segments`
  - OR `/scraping`
  - OR `/financial-scraping`
  - OR `/sending`
  - OR `/responses`
  - OR `/settings`
- Then Cache eligibility: `Bypass cache`

Note: l app utilise beaucoup de contenu dynamique, ne pas mettre de cache HTML agressif.

## 3.3 WAF basique

Activer:

- Cloudflare Managed Ruleset
- OWASP Core Ruleset (mode observe ou block progressif)

Exceptions eventuelles:

- endpoints webhook legitimes (Resend/Inngest) si faux positifs

## 3.4 Rate limiting (routes couteuses)

Configurer des regles par IP (ajuster selon trafic reel):

- `POST /api/ai/generate`: 30 req / 5 min
- `POST /api/campaigns/*/generate`: 10 req / 5 min
- `POST /api/scraping`: 5 req / 10 min
- `POST /api/financial-scraping`: 5 req / 10 min
- `POST /api/campaigns/*/send`: 20 req / 5 min

Action recommandee: `Managed Challenge` ou `Block` selon risque.

---

## 4) Phase 2 - Workers (edge-friendly seulement)

Mettre en Workers uniquement des endpoints simples:

- health checks publics
- endpoints info/cache (lecture seule)
- webhooks legerement transforms
- petites APIs sans acces Prisma direct

Eviter pour le moment:

- scraping orchestration
- generation IA batch
- routes Prisma transactionnelles

Template inclus dans ce repo:

- `cloudflare/worker.ts`
- `cloudflare/wrangler.toml.example`

---

## 5) Supabase - points critiques DB

Pour reduire `EMAXCONNSESSION`:

1. Preferer URL pooler transactionnel Supabase pour l app Node.
2. Garder `DATABASE_POOL_MAX` bas:
   - dev: `1`
   - prod: `3` a `5` selon charge
3. Eviter plusieurs clients concurrents (plusieurs `pnpm dev`, Prisma Studio ouvert en continu, scripts lourds en meme temps).

Variables utiles:

```env
DATABASE_POOL_MAX=1
```

---

## 6) Plan de rollout (7 jours)

- J1: DNS proxied + SSL strict + HTTPS always
- J2: Caching rules (static cache + bypass api/dashboard)
- J3: WAF managed rules + observation logs
- J4: rate limit endpoints couteux
- J5: validation app (dashboard, scraping, campagnes)
- J6: un worker simple non critique
- J7: tuning TTL/rate limits selon analytics

---

## 7) Validation/KPI

Suivre avant/apres:

- erreurs DB `EMAXCONNSESSION`
- latence P95 page dashboard
- latence P95 endpoints generation/send
- cache hit ratio static (`/_next/static/*`)
- volume requetes bloquees par WAF/rate-limit

---

## 8) Troubleshooting rapide

- Si pages dynamiques affichent de vieilles donnees: verifier rule bypass sur routes dashboard/api.
- Si webhooks echouent: verifier WAF/rate-limit et ajouter exceptions ciblees.
- Si DB sature encore: verifier vraie URL DB utilisee + nombre de process Node actifs.

