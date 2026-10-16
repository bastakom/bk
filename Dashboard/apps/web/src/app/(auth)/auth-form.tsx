"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

const ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Fel e-post eller lösenord.",
  USER_ALREADY_EXISTS: "Det finns redan ett konto med den e-postadressen.",
  PASSWORD_TOO_SHORT: "Lösenordet måste vara minst 10 tecken.",
};

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const res =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: String(form.get("name")) });
    setPending(false);
    if (res.error) {
      setError(ERRORS[res.error.code ?? ""] ?? res.error.message ?? "Något gick fel.");
      return;
    }
    router.push(next?.startsWith("/") ? next : "/clients");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "sign-up" && (
        <div className="space-y-2">
          <Label htmlFor="name">Namn</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Lösenord</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={10}
          required
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {mode === "sign-in" ? "Logga in" : "Skapa konto"}
      </Button>
    </form>
  );
}
