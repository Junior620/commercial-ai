# SCPB Commercial

Outil interne de prospection B2B pour la filière cacao : recherche d'acheteurs (chocolatiers, importateurs,
industriels), rédaction assistée d'emails dans la langue de chaque prospect, envoi progressif et suivi.

## Fonctionnement

1. **Recherche de prospects** : Google Maps, puis lecture des sites pour trouver les emails publics.
   Chaque étape a une source principale et un secours :
   - Google Maps par Apify ; si Apify refuse de démarrer ou échoue, Bright Data prend le relais ;
   - lecture des sites par le service installé sur le VPS (`worker/`), qui passe par Bright Data pour les
     sites qui refusent les robots et pour une recherche web quand un site reste sans adresse ;
   - si le VPS ne répond pas, les passes Apify d'origine s'exécutent.
   Score de 0 à 100, dédoublonnage, adresses vérifiées. Le résumé de chaque recherche indique les sources utilisées.
2. **Segments** : critères (pays, activité, produit, score…) évalués à la volée.
3. **Campagne** : l'assistant (Claude) rédige un email par prospect. **Chaque email doit être approuvé**
   (un par un, par page ou en bloc) : activer une campagne n'approuve rien. Un email modifié doit être
   approuvé à nouveau. Un seul contact par entreprise, et pas de nouveau premier contact avant 30 jours
   (réglable) si une autre campagne vient d'écrire au prospect.
4. **Envoi** : automatique en heures ouvrées (lun.–ven., 8 h–19 h, heure de Douala), quota quotidien global,
   espacement entre emails, un seul envoi garanti par email. Avant chaque lot : contrôle de la configuration
   et du taux de rebond (au-delà du seuil sur 7 jours, les campagnes passent en pause).
5. **Relances** : calculées depuis le dernier email envoyé, arrêtées dès qu'une réponse est enregistrée.
   Elles sont rédigées automatiquement mais attendent elles aussi une approbation.
6. **Conformité** : lien de désinscription en un clic (en-têtes `List-Unsubscribe`), adresse postale et
   source des données en pied d'email, liste d'exclusion alimentée par les désinscriptions, plaintes et
   rebonds définitifs. Les adresses sont vérifiées (syntaxe et serveur de messagerie du domaine) à l'import,
   avant la rédaction et avant l'envoi. Dans les pays à accord préalable (`STRICT_OPTIN_COUNTRIES`, par
   défaut Allemagne, Espagne, Pays-Bas), seules les adresses génériques d'entreprise sont contactées, avec
   un message court et sans relance. Cette règle n'est pas un avis juridique : à confirmer avec un conseil.

## Stack

| Rôle | Outil |
|---|---|
| Application | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) |
| Données | PostgreSQL (Supabase) + Prisma 7 |
| Authentification | Supabase Auth, accès sur invitation, rôles |
| Rédaction | Anthropic Claude (`claude-sonnet-5-5`), OpenAI en secours facultatif |
| Emails | Resend (envoi + webhooks signés) |
| Recherche | Apify (Google Maps et passes de secours), Bright Data (secours Google Maps, déblocage, recherche web), service de lecture des sites sur VPS (`worker/`, Playwright) |
| Tâches de fond | Inngest (envoi, rédaction, relances, recherche) |

## Démarrage local

Prérequis : Node.js 22, pnpm 10.

```bash
pnpm install
cp .env.example .env   # puis renseigner les valeurs
pnpm prisma migrate deploy
pnpm dev
```

Dans un second terminal, le serveur Inngest local. Sans lui, « Rédiger les emails », l'envoi et la recherche
de prospects ne démarrent pas :

```bash
pnpm dev:jobs
```

Sans `RESEND_API_KEY`, les envois sont **simulés** en développement (refusés en production).
En local, `NEXT_PUBLIC_APP_URL` vaut `http://localhost:3000` : la carte **Paramètres > État de la configuration**
le signale comme bloquant et aucun email de prospection ne part, ce qui est voulu (les liens de désinscription
seraient morts). Le bouton « M'envoyer un email d'essai » reste utilisable.

## Service de lecture des sites (VPS)

`worker/` est un petit service autonome : il lit les pages de coordonnées des sites d'entreprises et renvoie
emails, contact et téléphone. Il refuse toute adresse interne, respecte `robots.txt` et espace ses requêtes.

```bash
WORKER_TOKEN=<24 caractères ou plus> BROWSER_CHANNEL=msedge pnpm worker:dev   # en local, port 8090
bash scripts/vps/deploy-worker.sh           # empaquette, envoie et redémarre sur le VPS (lit .env.deploy)
bash scripts/vps/deploy-worker.sh --check   # état du service, sans rien modifier
```

Sur le VPS, il vit dans `/opt/scpb-scraper` (conteneur isolé, 2 Go et 2 vCPU au plus, écoute locale), derrière
nginx sur `scraper.<domaine>`. Fichiers : `deploy/vps/` (docker-compose, bloc nginx, modèle de `.env`).
Côté application : `SCRAPER_WORKER_URL` et `SCRAPER_WORKER_TOKEN`. Sans elles, les sites sont lus par Apify.

## Accès et rôles

