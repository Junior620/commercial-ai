import { NextRequest, NextResponse } from "next/server";
import { generateEmail } from "@/lib/claude";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateEmail({
      prospectName: body.prospectName,
      companyName: body.companyName,
      country: body.country || "",
      sector: body.sector || "",
      product: body.product || "",
      language: body.language || "en",
      tone: body.tone || "FORMAL",
      campaignProduct: body.campaignProduct || "cocoa products",
      senderName: process.env.SENDER_NAME?.trim(),
      senderCompany: process.env.SENDER_COMPANY?.trim(),
      customInstructions: body.customInstructions,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de generation";
    console.error("[AI Generate]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
