"use client";

import { COMPARE_MODES, describeSchedule, RANGE_PRESETS } from "@rp/core";
import { Loader2, Mail, Pause, Play, Send, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSchedule, deleteSchedule, sendNow, setScheduleActive, type ScheduleInput } from "./schedule-actions";

export interface ScheduleRow {
  id: string;
  frequency: "WEEKLY" | "MONTHLY";
  weekday: number | null;
  dayOfMonth: number | null;
  hour: number;
  timezone: string;
  recipients: string[];
  rangePreset: string;
  active: boolean;
  nextRunAt: string;
  lastStatus: "SENT" | "FAILED" | null;
}

const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];
const when = new Intl.DateTimeFormat("sv-SE", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ScheduleDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dashboardId: string;
  defaultSubject: string;
  schedules: ScheduleRow[];
  timezone: string;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    frequency: "WEEKLY" as "WEEKLY" | "MONTHLY",
    weekday: "1",
    dayOfMonth: "1",
    hour: "7",
    rangePreset: "last_week",
    compare: "previous_period",
    layout: "PAGED" as "PAGED" | "LONG",
    recipients: "",
    subject: props.defaultSubject,
    message: "",
  });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const input = (): ScheduleInput => ({
    dashboardId: props.dashboardId,
    frequency: form.frequency,
    weekday: form.frequency === "WEEKLY" ? Number(form.weekday) : undefined,
    dayOfMonth: form.frequency === "MONTHLY" ? Number(form.dayOfMonth) : undefined,
    hour: Number(form.hour),
    rangePreset: form.rangePreset,
    compare: form.compare as ScheduleInput["compare"],
    layout: form.layout,
    recipients: form.recipients,
    subject: form.subject,
    message: form.message,
  });
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.error);
    });

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Schemalagda utskick</DialogTitle>
          <DialogDescription>PDF:en skickas som bilaga med en länk till live-dashboarden. Tider gäller kundens tidszon ({props.timezone}).</DialogDescription>
        </DialogHeader>

        {props.schedules.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {props.schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {describeSchedule(s)} · {RANGE_PRESETS.find((r) => r.id === s.rangePreset)?.label.toLowerCase()}
                  </p>
                  <p className="truncate text-xs text-muted-foreground" title={s.recipients.join(", ")}>
                    {s.recipients.join(", ")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{s.active ? `Nästa: ${when.format(new Date(s.nextRunAt))}` : "Pausad"}</span>
                {s.lastStatus === "FAILED" && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs text-destructive">Senaste misslyckades</span>}
                <Button variant="ghost" size="icon" className="size-7" aria-label={s.active ? "Pausa" : "Aktivera"} onClick={() => run(() => setScheduleActive(s.id, !s.active))}>
                  {s.active ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Ta bort utskick" onClick={() => run(() => deleteSchedule(s.id))}>
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 rounded-lg border p-4">
          <p className="text-sm font-medium">Nytt utskick</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Hur ofta</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => set({ frequency: v as "WEEKLY" | "MONTHLY", rangePreset: v === "WEEKLY" ? "last_week" : "last_month" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Varje vecka</SelectItem>
                  <SelectItem value="MONTHLY">Varje månad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dag</Label>
              {form.frequency === "WEEKLY" ? (
                <Select value={form.weekday} onValueChange={(v) => set({ weekday: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((d, i) => (
                      <SelectItem key={d} value={String(i + 1)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={form.dayOfMonth} onValueChange={(v) => set({ dayOfMonth: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        Den {i + 1}:e
                      </SelectItem>
                    ))}
                    <SelectItem value="0">Sista dagen</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-klockan">Klockan</Label>
              <Select value={form.hour} onValueChange={(v) => set({ hour: v })}>
                <SelectTrigger id="f-klockan" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="f-period-i-rapporten">Period i rapporten</Label>
              <Select value={form.rangePreset} onValueChange={(v) => set({ rangePreset: v })}>
                <SelectTrigger id="f-period-i-rapporten" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_PRESETS.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-jamforelse">Jämförelse</Label>
              <Select value={form.compare} onValueChange={(v) => set({ compare: v })}>
                <SelectTrigger id="f-jamforelse" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARE_MODES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-format">Format</Label>
              <Select value={form.layout} onValueChange={(v) => set({ layout: v as "PAGED" | "LONG" })}>
                <SelectTrigger id="f-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAGED">A4, paginerad</SelectItem>
                  <SelectItem value="LONG">En lång sida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-to">Mottagare</Label>
            <Input id="sch-to" value={form.recipients} onChange={(e) => set({ recipients: e.target.value })} placeholder="anna@kund.se, marknad@kund.se" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-subject">Ämnesrad</Label>
            <Input id="sch-subject" value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sch-msg">Meddelande (valfritt)</Label>
            <Textarea id="sch-msg" rows={3} value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="Hej! Här kommer veckans rapport." />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={pending || !form.recipients.trim()} onClick={() => run(() => sendNow(input()))}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              Skicka nu
            </Button>
            <Button disabled={pending || !form.recipients.trim()} onClick={() => run(() => createSchedule(input()))}>
              Schemalägg
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
