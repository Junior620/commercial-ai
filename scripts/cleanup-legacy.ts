/**
 * Nettoyage de l'héritage avant relance (voir l'audit du 12/11/2026).
 *
 * Par défaut : simulation uniquement (aucune écriture).
 *
 *   pnpm cleanup-legacy              # simulation
 *   pnpm cleanup-legacy -- --apply   # applique
 *
 * Ce que fait --apply :
 *  1. Adresses ayant rebondi : ajout à la liste d'exclusion, prospect « ne plus contacter »,
 *     brouillons non envoyés annulés.
 *  2. Brouillons non envoyés vers d'anciens prospects financiers : supprimés.
 *  3. Recherches de prospects restées « en cours » depuis plus de 3 heures : passées en échec.
 *
 * Rien d'autre n'est modifié. Les segments et campagnes de test sont seulement listés.
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const apply = process.argv.slice(2).includes("--apply");
const STALE_JOB_MS = 3 * 60 * 60 * 1000;

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL est requis (.env)");
  const pool = new Pool({ connectionString, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // 1. Rebonds historiques
    const bounced = await prisma.email.findMany({
      where: { status: "BOUNCED" },
      select: { prospect: { select: { id: true, email: true, company: true } } },
    });
    const bouncedProspects = [...new Map(bounced.map((b) => [b.prospect.id, b.prospect])).values()];
    const already = new Set(
      (
        await prisma.suppression.findMany({
          where: { email: { in: bouncedProspects.map((p) => p.email.toLowerCase()) } },
          select: { email: true },
        })
      ).map((s) => s.email)
    );
    const toSuppress = bouncedProspects.filter((p) => !already.has(p.email.toLowerCase()));
    const bouncedDrafts = await prisma.email.count({
      where: { status: "PENDING", prospectId: { in: bouncedProspects.map((p) => p.id) } },
    });
    console.log(`1. Adresses ayant rebondi : ${bouncedProspects.length} (dont ${toSuppress.length} à ajouter à la liste d'exclusion)`);
    console.log(`   Brouillons en attente vers ces adresses : ${bouncedDrafts}`);
    for (const p of toSuppress.slice(0, 8)) console.log(`   - ${p.company} <${p.email}>`);
    if (toSuppress.length > 8) console.log(`   … et ${toSuppress.length - 8} autre(s)`);

    // 2. Brouillons vers d'anciens prospects financiers
    const financialDrafts = await prisma.email.groupBy({
      by: ["campaignId"],
      where: { status: { in: ["PENDING", "FAILED"] }, prospect: { prospectType: "FINANCIAL" } },
      _count: { _all: true },
    });
    const campaigns = await prisma.campaign.findMany({ select: { id: true, name: true, status: true, product: true } });
    const name = (id: string) => campaigns.find((c) => c.id === id)?.name ?? id;
    const financialTotal = financialDrafts.reduce((s, d) => s + d._count._all, 0);
    console.log(`\n2. Brouillons vers d'anciens prospects financiers : ${financialTotal}`);
    for (const d of financialDrafts) console.log(`   - campagne « ${name(d.campaignId)} » : ${d._count._all}`);

    // 3. Recherches bloquées
    const staleJobs = await prisma.scrapingJob.findMany({
      where: { status: "RUNNING", createdAt: { lt: new Date(Date.now() - STALE_JOB_MS) } },
      select: { id: true, createdAt: true },
    });
    console.log(`\n3. Recherches de prospects bloquées « en cours » : ${staleJobs.length}`);
    for (const j of staleJobs) console.log(`   - ${j.id} (lancée le ${j.createdAt.toISOString().slice(0, 10)})`);

    // Information seulement
    const segments = await prisma.segment.findMany({ select: { name: true, filters: true } });
    const obsolete = segments.filter((s) => !/targetFits|productNeeds/.test(JSON.stringify(s.filters)));
    console.log(`\nPour information (à supprimer vous-même depuis l'application si vous le souhaitez) :`);
    console.log(`   Segments d'avant le recentrage : ${obsolete.map((s) => `« ${s.name} »`).join(", ") || "aucun"}`);
    console.log(
      `   Campagnes de test : ${
        campaigns
          .filter((c) => /test/i.test(c.name) || c.product === "financial_all_prospects")
          .map((c) => `« ${c.name} » (${c.status})`)
          .join(", ") || "aucune"
      }`
    );

    if (!apply) {
      console.log("\nSimulation : aucune écriture. Relancez avec --apply pour appliquer les points 1 à 3.");
      return;
    }

    for (const p of toSuppress) {
      await prisma.suppression.upsert({
        where: { email: p.email.toLowerCase() },
        update: {},
        create: { email: p.email.toLowerCase(), reason: "hard bounce (historique avril 2026)" },
      });
    }
    const cold = await prisma.prospect.updateMany({
      where: { id: { in: bouncedProspects.map((p) => p.id) }, status: { notIn: ["UNSUBSCRIBED", "CONVERTED"] } },
      data: { status: "COLD" },
    });
    const cancelled = await prisma.email.updateMany({
      where: { status: "PENDING", prospectId: { in: bouncedProspects.map((p) => p.id) } },
      data: { status: "FAILED" },
    });
    const deleted = await prisma.email.deleteMany({
      where: { status: { in: ["PENDING", "FAILED"] }, prospect: { prospectType: "FINANCIAL" } },
    });
    const failedJobs = await prisma.scrapingJob.updateMany({
      where: { id: { in: staleJobs.map((j) => j.id) }, status: "RUNNING" },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: "Recherche interrompue (job bloqué, nettoyé automatiquement)" },
    });

    console.log(`\nAppliqué :`);
    console.log(`   ${toSuppress.length} adresse(s) ajoutée(s) à la liste d'exclusion, ${cold.count} prospect(s) « ne plus contacter »`);
    console.log(`   ${cancelled.count} brouillon(s) annulé(s), ${deleted.count} brouillon(s) financier(s) supprimé(s)`);
    console.log(`   ${failedJobs.count} recherche(s) bloquée(s) passée(s) en échec`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
