"use client";

import { COMPARE_MODES, formatRange, presetText, RANGE_PRESETS, type CompareMode, type DateRange, type Lang, type RangePreset } from "@rp/core";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRangeValue {
  preset: RangePreset;
  range: DateRange;
  compare: CompareMode;
  compareRange: DateRange | null;
}

/**
 * En knapp som visar period och jämförelse; panelen har snabbval, anpassad period och jämförelse.
 * Ändringar gäller först vid "Använd", så att man kan välja flera saker i ett svep.
 */
export function DateRangePicker({
  value,
  onApply,
  disabled,
  className,
  lang = "sv",
}: {
  value: DateRangeValue;
  onApply: (v: { preset: RangePreset; from?: string; to?: string; compare: CompareMode }) => void;
  disabled?: boolean;
  className?: string;
  lang?: Lang;
}) {
  const en = lang === "en";
  const T = {
    custom: en ? "Custom period" : "Anpassad period",
    period: en ? "Period" : "Period",
    from: en ? "From" : "Från",
    to: en ? "To" : "Till",
    invalid: en ? "The start date must be before the end date." : "Startdatumet måste vara före slutdatumet.",
    compare: en ? "Compare with" : "Jämför med",
    vs: en ? "vs" : "mot",
    cancel: en ? "Cancel" : "Avbryt",
    apply: en ? "Apply" : "Använd",
  };
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<RangePreset>(value.preset);
  const [from, setFrom] = useState(value.range.start);
  const [to, setTo] = useState(value.range.end);
  const [compare, setCompare] = useState<CompareMode>(value.compare);
  const presetLabel = value.preset === "custom" ? T.custom : presetText(value.preset, RANGE_PRESETS.find((p) => p.id === value.preset)?.label ?? "", lang);
  const invalid = preset === "custom" && (!from || !to || from > to);

  const reset = (o: boolean) => {
    setOpen(o);
    if (o) {
      setPreset(value.preset);
      setFrom(value.range.start);
      setTo(value.range.end);
      setCompare(value.compare);
    }
  };

  return (
    <Popover open={open} onOpenChange={reset}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className={cn("h-9 max-w-full justify-start gap-2 font-normal", className)}>
          <CalendarDays className="text-muted-foreground" aria-hidden />
          <span className="font-medium">{presetLabel}</span>
          <span className="hidden truncate text-muted-foreground sm:inline">
            {formatRange(value.range, lang)}
            {value.compareRange && ` ${T.vs} ${formatRange(value.compareRange, lang)}`}
          </span>
          <ChevronDown className="ml-auto opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,520px)] p-0">
        <div className="grid sm:grid-cols-[180px_1fr]">
          <fieldset className="border-b p-2 sm:border-r sm:border-b-0">
            <legend className="sr-only">{T.period}</legend>
            {[...RANGE_PRESETS, { id: "custom" as const, label: T.custom }].map((p) => (
              <label key={p.id} className={cn("flex cursor-pointer items-center rounded-md px-2.5 py-1.5 text-sm hover:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", preset === p.id && "bg-accent font-medium text-accent-foreground")}>
                <input type="radio" name="drp-preset" className="sr-only" checked={preset === p.id} onChange={() => setPreset(p.id)} />
                {p.id === "custom" ? p.label : presetText(p.id, p.label, lang)}
              </label>
            ))}
          </fieldset>
          <div className="space-y-4 p-4">
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="drp-from">{T.from}</Label>
                  <Input id="drp-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-invalid={invalid || undefined} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="drp-to">{T.to}</Label>
                  <Input id="drp-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-invalid={invalid || undefined} />
                </div>
                {invalid && <p className="col-span-2 text-xs text-destructive">{T.invalid}</p>}
              </div>
            )}
            <fieldset className="space-y-1">
              <legend className="mb-1.5 text-sm font-medium">{T.compare}</legend>
              {COMPARE_MODES.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="drp-compare" className="size-4 accent-[var(--primary)]" checked={compare === c.id} onChange={() => setCompare(c.id)} />
                  {presetText(c.id, c.label, lang)}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                {T.cancel}
              </Button>
              <Button
                disabled={invalid}
                onClick={() => {
                  onApply(preset === "custom" ? { preset, from, to, compare } : { preset, compare });
                  setOpen(false);
                }}
              >
                {T.apply}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
