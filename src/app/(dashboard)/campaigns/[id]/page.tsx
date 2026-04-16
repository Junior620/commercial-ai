"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import {
  Play,
  Pause,
  Bot,
  Send,
  RefreshCw,
  BarChart3,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/layout/page-title";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ListPagination } from "@/components/shared/list-pagination";

interface CampaignDetail {
  id: string;
  name: string;
  product: string | null;
  language: string;
  tone: string;
  status: string;
  maxFollowUps: number;
  followUpDelayDays: number;
  dailyLimit: number;
  sentCount: number;
  deliveredCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
  failedCount: number;
  segment: { name: string; id: string } | null;
  emails: Array<{
    id: string;
    subject: string;
    body: string;
    status: string;
    type: string;
    sentAt: string | null;
    prospect: { company: string; email: string; contact: string | null };
  }>;
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewEmail, setViewEmail] = useState<CampaignDetail["emails"][0] | null>(
    null
  );
  const [editEmail, setEditEmail] = useState<CampaignDetail["emails"][0] | null>(
    null
  );
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailPage, setEmailPage] = useState(1);
  const EMAILS_PER_PAGE = 20;

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  useEffect(() => {
    const interval = setInterval(fetchCampaign, 8000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.ok) setCampaign(await res.json());
    } catch {
      // ignore
    }
  };

  const handleGenerateEmails = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur generation");
      const result = await res.json();
      toast.success(`${result.generated} emails generes par l'IA`);
      fetchCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendBatch = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur envoi");
      const result = await res.json();
      toast.success(`${result.sent} emails envoyes`);
      fetchCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  const toggleStatus = async () => {
    if (!campaign) return;
    const newStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchCampaign();
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (
      !confirm(
        `Supprimer la campagne « ${campaign.name} » ? Tous les emails associes seront supprimes.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Campagne supprimee");
      router.push("/campaigns");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  const openEditEmail = (email: CampaignDetail["emails"][0]) => {
    setEditEmail(email);
    setEditSubject(email.subject);
    setEditBody(email.body);
  };

  const handleSaveEmail = async () => {
    if (!editEmail) return;
    setSavingEmail(true);
    try {
      const res = await fetch(`/api/emails/${editEmail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Erreur");
      }
      toast.success("Email mis a jour");
      setEditEmail(null);
      fetchCampaign();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleDeleteEmail = async (email: CampaignDetail["emails"][0]) => {
    const warn =
      email.status !== "PENDING"
        ? `Cet email est deja ${email.status}. Supprimer quand meme ?`
        : `Supprimer l email pour « ${email.prospect.company} » ?`;
    if (!confirm(warn)) return;
    try {
      const res = await fetch(`/api/emails/${email.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Email supprime");
      setViewEmail(null);
      if (editEmail?.id === email.id) setEditEmail(null);
      fetchCampaign();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-800",
    SENT: "bg-blue-100 text-blue-800",
    DELIVERED: "bg-green-100 text-green-800",
    OPENED: "bg-purple-100 text-purple-800",
    CLICKED: "bg-indigo-100 text-indigo-800",
    BOUNCED: "bg-red-100 text-red-800",
    REPLIED: "bg-emerald-100 text-emerald-800",
    FAILED: "bg-red-100 text-red-800",
  };
  const totalEmailPages = Math.max(
    1,
    Math.ceil(campaign.emails.length / EMAILS_PER_PAGE)
  );
  const safeEmailPage = Math.min(emailPage, totalEmailPages);
  const paginatedEmails = campaign.emails.slice(
    (safeEmailPage - 1) * EMAILS_PER_PAGE,
    safeEmailPage * EMAILS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle
          title={campaign.name}
          description={`${campaign.segment?.name || "Sans segment"} — ${campaign.language.toUpperCase()} — ${campaign.tone}`}
          icon={BarChart3}
        />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/campaigns/${id}/edit`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "inline-flex items-center"
            )}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Modifier
          </Link>
          <Button
            variant="outline"
            onClick={handleGenerateEmails}
            disabled={generating}
          >
            <Bot className="mr-2 h-4 w-4" />
            {generating ? "Generation..." : "Generer emails IA"}
          </Button>
          <Button
            variant="outline"
            onClick={handleSendBatch}
            disabled={sending}
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Envoi..." : "Envoyer le lot"}
          </Button>
          <Button variant="outline" onClick={toggleStatus}>
            {campaign.status === "ACTIVE" ? (
              <Pause className="mr-2 h-4 w-4" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            {campaign.status === "ACTIVE" ? "Pause" : "Activer"}
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={handleDeleteCampaign}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Envoyes", value: campaign.sentCount },
          { label: "Livres", value: campaign.deliveredCount ?? 0 },
          { label: "Ouverts", value: campaign.openCount },
          { label: "Reponses", value: campaign.replyCount },
          { label: "Rebonds", value: campaign.bounceCount },
          { label: "Failed", value: campaign.failedCount ?? 0 },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emails de la campagne</CardTitle>
          <CardDescription>{campaign.emails.length} emails</CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.emails.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucun email genere. Cliquez sur &quot;Generer emails IA&quot; pour commencer.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Prospect</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoye le</TableHead>
                    <TableHead className="w-[120px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmails.map((email) => (
                    <TableRow
                      key={email.id}
                      className="odd:bg-muted/20 hover:bg-muted/50 transition-colors"
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {email.prospect.company}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {email.prospect.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {email.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{email.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[email.status] || ""}
                        >
                          {email.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {email.sentAt
                          ? new Date(email.sentAt).toLocaleString("fr-FR")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8"
                            aria-label="Voir le contenu"
                            onClick={() => setViewEmail(email)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8"
                            disabled={email.status !== "PENDING"}
                            title={
                              email.status !== "PENDING"
                                ? "Modification reservee aux emails non envoyes"
                                : "Modifier"
                            }
                            aria-label="Modifier"
                            onClick={() => openEditEmail(email)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label="Supprimer"
                            onClick={() => handleDeleteEmail(email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
              <ListPagination
                page={safeEmailPage}
                totalPages={totalEmailPages}
                totalItems={campaign.emails.length}
                itemLabel="emails"
                onPageChange={setEmailPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={viewEmail !== null}
        onOpenChange={(open) => {
          if (!open) setViewEmail(null);
        }}
      >
        <SheetContent className="flex max-h-[100vh] flex-col gap-0 overflow-hidden sm:max-w-lg">
          {viewEmail && (
            <>
              <SheetHeader className="shrink-0 text-left">
                <SheetTitle className="pr-8 leading-snug">
                  {viewEmail.subject}
                </SheetTitle>
                <SheetDescription>
                  {viewEmail.prospect.company} — {viewEmail.prospect.email}
                </SheetDescription>
              </SheetHeader>
              <Separator />
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Corps du message
                </p>
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {viewEmail.body}
                </div>
              </div>
              <Separator />
              <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewEmail(null)}
                >
                  Fermer
                </Button>
                <div className="flex flex-wrap gap-2">
                  {viewEmail.status === "PENDING" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const e = viewEmail;
                        setViewEmail(null);
                        openEditEmail(e);
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Modifier
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      const e = viewEmail;
                      setViewEmail(null);
                      handleDeleteEmail(e);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={editEmail !== null}
        onOpenChange={(open) => {
          if (!open) setEditEmail(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l email</DialogTitle>
          </DialogHeader>
          {editEmail && (
            <div className="grid gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Vers : {editEmail.prospect.company} ({editEmail.prospect.email})
              </p>
              <div className="space-y-2">
                <Label htmlFor="email-subject">Objet</Label>
                <Input
                  id="email-subject"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-body">Corps</Label>
                <Textarea
                  id="email-body"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditEmail(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSaveEmail}
              disabled={savingEmail || !editSubject.trim() || !editBody.trim()}
            >
              {savingEmail ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
