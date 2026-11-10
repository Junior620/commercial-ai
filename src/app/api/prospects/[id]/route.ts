import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, prismaErrorCode, serverError } from "@/lib/api";
import { normalizeCountryToIso2 } from "@/lib/prospect-language";
import { suppressEmail } from "@/lib/sending";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

const UpdateProspectSchema = z
  .object({
    company: z.string().trim().min(1).max(200).optional(),
    contact: nullableText(120),
    email: z.string().trim().toLowerCase().email().max(200).optional(),
    phone: nullableText(60),
    country: z.string().trim().min(1).max(80).optional(),
    sector: nullableText(200),
    clientType: nullableText(60),
    product: nullableText(60),
    language: z.string().trim().max(10).optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    status: z.enum(["NEW", "CONTACTED", "IN_DISCUSSION", "CONVERTED", "COLD", "UNSUBSCRIBED"]).optional(),
    website: nullableText(300),
    source: nullableText(60),
    notes: nullableText(5000),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, UpdateProspectSchema);
  if (!parsed.ok) return parsed.response;
  const data = { ...parsed.data, ...(parsed.data.country ? { country: normalizeCountryToIso2(parsed.data.country) } : {}) };
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  try {
    if (data.email) {
      const taken = await prisma.prospect.findFirst({
        where: { email: { equals: data.email, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "Un prospect avec cet email existe déjà" }, { status: 409 });
    }

    const prospect = await prisma.prospect.update({ where: { id }, data });
    // Une désinscription saisie à la main vaut pour toutes les campagnes.
    if (data.status === "UNSUBSCRIBED") await suppressEmail(prospect.email, `manual (${auth.user.email})`);
    return NextResponse.json(prospect);
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
    return serverError("prospects:update", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireUser(["ADMIN", "COMMERCIAL"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
    return serverError("prospects:delete", err);
  }
}
