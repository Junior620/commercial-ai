import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmail } from "@/lib/claude";

function sanitizeContactName(
  contact: string | null | undefined,
  companyFallback: string
): string {
  if (!contact || contact.trim().length === 0) {
    return `${companyFallback} Team`;
  }
  const cleaned = contact.trim();
  if (/^\+?\d[\d\s\-().]{5,}$/.test(cleaned)) {
    return `${companyFallback} Team`;
  }
  if (/^[\d@.]+$/.test(cleaned)) {
    return `${companyFallback} Team`;
  }
  if (cleaned.includes("@")) {
    return `${companyFallback} Team`;
  }
  if (cleaned.length < 2 || cleaned.length > 80) {
    return `${companyFallback} Team`;
  }
  return cleaned;
}

function resolveCampaignLanguage(
  campaignLanguage: string | null | undefined,
  prospectLanguage: string | null | undefined
): string {
  if (campaignLanguage && campaignLanguage !== "auto") {
    return campaignLanguage;
  }
  const p = (prospectLanguage || "").trim().toLowerCase();
  if (p) return p;
  return "en";
}

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
        take: 2000,
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

    for (const prospect of prospects) {
      try {
        const contactName = sanitizeContactName(
          prospect.contact,
          prospect.company
        );

        const emailContent = await generateEmail({
          prospectName: contactName,
          companyName: prospect.company,
          country: prospect.country,
          sector: prospect.sector || "",
          product: prospect.product || "",
          language: resolveCampaignLanguage(campaign.language, prospect.language),
          tone: campaign.tone as "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM",
          campaignProduct:
            !campaign.product || campaign.product === "all"
              ? "cocoa or coffee products"
              : campaign.product,
          senderName: process.env.SENDER_NAME?.trim(),
          senderCompany: process.env.SENDER_COMPANY?.trim(),
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
  } catch {
    return NextResponse.json(
      { error: "Erreur de generation" },
      { status: 500 }
    );
  }
}
