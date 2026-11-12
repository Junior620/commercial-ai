"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Marque une alerte de tâche de fond comme traitée. */
export function DismissAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const dismiss = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("Impossible de clore l'alerte");
      setBusy(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="shrink-0" onClick={dismiss} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      C&apos;est traité
    </Button>
  );
}
