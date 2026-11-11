/**
 * Recalcule le ciblage « fèves de cacao et dérivés » de tous les prospects commerciaux :
 * adéquation (cœur / secondaire / hors cible), produits pertinents, produit principal,
 * type de client, score et priorité.
 *
 * Par défaut : simulation uniquement (aucune écriture).
 *
 * Usage :
 *   pnpm retarget-prospects                              # simulation
 *   pnpm retarget-prospects -- --apply                   # met à jour les prospects
 *   pnpm retarget-prospects -- --apply --purge-drafts    # + supprime les emails non envoyés des hors cible
 *
 * --purge-drafts ne touche que les emails PENDING ou FAILED, dans des campagnes DRAFT ou PAUSED.
 * Aucun prospect n'est supprimé.
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { calculateLeadScore, inferClientType, inferProduct, priorityFromScore } from "../src/lib/scoring";

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const purgeDrafts = argv.includes("--purge-drafts");

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL est requis (.env)");
  const pool = new Pool({ connectionString, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const prospects = await prisma.prospect.findMany({
      where: { prospectType: "COMMERCIAL" },
      select: {
        id: true, company: true, sector: true, notes: true, country: true, email: true, website: true,
        product: true, clientType: true, score: true, priority: true, status: true,
      },
    });

    const updates = prospects.map((p) => {
      const input = { title: p.company, categoryName: p.sector, country: p.country, email: p.email, website: p.website };
      const scoring = calculateLeadScore(input);
      return {
        id: p.id,
        company: p.company,
        sector: p.sector,
        before: { score: p.score },
        data: {
          targetFit: scoring.fit,
          productNeeds: scoring.productNeeds,
          product: inferProduct(input) ?? p.product,
          clientType: inferClientType(input) ?? p.clientType,
          score: scoring.score,
          priority: priorityFromScore(scoring.score, scoring.fit),
        },
        reason: scoring.reasons[0] ?? "",
      };
    });

    const count = (fit: string) => updates.filter((u) => u.data.targetFit === fit).length;
    console.log(`Prospects analysés : ${updates.length}`);
    console.log(`  Cœur de cible : ${count("CORE")}  |  Secondaire : ${count("SECONDARY")}  |  Hors cible : ${count("OUT_OF_SCOPE")}`);

    const needs: Record<string, number> = {};
    for (const u of updates) if (u.data.targetFit === "CORE") for (const n of u.data.productNeeds) needs[n] = (needs[n] ?? 0) + 1;
    console.log("  Demande (cœur de cible) :", needs);

    console.log("\nExemples :");
    for (const fit of ["CORE", "SECONDARY", "OUT_OF_SCOPE"]) {
      for (const u of updates.filter((x) => x.data.targetFit === fit).slice(0, 5)) {
        console.log(`  [${fit}] ${u.company} (${u.sector ?? "?"}) → score ${u.data.score}, ${u.data.product ?? "—"} · ${u.reason}`);
      }
    }

    const outIds = updates.filter((u) => u.data.targetFit === "OUT_OF_SCOPE").map((u) => u.id);
    const drafts = await prisma.email.groupBy({
      by: ["campaignId"],
      where: { prospectId: { in: outIds }, status: { in: ["PENDING", "FAILED"] }, campaign: { status: { in: ["DRAFT", "PAUSED"] } } },
      _count: { _all: true },
    });
    const campaigns = await prisma.campaign.findMany({ where: { id: { in: drafts.map((d) => d.campaignId) } }, select: { id: true, name: true } });
    const draftTotal = drafts.reduce((s, d) => s + d._count._all, 0);
    console.log(`\nEmails non envoyés destinés à des hors cible : ${draftTotal}`);
    for (const d of drafts) console.log(`  - ${campaigns.find((c) => c.id === d.campaignId)?.name ?? d.campaignId} : ${d._count._all}`);

    if (!apply) {
      console.log("\nSimulation : aucune écriture. Relancez avec --apply (et --purge-drafts pour supprimer ces emails).");
      return;
    }

    let done = 0;
    for (const u of updates) {
      await prisma.prospect.update({ where: { id: u.id }, data: u.data });
      done++;
      if (done % 100 === 0) console.log(`  ${done} / ${updates.length}`);
    }
    console.log(`\nProspects mis à jour : ${done}`);

    if (purgeDrafts && outIds.length) {
      const { count: deleted } = await prisma.email.deleteMany({
        where: { prospectId: { in: outIds }, status: { in: ["PENDING", "FAILED"] }, campaign: { status: { in: ["DRAFT", "PAUSED"] } } },
      });
      console.log(`Emails non envoyés supprimés : ${deleted}`);
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
