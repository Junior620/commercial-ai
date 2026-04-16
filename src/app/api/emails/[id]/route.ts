import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const PatchEmailSchema = z
  .object({
    subject: z.string().min(1).max(998).optional(),
    body: z.string().min(1).optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const json = await req.json();
    const parsed = PatchEmailSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Donnees invalides" },
        { status: 400 }
      );
    }
    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ a mettre a jour" },
        { status: 400 }
      );
    }

    const existing = await prisma.email.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        {
          error:
            "Seuls les emails en attente (PENDING) peuvent etre modifies avant envoi",
        },
        { status: 400 }
      );
    }

    const updated = await prisma.email.update({
      where: { id },
      data,
      include: {
        prospect: { select: { company: true, email: true, contact: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.email.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
