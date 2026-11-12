import Image from "next/image";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Confirmer votre accès" };

const TYPES = new Set(["invite", "recovery"]);

/**
 * Arrivée depuis un email d'invitation ou de réinitialisation.
 * Le jeton n'est validé qu'après un clic (requête POST) : un antivirus de messagerie
 * qui ouvre le lien automatiquement ne le consomme pas.
 */
export default async function ConfirmAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = !!tokenHash && tokenHash.length <= 200 && !!type && TYPES.has(type);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <Image src="/brand/mark.png" alt="" width={40} height={40} className="mb-6 h-10 w-10" />
        {valid ? (
          <form method="POST" action="/auth/confirm/verify">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <h1 className="text-2xl font-semibold">
              {type === "invite" ? "Bienvenue sur SCPB Commercial" : "Réinitialiser votre mot de passe"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Cliquez sur « Continuer » pour {type === "invite" ? "activer votre accès et " : ""}définir votre mot de passe.
            </p>
            <Button type="submit" className="mt-6 h-11 w-full">
              Continuer
            </Button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Lien invalide</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce lien est incomplet ou a expiré. Demandez-en un nouveau depuis la page de connexion (« Mot de passe oublié »).
            </p>
            <Link href="/login" className={buttonVariants({ className: "mt-6 h-11 w-full" })}>
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
