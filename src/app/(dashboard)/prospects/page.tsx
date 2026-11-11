import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ProspectsClient } from "@/components/prospects/prospects-client";

export const metadata: Metadata = { title: "Prospects" };

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const { search } = await searchParams;
  // En cas d'erreur base de données, error.tsx affiche un message explicite
  // (au lieu d'une liste vide trompeuse).
  const prospects = await prisma.prospect.findMany({
    where: { prospectType: "COMMERCIAL" },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  return <ProspectsClient key={search ?? ""} initialProspects={JSON.parse(JSON.stringify(prospects))} initialSearch={search ?? ""} />;
}
