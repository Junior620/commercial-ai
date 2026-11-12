import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Valide le jeton d'un lien d'accès (invitation ou réinitialisation) et ouvre la session. */
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const failure = NextResponse.redirect(new URL("/login?error=auth", origin), 303);

  let tokenHash = "";
  let type = "";
  try {
    const form = await request.formData();
    tokenHash = String(form.get("token_hash") || "");
    type = String(form.get("type") || "");
  } catch {
    return failure;
  }
  if (!tokenHash || tokenHash.length > 200 || (type !== "invite" && type !== "recovery")) return failure;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) return failure;

  return NextResponse.redirect(new URL("/auth/reset", origin), 303);
}
