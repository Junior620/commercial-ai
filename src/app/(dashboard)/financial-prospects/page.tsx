import { prisma } from "@/lib/prisma";
import { ProspectsClient } from "@/components/prospects/prospects-client";

export default async function FinancialProspectsPage() {
  let prospects: Awaited<ReturnType<typeof prisma.prospect.findMany>> = [];
  try {
    prospects = await prisma.prospect.findMany({
      where: { prospectType: "FINANCIAL" },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  } catch {
    prospects = [];
  }

  return (
    <ProspectsClient
      initialProspects={JSON.parse(JSON.stringify(prospects))}
      prospectType="FINANCIAL"
      title="Partenaires financiers"
    />
  );
}
