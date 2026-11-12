import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { parseJsonBody, prismaErrorCode, serverError } from "@/lib/api";

const PatchEmailSchema = z
  .object({
    subject: z.string().trim().min(1).max(200).optional(),
    body: z.string().trim().min(1).max(10000).optional(),
  })
  .strict();

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, PatchEmailSchema);
  if (!parsed.ok) return parsed.response;
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
  }

  try {
    // Un email modifié doit être approuvé à nouveau.
    const { count } = await prisma.email.updateMany({
      where: { id, status: "PENDING" },
      data: { ...parsed.data, approvedAt: null, approvedById: null },
    });
    if (count === 0) {
      const exists = await prisma.email.findUnique({ where: { id }, select: { id: true } });
      return exists
        ? NextResponse.json({ error: "Seuls les emails en attente peuvent être modifiés" }, { status: 400 })
        : NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }
    const updated = await prisma.email.findUnique({
      where: { id },
      include: { prospect: { select: { company: true, email: true, contact: true, country: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    return serverError("emails:update", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    // Un email déjà parti fait partie de l'historique (statistiques, relances) : on le conserve.
    const { count } = await prisma.email.deleteMany({ where: { id, status: { in: ["PENDING", "FAILED"] } } });
    if (count === 0) {
      return NextResponse.json({ error: "Seuls les emails non envoyés peuvent être supprimés" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("emails:delete", err);
  }
}
