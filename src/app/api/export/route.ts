import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/export?type=prospects|bounced|campaign_emails&campaignId=...
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  try {
    const type = req.nextUrl.searchParams.get("type") || "prospects";
    const campaignId = req.nextUrl.searchParams.get("campaignId");

    if (type === "bounced") {
      const emails = await prisma.email.findMany({
        where: { status: "BOUNCED" },
        orderBy: { updatedAt: "desc" },
        take: 5000,
        include: {
          prospect: {
            select: { company: true, email: true, country: true },
          },
        },
      });
      const csv = toCsv(
        ["email_id", "company", "prospect_email", "country", "subject"],
        emails.map((e) => [
          e.id,
          e.prospect.company,
          e.prospect.email,
          e.prospect.country,
          e.subject,
        ])
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="rebonds_${Date.now()}.csv"`,
        },
      });
    }

    if (type === "campaign_emails") {
      if (!campaignId) {
        return NextResponse.json(
          { error: "campaignId requis" },
          { status: 400 }
        );
      }
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { name: true },
      });
      if (!campaign) {
        return NextResponse.json(
          { error: "Campagne introuvable" },
          { status: 404 }
        );
      }
      const emails = await prisma.email.findMany({
        where: { campaignId },
        orderBy: { createdAt: "desc" },
        include: {
          prospect: {
            select: { company: true, email: true, country: true },
          },
        },
      });
      const safeName = campaign.name.replace(/[^\w\-]+/g, "_").slice(0, 40);
      const csv = toCsv(
        [
          "email_id",
          "status",
          "type",
          "company",
          "prospect_email",
          "country",
          "subject",
          "sentAt",
        ],
        emails.map((e) => [
          e.id,
          e.status,
          e.type,
          e.prospect.company,
          e.prospect.email,
          e.prospect.country,
          e.subject,
          e.sentAt ? e.sentAt.toISOString() : "",
        ])
      );
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="campagne_${safeName}.csv"`,
        },
      });
    }

    /* prospects (defaut) */
    const prospects = await prisma.prospect.findMany({
      where: { prospectType: "COMMERCIAL" },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    const csv = toCsv(
      [
        "id",
        "company",
        "contact",
        "email",
        "country",
        "sector",
        "status",
        "score",
        "priority",
        "source",
        "createdAt",
      ],
      prospects.map((p) => [
        p.id,
        p.company,
        p.contact ?? "",
        p.email,
        p.country,
        p.sector ?? "",
        p.status,
        String(p.score),
        p.priority,
        p.source ?? "",
        p.createdAt.toISOString(),
      ])
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prospects_${Date.now()}.csv"`,
      },
    });
  } catch (e) {
    console.error("[export]", e);
    return NextResponse.json({ error: "Export impossible" }, { status: 500 });
  }
}
