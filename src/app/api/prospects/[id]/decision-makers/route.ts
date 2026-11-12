import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { checkEligibility, decisionMakersConfigured, findDecisionMakers } from "@/lib/decision-makers";

type Params = { params: Promise<{ id: string }> };

/** Décideurs déjà trouvés, et possibilité d'en chercher pour ce prospect. */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const prospect = await prisma.prospect.findUnique({
    where: { id },
    select: { targetFit: true, country: true, status: true, prospectType: true },
  });
  if (!prospect) return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });

  const contacts = await prisma.prospectContact.findMany({
    where: { prospectId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, title: true, linkedinUrl: true, createdAt: true },
  });
  const eligibility = checkEligibility(prospect);
  return NextResponse.json({
    contacts,
    configured: decisionMakersConfigured(),
    eligible: eligibility.ok,
    reason: eligibility.ok ? null : eligibility.reason,
  });
}

/** Lance la recherche (payante, une requête Bright Data). */
export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const { contacts } = await findDecisionMakers(id);
    return NextResponse.json({ found: contacts.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/introuvable|Réservé|accord préalable|ne souhaite plus|configurés|Recherche impossible/.test(message)) {
      return NextResponse.json({ error: message }, { status: /introuvable/.test(message) ? 404 : 400 });
    }
    return serverError("prospects:decision-makers", err, "La recherche des décideurs a échoué.");
  }
}
