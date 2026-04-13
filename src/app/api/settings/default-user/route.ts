import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Configuration Supabase incomplète (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const existing = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    const alreadyExists = existing.data.users.some(
      (u) => u.email?.toLowerCase() === email
    );
    if (alreadyExists) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || undefined,
        role: "ADMIN",
      },
    });

    if (error || !data.user) {
      return NextResponse.json(
        { error: error?.message || "Erreur de création utilisateur" },
        { status: 500 }
      );
    }

    try {
      await prisma.user.upsert({
        where: { email },
        update: {
          name: fullName || null,
          role: "ADMIN",
        },
        create: {
          email,
          name: fullName || null,
          role: "ADMIN",
        },
      });
    } catch {
      // Non-bloquant: l'utilisateur auth est déjà créé.
    }

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      created: true,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur interne lors de la création utilisateur" },
      { status: 500 }
    );
  }
}
