-- Relance : sécurité, conformité et fiabilité des envois.
-- ⚠️ Faire une sauvegarde de la base avant `prisma migrate deploy`.

-- 1. Nouveau statut d'email « SENDING » (réservation atomique avant envoi)
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'PENDING';

-- 2. Membres désactivables
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- 3. Adresse postale pour le pied d'email
ALTER TABLE "app_settings" ADD COLUMN IF NOT EXISTS "companyAddress" TEXT;

-- 4. Liste de suppression (désinscriptions, plaintes, rebonds définitifs)
CREATE TABLE IF NOT EXISTS "suppressions" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("email")
);

-- Les prospects déjà désinscrits rejoignent la liste de suppression
INSERT INTO "suppressions" ("email", "reason")
SELECT lower("email"), 'unsubscribed (migration)'
FROM "prospects"
WHERE "status" = 'UNSUBSCRIBED'
ON CONFLICT ("email") DO NOTHING;

-- 5. Idempotence des webhooks Resend
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "webhook_events_createdAt_idx" ON "webhook_events"("createdAt");

-- 6. Un seul email par (campagne, prospect, étape).
--    Les doublons non envoyés (PENDING / FAILED) sont supprimés ; on garde en priorité
--    la ligne la plus avancée, puis la plus ancienne. S'il reste des doublons déjà envoyés,
--    la création de l'index échoue : les traiter à la main avant de relancer.
DELETE FROM "emails" e
USING (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "campaignId", "prospectId", "type"
               ORDER BY CASE WHEN "status" IN ('PENDING', 'FAILED') THEN 1 ELSE 0 END,
                        "createdAt" ASC
           ) AS rn
    FROM "emails"
) ranked
WHERE e."id" = ranked."id"
  AND ranked.rn > 1
  AND e."status" IN ('PENDING', 'FAILED');

CREATE UNIQUE INDEX IF NOT EXISTS "emails_campaignId_prospectId_type_key"
    ON "emails"("campaignId", "prospectId", "type");

-- 7. Index manquants
CREATE INDEX IF NOT EXISTS "emails_status_sentAt_idx" ON "emails"("status", "sentAt");
CREATE INDEX IF NOT EXISTS "emails_resendId_idx" ON "emails"("resendId");
CREATE INDEX IF NOT EXISTS "prospect_segments_segmentId_idx" ON "prospect_segments"("segmentId");
CREATE INDEX IF NOT EXISTS "responses_prospectId_idx" ON "responses"("prospectId");
CREATE INDEX IF NOT EXISTS "responses_emailId_idx" ON "responses"("emailId");
CREATE INDEX IF NOT EXISTS "prospects_createdAt_idx" ON "prospects"("createdAt");
CREATE INDEX IF NOT EXISTS "scraping_jobs_kind_createdAt_idx" ON "scraping_jobs"("kind", "createdAt");

-- 8. Row Level Security : bloque l'accès direct via l'API REST Supabase (clé anon publique).
--    Prisma se connecte avec le rôle propriétaire des tables et n'est pas concerné.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospect_segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prospect_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scraping_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "suppressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
