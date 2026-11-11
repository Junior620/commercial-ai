import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateEmail } from "@/lib/claude";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import { classifyTarget } from "@/lib/targeting";

const GenerateSchema = z.object({
  prospectName: z.string().trim().min(1, "Nom du contact requis").max(120),
  companyName: z.string().trim().min(1, "Entreprise requise").max(200),
  country: z.string().trim().max(80).optional().default(""),
  sector: z.string().trim().max(200).optional().default(""),
  product: z.string().trim().max(120).optional().default(""),
  language: z.string().trim().max(10).optional().default("fr"),
  tone: z.enum(["FORMAL", "FRIENDLY", "TECHNICAL", "PREMIUM"]).optional().default("FORMAL"),
  campaignProduct: z.string().trim().max(200).optional(),
  campaignProductId: z.string().trim().max(40).optional(),
  customInstructions: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, GenerateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    const result = await generateEmail({
      ...body,
      campaignProduct: body.campaignProduct || "fèves de cacao et produits dérivés",
      ...(() => {
        const target = classifyTarget({ title: body.companyName, categoryName: body.sector });
        return { buyerType: target.buyerType, productNeeds: target.productNeeds };
      })(),
    });
    return NextResponse.json(result);
  } catch (err) {
    return serverError("ai:generate", err, "La génération a échoué. Réessayez dans un instant.");
  }
}
