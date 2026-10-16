"use client";

import { GOAL_PERIODS, type GoalPeriod, type PlatformId } from "@rp/core";
import { Goal, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { GoalWidget } from "@/components/widgets/goal-widget";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GoalProgress } from "@/lib/goals";
import { deleteClientGoal, saveClientGoal } from "../actions";

export interface GoalRow {
  id: string;
  label: string | null;
  metric: string;
  target: number;
  period: GoalPeriod;
  accountIds: string[];
  startDate: string | null;
  endDate: string | null;
  group: string | null;
  /** Kampanjnamn som ska innehålla någon av texterna (tomt = alla kampanjer) */
  campaignContains: string[];
}

interface Draft {
  label: string;
  metric: string;
  target: string;
  period: GoalPeriod;
  accountIds: string[];
  startDate: string;
  endDate: string;
  group: string;
  campaignContains: string;
}

/** Kundens mål: används av målwidgeten, larm och AI-analysen. */
export function GoalsCard(props: {
  clientId: string;
  currency: string;
  goals: GoalRow[];
  progress: GoalProgress[];
  metrics: { id: string; label: string }[];
  sources: { id: string; name: string; platform: PlatformId }[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [pending, start] = useTransition();

  const open = (g?: GoalRow) =>
    setEditing({
      id: g?.id ?? null,
      draft: g
        ? {
            label: g.label ?? "",
            metric: g.metric,
            target: String(g.target),
            period: g.period,
            accountIds: g.accountIds,
            startDate: g.startDate ?? "",
            endDate: g.endDate ?? "",
            group: g.group ?? "",
            campaignContains: g.campaignContains.join(", "),
          }
        : { label: "", metric: props.metrics.find((m) => m.id === "conversions")?.id ?? props.metrics[0]?.id ?? "spend", target: "", period: "month", accountIds: [], startDate: "", endDate: "", group: "", campaignContains: "" },
    });

  const save = () =>
    start(async () => {
      if (!editing) return;
      const d = editing.draft;
      const words = d.campaignContains.split(",").map((w) => w.trim()).filter(Boolean);
      const res = await saveClientGoal(props.clientId, editing.id, {
        label: d.label,
        metric: d.metric,
        target: Number(d.target.replace(",", ".")),
        period: d.period,
        accountIds: d.accountIds,
        group: d.group,
        ...(d.period === "custom" ? { startDate: d.startDate, endDate: d.endDate } : {}),
        filters: words.length ? [{ dimension: "campaign", op: "contains", values: words }] : [],
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setEditing(null);
    });

  const remove = (id: string) =>
    start(async () => {
      const res = await deleteClientGoal(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
    });

  const d = editing?.draft;
  const set = (p: Partial<Draft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...p } } : e));

  return (
    <section aria-labelledby="goals-heading" className="rounded-xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="goals-heading" className="flex items-center gap-2 text-xl font-bold tracking-tight text-heading">
            <Goal className="size-4" aria-hidden /> Mål och budget
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Visas i rapporter med widgeten Mål och budget, och används av AI-analysen.</p>
        </div>
        {props.canEdit && (
          <Button variant="outline" size="sm" onClick={() => open()}>
            <Plus /> Lägg till mål
          </Button>
        )}
      </div>

      {props.goals.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Inga mål än. Lägg till t.ex. leads per månad, CPA, ROAS eller månadsbudget.</p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <GoalWidget type="goal" title={null} config={{} as never} platforms={[]} data={{ result: null, currency: props.currency, meta: {}, notices: [], goals: props.progress }} />
          {props.canEdit && (
            <ul className="flex flex-row flex-wrap gap-1 lg:flex-col" aria-label="Redigera mål">
              {props.goals.map((g) => {
                const name = g.label ?? props.metrics.find((m) => m.id === g.metric)?.label ?? g.metric;
                return (
                  <li key={g.id} className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => open(g)} aria-label={`Redigera ${name}`}>
                      <Pencil /> {name}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" disabled={pending} onClick={() => remove(g.id)} aria-label={`Ta bort ${name}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Redigera mål" : "Nytt mål"}</DialogTitle>
            <DialogDescription>Spend som mål blir en budget: rapporten visar om förbrukningen ligger i takt.</DialogDescription>
          </DialogHeader>
          {d && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Metric</Label>
                <Select value={d.metric} onValueChange={(metric) => set({ metric })}>
                  <SelectTrigger className="w-full" aria-label="Metric">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.metrics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id === "spend" ? `${m.label} (budget)` : m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-target">Målvärde{d.metric === "spend" || /cp|cost|kostnad/i.test(d.metric) ? ` (${props.currency})` : ""}</Label>
                <Input id="g-target" inputMode="decimal" value={d.target} onChange={(e) => set({ target: e.target.value })} placeholder="T.ex. 500" />
              </div>
              <div className="space-y-1.5">
                <Label>Period</Label>
                <Select value={d.period} onValueChange={(period) => set({ period: period as GoalPeriod })}>
                  <SelectTrigger className="w-full" aria-label="Period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_PERIODS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {d.period === "custom" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="g-start">Kampanjen startar</Label>
                    <Input id="g-start" type="date" value={d.startDate} max={d.endDate || undefined} onChange={(e) => set({ startDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="g-end">Kampanjen slutar</Label>
                    <Input id="g-end" type="date" value={d.endDate} min={d.startDate || undefined} onChange={(e) => set({ endDate: e.target.value })} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="g-label">Namn (valfritt)</Label>
                <Input id="g-label" value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="T.ex. Räckvidd" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-group">Grupp (valfri)</Label>
                <Input id="g-group" value={d.group} onChange={(e) => set({ group: e.target.value })} placeholder="T.ex. Demoprodukt SE" list="goal-groups" />
                <datalist id="goal-groups">
                  {[...new Set(props.goals.map((g) => g.group).filter(Boolean))].map((g) => (
                    <option key={g} value={g!} />
                  ))}
                </datalist>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Mål med samma grupp visas tillsammans, t.ex. spend, räckvidd och CTR för en marknad.</p>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="g-campaigns">Bara kampanjer som innehåller (valfritt)</Label>
                <Input id="g-campaigns" value={d.campaignContains} onChange={(e) => set({ campaignContains: e.target.value })} placeholder="T.ex. [SE], Demoprodukt – flera ord separeras med komma" />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1.5 text-sm font-medium">Källor som räknas</legend>
                <p className="mb-2 text-xs text-muted-foreground">Inga valda = alla kundens källor som har metricen.</p>
                <ul className="max-h-48 space-y-1 overflow-y-auto">
                  {props.sources.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--primary)]"
                          checked={d.accountIds.includes(s.id)}
                          onChange={(e) => set({ accountIds: e.target.checked ? [...d.accountIds, s.id] : d.accountIds.filter((x) => x !== s.id) })}
                        />
                        <PlatformIcon platform={s.platform} size="sm" /> {s.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={pending || !d || !(Number(d.target.replace(",", ".")) > 0) || (d.period === "custom" && !(d.startDate && d.endDate && d.startDate <= d.endDate))}>
              {pending && <Loader2 className="animate-spin" />} Spara mål
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
