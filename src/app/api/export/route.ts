import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(val: string): string {
  const s = val ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  return lines.join("\r\n");
}

/**
 * GET /api/export?type=prospects|bounced|campaign_emails&campaignId=...
 */
export async function GET(req: NextRequest) {
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
