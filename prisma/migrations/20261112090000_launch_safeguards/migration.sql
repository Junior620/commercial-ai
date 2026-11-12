-- Garde-fous avant lancement : validation de chaque email, vérification des adresses,
-- corrections manuelles d'adéquation, alertes des tâches de fond.

ALTER TABLE "prospects" ADD COLUMN "targetFitManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "prospects" ADD COLUMN "emailCheckedAt" TIMESTAMP(3);
ALTER TABLE "prospects" ADD COLUMN "emailInvalidReason" TEXT;

-- Les emails déjà rédigés restent non approuvés (approvedAt NULL) : ils devront être relus.
ALTER TABLE "emails" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "emails" ADD COLUMN "approvedById" TEXT;
CREATE INDEX "emails_status_approvedAt_idx" ON "emails"("status", "approvedAt");

ALTER TABLE "app_settings" ADD COLUMN "minDaysBetweenCampaigns" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "job_alerts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "job_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_alerts_resolvedAt_createdAt_idx" ON "job_alerts"("resolvedAt", "createdAt");
ALTER TABLE "job_alerts" ENABLE ROW LEVEL SECURITY;
