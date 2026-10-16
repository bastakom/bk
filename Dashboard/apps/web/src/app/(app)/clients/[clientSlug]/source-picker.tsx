"use client";

import { PLATFORMS, type PlatformId } from "@rp/core";
import { Database, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addClientSources } from "../actions";

export interface PickableSource {
  id: string;
  name: string;
  externalId: string;
  platform: PlatformId;
  /** Inloggningen i Databaser som ger åtkomst */
  login: string;
  /** Redan vald av den här kunden */
  chosen: boolean;
  /** Andra kunder som använder källan */
  usedBy: string[];
}

const ORDER: PlatformId[] = ["ga4", "google_ads", "meta_ads", "linkedin_ads", "tiktok_ads"];

/** Välj kundens källor bland byråns databaser. */
export function SourcePicker({ clientId, clientName, sources, isAdmin, primary }: { clientId: string; clientName: string; sources: PickableSource[]; isAdmin: boolean; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<PlatformId | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const platforms = ORDER.filter((p) => sources.some((s) => s.platform === p));
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter(
      (s) => (platform === "all" || s.platform === platform) && (!q || s.name.toLowerCase().includes(q) || s.externalId.toLowerCase().includes(q) || s.login.toLowerCase().includes(q)),
    );
  }, [sources, query, platform]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await addClientSources({ clientId, accountIds: [...selected] });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setSelected(new Set());
      setOpen(false);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={primary ? "default" : "outline"}>
          <Plus /> Välj källor
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Välj källor för {clientName}</DialogTitle>
          <DialogDescription>Konton från byråns databaser. Ett konto kan användas av flera kunder – avgränsa med ett filter på källan, t.ex. kundens kampanjer.</DialogDescription>
        </DialogHeader>

        {sources.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center">
            <Database className="size-5 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Databaser är tom</p>
            <p className="mt-1 text-sm text-muted-foreground">{isAdmin ? "Koppla byråns inloggningar först." : "Be en administratör koppla byråns inloggningar i Databaser."}</p>
            {isAdmin && (
              <Button asChild className="mt-4" size="sm">
                <Link href="/databases">Öppna Databaser</Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök konto, id eller inloggning …" className="pl-8" aria-label="Sök källor" />
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Kanal">
                <Button size="sm" variant={platform === "all" ? "secondary" : "ghost"} onClick={() => setPlatform("all")} aria-pressed={platform === "all"}>
                  Alla
                </Button>
                {platforms.map((p) => (
                  <Button key={p} size="sm" variant={platform === p ? "secondary" : "ghost"} onClick={() => setPlatform(p)} aria-pressed={platform === p} aria-label={PLATFORMS[p].label}>
                    <PlatformIcon platform={p} size="sm" />
                  </Button>
                ))}
              </div>
            </div>
            <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border" aria-label="Källor">
              {list.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Inga källor matchar.</li>}
              {list.map((s) => (
                <li key={s.id}>
                  <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/50", s.chosen && "cursor-default opacity-60")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={s.chosen || selected.has(s.id)}
                      disabled={s.chosen}
                      onChange={() => toggle(s.id)}
                      aria-label={`${s.name} (${PLATFORMS[s.platform].label})`}
                    />
                    <PlatformIcon platform={s.platform} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.externalId} · {s.login}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {s.chosen ? "Vald" : s.usedBy.length ? `Används av ${s.usedBy.join(", ")}` : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <DialogFooter className="items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {isAdmin ? (
                  <>
                    Saknas ett konto?{" "}
                    <Link href="/databases" className="font-medium text-link underline-offset-2 hover:underline">
                      Koppla inloggning i Databaser
                    </Link>
                  </>
                ) : (
                  "Saknas ett konto? En administratör kopplar fler inloggningar i Databaser."
                )}
              </p>
              <Button onClick={save} disabled={pending || selected.size === 0}>
                {pending && <Loader2 className="animate-spin" />}
                {selected.size ? `Lägg till ${selected.size}` : "Lägg till"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
