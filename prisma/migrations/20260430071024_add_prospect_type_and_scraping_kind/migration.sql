-- CreateEnum
CREATE TYPE "ProspectType" AS ENUM ('COMMERCIAL', 'FINANCIAL');

-- CreateEnum
CREATE TYPE "ScrapingJobKind" AS ENUM ('COMMERCIAL', 'FINANCIAL');

-- AlterTable
ALTER TABLE "prospects" ADD COLUMN     "financialCategory" TEXT,
ADD COLUMN     "prospectType" "ProspectType" NOT NULL DEFAULT 'COMMERCIAL';

-- AlterTable
ALTER TABLE "scraping_jobs" ADD COLUMN     "kind" "ScrapingJobKind" NOT NULL DEFAULT 'COMMERCIAL';

-- CreateIndex
CREATE INDEX "prospects_prospectType_idx" ON "prospects"("prospectType");
