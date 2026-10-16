"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiOption {
  value: string;
  label: string;
  /** T.ex. en källikon */
  icon?: React.ReactNode;
  hint?: string;
}

/** Sökbar flervalslista med valda värden som chips. Tomt val kan betyda "alla" (allLabel). */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Välj …",
  allLabel,
  label,
  id,
  disabled,
  className,
}: {
  options: MultiOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  /** Visas när inget är valt och tomt betyder alla, t.ex. "Alla kunder". */
  allLabel?: string;
  /** Tillgängligt namn (om ingen synlig etikett pekar på id). */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const summary = selected.length === 0 ? (allLabel ?? placeholder) : selected.length <= 2 ? selected.map((s) => s.label).join(", ") : `${selected.length} valda`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} variant="outline" disabled={disabled} className="w-full justify-between font-normal" aria-label={label ? `${summary} (${label})` : undefined}>
            <span className={cn("truncate", selected.length === 0 && !allLabel && "text-muted-foreground")}>{summary}</span>
            <ChevronsUpDown className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Sök …" />
            <CommandList>
              <CommandEmpty>Inga träffar.</CommandEmpty>
              {allLabel && (
                <CommandGroup>
                  <CommandItem value="__all__" onSelect={() => onChange([])}>
                    <Check className={cn("size-4", value.length === 0 ? "opacity-100" : "opacity-0")} aria-hidden />
                    {allLabel}
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)} aria-selected={value.includes(o.value)}>
                    <Check className={cn("size-4", value.includes(o.value) ? "opacity-100" : "opacity-0")} aria-hidden />
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                    {o.hint && <span className="ml-auto text-xs text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 2 && (
        <ul className="flex flex-wrap gap-1" aria-label="Valda">
          {selected.map((s) => (
            <li key={s.value} className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent py-0.5 pr-0.5 pl-2 text-xs text-accent-foreground">
              <span className="truncate">{s.label}</span>
              <button type="button" className="grid size-5 place-items-center rounded hover:bg-foreground/10" onClick={() => toggle(s.value)} aria-label={`Ta bort ${s.label}`}>
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
