import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJsonBody, prismaErrorCode, serverError } from "@/lib/api";

const UpdateMemberSchema = z
  .object({
    role: z.enum(["ADMIN", "COMMERCIAL", "ASSISTANT", "DIRECTION"]).optional(),
    active: z.boolean().optional(),
    name: z.string().trim().max(120).nullable().optional(),
  })
  .strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = await parseJsonBody(req, UpdateMemberSchema);
  if (!parsed.ok) return parsed.response;
  const data = parsed.data;

  // Garde-fou : l'équipe doit toujours conserver au moins un administrateur actif.
  const demotesSelf = id === auth.user.id && (data.active === false || (data.role && data.role !== "ADMIN"));
  if (demotesSelf) {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true, NOT: { id } } });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Vous êtes le dernier administrateur actif." }, { status: 409 });
    }
  }

  try {
    const member = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    return NextResponse.json(member);
  } catch (err) {
    if (prismaErrorCode(err) === "P2025") return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    return serverError("members:update", err);
  }
}
