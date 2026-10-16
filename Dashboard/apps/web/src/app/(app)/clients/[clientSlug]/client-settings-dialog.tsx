"use client";

import { LANGUAGES } from "@rp/core";
import { Settings2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LogoInput } from "@/components/logo-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateClient } from "../actions";

const CURRENCIES = ["SEK", "EUR", "USD", "NOK", "DKK", "GBP"] as const;
const TIMEZONES = ["Europe/Stockholm", "Europe/Oslo", "Europe/Copenhagen", "Europe/Helsinki", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"];

interface ClientValues {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  locale: string;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
}

export function ClientSettingsDialog({ client }: { client: ClientValues }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(client);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), o && setV(client))}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 /> Inställningar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Kundinställningar</DialogTitle>
          <DialogDescription>Logga och färger används i kundens rapporter, PDF-omslag och delade länkar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Namn</Label>
            <Input id="c-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Kundens logga</Label>
            <LogoInput value={v.logoUrl} onChange={(logoUrl) => setV({ ...v, logoUrl })} label="Kundens logga" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-primary">Huvudfärg</Label>
              <Input id="c-primary" type="color" value={v.primaryColor} onChange={(e) => setV({ ...v, primaryColor: e.target.value })} className="h-9 w-full p-1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-accent">Accentfärg</Label>
              <Input id="c-accent" type="color" value={v.accentColor} onChange={(e) => setV({ ...v, accentColor: e.target.value })} className="h-9 w-full p-1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-rapportvaluta">Rapportvaluta</Label>
              <Select value={v.currency} onValueChange={(currency) => setV({ ...v, currency })}>
                <SelectTrigger id="f-rapportvaluta" className="w-full">
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
            <div className="space-y-1.5">
              <Label>Rapportspråk</Label>
              <Select value={v.locale.startsWith("en") ? "en-GB" : "sv-SE"} onValueChange={(locale) => setV({ ...v, locale })}>
                <SelectTrigger className="w-full" aria-label="Rapportspråk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Delade länkar, PDF:er och utskick. Appen är på svenska.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-tidszon">Tidszon</Label>
              <Select value={v.timezone} onValueChange={(timezone) => setV({ ...v, timezone })}>
                <SelectTrigger id="f-tidszon" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await updateClient({ ...v, currency: v.currency as (typeof CURRENCIES)[number], locale: v.locale.startsWith("en") ? "en-GB" : "sv-SE" });
                if (res.ok) {
                  toast.success(res.message);
                  setOpen(false);
                } else toast.error(res.error);
              })
            }
          >
            Spara
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
