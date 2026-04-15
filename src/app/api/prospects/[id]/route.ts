import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateProspectSchema = z
  .object({
    company: z.string().min(1).optional(),
    contact: z.string().nullable().optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    country: z.string().min(1).optional(),
    sector: z.string().nullable().optional(),
    clientType: z.string().nullable().optional(),
    product: z.string().nullable().optional(),
    language: z.string().optional(),
    priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
    status: z
      .enum([
        "NEW",
        "CONTACTED",
        "IN_DISCUSSION",
        "CONVERTED",
        "COLD",
        "UNSUBSCRIBED",
      ])
      .optional(),
    website: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateProspectSchema.safeParse(body);
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

    if (data.email) {
      const taken = await prisma.prospect.findFirst({
        where: { email: data.email, NOT: { id } },
      });
      if (taken) {
        return NextResponse.json(
          { error: "Un prospect avec cet email existe deja" },
          { status: 409 }
        );
      }
    }

    const prospect = await prisma.prospect.update({
      where: { id },
      data,
    });
    return NextResponse.json(prospect);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Prospect introuvable" },
        { status: 404 }
      );
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
    await prisma.prospect.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";
    if (code === "P2025") {
      return NextResponse.json(
        { error: "Prospect introuvable" },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
