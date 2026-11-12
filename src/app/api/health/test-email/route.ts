import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { EmailSendError, buildEmailHtml, buildEmailText, buildUnsubscribeHeaders, sendEmail } from "@/lib/resend";

/**
 * Envoie un email d'essai à l'administrateur connecté, avec la mise en page,
 * la signature, le pied de page et les en-têtes de désinscription des vrais emails.
 * Aucun prospect n'est contacté.
 */
export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" }, select: { companyAddress: true } });
  const to = auth.user.email;
  const options = { to, language: "fr", companyAddress: settings?.companyAddress };
  const body = [
    "Bonjour,",
    "Ceci est un email d'essai envoyé depuis SCPB Commercial. Il utilise exactement la mise en page, la signature et le pied de page des emails de prospection.",
    "À vérifier : l'expéditeur affiché, la signature, l'adresse postale en bas de message, et le lien de désinscription (il doit ouvrir une page de confirmation).",
    "Cordialement,",
  ].join("\n\n");

  try {
    const result = await sendEmail({
      to,
      subject: "Email d'essai SCPB Commercial",
      html: buildEmailHtml(body, options),
      text: buildEmailText(body, options),
      headers: buildUnsubscribeHeaders(to),
      idempotencyKey: `test-${auth.user.id}-${Math.floor(Date.now() / 60000)}`,
      tags: [{ name: "kind", value: "test" }],
    });
    return NextResponse.json({ ok: true, to, simulated: result.simulated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Envoi impossible";
    console.error("[health:test-email]", message);
    return NextResponse.json({ error: message }, { status: err instanceof EmailSendError ? 502 : 503 });
  }
}
