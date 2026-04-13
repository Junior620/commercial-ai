import { prisma } from "@/lib/prisma";
import { ProspectsClient } from "@/components/prospects/prospects-client";

export default async function ProspectsPage() {
  let prospects: Awaited<ReturnType<typeof prisma.prospect.findMany>> = [];
  try {
    prospects = await prisma.prospect.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch {
    prospects = [];
  }

  return <ProspectsClient initialProspects={JSON.parse(JSON.stringify(prospects))} />;
}
