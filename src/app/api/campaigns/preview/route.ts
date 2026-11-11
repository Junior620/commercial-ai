import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { countCampaignTargets } from "@/lib/campaign-generation";
import { serverError } from "@/lib/api";

/** Aperçu du ciblage d'une campagne : nombre de prospects visés (dont cœur de cible). */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const segmentId = req.nextUrl.searchParams.get("segmentId")?.slice(0, 60) || null;
  const product = req.nextUrl.searchParams.get("product")?.slice(0, 60) || null;
  try {
    return NextResponse.json(await countCampaignTargets({ segmentId, product }));
  } catch (err) {
    return serverError("campaigns:preview", err);
  }
}
