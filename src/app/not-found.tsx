import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <Image src="/brand/mark.png" alt="" width={64} height={64} className="mb-6 h-16 w-16" />
      <h1 className="text-3xl font-semibold">Page introuvable</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Cette adresse n&apos;existe pas ou a été déplacée.</p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Retour au tableau de bord
      </Link>
    </main>
  );
}
