# SCPB Commercial

Outil interne de prospection B2B pour la filière cacao : recherche d'acheteurs (chocolatiers, importateurs,
industriels), rédaction assistée d'emails dans la langue de chaque prospect, envoi progressif et suivi.

## Fonctionnement

1. **Recherche de prospects** : Google Maps via Apify, puis recherche des emails publics sur les sites
   (pages contact, recherche web vérifiée par domaine, lecture directe). Score de 0 à 100, dédoublonnage.
2. **Segments** : critères (pays, activité, produit, score…) évalués à la volée.
3. **Campagne** : l'assistant (Claude) rédige un email par prospect. Rien ne part avant relecture :
   la campagne doit être **approuvée et activée**.
4. **Envoi** : automatique en heures ouvrées (lun.–ven., 8 h–19 h, heure de Douala), quota quotidien global,
   espacement entre emails, un seul envoi garanti par email.
5. **Relances** : calculées depuis le dernier email envoyé, arrêtées dès qu'une réponse est enregistrée.
6. **Conformité** : lien de désinscription en un clic (en-têtes `List-Unsubscribe`), adresse postale et
   source des données en pied d'email, liste d'exclusion alimentée par les désinscriptions, plaintes et
   rebonds définitifs.

## Stack

| Rôle | Outil |
|---|---|
| Application | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) |
| Données | PostgreSQL (Supabase) + Prisma 7 |
| Authentification | Supabase Auth, accès sur invitation, rôles |
| Rédaction | Anthropic Claude (`claude-sonnet-5-5`), OpenAI en secours facultatif |
| Emails | Resend (envoi + webhooks signés) |
| Recherche | Apify (Google Maps, Contact Info, Google Search, Website Content Crawler) |
| Tâches de fond | Inngest (envoi, rédaction, relances, recherche) |

## Démarrage local

Prérequis : Node.js 22, pnpm 10.

```bash
pnpm install
cp .env.example .env   # puis renseigner les valeurs
pnpm prisma migrate deploy
pnpm dev
```

Dans un second terminal, le serveur Inngest local (exécute envois, rédaction et recherches) :

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Sans `RESEND_API_KEY`, les envois sont **simulés** en développement (refusés en production).

## Accès et rôles

L'inscription publique est désactivée. Au premier lancement, renseignez `ADMIN_EMAILS` : ces comptes
deviennent administrateurs à leur première connexion. Ensuite, les administrateurs invitent l'équipe
depuis **Paramètres > Équipe**.

| Rôle | Droits |
|---|---|
| Administrateur | Tout, y compris paramètres et équipe |
| Commercial | Prospects, segments, recherches, campagnes, envois |
| Assistant | Idem Commercial, sans suppression de campagne ni de prospect |
| Direction | Lecture seule |

## Mise en production (Vercel + Supabase)

1. **Sauvegarder la base**, puis appliquer les migrations : `pnpm prisma migrate deploy`.
   La migration `20261110090000_relaunch_hardening` supprime les doublons d'emails non envoyés, ajoute la
   liste d'exclusion et active la Row Level Security sur toutes les tables.
2. Supabase > Authentication > Providers : **désactiver les inscriptions** (« Allow new users to sign up »)
   et le fournisseur Google s'il était activé. Ajouter `https://<domaine>/auth/callback` aux URL de redirection.
3. Variables Vercel : toutes celles de `.env.example`. Indispensables : `DATABASE_URL` (pooler transaction,
   port 6543), `ADMIN_EMAILS`, `UNSUBSCRIBE_SECRET`, `RESEND_WEBHOOK_SECRET`, `INNGEST_SIGNING_KEY`,
   `INNGEST_EVENT_KEY`, `NEXT_PUBLIC_APP_URL`.
4. Resend : domaine vérifié (SPF, DKIM), DMARC en `p=none` puis durcissement, suivi des ouvertures activé,
   webhook vers `https://<domaine>/api/webhooks/resend`.
5. Inngest Cloud : synchroniser `https://<domaine>/api/inngest`.

### Délivrabilité : montée en charge

Commencer à 20–30 emails par jour pendant deux semaines, surveiller le taux de rebond (alerte au-delà de 5 %),
puis augmenter progressivement. Un taux de plainte au-dessus de 0,3 % entraîne un blocage chez Gmail.

## Commandes

```bash
pnpm dev          # développement
pnpm typecheck    # TypeScript
pnpm lint         # ESLint
pnpm test         # tests unitaires (Vitest)
pnpm build        # build de production
pnpm fix-prospect-languages -- --countries          # simulation : langues + pays en ISO2
pnpm fix-prospect-languages -- --countries --apply  # application
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
