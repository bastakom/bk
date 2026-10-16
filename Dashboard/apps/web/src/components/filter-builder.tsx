"use client";

import { DIMENSIONS, FILTER_OPS, FILTERABLE_DIMENSIONS, PLATFORMS, type DataFilter, type DimensionId, type FilterOp, type PlatformId } from "@rp/core";
import { Check, ChevronsUpDown, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Catalog } from "@/lib/availability";
import { cn } from "@/lib/utils";

/** Filter under redigering: värdelistan får vara tom tills användaren valt något. */
export type DraftFilter = Omit<DataFilter, "values"> & { values: string[] };

/** Filter utan värden sparas inte. */
export const completeFilters = (filters: DraftFilter[]): DataFilter[] => filters.filter((f) => f.values.length > 0) as DataFilter[];

const ALL = "__all__";

interface Props {
  filters: DraftFilter[];
  onChange: (filters: DraftFilter[]) => void;
  /** Kanaler som kan filtreras (de som finns i widgeten eller hos kunden). */
  platforms: PlatformId[];
  catalog: Catalog;
  /** Hämtar valbara värden, t.ex. kundens kampanjer i kanalen. */
  loadValues: (platform: PlatformId | null, dimension: DimensionId) => Promise<string[]>;
  hint?: string;
  /** Filter för en enda källa: kanalvalet döljs. */
  lockPlatform?: boolean;
}

/** Fält som går att filtrera på för en kanal (eller för alla valda kanaler). */
function fieldsFor(platform: PlatformId | undefined, platforms: PlatformId[], catalog: Catalog): DimensionId[] {
  const sources = platform ? [platform] : platforms;
  return FILTERABLE_DIMENSIONS.filter((d) => sources.some((p) => catalog[p]?.dimensions.includes(d)));
}

export function FilterBuilder({ filters, onChange, platforms, catalog, loadValues, hint, lockPlatform }: Props) {
  const update = (i: number, p: Partial<DraftFilter>) => onChange(filters.map((f, j) => (j === i ? { ...f, ...p } : f)));

  const add = () => {
    const platform = platforms.length === 1 ? platforms[0] : undefined;
    const fields = fieldsFor(platform, platforms, catalog);
    const dimension = fields.includes("campaign") ? "campaign" : fields[0];
    if (dimension) onChange([...filters, { platform, dimension, op: "in", values: [] }]);
  };

  return (
    <div className="space-y-2">
      {filters.length === 0 && <p className="text-sm text-muted-foreground">Inga filter. All data från valda källor räknas med.</p>}
      <ul className="space-y-2">
        {filters.map((f, i) => {
          const fields = fieldsFor(f.platform, platforms, catalog);
          return (
            <li key={i} className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
              <div className="flex items-center gap-1.5">
                {!lockPlatform && (
                <Select
                  value={f.platform ?? ALL}
                  onValueChange={(v) => {
                    const platform = v === ALL ? undefined : (v as PlatformId);
                    const next = fieldsFor(platform, platforms, catalog);
                    update(i, { platform, dimension: next.includes(f.dimension) ? f.dimension : (next[0] ?? f.dimension), values: next.includes(f.dimension) ? f.values : [] });
                  }}
                >
                  <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Kanal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Alla kanaler</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p}>
                        <PlatformIcon platform={p} size="sm" /> {PLATFORMS[p].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                )}
                <Select value={f.dimension} onValueChange={(v) => update(i, { dimension: v as DimensionId, values: [] })}>
                  <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label="Fält">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((d) => (
                      <SelectItem key={d} value={d}>
                        {DIMENSIONS[d].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => onChange(filters.filter((_, j) => j !== i))} aria-label="Ta bort filter">
                  <X className="size-3.5" />
                </Button>
              </div>
              <div className="flex items-start gap-1.5">
                <Select value={f.op} onValueChange={(v) => update(i, { op: v as FilterOp })}>
                  <SelectTrigger size="sm" className="w-40 shrink-0" aria-label="Villkor">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPS.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {f.op === "in" || f.op === "not_in" ? (
                  <ValuePicker filter={f} onChange={(values) => update(i, { values })} loadValues={loadValues} />
                ) : (
                  <TextValues values={f.values} onChange={(values) => update(i, { values })} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" size="sm" onClick={add} disabled={platforms.length === 0}>
        <Plus /> Lägg till filter
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Välj bland kundens faktiska värden (t.ex. kampanjer), med sök. */
function ValuePicker({ filter, onChange, loadValues }: { filter: DraftFilter; onChange: (v: string[]) => void; loadValues: Props["loadValues"] }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ key: string; values: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const key = `${filter.platform ?? ""}:${filter.dimension}`;

  const openPicker = async (o: boolean) => {
    setOpen(o);
    if (!o || options?.key === key) return;
    setLoading(true);
    try {
      setOptions({ key, values: await loadValues(filter.platform ?? null, filter.dimension) });
    } finally {
      setLoading(false);
    }
  };
  const toggle = (v: string) => onChange(filter.values.includes(v) ? filter.values.filter((x) => x !== v) : [...filter.values, v]);
  const list = options?.key === key ? options.values : [];
  const custom = search.trim() && !list.some((v) => v.toLowerCase() === search.trim().toLowerCase()) ? search.trim() : null;

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Popover open={open} onOpenChange={openPicker}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between font-normal" aria-label={`Välj ${DIMENSIONS[filter.dimension].label.toLowerCase()}`}>
            <span className="truncate">{filter.values.length ? `${filter.values.length} valda` : `Välj ${DIMENSIONS[filter.dimension].label.toLowerCase()} …`}</span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Sök …" value={search} onValueChange={setSearch} />
            <CommandList>
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Hämtar värden" />
                </div>
              ) : (
                <>
                  <CommandEmpty>Inga träffar i synkad data.</CommandEmpty>
                  {custom && (
                    <CommandGroup>
                      <CommandItem value={`__custom__${custom}`} onSelect={() => (toggle(custom), setSearch(""))}>
                        <Plus /> Lägg till ”{custom}”
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup heading="Senast aktiva först">
                    {[...new Set([...filter.values, ...list])].map((v) => (
                      <CommandItem key={v} value={v} onSelect={() => toggle(v)}>
                        <Check className={cn("size-4", filter.values.includes(v) ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{v}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Chips values={filter.values} onRemove={(v) => onChange(filter.values.filter((x) => x !== v))} />
    </div>
  );
}

/** Fritext ("innehåller"): flera ord ger ELLER, t.ex. "höst" eller "vinter". */
function TextValues({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const commit = () => {
    const v = text.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setText("");
  };
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Input
        className="h-8"
        value={text}
        placeholder={values.length ? "Lägg till fler (Enter)" : "Skriv text och tryck Enter"}
        aria-label="Filtertext"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
      <Chips values={values} onRemove={(v) => onChange(values.filter((x) => x !== v))} />
    </div>
  );
}

function Chips({ values, onRemove }: { values: string[]; onRemove: (v: string) => void }) {
  if (!values.length) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {values.map((v) => (
        <li key={v} className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent py-0.5 pr-0.5 pl-2 text-xs text-accent-foreground">
          <span className="truncate">{v}</span>
          <button type="button" className="rounded p-0.5 hover:bg-foreground/10" onClick={() => onRemove(v)} aria-label={`Ta bort ${v}`}>
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
