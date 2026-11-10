import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { suppressEmail } from "@/lib/sending";

/**
 * Désinscription en un clic (RFC 8058) : Gmail / Yahoo envoient un POST
 * sur l'URL de l'en-tête List-Unsubscribe. Le formulaire de /unsubscribe aussi.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const email = verifyUnsubscribeToken(token);
  if (!email) return NextResponse.json({ error: "Lien invalide" }, { status: 400 });

  await suppressEmail(email, "unsubscribe link");

  const accept = req.headers.get("accept") || "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/unsubscribe?t=${encodeURIComponent(token!)}&done=1`, req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
