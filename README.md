# SCPB Commercial AI

Plateforme de prospection commerciale assistee par IA pour le secteur du cacao et de ses derives.

Cette application permet de:
- scraper automatiquement des prospects B2B (Apify + keywords CSV),
- enrichir et dedoublonner les donnees,
- segmenter les prospects,
- generer des emails commerciaux personnalises (Claude),
- envoyer des campagnes progressives (Resend),
- planifier des relances automatiques (Inngest),
- suivre les performances via un dashboard.

## 1) Stack technique

- Frontend: Next.js 16 (App Router), TypeScript, TailwindCSS, shadcn/ui
- Backend: Next.js API routes
- Base de donnees: PostgreSQL (Supabase) + Prisma 7
- IA: Anthropic Claude
- Scraping: Apify (Google Maps + Contact Info scraper)
- Emailing: Resend
- Jobs: Inngest
- Charts: Recharts

## 2) Fonctionnalites implementees

- Authentification (base Supabase client)
- Module prospects:
  - import CSV,
  - creation manuelle,
  - recherche, filtres, export
- Module scraping:
  - lecture des mots-cles depuis `data/cocoa_keywords_scraping.csv`,
  - lancement des jobs Apify,
  - extraction d'emails, scoring, deduplication
- Module segmentation:
  - segments personnalises,
  - segments predefinis,
  - liaison prospects <-> segments
- Module campagnes:
  - creation campagne,
  - generation IA des emails,
  - envoi par lot et suivi des statuts
- Module reponses:
  - affichage et classification (schema pret pour IA)
- Dashboard KPI:
  - volumes, taux ouverture/reponse, repartitions
- Parametres globaux:
  - limites envoi/jour, espacement, signature

## 3) Arborescence principale

```txt
src/
  app/
    (dashboard)/            # pages metier (dashboard, prospects, scraping...)
    api/                    # routes API
    login/
  components/
    dashboard/
    layout/
    prospects/
    ui/
  lib/
    apify.ts
    claude.ts
    dedup.ts
    email-extractor.ts
    inngest.ts
    prisma.ts
    resend.ts
    scoring.ts
    supabase/
  inngest/
    functions.ts
prisma/
  schema.prisma
data/
  cocoa_keywords_scraping.csv
```

## 4) Prerequis

- Node.js 20+ (recommande 22+)
- npm ou pnpm
- Un projet Supabase (PostgreSQL)
- Une cle API Apify
- Une cle API Anthropic
- Une cle API Resend + domaine configure
- (Optionnel) Inngest Cloud

## 5) Installation locale

```bash
# 1) Installer les dependances
npm install
# ou
pnpm install

# 2) Generer le client Prisma
npx prisma generate

# 3) Lancer le projet
npm run dev
# ou
pnpm dev
```

Application disponible sur `http://localhost:3000`.

## 6) Configuration environnement (.env)

Le fichier `.env.example` contient toutes les variables attendues:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

# Claude (Anthropic)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# OpenAI (fallback)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Apify
APIFY_API_TOKEN=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Notes importantes

- `DATABASE_URL` doit pointer vers ta base PostgreSQL Supabase.
- Sans `RESEND_API_KEY`, l'app ne casse pas, mais les envois sont simules.
- Sans `DATABASE_URL`, les routes base de donnees ne fonctionneront pas.
- Sans `ANTHROPIC_API_KEY`, le systeme bascule automatiquement sur OpenAI si `OPENAI_API_KEY` est disponible.
- Si `ANTHROPIC_API_KEY` et `OPENAI_API_KEY` sont absents, la generation IA echouera.
- Sans `APIFY_API_TOKEN`, le scraping ne pourra pas demarrer.

## 7) Base de donnees (Prisma + Supabase)

### 7.1 Generer le client

```bash
npx prisma generate
```

### 7.2 Creer les migrations

```bash
npx prisma migrate dev --name init
```

