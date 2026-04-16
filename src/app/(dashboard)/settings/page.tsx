"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Settings, UserPlus } from "lucide-react";
import { PageTitle } from "@/components/layout/page-title";

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    companyName: "",
    senderName: "",
    senderEmail: "",
    dailyEmailLimit: "50",
    emailSpacingSeconds: "30",
    defaultSignature: "",
  });
  const [defaultUser, setDefaultUser] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error("Erreur de chargement");
        const data = await res.json();
        setSettings({
          companyName: data.companyName || "",
          senderName: data.senderName || "",
          senderEmail: data.senderEmail || "",
          dailyEmailLimit: String(data.dailyEmailLimit ?? 50),
          emailSpacingSeconds: String(data.emailSpacingSeconds ?? 30),
          defaultSignature: data.defaultSignature || "",
        });
      } catch {
        toast.error("Impossible de charger les paramètres");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          dailyEmailLimit: parseInt(settings.dailyEmailLimit),
          emailSpacingSeconds: parseInt(settings.emailSpacingSeconds),
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      // Re-sync with persisted values
      const saved = await res.json();
      setSettings({
        companyName: saved.companyName || "",
        senderName: saved.senderName || "",
        senderEmail: saved.senderEmail || "",
        dailyEmailLimit: String(saved.dailyEmailLimit ?? 50),
        emailSpacingSeconds: String(saved.emailSpacingSeconds ?? 30),
        defaultSignature: saved.defaultSignature || "",
      });
      toast.success("Parametres sauvegardes");
    } catch {
      toast.error("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDefaultUser = async () => {
    if (!defaultUser.email || !defaultUser.password) {
      toast.error("Email et mot de passe requis");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch("/api/settings/default-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaultUser),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur de création");
      }
      toast.success("Utilisateur par défaut créé");
      setDefaultUser({ email: "", password: "", fullName: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageTitle
        title="Paramètres"
        description="Configuration globale de la plateforme"
        icon={Settings}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations entreprise</CardTitle>
          <CardDescription>
            Ces informations seront utilisees dans les emails generes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nom de l&apos;entreprise</Label>
            <Input
              value={settings.companyName}
              onChange={(e) =>
                setSettings({ ...settings, companyName: e.target.value })
              }
              placeholder="Votre Entreprise SARL"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom de l&apos;expediteur</Label>
              <Input
                value={settings.senderName}
                onChange={(e) =>
                  setSettings({ ...settings, senderName: e.target.value })
                }
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Email expediteur</Label>
              <Input
                value={settings.senderEmail}
                onChange={(e) =>
                  setSettings({ ...settings, senderEmail: e.target.value })
                }
                placeholder="commercial@entreprise.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration d&apos;envoi</CardTitle>
          <CardDescription>
            Parametres de delivrabilite et quotas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Limite emails/jour</Label>
              <Input
                type="number"
                value={settings.dailyEmailLimit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyEmailLimit: e.target.value,
                  })
                }
                min="1"
                max="500"
              />
            </div>
            <div className="space-y-2">
              <Label>Espacement entre emails (secondes)</Label>
              <Input
                type="number"
                value={settings.emailSpacingSeconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    emailSpacingSeconds: e.target.value,
                  })
                }
                min="5"
                max="300"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signature par defaut</CardTitle>
          <CardDescription>
            Utilisee automatiquement dans tous les emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={settings.defaultSignature}
            onChange={(e) =>
              setSettings({
                ...settings,
                defaultSignature: e.target.value,
              })
            }
            placeholder={"Cordialement,\nVotre nom\nTitre - Entreprise\nTel: +xxx"}
            rows={6}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateur par défaut</CardTitle>
          <CardDescription>
            Créez un compte administrateur initial depuis les paramètres
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email utilisateur</Label>
            <Input
              type="email"
              value={defaultUser.email}
              onChange={(e) =>
                setDefaultUser({ ...defaultUser, email: e.target.value })
              }
              placeholder="admin@scpb.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Nom complet (optionnel)</Label>
            <Input
              value={defaultUser.fullName}
              onChange={(e) =>
                setDefaultUser({ ...defaultUser, fullName: e.target.value })
              }
              placeholder="Administrateur SCPB"
            />
          </div>
          <div className="space-y-2">
            <Label>Mot de passe temporaire</Label>
            <Input
              type="password"
              value={defaultUser.password}
              onChange={(e) =>
                setDefaultUser({ ...defaultUser, password: e.target.value })
              }
              placeholder="Minimum 6 caractères"
              minLength={6}
            />
          </div>
          <Button
            onClick={handleCreateDefaultUser}
            disabled={creatingUser}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {creatingUser
              ? "Création en cours..."
              : "Créer l'utilisateur par défaut"}
          </Button>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full" disabled={loading || saving}>
        {loading ? "Chargement..." : saving ? "Sauvegarde..." : "Sauvegarder les parametres"}
      </Button>
    </div>
  );
}
