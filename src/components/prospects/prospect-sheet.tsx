"use client";

import { Building2, ExternalLink, Globe, Mail, MapPin, Pencil, Phone, Star, Tag, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/status-badge";
import { LANGUAGE_LABELS } from "@/lib/labels";
import { PRODUCT_LABELS } from "@/lib/product-catalog";
import { cn } from "@/lib/utils";
import { CLIENT_TYPE_LABELS, SOURCE_LABELS, countryName, scoreTone, type Prospect } from "@/components/prospects/types";
import { FitBadge, NeedChips } from "@/components/prospects/fit-badge";
import { checkOutreachAllowed } from "@/lib/compliance";
import { DecisionMakers } from "@/components/prospects/decision-makers";

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {href && value ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1 break-all text-sm font-medium text-primary hover:underline"
          >
            {value}
            {external ? <ExternalLink className="h-3 w-3 shrink-0" /> : null}
          </a>
        ) : (
          <p className="text-sm font-medium">{value || "—"}</p>
        )}
      </div>
    </div>
  );
}

export function ProspectSheet({
  prospect,
  onClose,
  onEdit,
  onDelete,
}: {
  prospect: Prospect | null;
  onClose: () => void;
  onEdit: (p: Prospect) => void;
  onDelete: (p: Prospect) => void;
}) {
  const compliance = prospect ? checkOutreachAllowed(prospect.email, prospect.country) : null;
  const website = prospect?.website ? (prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`) : undefined;
  return (
    <Sheet open={prospect !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
        {prospect ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 pr-8 text-lg">
                <Building2 className="h-5 w-5 shrink-0 text-primary" />
                {prospect.company}
              </SheetTitle>
              <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                <StatusBadge kind="prospect" value={prospect.status} />
                <StatusBadge kind="priority" value={prospect.priority} />
                <FitBadge fit={prospect.targetFit} />
                <span className={cn("ml-auto text-sm font-semibold", scoreTone(prospect.score))}>Score {prospect.score}/100</span>
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 border-y px-4 py-5">
              {prospect.emailInvalidReason ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  Adresse inutilisable : {prospect.emailInvalidReason}. Aucun email ne sera envoyé tant qu&apos;elle n&apos;est pas corrigée.
                </p>
              ) : null}
              {compliance?.strict ? (
                <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <span className="font-medium">Pays à accord préalable.</span>{" "}
                  {compliance.allowed
                    ? "Adresse générique d'entreprise : un seul message, court et sans relance."
                    : "Adresse nominative : ce prospect n'est repris dans aucune campagne. Remplacez-la par une adresse générique (contact@, info@, achats@…) pour pouvoir lui écrire."}
                </p>
              ) : null}
              {prospect.targetFitManual ? (
                <p className="text-xs text-muted-foreground">Adéquation corrigée à la main : elle n&apos;est plus recalculée automatiquement.</p>
              ) : null}
              {prospect.productNeeds?.length ? (
                <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Produits pertinents</p>
                  <NeedChips needs={prospect.productNeeds} />
                </div>
              ) : null}
              <DetailRow icon={User} label="Contact" value={prospect.contact} />
              <DecisionMakers key={prospect.id} prospectId={prospect.id} company={prospect.company} />
              <DetailRow icon={Mail} label="Email" value={prospect.email} href={`mailto:${prospect.email}`} />
              <DetailRow icon={Phone} label="Téléphone" value={prospect.phone} href={prospect.phone ? `tel:${prospect.phone}` : undefined} />
              <DetailRow icon={MapPin} label="Pays" value={countryName(prospect.country)} />
              <DetailRow icon={Tag} label="Activité" value={prospect.sector} />
              <DetailRow icon={Star} label="Type de client" value={prospect.clientType ? CLIENT_TYPE_LABELS[prospect.clientType] ?? prospect.clientType : null} />
              <DetailRow icon={Tag} label="Produit d'intérêt" value={prospect.product ? PRODUCT_LABELS[prospect.product] ?? prospect.product : null} />
              <DetailRow icon={Globe} label="Site web" value={prospect.website} href={website} external />
              <DetailRow icon={Tag} label="Langue" value={LANGUAGE_LABELS[prospect.language] ?? prospect.language} />
              <DetailRow icon={Tag} label="Origine" value={prospect.source ? SOURCE_LABELS[prospect.source] ?? prospect.source : null} />
              {prospect.notes ? (
                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap text-sm">{prospect.notes}</p>
                </div>
              ) : null}
            </div>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onEdit(prospect)}>
                <Pencil className="h-4 w-4" />
                Modifier
              </Button>
              <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => onDelete(prospect)}>
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
