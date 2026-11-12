"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/confirm-dialog";

type Contact = { id: string; name: string; title: string | null; linkedinUrl: string };
type State = { contacts: Contact[]; configured: boolean; eligible: boolean; reason: string | null };

/** Décideurs d'un prospect : recherche à la demande, jamais automatique. */
export function DecisionMakers({ prospectId, company }: { prospectId: string; company: string }) {
  const confirm = useConfirm();
  const [state, setState] = useState<State | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/prospects/${prospectId}/decision-makers`, { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, [prospectId]);

  useEffect(() => {
    load();
  }, [load]);

  const search = async () => {
    const ok = await confirm({
      title: `Chercher les décideurs de « ${company} » ?`,
      description:
        "Une recherche Google sur les profils LinkedIn publics, facturée par Bright Data. Au plus 3 contacts (nom, poste, profil). Aucune adresse email n'est devinée : ces contacts servent à personnaliser le message ou à une prise de contact manuelle.",
      confirmLabel: "Chercher",
    });
    if (!ok) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/decision-makers`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Recherche impossible");
      toast[data.found ? "success" : "info"](data.found ? `${data.found} décideur(s) trouvé(s).` : "Aucun décideur identifiable pour cette entreprise.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSearching(false);
    }
  };

  if (!state) return null;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Décideurs</p>
        {state.configured && state.eligible ? (
          <Button size="sm" variant="outline" onClick={search} disabled={searching}>
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserSearch className="h-3.5 w-3.5" />}
            {state.contacts.length ? "Chercher à nouveau" : "Trouver les décideurs"}
          </Button>
        ) : null}
      </div>
      {state.contacts.length ? (
        <ul className="mt-2 space-y-2">
          {state.contacts.map((c) => (
            <li key={c.id} className="text-sm">
              <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                {c.name}
                <ExternalLink className="h-3 w-3" />
              </a>
              {c.title ? <p className="text-xs text-muted-foreground">{c.title}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {!state.configured
            ? "Recherche indisponible : BRIGHTDATA_API_TOKEN et BRIGHTDATA_SERP_ZONE ne sont pas configurés sur le serveur."
            : !state.eligible
              ? state.reason
              : "Aucun décideur enregistré. La recherche porte sur les profils LinkedIn publics (achats, approvisionnement, direction)."}
        </p>
      )}
    </div>
  );
}
