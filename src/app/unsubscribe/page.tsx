import type { Metadata } from "next";
import Image from "next/image";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const metadata: Metadata = {
  title: "Désinscription",
  robots: { index: false, follow: false },
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const { t, done } = await searchParams;
  const email = verifyUnsubscribeToken(t);
  const company = process.env.SENDER_COMPANY?.trim() || "SCPB";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <Image src="/logo.png" alt={company} width={96} height={64} className="mx-auto mb-6 h-16 w-auto" priority />
        {!email ? (
          <>
            <h1 className="font-heading text-2xl text-foreground">Lien invalide</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ce lien de désinscription est incomplet ou a expiré. Répondez simplement à notre email avec
              « désinscription » et nous retirerons votre adresse.
            </p>
          </>
        ) : done ? (
          <>
            <h1 className="font-heading text-2xl text-foreground">C&apos;est noté</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              L&apos;adresse {maskEmail(email)} ne recevra plus de messages de {company}. / You will no longer
              receive messages from {company}.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl text-foreground">Se désinscrire</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Confirmez que vous ne souhaitez plus recevoir de messages de {company} à l&apos;adresse{" "}
              {maskEmail(email)}. / Confirm you no longer wish to hear from us.
            </p>
            <form method="post" action={`/api/unsubscribe?t=${encodeURIComponent(t!)}`} className="mt-6">
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Confirmer la désinscription / Unsubscribe
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
