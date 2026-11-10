"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Mail,
  MessageSquareReply,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle } from "@/components/layout/page-title";
import { ListPagination } from "@/components/shared/list-pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EMAIL_TYPE_LABELS, LANGUAGE_LABELS, TONE_LABELS } from "@/lib/labels";
import { PRODUCT_LABELS } from "@/lib/product-catalog";
import { cn } from "@/lib/utils";

type CampaignEmail = {
  id: string;
  subject: string;
  body: string;
  status: string;
  type: string;
  sentAt: string | null;
  prospect: { company: string; email: string; contact: string | null };
};

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
  pendingCount: number;
  segment: { name: string; id: string } | null;
  emails: CampaignEmail[];
}

const EMAILS_PER_PAGE = 20;

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <p data-slot="kpi-value" className="text-2xl font-semibold">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function rate(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : "—";
}

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "send" | "status" | null>(null);
  const [generatingQueued, setGeneratingQueued] = useState(false);
  const [viewEmail, setViewEmail] = useState<CampaignEmail | null>(null);
  const [editEmail, setEditEmail] = useState<CampaignEmail | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [markingRepliedId, setMarkingRepliedId] = useState<string | null>(null);
  const [emailPage, setEmailPage] = useState(1);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (!res.ok) throw new Error(await readError(res, "Campagne introuvable"));
      setCampaign(await res.json());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Erreur de chargement");
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
    const interval = setInterval(fetchCampaign, generatingQueued ? 4000 : 10000);
    return () => clearInterval(interval);
  }, [fetchCampaign, generatingQueued]);

  const handleGenerate = async () => {
    setBusy("generate");
    try {
      const res = await fetch(`/api/campaigns/${id}/generate`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "La génération n'a pas pu démarrer"));
      const result = await res.json();
      if (result.queued > 0) {
        setGeneratingQueued(true);
        setTimeout(() => setGeneratingQueued(false), 5 * 60 * 1000);
        toast.success(`Rédaction lancée pour ${result.queued} prospect(s). Les emails apparaissent au fur et à mesure.`);
      } else {
        toast.info(result.message || "Aucun nouveau prospect à cibler.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleSendNow = async () => {
    setBusy("send");
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Envoi impossible"));
      const result = await res.json();
      if (result.queued) {
        toast.success(`Lot d'envoi lancé : ${result.quota.remaining} envoi(s) possible(s) aujourd'hui, avec espacement.`);
      } else {
        toast.info(result.message || "Rien à envoyer pour le moment.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: "ACTIVE" | "PAUSED" | "COMPLETED") => {
    if (!campaign) return;
    if (status === "ACTIVE" && campaign.status !== "PAUSED") {
      const ok = await confirm({
        title: "Approuver et activer la campagne ?",
        description: `${campaign.pendingCount} email(s) relu(s) partiront automatiquement en heures ouvrées, dans la limite du quota quotidien. Les relances suivront le calendrier prévu.`,
        confirmLabel: "Approuver et activer",
      });
      if (!ok) return;
    }
    setBusy("status");
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await readError(res, "Mise à jour impossible"));
      toast.success(status === "ACTIVE" ? "Campagne active" : status === "PAUSED" ? "Campagne en pause" : "Campagne terminée");
      fetchCampaign();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    const ok = await confirm({
      title: `Supprimer « ${campaign.name} » ?`,
      description: "Tous les emails de la campagne et leur historique seront supprimés. Cette action est définitive.",
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res, "Suppression impossible"));
    toast.success("Campagne supprimée");
    router.push("/campaigns");
  };

  const openEditEmail = (email: CampaignEmail) => {
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
      if (!res.ok) throw new Error(await readError(res, "Enregistrement impossible"));
      toast.success("Email mis à jour");
      setEditEmail(null);
      fetchCampaign();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleMarkReplied = async (email: CampaignEmail) => {
    setMarkingRepliedId(email.id);
    try {
      const res = await fetch(`/api/emails/${email.id}/mark-replied`, { method: "POST" });
      if (!res.ok) throw new Error(await readError(res, "Marquage impossible"));
      toast.success("Réponse enregistrée : relances arrêtées, prospect « En discussion ».");
      fetchCampaign();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setMarkingRepliedId(null);
    }
  };

  const handleDeleteEmail = async (email: CampaignEmail) => {
    const ok = await confirm({
      title: "Supprimer cet email ?",
      description: `L'email destiné à ${email.prospect.company} ne sera pas envoyé.`,
      confirmLabel: "Supprimer",
      destructive: true,
    });
    if (!ok) return;
    const res = await fetch(`/api/emails/${email.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(await readError(res, "Suppression impossible"));
    toast.success("Email supprimé");
    setViewEmail(null);
    fetchCampaign();
  };

  if (!campaign) {
    return loadError ? (
      <div role="alert" className="py-16 text-center">
        <p className="font-medium">{loadError}</p>
        <Link href="/campaigns" className={buttonVariants({ variant: "outline", className: "mt-4" })}>
          Retour aux campagnes
        </Link>
      </div>
    ) : (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const totalEmailPages = Math.max(1, Math.ceil(campaign.emails.length / EMAILS_PER_PAGE));
  const safeEmailPage = Math.min(emailPage, totalEmailPages);
  const paginatedEmails = campaign.emails.slice((safeEmailPage - 1) * EMAILS_PER_PAGE, safeEmailPage * EMAILS_PER_PAGE);
  const isActive = campaign.status === "ACTIVE";
  const canApprove = campaign.status !== "ACTIVE" && campaign.status !== "COMPLETED" && campaign.pendingCount > 0;
  const productLabel = campaign.product ? PRODUCT_LABELS[campaign.product] ?? campaign.product : "Tous produits";

  const steps = [
    { label: "Rédiger", done: campaign.emails.length > 0, hint: "Génération par l'assistant" },
    { label: "Relire", done: campaign.pendingCount === 0 && campaign.emails.length > 0, hint: `${campaign.pendingCount} à relire` },
    { label: "Activer", done: isActive || campaign.sentCount > 0, hint: "Approbation du lot" },
    { label: "Envoi", done: campaign.sentCount > 0, hint: `${campaign.sentCount} envoyé(s)` },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title={campaign.name}
        description={`${campaign.segment?.name || "Tous les prospects"} · ${productLabel} · ${
          LANGUAGE_LABELS[campaign.language] ?? campaign.language.toUpperCase()
        } · ton ${(TONE_LABELS[campaign.tone] ?? campaign.tone).toLowerCase()}`}
        icon={Mail}
        actions={
          <>
            <StatusBadge kind="campaign" value={campaign.status} className="mr-1" />
            <Button variant="outline" onClick={handleGenerate} disabled={busy !== null}>
              {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Rédiger les emails
            </Button>
            {isActive ? (
              <>
                <Button variant="outline" onClick={handleSendNow} disabled={busy !== null}>
                  {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer maintenant
                </Button>
                <Button variant="outline" onClick={() => setStatus("PAUSED")} disabled={busy !== null}>
                  <Pause className="h-4 w-4" />
                  Mettre en pause
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setStatus("ACTIVE")}
                disabled={busy !== null || (!canApprove && campaign.status !== "PAUSED")}
                title={!canApprove && campaign.status !== "PAUSED" ? "Rédigez et relisez des emails d'abord" : undefined}
              >
                <Play className="h-4 w-4" />
                {campaign.status === "PAUSED" ? "Reprendre" : "Approuver et activer"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Plus d'actions" />}>
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/campaigns/${id}/edit`)}>
                  <Pencil className="h-4 w-4" />
                  Modifier les paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => (window.location.href = `/api/export?type=campaign_emails&campaignId=${id}`)}>
                  <Download className="h-4 w-4" />
                  Exporter en CSV
                </DropdownMenuItem>
                {campaign.status !== "COMPLETED" ? (
                  <DropdownMenuItem onClick={() => setStatus("COMPLETED")}>
                    <CheckCircle2 className="h-4 w-4" />
                    Marquer comme terminée
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleDeleteCampaign}>
                  <Trash2 className="h-4 w-4" />
                  Supprimer la campagne
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Étapes de la campagne">
        {steps.map((step, i) => (
          <li
            key={step.label}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
              step.done && "border-primary/30 bg-primary/5"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{step.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{step.hint}</span>
            </span>
          </li>
        ))}
      </ol>

      {generatingQueued ? (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-sun/40 bg-sun/15 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rédaction en cours en arrière-plan : la liste se met à jour automatiquement.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="À relire" value={campaign.pendingCount} />
        <Kpi label="Envoyés" value={campaign.sentCount} />
        <Kpi label="Délivrés" value={campaign.deliveredCount ?? 0} hint={rate(campaign.deliveredCount, campaign.sentCount)} />
        <Kpi label="Ouverts" value={campaign.openCount} hint={rate(campaign.openCount, campaign.deliveredCount)} />
        <Kpi label="Réponses" value={campaign.replyCount} hint={rate(campaign.replyCount, campaign.sentCount)} />
        <Kpi label="Rebonds / échecs" value={campaign.bounceCount + (campaign.failedCount ?? 0)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emails de la campagne</CardTitle>
          <CardDescription>
            {campaign.emails.length} email(s) · relances : {campaign.maxFollowUps} maximum, tous les {campaign.followUpDelayDays} jours
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.emails.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <p className="font-medium">Aucun email pour l&apos;instant</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                L&apos;assistant rédige un email personnalisé pour chaque prospect du segment, dans sa langue. Vous
                pourrez tout relire et corriger avant d&apos;activer la campagne.
              </p>
              <Button className="mt-5" onClick={handleGenerate} disabled={busy !== null}>
                <Sparkles className="h-4 w-4" />
                Rédiger les emails
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Objet</TableHead>
                      <TableHead>Étape</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Envoyé le</TableHead>
                      <TableHead className="w-[150px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmails.map((email) => {
                      const sent = !["PENDING", "SENDING", "FAILED"].includes(email.status);
                      return (
                        <TableRow key={email.id}>
                          <TableCell>
                            <p className="font-medium">{email.prospect.company}</p>
                            <p className="text-xs text-muted-foreground">{email.prospect.email}</p>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <button
                              type="button"
                              className="block max-w-full truncate rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => setViewEmail(email)}
                            >
                              {email.subject}
                            </button>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {EMAIL_TYPE_LABELS[email.type] ?? email.type}
                          </TableCell>
                          <TableCell>
                            <StatusBadge kind="email" value={email.status} />
                          </TableCell>
                          <TableCell className="text-sm">
                            {email.sentAt ? new Date(email.sentAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-0.5">
                              <Button variant="ghost" size="icon-sm" aria-label="Lire l'email" title="Lire" onClick={() => setViewEmail(email)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {email.status === "PENDING" ? (
                                <Button variant="ghost" size="icon-sm" aria-label="Modifier l'email" title="Modifier" onClick={() => openEditEmail(email)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {sent && email.status !== "REPLIED" && email.status !== "BOUNCED" ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-success"
                                  disabled={markingRepliedId === email.id}
                                  aria-label="Le prospect a répondu"
                                  title="Le prospect a répondu"
                                  onClick={() => handleMarkReplied(email)}
                                >
                                  <MessageSquareReply className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {!sent ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  aria-label="Supprimer l'email"
                                  title="Supprimer"
                                  onClick={() => handleDeleteEmail(email)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      <Sheet open={viewEmail !== null} onOpenChange={(open) => !open && setViewEmail(null)}>
        <SheetContent className="flex max-h-dvh flex-col gap-0 overflow-hidden sm:max-w-lg">
          {viewEmail ? (
            <>
              <SheetHeader className="shrink-0 text-left">
                <SheetTitle className="pr-8 leading-snug">{viewEmail.subject}</SheetTitle>
                <SheetDescription>
                  {viewEmail.prospect.contact ? `${viewEmail.prospect.contact} · ` : ""}
                  {viewEmail.prospect.company} · {viewEmail.prospect.email}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto border-y px-4 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <StatusBadge kind="email" value={viewEmail.status} />
                  <span className="text-xs text-muted-foreground">{EMAIL_TYPE_LABELS[viewEmail.type] ?? viewEmail.type}</span>
                </div>
                <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm leading-relaxed">{viewEmail.body}</div>
                <p className="mt-3 text-xs text-muted-foreground">
                  La signature, le pied de page légal et le lien de désinscription sont ajoutés automatiquement à l&apos;envoi.
                </p>
              </div>
              <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setViewEmail(null)}>
                  Fermer
                </Button>
                {viewEmail.status === "PENDING" ? (
                  <Button
                    onClick={() => {
                      const e = viewEmail;
                      setViewEmail(null);
                      openEditEmail(e);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </Button>
                ) : null}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={editEmail !== null} onOpenChange={(open) => !open && setEditEmail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;email</DialogTitle>
          </DialogHeader>
          {editEmail ? (
            <div className="grid gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Destinataire : {editEmail.prospect.company} ({editEmail.prospect.email})
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="email-subject">Objet</Label>
                <Input id="email-subject" value={editSubject} maxLength={200} onChange={(e) => setEditSubject(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email-body">Message</Label>
                <Textarea
                  id="email-body"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="min-h-[260px] text-sm leading-relaxed"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmail(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEmail} disabled={savingEmail || !editSubject.trim() || !editBody.trim()}>
              {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
