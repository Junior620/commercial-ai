import { cache } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/enums";

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

function parseList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Résout l'utilisateur connecté et vérifie qu'il est membre actif de l'équipe.
 *
 * Accès accordé si :
 * - l'email existe dans la table `users` et le membre est actif ;
 * - sinon, l'email figure dans ADMIN_EMAILS (création automatique en ADMIN) ;
 * - sinon, son domaine figure dans ALLOWED_EMAIL_DOMAINS (création en COMMERCIAL).
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<
  { user: AppUser; reason?: never } | { user: null; reason: "unauthenticated" | "forbidden" }
> {
  let email: string | undefined;
  let fullName: string | undefined;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email?.toLowerCase();
    fullName = (data.user?.user_metadata?.full_name as string | undefined) || undefined;
  } catch {
    email = undefined;
  }
  if (!email) return { user: null, reason: "unauthenticated" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.active) return { user: null, reason: "forbidden" };
    return {
      user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role },
    };
  }

  const adminEmails = parseList(process.env.ADMIN_EMAILS);
  const allowedDomains = parseList(process.env.ALLOWED_EMAIL_DOMAINS);
  const domain = email.split("@")[1] || "";

  let role: UserRole | null = null;
  if (adminEmails.includes(email)) role = "ADMIN";
  else if (domain && allowedDomains.includes(domain)) role = "COMMERCIAL";
  if (!role) return { user: null, reason: "forbidden" };

  const created = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: fullName ?? null, role },
  });
  return {
    user: { id: created.id, email: created.email, name: created.name, role: created.role },
  };
});

type AuthResult =
  | { ok: true; user: AppUser }
  | { ok: false; response: NextResponse };

/**
 * À appeler en tête de chaque route API.
 * `roles` restreint l'accès (ex. ["ADMIN"] pour la gestion des membres).
 */
export async function requireUser(roles?: UserRole[]): Promise<AuthResult> {
  const result = await getCurrentUser();
  if (!result.user) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    const error = status === 401 ? "Non authentifié" : "Accès non autorisé";
    return { ok: false, response: NextResponse.json({ error }, { status }) };
  }
  if (roles && !roles.includes(result.user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Droits insuffisants" }, { status: 403 }),
    };
  }
  return { ok: true, user: result.user };
}

/** Rôles autorisés à modifier les données (la Direction est en lecture seule). */
export const WRITE_ROLES: UserRole[] = ["ADMIN", "COMMERCIAL", "ASSISTANT"];
