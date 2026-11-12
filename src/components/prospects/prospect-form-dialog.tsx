"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGE_LABELS, PRIORITY_LABELS, PROSPECT_STATUS_LABELS } from "@/lib/labels";
import { PRODUCT_LABELS } from "@/lib/product-catalog";
import { CLIENT_TYPE_LABELS, type Prospect } from "@/components/prospects/types";

type FormValues = {
  company: string;
  contact: string;
  email: string;
  phone: string;
  country: string;
  sector: string;
  website: string;
  clientType: string;
  product: string;
  language: string;
  priority: string;
  status: string;
  notes: string;
  targetFit: string;
};

const NONE = "__none__";
const PRODUCTS = ["cocoa_beans", "cocoa_butter", "cocoa_powder", "cocoa_mass", "derivatives", "food_chocolate", "cosmetics", "coffee_beans", "green_coffee"];

function toValues(p: Prospect | null): FormValues {
  return {
    company: p?.company ?? "",
    contact: p?.contact ?? "",
    email: p?.email ?? "",
    phone: p?.phone ?? "",
    country: p?.country ?? "",
    sector: p?.sector ?? "",
    website: p?.website ?? "",
    clientType: p?.clientType ?? "",
    product: p?.product ?? "",
    language: p?.language ?? "",
    priority: p?.priority ?? "MEDIUM",
    status: p?.status ?? "NEW",
    notes: p?.notes ?? "",
    targetFit: p?.targetFit ?? "",
  };
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  allowNone,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  allowNone?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={allowNone ? { [NONE]: allowNone, ...options } : options}
        value={value || NONE}
        onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value={NONE}>{allowNone}</SelectItem> : null}
          {Object.entries(options).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Formulaire unique d'ajout et de modification d'un prospect. */
export function ProspectFormDialog({
  open,
  onOpenChange,
  prospect,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = création */
  prospect: Prospect | null;
  onSaved: (saved: Prospect, isNew: boolean) => void;
}) {
  const [values, setValues] = useState<FormValues>(toValues(prospect));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = prospect === null;
  const set = (key: keyof FormValues) => (v: string) => setValues((s) => ({ ...s, [key]: v }));

  useEffect(() => {
    if (open) {
      setValues(toValues(prospect));
      setError(null);
    }
  }, [open, prospect]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const opt = (v: string) => (v.trim() ? v.trim() : isNew ? undefined : null);
    const body = {
      company: values.company.trim(),
      email: values.email.trim(),
      country: values.country.trim(),
      contact: opt(values.contact),
      phone: opt(values.phone),
      sector: opt(values.sector),
      website: opt(values.website),
      clientType: opt(values.clientType),
      product: opt(values.product),
      notes: opt(values.notes),
      priority: values.priority,
      ...(values.language ? { language: values.language } : {}),
      ...(isNew ? {} : { status: values.status, ...(values.targetFit ? { targetFit: values.targetFit } : {}) }),
    };
    try {
      const res = await fetch(isNew ? "/api/prospects" : `/api/prospects/${prospect!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible");
      onSaved(data, isNew);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Ajouter un prospect" : "Modifier le prospect"}</DialogTitle>
          <DialogDescription>Les champs marqués * sont obligatoires.</DialogDescription>
        </DialogHeader>
        <form id="prospect-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pf-company">Entreprise *</Label>
            <Input id="pf-company" required maxLength={200} value={values.company} onChange={(e) => set("company")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-contact">Contact</Label>
            <Input id="pf-contact" maxLength={120} value={values.contact} onChange={(e) => set("contact")(e.target.value)} placeholder="Prénom Nom" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-email">Email *</Label>
            <Input id="pf-email" type="email" required value={values.email} onChange={(e) => set("email")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-phone">Téléphone</Label>
            <Input id="pf-phone" type="tel" value={values.phone} onChange={(e) => set("phone")(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-country">Pays *</Label>
            <Input id="pf-country" required value={values.country} onChange={(e) => set("country")(e.target.value)} placeholder="Code (BE) ou nom (Belgique)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pf-website">Site web</Label>
            <Input id="pf-website" value={values.website} onChange={(e) => set("website")(e.target.value)} placeholder="https://" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-sector">Activité</Label>
            <Input id="pf-sector" value={values.sector} onChange={(e) => set("sector")(e.target.value)} placeholder="Ex. : fabricant de chocolat" />
          </div>
          <SelectField id="pf-type" label="Type de client" value={values.clientType} onChange={set("clientType")} options={CLIENT_TYPE_LABELS} allowNone="Non défini" />
          <SelectField
            id="pf-product"
            label="Produit d'intérêt"
            value={values.product}
            onChange={set("product")}
            options={Object.fromEntries(PRODUCTS.map((p) => [p, PRODUCT_LABELS[p] ?? p]))}
            allowNone="Non défini"
          />
          <SelectField
            id="pf-language"
            label="Langue"
            value={values.language}
            onChange={set("language")}
            options={Object.fromEntries(["fr", "en", "es", "pt", "de"].map((l) => [l, LANGUAGE_LABELS[l]]))}
            allowNone="Selon le pays"
          />
          <SelectField id="pf-priority" label="Priorité" value={values.priority} onChange={set("priority")} options={PRIORITY_LABELS} />
          {!isNew ? <SelectField id="pf-status" label="Statut" value={values.status} onChange={set("status")} options={PROSPECT_STATUS_LABELS} /> : null}
          {!isNew ? (
            <SelectField
              id="pf-fit"
              label="Adéquation à la cible"
              value={values.targetFit}
              onChange={set("targetFit")}
              options={{ CORE: "Cœur de cible", SECONDARY: "Secondaire", OUT_OF_SCOPE: "Hors cible" }}
            />
          ) : null}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pf-notes">Notes</Label>
            <Textarea id="pf-notes" rows={3} value={values.notes} onChange={(e) => set("notes")(e.target.value)} />
          </div>
          {!isNew && values.status === "UNSUBSCRIBED" && prospect?.status !== "UNSUBSCRIBED" ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm sm:col-span-2">
              L&apos;adresse sera ajoutée à la liste d&apos;exclusion : elle ne recevra plus aucun email, même dans d&apos;autres campagnes.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="prospect-form" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNew ? "Ajouter" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