### 7.3 (Optionnel) Ouvrir Prisma Studio

```bash
npx prisma studio
```

Modele principal:
- `User`
- `Prospect`
- `Segment`
- `ProspectSegment`
- `Campaign`
- `Email`
- `Response`
- `ScrapingJob`
- `EmailTemplate`
- `AppSettings`

## 8) Workflow d'utilisation (metier)

### 8.1 Scraping
1. Aller sur `/scraping`
2. Choisir categories / pays / produit
3. Lancer le job
4. Les prospects dedoublonnes sont inseres en base avec score

### 8.2 Qualification prospects
1. Aller sur `/prospects`
2. Filtrer et verifier les leads
3. Ajuster les statuts/priorites si besoin

### 8.3 Segmentation
1. Aller sur `/segments`
2. Creer un segment custom ou predefini
3. Utiliser ce segment dans une campagne

### 8.4 Campagnes IA
1. Aller sur `/campaigns/new`
2. Configurer langue, ton, quotas, relances
3. Ouvrir la campagne
4. Cliquer "Generer emails IA"
5. Cliquer "Envoyer le lot"

### 8.5 Suivi et relances
- `/responses` pour voir les reponses
- `/sending` pour suivre la cadence d'envoi
- Inngest gere les relances planifiees

## 9) API routes principales

- `POST /api/scraping` - lancer scraping
- `GET /api/scraping` - liste jobs scraping
- `GET|POST /api/prospects`
- `POST /api/prospects/import`
- `GET|POST /api/segments`
- `GET|POST /api/campaigns`
- `GET|PATCH /api/campaigns/:id`
- `POST /api/campaigns/:id/generate`
- `POST /api/campaigns/:id/send`
- `POST /api/ai/generate`
- `GET /api/sending/stats`
- `POST /api/sending/batch`
- `GET|PUT /api/settings`
- `POST /api/webhooks/resend`
- `GET|POST|PUT /api/inngest`

## 10) Deploiement production

## 10.1 Architecture recommandee

- Front/API: Vercel
- DB/Auth: Supabase
- Email: Resend
- Jobs: Inngest Cloud
- Scraping: Apify

### 10.2 Deployer sur Vercel

1. Push le projet sur GitHub
2. Importer le repo dans Vercel
3. Definir toutes les variables d'environnement (meme valeurs que `.env`)
4. Build command:
   - `npx prisma generate && next build`
5. Output: automatique (Next.js)
6. Deploy

### 10.3 Variables Vercel obligatoires

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` (obligatoire si fallback voulu)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APIFY_API_TOKEN`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `NEXT_PUBLIC_APP_URL` (URL Vercel de prod)

### 10.4 Migration DB en production

Depuis CI/CD ou local:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 10.5 Webhooks a configurer

- Resend webhook -> `https://ton-domaine.com/api/webhooks/resend`
- Inngest endpoint -> `https://ton-domaine.com/api/inngest`

## 11) Securite et bonnes pratiques

- Ne jamais commit `.env`
- Limiter les quotas d'envoi pour la delivrabilite
- Configurer SPF, DKIM, DMARC sur le domaine expediteur
- Verifier legalite/rgpd des donnees selon ton pays cible
- Mettre un humain dans la boucle avant envoi massif

## 12) Commandes utiles

```bash
# Dev
npm run dev

# Lint
npm run lint

# Build
npm run build

# Prisma
npx prisma generate
npx prisma migrate dev --name init
npx prisma migrate deploy
npx prisma studio
```

## 13) Troubleshooting

- `pnpm.ps1 execution policy`
  - Sous PowerShell, utiliser:
    - `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- `DATABASE_URL is not set`
  - Renseigner `DATABASE_URL` dans `.env`
- `Missing API key` (Resend/Anthropic/Apify)
  - Ajouter les cles dans `.env`
- Build OK mais envois non effectifs
  - Verifier `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + domaine valide

## 14) Licence

Projet interne SCPB.
