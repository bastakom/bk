"use client";

import { describeFormula, FormulaError, parseFormula } from "@rp/core";
import { Calculator, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteCustomMetric, saveCustomMetric } from "./actions";

interface Metric {
  id: string;
  key: string;
  name: string;
  formula: string;
  readable: string;
  format: string;
  higherIsBetter: boolean | null;
  description: string | null;
}

interface Reference {
  metrics: { id: string; label: string; derived: boolean }[];
  platforms: { id: string; label: string }[];
}

const FORMATS = [
  { id: "number", label: "Tal (t.ex. ROAS 3,2)" },
  { id: "currency", label: "Belopp i rapportvaluta" },
  { id: "percent", label: "Procent (0,05 visas som 5 %)" },
  { id: "duration", label: "Tid i sekunder" },
];

const EXAMPLES = [
  { name: "Total ROAS", formula: "conversion_value / spend", format: "number", higherIsBetter: "true", description: "Allt konverteringsvärde delat med all spend i valda källor." },
  { name: "Kostnad per besök", formula: "spend / sessions[ga4]", format: "currency", higherIsBetter: "false", description: "All annonsspend delat med besök enligt GA4." },
  { name: "Blended CPA", formula: "spend / conversions[ga4]", format: "currency", higherIsBetter: "false", description: "All spend delat med konverteringar enligt GA4 (undviker dubbelräkning)." },
];

type Draft = { id?: string; name: string; formula: string; format: string; higherIsBetter: string; description: string };
const EMPTY: Draft = { name: "", formula: "", format: "number", higherIsBetter: "true", description: "" };

export function CustomMetricsManager({ metrics, reference, canEdit }: { metrics: Metric[]; reference: Reference; canEdit: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const formulaRef = useRef<HTMLTextAreaElement>(null);

  // Formeln valideras direkt i webbläsaren med samma parser som servern använder.
  const formula = draft?.formula ?? "";
  const check = useMemo(() => {
    if (!formula.trim()) return null;
    try {
      return { ok: true as const, text: describeFormula(parseFormula(formula)) };
    } catch (e) {
      return { ok: false as const, text: e instanceof FormulaError ? `${e.message} (tecken ${e.position + 1})` : "Ogiltig formel" };
    }
  }, [formula]);

  const insert = (token: string) => {
    if (!draft) return;
    const el = formulaRef.current;
    const pos = el?.selectionStart ?? draft.formula.length;
    const next = `${draft.formula.slice(0, pos)}${token}${draft.formula.slice(el?.selectionEnd ?? pos)}`;
    setDraft({ ...draft, formula: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + token.length, pos + token.length);
    });
  };

  const save = () =>
    start(async () => {
      if (!draft) return;
      const res = await saveCustomMetric({ ...draft, format: draft.format as "number" | "currency" | "percent" | "duration", higherIsBetter: draft.higherIsBetter as "true" | "false" | "null" });
      if (res.ok) {
        toast.success(res.message);
        setDraft(null);
      } else toast.error(res.error);
    });

  return (
    <section aria-labelledby="custom-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="custom-heading" className="text-xl font-bold tracking-tight text-heading">
            Egna metrics (blended)
          </h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Formler över en eller flera källor. De räknas alltid på summor för perioden, aldrig som medelvärde av dagliga värden, och finns sedan i
            widget-editorn för alla kunder.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setDraft(EMPTY)}>
            <Plus /> Ny metric
          </Button>
        )}
      </div>

      {metrics.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 px-6 py-10 text-center">
          <Calculator className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-2 font-medium">Inga egna metrics än</p>
          <p className="mt-1 text-sm text-muted-foreground">Till exempel Total ROAS = konverteringsvärde / spend över alla kanaler.</p>
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-soft">
          {metrics.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{m.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{m.readable}</p>
                <code className="mt-1.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{m.formula}</code>
                {m.description && <p className="mt-1.5 text-xs text-muted-foreground">{m.description}</p>}
              </div>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{FORMATS.find((f) => f.id === m.format)?.label.split(" (")[0]}</span>
              {canEdit && (
                <span className="flex">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Redigera ${m.name}`}
                    onClick={() =>
                      setDraft({ id: m.id, name: m.name, formula: m.formula, format: m.format, higherIsBetter: String(m.higherIsBetter), description: m.description ?? "" })
                    }
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ta bort ${m.name}`}
                    onClick={() =>
                      start(async () => {
                        if (!confirm(`Ta bort "${m.name}"?`)) return;
                        const res = await deleteCustomMetric(m.id);
                        if (res.ok) toast.success(res.message);
                        else toast.error(res.error);
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Redigera metric" : "Ny metric"}</DialogTitle>
            <DialogDescription>Använd metric-namnen nedan. Begränsa till en källa med hakparentes, t.ex. sessions[ga4].</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="space-y-4">
                {!draft.id && (
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLES.map((e) => (
                      <button
                        key={e.name}
                        type="button"
                        className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
                        onClick={() => setDraft({ ...draft, ...e })}
                      >
                        {e.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="cm-name">Namn</Label>
                  <Input id="cm-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cm-formula">Formel</Label>
                  <Textarea
                    id="cm-formula"
                    ref={formulaRef}
                    rows={3}
                    value={draft.formula}
                    onChange={(e) => setDraft({ ...draft, formula: e.target.value })}
                    className="font-mono text-sm"
                    spellCheck={false}
                    aria-describedby="cm-check"
                  />
                  <p id="cm-check" role="status" className={cn("text-sm", check?.ok ? "text-muted-foreground" : "text-destructive")}>
                    {check ? (check.ok ? `= ${check.text}` : check.text) : "Exempel: conversion_value / spend"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="f-visas-som">Visas som</Label>
                    <Select value={draft.format} onValueChange={(v) => setDraft({ ...draft, format: v })}>
                      <SelectTrigger id="f-visas-som" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-en-okning-ar">En ökning är</Label>
                    <Select value={draft.higherIsBetter} onValueChange={(v) => setDraft({ ...draft, higherIsBetter: v })}>
                      <SelectTrigger id="f-en-okning-ar" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Bra (grön)</SelectItem>
                        <SelectItem value="false">Dålig (röd)</SelectItem>
                        <SelectItem value="null">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cm-desc">Beskrivning (valfri)</Label>
                  <Input id="cm-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Klicka för att infoga</p>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border p-1.5">
                  {reference.metrics.map((m) => (
                    <button key={m.id} type="button" onClick={() => insert(m.id)} className="flex w-full flex-col rounded px-1.5 py-1 text-left text-xs hover:bg-muted">
                      <span>{m.label}</span>
                      <code className="font-mono text-[10px] break-all text-muted-foreground">{m.id}</code>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {reference.platforms.map((p) => (
                    <button key={p.id} type="button" onClick={() => insert(`[${p.id}]`)} className="rounded border px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted" title={p.label}>
                      [{p.id}]
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Avbryt
            </Button>
            <Button onClick={save} disabled={pending || !draft?.name.trim() || !check?.ok}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
