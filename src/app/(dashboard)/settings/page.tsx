"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Settings, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageTitle } from "@/components/layout/page-title";
import { ConfigHealthCard } from "@/components/settings/config-health-card";

type SettingsForm = {
  companyAddress: string;
  dailyEmailLimit: string;
  emailSpacingSeconds: string;
  weeklyEmailTarget: string;
  weeklyNewProspectTarget: string;
  weeklyReplyTarget: string;
  alertBouncePctThreshold: string;
  minDaysBetweenCampaigns: string;
};

type Member = { id: string; email: string; name: string | null; role: string; active: boolean };

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrateur" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "DIRECTION", label: "Direction (lecture seule)" },
];

const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

function toForm(data: Record<string, unknown>): SettingsForm {
  return {
    companyAddress: String(data.companyAddress ?? ""),
    dailyEmailLimit: String(data.dailyEmailLimit ?? 50),
    emailSpacingSeconds: String(data.emailSpacingSeconds ?? 30),
    weeklyEmailTarget: String(data.weeklyEmailTarget ?? 200),
    weeklyNewProspectTarget: String(data.weeklyNewProspectTarget ?? 30),
    weeklyReplyTarget: String(data.weeklyReplyTarget ?? 5),
    alertBouncePctThreshold: String(data.alertBouncePctThreshold ?? 5),
    minDaysBetweenCampaigns: String(data.minDaysBetweenCampaigns ?? 30),
  };
}

function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" inputMode="numeric" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MembersCard({ onAccess }: { onAccess: (isAdmin: boolean) => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [invite, setInvite] = useState({ email: "", name: "", role: "COMMERCIAL" });
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/members");
    if (res.status === 403) return setForbidden(true);
    if (res.ok) {
      setMembers(await res.json());
      onAccess(true);
    }
  }, [onAccess]);

  useEffect(() => {
    load();
  }, [load]);

  if (forbidden) return null;

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invite),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invitation impossible");
      toast.success(
        data.invitationSimulated
          ? `Membre ajouté. Resend n'est pas configuré ici : le lien d'invitation est affiché dans la console du serveur.`
          : `Invitation envoyée à ${invite.email}`
      );
      setInvite({ email: "", name: "", role: "COMMERCIAL" });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setInviting(false);
    }
  };

  const update = async (member: Member, data: Partial<Pick<Member, "role" | "active">>) => {
    const res = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.error || "Mise à jour impossible");
    toast.success("Membre mis à jour");
    load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Équipe</CardTitle>
        <CardDescription>
          L&apos;accès est réservé aux membres invités. Chaque invité reçoit un email avec un lien personnel pour définir
          son mot de passe. Un membre désactivé ne peut plus se connecter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={sendInvite} className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email professionnel</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="prenom.nom@entreprise.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nom (facultatif)</Label>
            <Input id="invite-name" value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rôle</Label>
            <Select items={ROLE_LABELS} value={invite.role} onValueChange={(v) => v && setInvite({ ...invite, role: v })}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting || !invite.email}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Inviter
          </Button>
        </form>

        {members === null ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Membre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className="text-right">Accès</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className={m.active ? undefined : "opacity-60"}>
                    <TableCell>
                      <p className="font-medium">{m.name || m.email}</p>
                      {m.name ? <p className="text-xs text-muted-foreground">{m.email}</p> : null}
                    </TableCell>
                    <TableCell>
                      <Select items={ROLE_LABELS} value={m.role} onValueChange={(v) => v && v !== m.role && update(m, { role: v })}>
                        <SelectTrigger className="w-52" aria-label={`Rôle de ${m.email}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={m.active}
                        onCheckedChange={(checked) => update(m, { active: checked })}
                        aria-label={m.active ? `Désactiver ${m.email}` : `Réactiver ${m.email}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const set = (key: keyof SettingsForm) => (value: string) => setForm((f) => (f ? { ...f, [key]: value } : f));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        setForm(toForm(await res.json()));
      } catch {
        toast.error("Impossible de charger les paramètres");
        setForm(toForm({}));
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyAddress: form.companyAddress,
          dailyEmailLimit: Number(form.dailyEmailLimit),
          emailSpacingSeconds: Number(form.emailSpacingSeconds),
          weeklyEmailTarget: Number(form.weeklyEmailTarget),
          weeklyNewProspectTarget: Number(form.weeklyNewProspectTarget),
          weeklyReplyTarget: Number(form.weeklyReplyTarget),
          alertBouncePctThreshold: Number(form.alertBouncePctThreshold),
          minDaysBetweenCampaigns: Number(form.minDaysBetweenCampaigns),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur de sauvegarde");
      setForm(toForm(data));
      toast.success("Paramètres enregistrés");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageTitle title="Paramètres" description="Règles d'envoi, mentions légales, objectifs et équipe." icon={Settings} />

      <ConfigHealthCard isAdmin={isAdmin} />

      {!form ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Envoi et délivrabilité</CardTitle>
              <CardDescription>
                Un rythme modéré protège la réputation du domaine expéditeur. Pour une reprise : 20 emails par jour et 60 secondes
                d&apos;espacement, puis augmentez par paliers si les rebonds restent sous 2 %.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField id="daily-limit" label="Emails par jour (toutes campagnes)" value={form.dailyEmailLimit} onChange={set("dailyEmailLimit")} min={1} max={500} />
              <NumberField
                id="spacing"
                label="Espacement entre deux emails (secondes)"
                hint="60 à 120 secondes recommandées."
                value={form.emailSpacingSeconds}
                onChange={set("emailSpacingSeconds")}
                min={0}
                max={600}
              />
              <NumberField
                id="bounce-alert"
                label="Seuil de rebonds (%)"
                hint="Au-delà sur 7 jours (20 envois minimum), toutes les campagnes passent en pause automatiquement."
                value={form.alertBouncePctThreshold}
                onChange={set("alertBouncePctThreshold")}
                min={1}
                max={100}
              />
              <NumberField
                id="campaign-gap"
                label="Délai entre deux campagnes pour un même prospect (jours)"
                hint="Un prospect contacté récemment n'est pas repris dans une autre campagne avant ce délai."
                value={form.minDaysBetweenCampaigns}
                onChange={set("minDaysBetweenCampaigns")}
                min={0}
                max={365}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mentions légales des emails</CardTitle>
              <CardDescription>
                L&apos;adresse postale figure en pied de chaque email, avec la source des données et le lien de désinscription.
                Le nom, le poste et la signature de l&apos;expéditeur sont définis par les variables SENDER_* du serveur.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <Label htmlFor="company-address">Adresse postale de l&apos;entreprise</Label>
                <Input
                  id="company-address"
                  value={form.companyAddress}
                  onChange={(e) => set("companyAddress")(e.target.value)}
                  placeholder="Rue, BP, ville, pays"
                  maxLength={300}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Objectifs hebdomadaires</CardTitle>
              <CardDescription>Affichés sur le tableau de bord (7 jours glissants).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <NumberField id="target-emails" label="Emails envoyés" value={form.weeklyEmailTarget} onChange={set("weeklyEmailTarget")} min={0} />
              <NumberField id="target-prospects" label="Nouveaux prospects" value={form.weeklyNewProspectTarget} onChange={set("weeklyNewProspectTarget")} min={0} />
              <NumberField id="target-replies" label="Réponses" value={form.weeklyReplyTarget} onChange={set("weeklyReplyTarget")} min={0} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer les paramètres
            </Button>
          </div>
        </form>
      )}

      <MembersCard onAccess={setIsAdmin} />
    </div>
  );
}
