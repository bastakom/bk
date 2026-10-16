"use client";

import { t, type Lang } from "@rp/core";
import { Lock } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unlockShare } from "./actions";

export function PasswordForm({ token, agency, logoUrl, lang = "sv" }: { token: string; agency: string; logoUrl: string | null; lang?: Lang }) {
  const [state, action, pending] = useActionState(unlockShare.bind(null, token, lang), null);
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <form action={action} className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-soft">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={agency} className="h-8 object-contain" />
        ) : (
          <p className="text-sm font-medium text-muted-foreground">{agency}</p>
        )}
        <div className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Lock className="size-4" /> {t(lang, "protected")}
          </h1>
          <p className="text-sm text-muted-foreground">{lang === "en" ? "Enter the password you received from the agency." : "Ange lösenordet du fått från byrån."}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t(lang, "password")}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {t(lang, "showReport")}
        </Button>
      </form>
    </div>
  );
}
