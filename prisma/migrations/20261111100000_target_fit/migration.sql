-- Ciblage fèves de cacao et dérivés : adéquation et produits pertinents par prospect.
-- Valeurs recalculées ensuite par : pnpm retarget-prospects -- --apply

CREATE TYPE "TargetFit" AS ENUM ('CORE', 'SECONDARY', 'OUT_OF_SCOPE');

ALTER TABLE "prospects" ADD COLUMN "targetFit" "TargetFit" NOT NULL DEFAULT 'SECONDARY';
ALTER TABLE "prospects" ADD COLUMN "productNeeds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "prospects_targetFit_idx" ON "prospects"("targetFit");
