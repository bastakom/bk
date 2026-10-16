"use client";

import type { PlatformId } from "@rp/core";
import { BellRing, CheckCircle2, Loader2, Pencil, Plus, Trash2, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { deleteAlertRule, saveAlertRule, testAlertRule } from "../actions";

const WINDOWS = [
  { id: "yesterday", label: "i går" },
  { id: "last_7", label: "senaste 7 dagarna" },
  { id: "month_to_date", label: "hittills denna månad" },
] as const;

export interface AlertRuleRow {
  id: string;
  kind: "metric" | "goal";
  metric: string | null;
  op: "above" | "below" | null;
  threshold: number | null;
  window: string;
  goalId: string | null;
  accountIds: string[];
  recipientIds: string[];
  active: boolean;
  firing: boolean;
  lastChecked: string | null;
  /** Läsbar beskrivning, t.ex. "CPA senaste 7 dagarna över 300" */
  summary: string;
}

interface Draft {
  kind: "metric" | "goal";
  metric: string;
  op: "above" | "below";
  threshold: string;
  window: string;
  goalId: string;
  accountIds: string[];
  recipientIds: string[];
  active: boolean;
}

/** Kundens larm: mejlas till teamet när ett nyckeltal passerar en gräns eller ett mål ligger efter. */
export function AlertsCard(props: {
  clientId: string;
  rules: AlertRuleRow[];
  metrics: { id: string; label: string }[];
  goals: { id: string; label: string }[];
  sources: { id: string; name: string; platform: PlatformId }[];
  members: { id: string; name: string; email: string; admin: boolean }[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [pending, start] = useTransition();

  const open = (r?: AlertRuleRow) =>
    setEditing({
      id: r?.id ?? null,
      draft: {
        kind: r?.kind ?? "metric",
        metric: r?.metric ?? (props.metrics.find((m) => m.id === "cpa")?.id ?? props.metrics[0]?.id ?? "spend"),
        op: r?.op ?? "above",
        threshold: r?.threshold != null ? String(r.threshold) : "",
        window: r?.window ?? "last_7",
        goalId: r?.goalId ?? props.goals[0]?.id ?? "",
        accountIds: r?.accountIds ?? [],
        recipientIds: r?.recipientIds ?? [],
        active: r?.active ?? true,
      },
    });
  const set = (p: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));
  const d = editing?.draft;

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, done?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Klart", { duration: 8000 });
      done?.();
    });

  const save = () => {
    if (!editing || !d) return;
    const payload =
      d.kind === "metric"
        ? { kind: "metric", metric: d.metric, op: d.op, threshold: Number(d.threshold.replace(",", ".")), window: d.window, accountIds: d.accountIds, recipientIds: d.recipientIds, active: d.active }
        : { kind: "goal", goalId: d.goalId, recipientIds: d.recipientIds, active: d.active };
    run(() => saveAlertRule(props.clientId, editing.id, payload), () => setEditing(null));
  };
  const valid = d && (d.kind === "goal" ? !!d.goalId : d.threshold.trim() !== "" && Number(d.threshold.replace(",", ".")) >= 0);

  return (
    <section aria-labelledby="alerts-heading" className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="alerts-heading" className="flex items-center gap-2 text-xl font-bold tracking-tight text-heading">
            <BellRing className="size-4" aria-hidden /> Larm
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Kontrolleras varje timme. Mejl när ett larm slår till, sedan högst en gång per dygn.</p>
        </div>
        {props.canEdit && (
          <Button variant="outline" size="sm" onClick={() => open()}>
            <Plus /> Nytt larm
          </Button>
        )}
      </div>

      {props.rules.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Inga larm. Till exempel: CPA över målet, ett mål som ligger efter eller en kampanj som slutat spendera (spend i går under 1 kr).</p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border">
          {props.rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  !r.active ? "bg-muted text-muted-foreground" : r.firing ? "bg-danger-soft text-destructive" : r.lastChecked ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {!r.active ? "Pausat" : r.firing ? (<><Zap className="size-3" /> Larmar</>) : r.lastChecked ? (<><CheckCircle2 className="size-3" /> OK</>) : "Ej kontrollerat"}
              </span>
              <span className="min-w-0 flex-1 text-sm">{r.summary}</span>
              <span className="text-xs text-muted-foreground">{r.lastChecked ? `Kontrollerat ${r.lastChecked}` : ""}</span>
              {props.canEdit && (
                <span className="flex items-center gap-0.5">
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => testAlertRule(r.id))}>
                    {pending ? <Loader2 className="animate-spin" /> : null} Testa nu
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => open(r)} aria-label={`Redigera larmet ${r.summary}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" disabled={pending} onClick={() => run(() => deleteAlertRule(r.id))} aria-label={`Ta bort larmet ${r.summary}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Redigera larm" : "Nytt larm"}</DialogTitle>
            <DialogDescription>Larmet mejlas till valda personer i teamet. Inga valda = byråns administratörer.</DialogDescription>
          </DialogHeader>
          {d && (
            <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Typ av larm">
                {(["metric", "goal"] as const).map((k) => (
                  <Button key={k} type="button" size="sm" variant={d.kind === k ? "secondary" : "ghost"} className={cn("flex-1", d.kind === k && "bg-card shadow-soft")} aria-pressed={d.kind === k} onClick={() => set({ kind: k })}>
                    {k === "metric" ? "Nyckeltal" : "Mål"}
                  </Button>
                ))}
              </div>

              {d.kind === "metric" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nyckeltal</Label>
                    <Select value={d.metric} onValueChange={(metric) => set({ metric })}>
                      <SelectTrigger className="w-full" aria-label="Nyckeltal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {props.metrics.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Villkor</Label>
                    <Select value={d.op} onValueChange={(op) => set({ op: op as Draft["op"] })}>
                      <SelectTrigger className="w-full" aria-label="Villkor">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="above">över</SelectItem>
                        <SelectItem value="below">under</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="al-threshold">Gräns</Label>
                    <Input id="al-threshold" inputMode="decimal" value={d.threshold} onChange={(e) => set({ threshold: e.target.value })} placeholder="T.ex. 300" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Period</Label>
                    <Select value={d.window} onValueChange={(window) => set({ window })}>
                      <SelectTrigger className="w-full" aria-label="Period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WINDOWS.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <fieldset className="sm:col-span-2">
                    <legend className="mb-1 text-sm font-medium">Källor</legend>
                    <p className="mb-1.5 text-xs text-muted-foreground">Inga valda = alla kundens källor.</p>
                    <CheckList items={props.sources.map((s) => ({ id: s.id, label: s.name, icon: <PlatformIcon platform={s.platform} size="sm" /> }))} value={d.accountIds} onChange={(accountIds) => set({ accountIds })} />
                  </fieldset>
                </div>
              ) : props.goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Kunden har inga mål än. Lägg till mål under Mål och budget.</p>
              ) : (
                <div className="space-y-1.5">
                  <Label>Mål</Label>
                  <Select value={d.goalId} onValueChange={(goalId) => set({ goalId })}>
                    <SelectTrigger className="w-full" aria-label="Mål">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {props.goals.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Larmar när målet ligger efter eller budgeten överförbrukas.</p>
                </div>
              )}

              <fieldset>
                <legend className="mb-1 text-sm font-medium">Mottagare</legend>
                <CheckList items={props.members.map((m) => ({ id: m.id, label: `${m.name}${m.admin ? " (admin)" : ""}`, hint: m.email }))} value={d.recipientIds} onChange={(recipientIds) => set({ recipientIds })} />
              </fieldset>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={d.active} onChange={(e) => set({ active: e.target.checked })} />
                Aktivt
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={pending || !valid}>
              {pending && <Loader2 className="animate-spin" />} Spara larm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function CheckList({ items, value, onChange }: { items: { id: string; label: string; hint?: string; icon?: React.ReactNode }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <ul className="max-h-40 space-y-0.5 overflow-y-auto">
      {items.map((it) => (
        <li key={it.id}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
            <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={value.includes(it.id)} onChange={(e) => onChange(e.target.checked ? [...value, it.id] : value.filter((x) => x !== it.id))} />
            {it.icon}
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.hint && <span className="truncate text-xs text-muted-foreground">{it.hint}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}
