import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import { sendAccessLink } from "@/lib/access-links";

const ROLES = ["ADMIN", "COMMERCIAL", "ASSISTANT", "DIRECTION"] as const;

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(200),
  name: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).default("COMMERCIAL"),
});

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const members = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(members);
}

/** Invite un membre : fiche équipe avec son rôle + email contenant un lien d'accès à usage unique. */
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, InviteSchema);
  if (!parsed.ok) return parsed.response;
  const { email, name, role } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.active) {
      return NextResponse.json({ error: "Ce membre fait déjà partie de l'équipe" }, { status: 409 });
    }

    const link = await sendAccessLink({ email, kind: "invite", name });
    if (!link.ok) {
      return NextResponse.json({ error: `Invitation non envoyée : ${link.error}` }, { status: 502 });
    }

    const member = await prisma.user.upsert({
      where: { email },
      update: { role, active: true, ...(name ? { name } : {}) },
      create: { email, name: name || null, role },
    });
    return NextResponse.json({ ...member, invitationSimulated: link.simulated }, { status: 201 });
  } catch (err) {
    return serverError("members:invite", err, "Erreur lors de l'invitation");
  }
}
