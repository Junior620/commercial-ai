"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Building2, Eye, EyeOff } from "lucide-react";

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
      <div className="relative flex w-full flex-col justify-between bg-[#0a0a0a] px-8 py-10 text-white lg:w-1/2">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            SCPB Commercial AI
          </span>
        </div>

        {/* Form area */}
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mb-1.5 text-2xl font-semibold tracking-tight">
            {isSignUp ? "Créer votre compte" : "Bon retour"}
          </h1>
          <p className="mb-8 text-sm text-neutral-400">
            {isSignUp
              ? "Bienvenue ! Remplissez les détails ci-dessous pour commencer."
              : "Connectez-vous pour accéder à votre espace commercial."}
          </p>

          {/* OAuth buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-white/5 text-sm font-medium text-white transition-colors hover:bg-white/10"
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
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-neutral-500">ou</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
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
                  className="h-10 w-full rounded-lg border border-white/15 bg-white/5 px-3 pr-10 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
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
              className="h-10 w-full rounded-lg bg-emerald-600 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Chargement..." : "Continuer"}
            </button>
          </form>

          {/* Toggle sign-up / sign-in */}
          <p className="mt-6 text-center text-sm text-neutral-400">
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
        <p className="text-center text-xs text-neutral-600">
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

      {/* ── Right panel: aurora visual ── */}
      <div className="relative hidden overflow-hidden bg-[#050505] lg:block lg:w-1/2">
        <div className="absolute inset-0">
          {/* Main bright teal core — bottom-right */}
          <div className="absolute bottom-[15%] right-[10%] h-[520px] w-[520px] rounded-full bg-[#0d9488] opacity-50 blur-[100px]" />
          {/* Secondary emerald glow — center */}
          <div className="absolute bottom-[30%] left-[20%] h-[450px] w-[550px] rounded-full bg-[#10b981] opacity-35 blur-[120px]" />
          {/* Deep teal wash — upper area */}
          <div className="absolute left-[10%] top-[10%] h-[400px] w-[500px] rounded-full bg-[#0f766e] opacity-40 blur-[130px]" />
          {/* Cyan accent — top-right */}
          <div className="absolute right-[5%] top-[20%] h-[300px] w-[350px] rounded-full bg-[#06b6d4] opacity-20 blur-[90px]" />
          {/* Hot spot — bright concentrated center */}
          <div className="absolute bottom-[25%] right-[25%] h-[250px] w-[250px] rounded-full bg-[#2dd4bf] opacity-30 blur-[60px]" />
          {/* Edge vignettes */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#050505_75%)]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
    </div>
  );
}
