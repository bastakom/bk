"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createWorkspace } from "./actions";

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspace, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Byråns namn</Label>
        <Input id="name" name="name" placeholder="Reklambyrån Bästa Kompisar" required />
      </div>
      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        Skapa byrå
      </Button>
    </form>
  );
}
