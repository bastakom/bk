"use client";

import { Check, Copy, LayoutGrid, Link2, Loader2, Lock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { timeAgo } from "@/lib/format";
import { createShareLink, revokeShareLink, setInPortal } from "./share-actions";

export interface ShareRowView {
  id: string;
  url: string;
  label: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  allowDateChange: boolean;
  allowPdf: boolean;
  viewCount: number;
  lastViewedAt: string | null;
}

const dateFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric" });

export function ShareDialog({
  open,
  onOpenChange,
  dashboardId,
  links,
  inPortal,
  portalUsers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dashboardId: string;
  links: ShareRowView[];
  inPortal: boolean;
  portalUsers: number;
}) {
  const [pending, start] = useTransition();
  const [portalPending, startPortal] = useTransition();
  const [portal, setPortal] = useState(inPortal);
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [expires, setExpires] = useState("0");
  const [allowDateChange, setAllowDateChange] = useState(true);
  const [allowPdf, setAllowPdf] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(url);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Dela med kund</DialogTitle>
          <DialogDescription>En läslänk till dashboarden – ingen inloggning behövs. Mottagaren ser samma data som här men kan inte ändra något.</DialogDescription>
        </DialogHeader>

        <section aria-label="Kundportal" className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
          <LayoutGrid className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[var(--primary)]"
                checked={portal}
                disabled={portalPending}
                onChange={(e) => {
                  const next = e.target.checked;
                  setPortal(next);
                  startPortal(async () => {
                    const res = await setInPortal(dashboardId, next);
                    if (res.ok) toast.success(res.message);
                    else {
                      setPortal(!next);
                      toast.error(res.error);
                    }
                  });
                }}
              />
              Visa i kundportalen
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {portalUsers > 0 ? `${portalUsers} ${portalUsers === 1 ? "person" : "personer"} hos kunden loggar in och ser rapporten. ` : "Ingen hos kunden har inloggning än. "}
              <Link href="/settings" className="font-medium text-link underline-offset-2 hover:underline">
                {portalUsers > 0 ? "Hantera inloggningar" : "Bjud in kunden"}
              </Link>
            </p>
          </div>
        </section>

        {links.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <Link2 className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-medium">
                    {l.label || "Länk"} {l.hasPassword && <Lock className="size-3.5 text-muted-foreground" aria-label="Lösenordsskyddad" />}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.viewCount} visningar{l.lastViewedAt ? `, senast ${timeAgo(new Date(l.lastViewedAt))}` : ""}
                    {l.expiresAt ? ` · gäller till ${dateFmt.format(new Date(l.expiresAt))}` : ""}
                    {!l.allowDateChange ? " · låst period" : ""}
                  </p>
                  <input
                    readOnly
                    value={l.url}
                    aria-label={`Länk ${l.label ?? ""}`}
                    onFocus={(e) => e.currentTarget.select()}
                    className="mt-1 w-full truncate rounded border bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={() => copy(l.url)}>
                  {copied === l.url ? <Check /> : <Copy />} {copied === l.url ? "Kopierad" : "Kopiera"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  aria-label="Stäng av länken"
                  onClick={() =>
                    start(async () => {
                      const res = await revokeShareLink(l.id);
                      if (res.ok) toast.success(res.message);
                      else toast.error(res.error);
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">Ny länk</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sh-label">Namn (för er)</Label>
              <Input id="sh-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Till marknadschefen" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sh-pw">Lösenord (valfritt)</Label>
              <Input id="sh-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minst 8 tecken" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-giltig">Giltig</Label>
              <Select value={expires} onValueChange={setExpires}>
                <SelectTrigger id="f-giltig" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tills den stängs av</SelectItem>
                  <SelectItem value="7">7 dagar</SelectItem>
                  <SelectItem value="30">30 dagar</SelectItem>
                  <SelectItem value="90">90 dagar</SelectItem>
                  <SelectItem value="365">Ett år</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-6 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={allowDateChange} onChange={(e) => setAllowDateChange(e.target.checked)} />
                Får byta period
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={allowPdf} onChange={(e) => setAllowPdf(e.target.checked)} />
                Får ladda ner PDF
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await createShareLink({ dashboardId, label, password: password || undefined, expiresInDays: Number(expires), allowDateChange, allowPdf });
                  if (res.ok && res.data) {
                    await copy(res.data);
                    toast.success(res.message);
                    setLabel("");
                    setPassword("");
                  } else if (!res.ok) toast.error(res.error);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              Skapa länk
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
