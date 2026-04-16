"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MessageSquare, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";

interface ResponseItem {
  id: string;
  content: string;
  classification: string;
  suggestedReply: string | null;
  createdAt: string;
  prospect: { company: string; email: string };
  email: { subject: string };
}

const CLASS_COLORS: Record<string, string> = {
  POSITIVE: "bg-green-100 text-green-800",
  INFO_REQUEST: "bg-blue-100 text-blue-800",
  PRICE_REQUEST: "bg-purple-100 text-purple-800",
  MEETING_REQUEST: "bg-indigo-100 text-indigo-800",
  NEGATIVE: "bg-red-100 text-red-800",
  NO_INTEREST: "bg-gray-100 text-gray-800",
  UNSUBSCRIBE: "bg-orange-100 text-orange-800",
  UNKNOWN: "bg-gray-100 text-gray-800",
};

const CLASS_LABELS: Record<string, string> = {
  POSITIVE: "Positif",
  INFO_REQUEST: "Demande info",
  PRICE_REQUEST: "Demande prix",
  MEETING_REQUEST: "Demande RDV",
  NEGATIVE: "Negatif",
  NO_INTEREST: "Pas interesse",
  UNSUBSCRIBE: "Desabonnement",
  UNKNOWN: "Inconnu",
};

export default function ResponsesPage() {
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetch("/api/responses")
      .then((r) => r.json())
      .then(setResponses)
      .catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil(responses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedResponses = responses.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="Réponses"
        description="Classification et gestion des réponses reçues"
        icon={MessageSquare}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {["POSITIVE", "INFO_REQUEST", "PRICE_REQUEST", "NEGATIVE"].map(
          (cls) => (
            <Card key={cls}>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">
                  {responses.filter((r) => r.classification === cls).length}
                </p>
                <p className="text-sm text-muted-foreground">
                  {CLASS_LABELS[cls]}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les reponses</CardTitle>
          <CardDescription>{responses.length} reponses recues</CardDescription>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>Aucune reponse recue pour le moment</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Objet original</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedResponses.map((resp) => (
                    <TableRow
                      key={resp.id}
                      className="odd:bg-muted/20 hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {resp.prospect.company}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {resp.prospect.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {resp.email.subject}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            CLASS_COLORS[resp.classification] || ""
                          }
                        >
                          {CLASS_LABELS[resp.classification] ||
                            resp.classification}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(resp.createdAt).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">
                            <span className="inline-flex items-center justify-center">
                              <Eye className="h-3 w-3" />
                            </span>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Reponse de {resp.prospect.company}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium mb-1">
                                  Contenu de la reponse
                                </p>
                                <p className="text-sm bg-muted p-3 rounded">
                                  {resp.content}
                                </p>
                              </div>
                              {resp.suggestedReply && (
                                <div>
                                  <p className="text-sm font-medium mb-1">
                                    Reponse suggeree par l&apos;IA
                                  </p>
                                  <p className="text-sm bg-blue-50 p-3 rounded">
                                    {resp.suggestedReply}
                                  </p>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <ListPagination
                page={safePage}
                totalPages={totalPages}
                totalItems={responses.length}
                itemLabel="reponses"
                onPageChange={setPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
