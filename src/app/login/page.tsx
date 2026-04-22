"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Sparkles,
  Brain,
  Radar,
  PenLine,
  TrendingUp,
  ShieldCheck,
  Check,
} from "lucide-react";
import { AITypingDemo } from "@/components/ui/ai-typing-demo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Compte créé. Vérifiez votre email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Erreur de connexion"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: form ── */}
      <div className="relative flex w-full flex-col justify-between bg-[#0a0a0a] px-3 py-6 text-white max-[360px]:px-2.5 max-[360px]:py-5 sm:px-6 sm:py-10 lg:w-1/2 lg:px-8">
        {/* Logo */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5 sm:h-9 sm:w-9">
            <Image
              src="/logo.png"
              alt="Logo SCPB Commercial AI"
              width={36}
              height={36}
              className="h-full w-full object-contain p-0.5"
              priority
            />
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="truncate text-sm font-bold tracking-tight max-[360px]:max-w-[9.5rem] sm:text-lg">
              SCPB Commercial AI
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-gradient-to-r from-violet-500 via-indigo-500 to-fuchsia-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
              <Sparkles className="h-3 w-3 animate-pulse" />
              IA
            </span>
          </div>
        </div>

        {/* Form area */}
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] font-medium text-violet-200 max-[360px]:text-[9px] sm:px-2.5 sm:text-[11px]">
            <Sparkles className="h-3 w-3 animate-pulse" />
            Plateforme commerciale propulsée par l’IA
          </div>
          <h1 className="mb-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {isSignUp ? "Créer votre compte" : "Bon retour"}
          </h1>
          <p className="mb-5 text-xs text-neutral-400 sm:mb-6 sm:text-sm">
            {isSignUp
              ? "Activez votre assistant commercial IA : scraping, scoring, rédaction et suivi automatiques."
              : "Connectez-vous pour retrouver votre assistant IA et vos campagnes en cours."}
          </p>

          {isSignUp && (
            <ul className="mb-5 space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-neutral-300 sm:mb-6 sm:space-y-2 sm:p-3 sm:text-xs">
              {[
                "Scraping intelligent + enrichissement des contacts",
                "Scoring IA des prospects et priorisation auto",
                "Emails rédigés par Claude dans la langue du prospect",
                "Relances et classification des réponses pilotées par IA",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 text-xs font-medium text-white transition-colors hover:bg-white/10 sm:h-10 sm:gap-2.5 sm:text-sm"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3 sm:my-6">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-neutral-500">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-300"
              >
                Adresse email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Entrez votre adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-xs text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 sm:h-10 sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-300"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Entrez votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-9 w-full rounded-lg border border-white/15 bg-white/5 px-3 pr-10 text-xs text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 sm:h-10 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors hover:text-neutral-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-9 w-full rounded-lg bg-emerald-600 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:text-sm"
            >
              {loading ? "Chargement..." : "Continuer"}
            </button>
          </form>

          {/* Toggle sign-up / sign-in */}
          <p className="mt-5 text-center text-xs text-neutral-400 sm:mt-6 sm:text-sm">
            {isSignUp ? (
              <>
                Vous avez déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  Se connecter
                </button>
              </>
            ) : (
              <>
                Pas encore de compte ?{" "}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                >
                  S&apos;inscrire
                </button>
              </>
            )}
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-neutral-600 sm:text-xs">
          En continuant, vous acceptez nos{" "}
          <span className="text-neutral-400 underline underline-offset-2">
            Conditions d&apos;utilisation
          </span>{" "}
          et notre{" "}
          <span className="text-neutral-400 underline underline-offset-2">
            Politique de confidentialité
          </span>
          .
        </p>
      </div>

      {/* ── Right panel: AI showcase ── */}
      <div className="relative hidden overflow-hidden bg-[#050505] text-white lg:block lg:w-1/2">
        {/* Ambient aurora background */}
        <div className="absolute inset-0">
          <div className="absolute bottom-[15%] right-[10%] h-[520px] w-[520px] rounded-full bg-[#6d28d9] opacity-40 blur-[110px]" />
          <div className="absolute bottom-[30%] left-[15%] h-[450px] w-[550px] rounded-full bg-[#4f46e5] opacity-30 blur-[130px]" />
          <div className="absolute left-[10%] top-[10%] h-[400px] w-[500px] rounded-full bg-[#0d9488] opacity-25 blur-[130px]" />
          <div className="absolute right-[5%] top-[20%] h-[300px] w-[350px] rounded-full bg-[#ec4899] opacity-20 blur-[90px]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050505_75%)]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Showcase content */}
        <div className="relative flex h-full min-h-0 flex-col justify-between px-6 py-8 xl:px-10 xl:py-10">
          {/* Top: status pill */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-neutral-200 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Assistant IA · en ligne
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100 backdrop-blur">
              <Brain className="h-3 w-3" />
              Claude 3.5 + scoring maison
            </div>
          </div>

          {/* Middle: hero text + live demo + feature cards */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="max-w-md text-2xl font-semibold leading-tight tracking-tight xl:text-3xl">
                Une équipe commerciale{" "}
                <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-indigo-200 bg-clip-text text-transparent">
                  augmentée par l’IA
                </span>
                .
              </h2>
              <p className="max-w-md text-sm text-neutral-300">
                Détection, scoring, rédaction et suivi — votre pipeline tourne 24/7.
              </p>
            </div>

            {/* Live typing demo */}
            <AITypingDemo className="max-w-md" />

            {/* Floating feature cards (compact) */}
            <div className="grid max-w-md grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <FeatureCard
                icon={Radar}
                title="Scraping intelligent"
                description="Google Maps + enrichissement email & site, filtré pays/secteur."
                accent="from-sky-500/30 to-cyan-500/10"
              />
              <FeatureCard
                icon={Brain}
                title="Scoring IA"
                description="Chaque lead reçoit un score 0-100 et une priorité auto."
                accent="from-violet-500/30 to-fuchsia-500/10"
              />
              <FeatureCard
                icon={PenLine}
                title="Rédaction Claude"
                description="Emails personnalisés dans la langue du prospect."
                accent="from-indigo-500/30 to-violet-500/10"
              />
              <FeatureCard
                icon={TrendingUp}
                title="Suivi & relances"
                description="Classification des réponses, relances au bon moment."
                accent="from-emerald-500/30 to-teal-500/10"
              />
            </div>
          </div>

          {/* Bottom: trust row */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-xs text-neutral-300 backdrop-blur sm:px-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Données chiffrées · Auth Supabase · RGPD-friendly</span>
            </div>
            <div className="hidden items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-400 xl:flex">
              <Sparkles className="h-3 w-3 text-violet-300" />
              Propulsé par IA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: typeof Brain;
  title: string;
  description: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-sm transition-colors hover:border-white/20">
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${accent} blur-2xl`}
      />
      <div className="relative flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-neutral-300">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
