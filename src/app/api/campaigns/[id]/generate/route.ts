import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmail } from "@/lib/claude";
import { isFinancialCampaignProduct } from "@/lib/financial-campaigns";
import { inferProspectLanguageFromCountry } from "@/lib/prospect-language";

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
  prospectLanguage: string | null | undefined,
  country: string | null | undefined
): string {
  const normalize = (value: string | null | undefined): string => {
    const raw = (value || "").trim().toLowerCase().replace("_", "-");
    if (!raw) return "";
    if (raw === "auto") return "auto";
    if (
      raw === "fr" ||
      raw.startsWith("fr-") ||
      raw === "french" ||
      raw === "francais" ||
      raw === "français"
    ) {
      return "fr";
    }
    if (raw === "en" || raw.startsWith("en-") || raw === "english") return "en";
    if (raw === "es" || raw.startsWith("es-") || raw === "spanish") return "es";
    if (raw === "pt" || raw.startsWith("pt-") || raw === "portuguese") return "pt";
    if (raw === "de" || raw.startsWith("de-") || raw === "german") return "de";
    if (raw === "ar" || raw.startsWith("ar-") || raw === "arabic") return "ar";
    return raw.slice(0, 2);
  };

  const campaignLang = normalize(campaignLanguage);
  if (campaignLang && campaignLang !== "auto") {
    return campaignLang;
  }

  let prospectLang = normalize(prospectLanguage);
  if (prospectLang === "auto") prospectLang = "";

  const inferred = inferProspectLanguageFromCountry(country);

  if (!prospectLang) {
    return inferred;
  }

  /**
   * Prospects financiers historiquement imports avec language=en par erreur ;
   * on corrige avec le pays lorsque ca pointe une autre langue.
   */
  if (prospectLang === "en" && inferred !== "en") {
    return inferred;
  }

  return prospectLang;
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
      const financialOnly = isFinancialCampaignProduct(campaign.product);
      prospects = await prisma.prospect.findMany({
        where: {
          status: { in: ["NEW", "CONTACTED"] },
          ...(financialOnly ? { prospectType: "FINANCIAL" } : {}),
        },
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

    const fundingOutreach = isFinancialCampaignProduct(campaign.product);

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
          prospectType: prospect.prospectType,
          financialCategory: prospect.financialCategory,
          language: resolveCampaignLanguage(
            campaign.language,
            prospect.language,
            prospect.country
          ),
          tone: campaign.tone as "FORMAL" | "FRIENDLY" | "TECHNICAL" | "PREMIUM",
          emailMission: fundingOutreach
            ? "STARTUP_FUNDING_PARTNER"
            : "COMMODITY_SALES",
          campaignProduct: fundingOutreach
            ? "Financement ou partenariat strategique avec notre projet (startup / chaine valeur cacao-cafe)."
            : !campaign.product || campaign.product === "all"
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
