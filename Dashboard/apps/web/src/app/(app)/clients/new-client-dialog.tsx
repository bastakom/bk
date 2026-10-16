"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "./actions";

const CURRENCIES = ["SEK", "EUR", "USD", "NOK", "DKK", "GBP"];
const TIMEZONES = ["Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"];

/** `defaultOpen`: öppnas direkt, t.ex. från kommandopaletten (/clients?ny=1). */
export function NewClientDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [state, action, pending] = useActionState(createClient, null);
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Ny kund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Ny kund</DialogTitle>
            <DialogDescription>Rapportvaluta och tidszon används när data från olika konton slås ihop.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">Namn</Label>
            <Input id="name" name="name" required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Rapportvaluta</Label>
              <Select name="currency" defaultValue="SEK">
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Tidszon</Label>
              <Select name="timezone" defaultValue="Europe/Stockholm">
                <SelectTrigger id="timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Kundens färg</Label>
            <div className="flex items-center gap-3">
              <Input id="primaryColor" name="primaryColor" type="color" defaultValue="#0F2A44" className="h-9 w-14 p-1" />
              <span className="text-sm text-muted-foreground">Används i rapportens omslag och rubriker.</span>
            </div>
          </div>
          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Skapa kund
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
