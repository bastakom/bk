"use client";

import { CalendarClock, Loader2, Lock, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnnotationView } from "@/lib/dashboard-data";
import { addAnnotation, deleteAnnotation } from "./annotation-actions";

const fmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Kundens händelser i perioden (t.ex. kampanjstart). Visas som markeringar i trendgraferna. */
export function EventsButton({ clientId, annotations, defaultDate, canEdit }: { clientId: string; annotations: AnnotationView[]; defaultDate: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, done?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Sparat");
      done?.();
    });

  return (
    <>
      <Button variant={annotations.length ? "secondary" : "outline"} onClick={() => setOpen(true)}>
        <CalendarClock /> Händelser{annotations.length ? ` (${annotations.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Händelser</DialogTitle>
            <DialogDescription>Markeras i kundens trendgrafer, t.ex. kampanjstart, prisändring eller ny landningssida. Interna händelser visas bara för byrån.</DialogDescription>
          </DialogHeader>
          {annotations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga händelser i perioden.</p>
          ) : (
            <ul className="divide-y rounded-lg border" aria-label="Händelser i perioden">
              {annotations.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-3 py-2 text-sm">
                  <span className="tabular w-24 shrink-0 text-muted-foreground">{fmt.format(new Date(`${a.date}T00:00:00Z`))}</span>
                  <span className="min-w-0 flex-1">
                    {a.text}
                    {a.internal && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                        <Lock className="size-2.5" /> intern
                      </span>
                    )}
                  </span>
                  {canEdit && (
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" disabled={pending} onClick={() => run(() => deleteAnnotation(a.id))} aria-label={`Ta bort ${a.text}`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => addAnnotation({ clientId, date, text, internal }), () => setText(""));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-date">Datum</Label>
                  <Input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-text">Vad hände?</Label>
                  <Input id="ev-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="T.ex. Höstkampanjen startade" required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                Intern – visas inte för kunden
              </label>
              <Button type="submit" disabled={pending || !text.trim()}>
                {pending && <Loader2 className="animate-spin" />} Lägg till händelse
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
