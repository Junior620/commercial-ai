import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/resend";
import { getAppUrl } from "@/lib/unsubscribe";

/**
 * Liens d'accès (invitation, mot de passe oublié).
 *
 * Le lien est créé côté serveur (API d'administration Supabase) et envoyé par Resend.
 * Il pointe vers /auth/confirm, qui valide le jeton sur le serveur après un clic explicite :
 * - il fonctionne depuis n'importe quel appareil (pas de code stocké dans le navigateur d'origine) ;
 * - un antivirus de messagerie qui « visite » le lien ne consomme pas le jeton.
 */

export type AccessLinkKind = "invite" | "recovery";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const COPY: Record<AccessLinkKind, { subject: string; title: string; intro: string; button: string }> = {
  invite: {
    subject: "Votre accès à SCPB Commercial",
    title: "Bienvenue dans l'équipe",
    intro: "Un administrateur vous a invité à rejoindre SCPB Commercial, l'outil de prospection de l'équipe. Cliquez sur le bouton pour définir votre mot de passe.",
    button: "Définir mon mot de passe",
  },
  recovery: {
    subject: "Réinitialisation de votre mot de passe SCPB Commercial",
    title: "Nouveau mot de passe",
    intro: "Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton pour en définir un nouveau. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    button: "Choisir un nouveau mot de passe",
  },
};

function accessEmailHtml(kind: AccessLinkKind, link: string, name?: string | null): string {
  const c = COPY[kind];
  return `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#F8F3EA;font-family:Helvetica,Arial,sans-serif;color:#1F2510;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#FFFDF8;border:1px solid #E4D9C6;border-radius:10px;">
<tr><td style="height:4px;background:#4E5A1F;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:32px 36px;font-size:15px;line-height:1.6;">
<h1 style="margin:0 0 14px 0;font-size:20px;">${escapeHtml(c.title)}</h1>
<p style="margin:0 0 14px 0;">${name ? `Bonjour ${escapeHtml(name)},` : "Bonjour,"}</p>
<p style="margin:0 0 22px 0;">${escapeHtml(c.intro)}</p>
<p style="margin:0 0 22px 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#4E5A1F;color:#FFFDF8;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">${escapeHtml(c.button)}</a></p>
<p style="margin:0;font-size:12px;color:#5F6650;">Ce lien est personnel et expire au bout de 24 heures. S'il ne fonctionne plus, demandez-en un nouveau depuis la page de connexion (« Mot de passe oublié »).</p>
</td></tr></table></td></tr></table></body></html>`;
}

export type AccessLinkResult = { ok: true; simulated: boolean } | { ok: false; error: string };

/** Crée un lien d'accès à usage unique et l'envoie par email. */
export async function sendAccessLink(opts: { email: string; kind: AccessLinkKind; name?: string | null }): Promise<AccessLinkResult> {
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur." };

  let kind = opts.kind;
  let generated =
    kind === "invite"
      ? await admin.auth.admin.generateLink({ type: "invite", email: opts.email, options: { data: { full_name: opts.name ?? undefined } } })
      : await admin.auth.admin.generateLink({ type: "recovery", email: opts.email });

  // Compte déjà existant : l'invitation devient un lien de définition du mot de passe.
  if (generated.error && kind === "invite" && /already|registered|exists/i.test(generated.error.message)) {
    kind = "recovery";
    generated = await admin.auth.admin.generateLink({ type: "recovery", email: opts.email });
  }
  // Mot de passe oublié pour un membre qui n'a encore jamais ouvert de compte.
  if (generated.error && kind === "recovery" && /not found/i.test(generated.error.message)) {
    kind = "invite";
    generated = await admin.auth.admin.generateLink({ type: "invite", email: opts.email, options: { data: { full_name: opts.name ?? undefined } } });
  }
  const tokenHash = generated.data?.properties?.hashed_token;
  if (generated.error || !tokenHash) {
    return { ok: false, error: generated.error?.message || "Lien non généré" };
  }

  const link = `${getAppUrl()}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${kind}`;
  const c = COPY[opts.kind];
  try {
    const result = await sendEmail({
      to: opts.email,
      subject: c.subject,
      html: accessEmailHtml(opts.kind, link, opts.name),
      text: `${c.intro}\n\n${link}\n\nCe lien est personnel et expire au bout de 24 heures.`,
      idempotencyKey: `access-${tokenHash.slice(0, 40)}`,
    });
    if (result.simulated) console.info(`[access-links] Resend non configuré. Lien pour ${opts.email} : ${link}`);
    return { ok: true, simulated: result.simulated };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Envoi de l'email impossible" };
  }
}
