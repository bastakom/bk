"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptAsNewUser } from "./actions";

export function NewUserForm({ token, email, name }: { token: string; email: string; name: string }) {
  const [state, action, pending] = useActionState(acceptAsNewUser.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" value={email} readOnly disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Namn</Label>
        <Input id="name" name="name" defaultValue={name} autoComplete="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Välj lösenord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="text-xs text-muted-foreground">Minst 10 tecken.</p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Kom igång
      </Button>
    </form>
  );
}