L'inscription publique est désactivée. Au premier lancement, renseignez `ADMIN_EMAILS` : ces comptes
deviennent administrateurs à leur première connexion. Ensuite, les administrateurs invitent l'équipe
depuis **Paramètres > Équipe** : l'invité reçoit (par Resend) un lien personnel vers `/auth/confirm`, où il
définit son mot de passe. « Mot de passe oublié » utilise le même mécanisme et fonctionne depuis n'importe
quel appareil.

| Rôle | Droits |
|---|---|
| Administrateur | Tout, y compris paramètres et équipe |
| Commercial | Prospects, segments, recherches, campagnes, envois |
| Assistant | Idem Commercial, sans suppression de campagne ni de prospect |
| Direction | Lecture seule |

## Mise en production (Vercel + Supabase)

1. **Sauvegarder la base**, puis appliquer les migrations : `pnpm prisma migrate deploy`.
2. **Vercel** : projet actif (un projet suspendu répond « 402 DEPLOYMENT_DISABLED »), domaine rattaché
   (Settings > Domains) et enregistrement DNS correspondant chez le registraire.
3. **Variables Vercel** : toutes celles de `.env.example`. Indispensables : `DATABASE_URL` (pooler transaction,
   port 6543), `ADMIN_EMAILS`, `SUPABASE_SERVICE_ROLE_KEY`, `UNSUBSCRIBE_SECRET`, `RESEND_API_KEY`,
   `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `INNGEST_SIGNING_KEY`, `INNGEST_EVENT_KEY`,
   `NEXT_PUBLIC_APP_URL` (adresse https publique, une seule valeur).
4. **Supabase** > Authentication : **désactiver les inscriptions** (« Allow new users to sign up ») et le
   fournisseur Google s'il était activé. URL du site : `https://<domaine>`.
5. **DNS du domaine d'envoi** : domaine vérifié dans Resend (SPF sur `send.<domaine>`, DKIM), et **un seul**
   enregistrement DMARC sur `_dmarc.<domaine>`, par exemple
   `v=DMARC1; p=none; rua=mailto:dmarc@<domaine>; adkim=r; aspf=r` (à durcir en `quarantine` après quelques
   semaines sans anomalie). Plusieurs enregistrements DMARC équivalent à aucun.
6. **Resend** : suivi des ouvertures activé, webhook vers `https://<domaine>/api/webhooks/resend`
   (événements sent, delivered, opened, clicked, bounced, complained).
7. **Inngest Cloud** : synchroniser `https://<domaine>/api/inngest`.
8. **Contrôles** : `pnpm check-deploy -- https://<domaine>`, puis **Paramètres > État de la configuration**
   (tout doit être conforme), puis « M'envoyer un email d'essai » et clic sur le lien de désinscription reçu.

Tant qu'un contrôle bloquant échoue (adresse publique injoignable, secret de désinscription, adresse postale,
webhook, DMARC, DKIM), aucune campagne ne peut être activée et aucun email ne part ; une alerte s'affiche sur
le tableau de bord.

### Délivrabilité : montée en charge

Commencer à 20 emails par jour avec 60 secondes d'espacement pendant deux semaines, puis augmenter par
paliers tant que les rebonds restent sous 2 %. Au-delà du seuil réglé dans Paramètres (5 % par défaut, sur
7 jours et 20 envois minimum), toutes les campagnes passent en pause automatiquement. Un taux de plainte
au-dessus de 0,3 % entraîne un blocage chez Gmail.

## Commandes

```bash
pnpm dev          # développement
pnpm dev:jobs     # serveur Inngest local (envoi, rédaction, recherche)
pnpm typecheck    # TypeScript
pnpm lint         # ESLint
pnpm test         # tests unitaires (Vitest)
pnpm build        # build de production
pnpm fix-prospect-languages -- --countries          # simulation : langues + pays en ISO2
pnpm fix-prospect-languages -- --countries --apply  # application
pnpm retarget-prospects                 # simulation : recalcul du ciblage (corrections manuelles conservées)
pnpm cleanup-legacy                     # simulation : rebonds en liste d'exclusion, brouillons obsolètes, recherches bloquées
pnpm check-deploy -- https://<domaine>  # contrôle d'un déploiement (lecture seule)
pnpm audit --prod                       # vulnérabilités des dépendances (la CI refuse toute vulnérabilité critique)
```

## Arborescence

```txt
src/
  app/(dashboard)/      pages de l'application (accès membres uniquement)
  app/api/              routes API (chacune vérifie l'utilisateur et son rôle)
  app/unsubscribe/      page publique de désinscription
  inngest/functions.ts  envoi, rédaction, relances, recherche de prospects
  lib/                  logique métier (auth, sending, claude, scraping/pipeline, scoring, dedup…)
  components/           interface (charte « Terroir & Soleil »)
prisma/                 schéma et migrations
docs/                   cahier des charges ; archive/ : worker Cloudflare gelé
```

## Hors périmètre actuel

- Réception automatique des réponses (Resend Inbound ou IMAP) et classification par l'assistant
  (`classifyResponse` est prête dans `src/lib/claude.ts`). Aujourd'hui : bouton « Le prospect a répondu ».
- Modèles d'emails réutilisables, journal d'audit.
- Suppression définitive des anciennes colonnes du module financier (`prospectType`, `financialCategory`).

Projet interne SCPB.
