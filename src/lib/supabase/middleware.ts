import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes accessibles sans session (pages d'auth, webhooks machine-à-machine, désinscription). */
const PUBLIC_EXACT = new Set(["/login", "/auth/callback", "/auth/reset", "/auth/confirm", "/auth/confirm/verify", "/api/auth/recover"]);
const PUBLIC_PREFIXES = ["/api/inngest", "/api/webhooks/resend", "/api/unsubscribe", "/unsubscribe"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function unauthorized(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) return unauthorized(request);

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Lecture du jeton de session (rafraîchi si besoin, signature vérifiée localement quand
  // le projet utilise des clés asymétriques). Le contrôle complet auprès de Supabase est fait
  // une seule fois par requête, dans getCurrentUser().
  let hasUser = false;
  try {
    const { data } = await supabase.auth.getClaims();
    hasUser = !!data?.claims?.sub;
  } catch {
    hasUser = false;
  }

  if (!hasUser) return unauthorized(request);
  // Vérification optimiste uniquement : l'autorisation (membre actif, rôle)
  // est faite par requireUser() dans chaque route et dans le layout du dashboard.
  return supabaseResponse;
}
