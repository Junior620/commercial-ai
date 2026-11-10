"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold">Cette page n&apos;a pas pu se charger</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        La base de données ou un service externe ne répond pas pour le moment. Réessayez dans quelques instants.
        {error.digest ? <span className="mt-1 block font-mono text-xs">Référence : {error.digest}</span> : null}
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Réessayer
      </Button>
    </div>
  );
}
