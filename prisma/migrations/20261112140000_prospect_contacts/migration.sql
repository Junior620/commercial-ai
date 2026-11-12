-- Décideurs trouvés à la demande (nom, poste, profil LinkedIn public). Aucune adresse email.
CREATE TABLE "prospect_contacts" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "linkedinUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'serp_linkedin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prospect_contacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "prospect_contacts_prospectId_linkedinUrl_key" ON "prospect_contacts"("prospectId", "linkedinUrl");
CREATE INDEX "prospect_contacts_prospectId_idx" ON "prospect_contacts"("prospectId");
ALTER TABLE "prospect_contacts" ADD CONSTRAINT "prospect_contacts_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "prospect_contacts" ENABLE ROW LEVEL SECURITY;
