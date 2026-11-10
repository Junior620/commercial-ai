import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseJsonBody, serverError } from "@/lib/api";
import { getAppUrl } from "@/lib/unsubscribe";

const ROLES = ["ADMIN", "COMMERCIAL", "ASSISTANT", "DIRECTION"] as const;

const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide").max(200),
  name: z.string().trim().max(120).optional(),
  role: z.enum(ROLES).default("COMMERCIAL"),
});

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const members = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return NextResponse.json(members);
}

/** Invite un membre : email d'invitation Supabase + fiche équipe avec son rôle. */
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(req, InviteSchema);
  if (!parsed.ok) return parsed.response;
  const { email, name, role } = parsed.data;

  const admin = supabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY manquante : invitation impossible." },
      { status: 503 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.active) {
      return NextResponse.json({ error: "Ce membre fait déjà partie de l'équipe" }, { status: 409 });
    }

    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${getAppUrl()}/auth/callback?next=/auth/reset`,
    });
    // Un compte Supabase déjà existant n'empêche pas de (ré)activer le membre.
    if (error && !/already|registered|exists/i.test(error.message)) {
      return NextResponse.json({ error: `Invitation refusée : ${error.message}` }, { status: 400 });
    }

    const member = await prisma.user.upsert({
      where: { email },
      update: { role, active: true, ...(name ? { name } : {}) },
      create: { email, name: name || null, role },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (err) {
    return serverError("members:invite", err, "Erreur lors de l'invitation");
  }
}
