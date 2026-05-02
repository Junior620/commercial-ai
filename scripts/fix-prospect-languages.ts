/**
 * Recalcule la langue des prospects a partir du code pays (meme logique que le scraping).
 *
 * Par defaut : simulation uniquement (aucune ecriture).
 *
 * Usage :
 *   pnpm run fix-prospect-languages              # dry-run (affiche les changements)
 *   pnpm run fix-prospect-languages -- --apply   # applique les mises a jour
 *
 * Options :
 *   --apply     Ecrire en base (sinon lecture seule)
 *   --source=X  Limiter aux prospects avec cette source (ex. apify_google_maps)
 *   --force     Mettre a jour si inferred !== language meme si language !== en
 *               (attention : ecrase des choix manuels possibles)
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { inferProspectLanguageFromCountry } from "../src/lib/prospect-language";

function parseArgs() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const force = argv.includes("--force");
  let source: string | undefined;
  for (const a of argv) {
    if (a.startsWith("--source=")) {
      source = a.slice("--source=".length).trim() || undefined;
    }
  }
  return { apply, force, source };
}

async function main() {
  const { apply, force, source } = parseArgs();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    console.error("DATABASE_URL est requis dans l environnement (.env).");
    process.exit(1);
  }

  const poolMaxRaw = process.env.DATABASE_POOL_MAX?.trim();
  const poolMaxParsed =
    poolMaxRaw && poolMaxRaw.length > 0
      ? Number.parseInt(poolMaxRaw, 10)
      : Number.NaN;
  const poolMax = Number.isFinite(poolMaxParsed)
    ? Math.min(15, Math.max(1, poolMaxParsed))
    : 2;

  const pool = new Pool({
    connectionString,
    max: poolMax,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 60_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const where = source ? { source } : {};

    const prospects = await prisma.prospect.findMany({
      where,
      select: {
        id: true,
        company: true,
        country: true,
        language: true,
        source: true,
      },
    });

    const toUpdate: {
      id: string;
      company: string;
      country: string;
      from: string;
      to: string;
      source: string | null;
    }[] = [];

    for (const p of prospects) {
      const inferred = inferProspectLanguageFromCountry(p.country);
      if (inferred === p.language) continue;
      if (!force && p.language !== "en") continue;

      toUpdate.push({
        id: p.id,
        company: p.company,
        country: p.country,
        from: p.language,
        to: inferred,
        source: p.source,
      });
    }

    console.log(
      `Prospects analyses : ${prospects.length} | a corriger : ${toUpdate.length}` +
        (source ? ` (source=${source})` : "")
    );

    if (toUpdate.length === 0) {
      console.log("Rien a faire.");
      return;
    }

    const preview = toUpdate.slice(0, 30);
    for (const row of preview) {
      console.log(
        `  - ${row.company} | ${row.country} : ${row.from} -> ${row.to}` +
          (row.source ? ` [${row.source}]` : "")
      );
    }
    if (toUpdate.length > preview.length) {
      console.log(`  ... et ${toUpdate.length - preview.length} autre(s).`);
    }

    if (!apply) {
      console.log(
        "\nMode simulation : aucune ecriture. Relancez avec --apply pour appliquer."
      );
      return;
    }

    let done = 0;
    for (const row of toUpdate) {
      await prisma.prospect.update({
        where: { id: row.id },
        data: { language: row.to },
      });
      done++;
    }

    console.log(`\nMis a jour : ${done} prospect(s).`);
  } finally {
    await prisma.$disconnect().catch(() => {});
    await pool.end().catch(() => {});
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
