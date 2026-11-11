"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AITypingDemo } from "@/components/ui/ai-typing-demo";

const ERRORS: Record<string, string> = {
  forbidden: "Ce compte n'a pas accès à l'application. Demandez une invitation à un administrateur.",
  auth: "Le lien de connexion est invalide ou a expiré.",
};

function translateAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirmez d'abord votre adresse email (lien reçu par email).";
  if (/rate limit/i.test(message)) return "Trop de tentatives. Patientez quelques minutes.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorKey = params.get("error");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
        });
        if (error) throw error;
        toast.success("Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      toast.error(translateAuthError(err instanceof Error ? err.message : "Erreur de connexion"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-3xl font-semibold tracking-tight">
        {mode === "login" ? "Connexion" : "Mot de passe oublié"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "login"
          ? "Espace réservé à l'équipe commerciale SCPB."
          : "Indiquez votre adresse professionnelle : nous vous enverrons un lien pour définir un nouveau mot de passe."}
      </p>

      {errorKey && ERRORS[errorKey] ? (
        <p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ERRORS[errorKey]}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom.nom@entreprise.com"
            className="h-11"
          />
        </div>

        {mode === "login" ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <button
                type="button"
                onClick={() => setMode("reset")}
                className="rounded text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        ) : null}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={loading || !email || (mode === "login" && !password)}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "login" ? "Se connecter" : "Envoyer le lien"}
        </Button>

        {mode === "reset" ? (
          <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>
            Retour à la connexion
          </Button>
        ) : null}
      </form>

      <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Accès sur invitation uniquement. Pour rejoindre l&apos;équipe, contactez un administrateur de l&apos;application.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <Image src="/brand/mark.png" alt="" width={36} height={36} className="h-9 w-9" priority />
          <span className="font-heading text-lg font-semibold">SCPB Commercial</span>
        </div>
        <div className="flex flex-1 items-center py-10">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} SCPB · Outil interne</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#EDEFDC] text-[#1F2510] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#F7AD21]/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#94A538]/20 blur-3xl" />
        <div className="relative">
          <Image src="/brand/logo.png" alt="SCPB" width={200} height={133} className="h-24 w-auto" priority />
          <h2 className="mt-10 max-w-md text-4xl font-semibold leading-tight text-[#26300F]">
            Trouver, convaincre et suivre les acheteurs de la filière cacao.
          </h2>
          <ul className="mt-8 space-y-3 text-[15px] text-[#3F4824]">
            <li>Recherche de chocolatiers, importateurs et industriels qualifiés</li>
            <li>Emails rédigés dans la langue de chaque prospect, relus avant envoi</li>
            <li>Envoi progressif, relances et suivi des réponses</li>
          </ul>
        </div>
        <div className="relative mt-10 max-w-lg">
          <AITypingDemo />
        </div>
      </aside>
    </div>
  );
}
