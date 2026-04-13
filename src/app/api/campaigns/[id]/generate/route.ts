import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmail } from "@/lib/claude";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        segment: {
          include: {
            prospectLinks: { include: { prospect: true } },
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campagne non trouvee" },
        { status: 404 }
      );
    }

    let prospects;
    if (campaign.segment) {
      prospects = campaign.segment.prospectLinks.map((pl) => pl.prospect);
    } else {
      prospects = await prisma.prospect.findMany({
        where: { status: { in: ["NEW", "CONTACTED"] } },
        take: 100,
      });
    }

    // Exclude prospects that already have emails in this campaign
    const existingEmails = await prisma.email.findMany({
      where: { campaignId: id },
      select: { prospectId: true },
    });
    const existingProspectIds = new Set(
      existingEmails.map((e) => e.prospectId)
    );
    prospects = prospects.filter((p) => !existingProspectIds.has(p.id));

    let generated = 0;

    for (const prospect of prospects.slice(0, 50)) {
      try {
        const emailContent = await generateEmail({
          prospectName: prospect.contact || prospect.company,
          companyName: prospect.company,
          country: prospect.country,
          sector: prospect.sector || "",
          product: prospect.product || "",
          language: campaign.language,
          tone: campaign.tone as "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM",
          campaignProduct: campaign.product || "cocoa products",
        });

        await prisma.email.create({
          data: {
            campaignId: id,
            prospectId: prospect.id,
            subject: emailContent.subject,
            body: emailContent.body,
            type: "INITIAL",
            status: "PENDING",
          },
        });

        generated++;
      } catch (err) {
        console.error(
          `Failed to generate email for ${prospect.email}:`,
          err
        );
      }
    }

    return NextResponse.json({ generated });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur de generation" },
      { status: 500 }
    );
  }
}
