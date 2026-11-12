import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, WRITE_ROLES } from "@/lib/auth";
import { serverError } from "@/lib/api";

/** Marque une alerte du tableau de bord comme traitée. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(WRITE_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await prisma.jobAlert.updateMany({ where: { id, resolvedAt: null }, data: { resolvedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("alerts:resolve", err);
  }
}
