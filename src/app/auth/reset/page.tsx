"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Définition du mot de passe après une invitation ou un lien « mot de passe oublié ». */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10 || password !== confirm) return;
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("Le lien a expiré. Redemandez un lien depuis la page de connexion.");
      return;
    }
    toast.success("Mot de passe enregistré.");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <Image src="/brand/mark.png" alt="" width={40} height={40} className="mb-6 h-10 w-10" />
        <h1 className="text-2xl font-semibold">Définir votre mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">10 caractères minimum.</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={tooShort || undefined}
              aria-describedby={tooShort ? "pwd-hint" : undefined}
            />
            {tooShort ? <p id="pwd-hint" className="text-xs text-destructive">Au moins 10 caractères.</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmation</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "confirm-hint" : undefined}
            />
            {mismatch ? <p id="confirm-hint" className="text-xs text-destructive">Les deux mots de passe diffèrent.</p> : null}
          </div>
          <Button type="submit" className="h-11 w-full" disabled={loading || password.length < 10 || password !== confirm}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>
      </form>
    </main>
  );
}
