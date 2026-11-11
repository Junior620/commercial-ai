"use client";

import { useEffect, useState } from "react";
import { Eye, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { RESPONSE_CLASSIFICATION_LABELS } from "@/lib/labels";
import type { Tone } from "@/lib/labels";

interface ResponseItem {
  id: string;
  content: string;
  classification: string;
  suggestedReply: string | null;
  createdAt: string;
  prospect: { company: string; email: string };
  email: { subject: string };
}

const CLASS_TONES: Record<string, Tone> = {
  POSITIVE: "success",
  MEETING_REQUEST: "success",
  PRICE_REQUEST: "brand",
  INFO_REQUEST: "info",
  NEGATIVE: "neutral",
  NO_INTEREST: "neutral",
  UNSUBSCRIBE: "danger",
  UNKNOWN: "sun",
};

const PAGE_SIZE = 20;

export default function ResponsesPage() {
  const [responses, setResponses] = useState<ResponseItem[] | null>(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<ResponseItem | null>(null);

  useEffect(() => {
    fetch("/api/responses")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResponses)
      .catch(() => {
        setError(true);
        setResponses([]);
      });
  }, []);

  const list = responses ?? [];
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const count = (cls: string[]) => list.filter((r) => cls.includes(r.classification)).length;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Réponses"
        description="Réponses des prospects enregistrées depuis les campagnes."
        icon={MessageSquare}
      />

      <p className="rounded-lg border border-sun/40 bg-sun/15 px-4 py-3 text-sm">
        Les réponses arrivent dans la boîte de l&apos;expéditeur. Quand un prospect répond, ouvrez la campagne et cliquez sur
        « Le prospect a répondu » : ses relances s&apos;arrêtent et il passe « En discussion ».
      </p>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les réponses.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Intéressés / rendez-vous", value: count(["POSITIVE", "MEETING_REQUEST"]) },
          { label: "Demandes de prix", value: count(["PRICE_REQUEST"]) },
          { label: "Demandes d'informations", value: count(["INFO_REQUEST"]) },
          { label: "À qualifier", value: count(["UNKNOWN"]) },
        ].map((k) => (
          <Card key={k.label} size="sm">
            <CardContent>
              <p data-slot="kpi-value" className="text-2xl font-semibold">
                {responses === null ? "…" : k.value}
              </p>
              <p className="text-sm text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les réponses</CardTitle>
          <CardDescription>{list.length} réponse(s), les 100 plus récentes</CardDescription>
        </CardHeader>
        <CardContent>
          {responses === null ? (
            <Skeleton className="h-48" />
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>Aucune réponse enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Email d&apos;origine</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-16 text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((resp) => (
                      <TableRow key={resp.id}>
                        <TableCell>
                          <p className="font-medium">{resp.prospect.company}</p>
                          <p className="text-xs text-muted-foreground">{resp.prospect.email}</p>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{resp.email.subject}</TableCell>
                        <TableCell>
                          <StatusBadge kind="response" value={resp.classification} tone={CLASS_TONES[resp.classification]} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(resp.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon-sm" aria-label={`Voir la réponse de ${resp.prospect.company}`} onClick={() => setOpen(resp)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ListPagination page={safePage} totalPages={totalPages} totalItems={list.length} itemLabel="réponses" onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-lg">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>Réponse de {open.prospect.company}</DialogTitle>
                <DialogDescription>
                  {RESPONSE_CLASSIFICATION_LABELS[open.classification] ?? open.classification} · {open.email.subject}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium">Contenu</p>
                  <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{open.content}</p>
                </div>
                {open.suggestedReply ? (
                  <div>
                    <p className="mb-1 text-sm font-medium">Brouillon de réponse proposé</p>
                    <p className="whitespace-pre-wrap rounded-md bg-sun/15 p-3 text-sm">{open.suggestedReply}</p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
