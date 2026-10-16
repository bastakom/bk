"use client";

import { PLATFORMS, type Delta, type PlatformId } from "@rp/core";
import { ArrowUpDown, BarChart3, Download, FileWarning, Inbox, Lock, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeltaBadge } from "@/components/delta-badge";
import { PlatformIcon } from "@/components/platform-icon";
import { PageSkeleton, TableSkeleton, WidgetSkeleton } from "@/components/skeletons";
import { SourceBadge } from "@/components/source-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { MultiSelect } from "@/components/ui/multi-select";
import { SaveStatus } from "@/components/ui/save-status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { contrast } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SECTIONS = [
  ["farger", "Färger"],
  ["typografi", "Typografi"],
  ["form", "Avstånd och form"],
  ["knappar", "Knappar"],
  ["formular", "Formulär"],
  ["navigering", "Flikar och menyer"],
  ["status", "Status och märken"],
  ["overlager", "Dialoger och aviseringar"],
  ["tabell", "Tabell"],
  ["laddning", "Laddning och sparstatus"],
  ["tomt", "Tomt, fel och behörighet"],
  ["data", "Datavisualisering"],
] as const;

/** Simulerade tillstånd, så att alla syns samtidigt utan att man behöver hovra eller tabba. */
const HOVER: Record<string, string> = {
  default: "bg-[color-mix(in_oklch,var(--primary),var(--bk-ink)_25%)] dark:bg-[color-mix(in_oklch,var(--primary),white_12%)]",
  outline: "bg-muted",
  secondary: "bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
  ghost: "bg-muted",
  destructive: "bg-destructive/20",
  link: "underline",
};
const FOCUS = "border-ring ring-3 ring-ring/50";

export function Showcase() {
  return (
    <TooltipProvider>
      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Innehåll" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="flex flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-14">
          <Colors />
          <Typography />
          <Shape />
          <Buttons />
          <Forms />
          <Navigation />
          <StatusSection />
          <Overlays />
          <TableSection />
          <Loading />
          <EmptyStates />
          <DataViz />
        </div>
      </div>
    </TooltipProvider>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6">
      <h2 id={`${id}-h`} className="text-h2 font-bold tracking-tight text-heading">
        {title}
      </h2>
      {intro && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function Panel({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      {title && <h3 className="mb-4 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">{title}</h3>}
      {children}
    </div>
  );
}

function StateLabel({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] text-muted-foreground">{children}</span>;
}

/* ─── Färger ─────────────────────────────────────────────────────────────── */

const COLOR_GROUPS: { title: string; tokens: [string, string, string?][] }[] = [
  {
    title: "Neutrala ytor och text",
    tokens: [
      ["--background", "Bakgrund"],
      ["--card", "Kort"],
      ["--muted", "Dämpad yta"],
      ["--border", "Kantlinje"],
      ["--muted-foreground", "Sekundär text", "--card"],
      ["--foreground", "Text", "--card"],
      ["--heading", "Rubrik", "--background"],
    ],
  },
  {
    title: "Navy och accent",
    tokens: [
      ["--primary", "Primär (navy, ljus i mörkt läge)", "--primary-foreground"],
      ["--accent", "Accentyta", "--accent-foreground"],
      ["--link", "Länk", "--card"],
      ["--highlight", "Accent (ljusare navy)", "--card"],
    ],
  },
  {
    title: "Semantiska",
    tokens: [
      ["--success", "Lyckat", "--success-soft"],
      ["--warning", "Varning", "--warning-soft"],
      ["--destructive", "Fel / farligt", "--danger-soft"],
      ["--info", "Information", "--info-soft"],
    ],
  },
];

function useCssVars(names: string[]) {
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const probe = document.createElement("span");
      document.body.appendChild(probe);
      const out: Record<string, string> = {};
      for (const n of names) {
        probe.style.color = `var(${n})`;
        const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
        out[n] = `#${rgb
          .slice(0, 3)
          .map((v) => Math.round(v).toString(16).padStart(2, "0"))
          .join("")}`;
      }
      probe.remove();
      setVals(out);
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return vals;
}

function Colors() {
  const names = [...new Set(COLOR_GROUPS.flatMap((g) => g.tokens.flatMap(([t, , on]) => (on ? [t, on] : [t]))))];
  const vals = useCssVars(names);
  return (
    <Section id="farger" title="Färger" intro="Alla färger är variabler med egna värden i ljust och mörkt tema. Siffran visar kontrasten mot ytan texten står på (krav: 4,5:1 för text, 3:1 för ikoner och kantlinjer).">
      {COLOR_GROUPS.map((g) => (
        <Panel key={g.title} title={g.title}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {g.tokens.map(([t, label, on]) => {
              const c = on && vals[t] && vals[on] ? contrast(vals[t]!, vals[on]!) : null;
              return (
                <li key={t} className="overflow-hidden rounded-lg border">
                  <div className="flex h-14 items-end p-2 text-sm font-medium" style={{ background: on ? `var(${on})` : `var(${t})`, color: on ? `var(${t})` : undefined }}>
                    {on ? "Aa Text" : ""}
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {t} {vals[t]}
                    </p>
                    {c !== null && (
                      <Badge variant={c >= 4.5 ? "success" : c >= 3 ? "warning" : "destructive"} className="tabular">
                        {c.toFixed(1).replace(".", ",")}:1 {c >= 4.5 ? "AA" : c >= 3 ? "stor text" : "för låg"}
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}
      <Panel title="Datakällor – samma färg överallt">
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Färgen följer källan i grafer, märken och ikoner, och visas alltid med namn eller monogram (aldrig bara färg). Paletten är kontrollerad för rött-grönt- och blått-gult-färgblindhet i båda teman.
        </p>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(Object.keys(PLATFORMS) as PlatformId[]).map((p) => (
            <li key={p} className="rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <PlatformIcon platform={p} />
                <span className="text-sm font-medium">{PLATFORMS[p].label}</span>
              </div>
              <div className="mt-3 h-2 rounded-full" style={{ background: `var(${SOURCE_VAR[p]})` }} />
              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {PLATFORMS[p].color} / {PLATFORMS[p].colorDark}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  );
}

const SOURCE_VAR: Record<PlatformId, string> = {
  ga4: "--source-ga4",
  google_ads: "--source-google-ads",
  meta_ads: "--source-meta",
  linkedin_ads: "--source-linkedin",
  tiktok_ads: "--source-tiktok",
};

/* ─── Typografi ──────────────────────────────────────────────────────────── */

function Typography() {
  const rows: [string, string, string][] = [
    ["text-h1 font-bold tracking-tight text-heading", "32 / Sidrubrik", "Kunder"],
    ["text-h2 font-bold tracking-tight text-heading", "24 / Sektion", "Dashboards"],
    ["text-h3 font-medium text-heading", "20 / Kort och dialoger", "Mål och budget"],
    ["text-base", "16 / Brödtext", "Rapporten bygger på data från plattformarnas API:er."],
    ["text-sm", "14 / Gränssnitt (standard)", "Senast synkad för 3 timmar sedan"],
    ["text-xs text-muted-foreground", "12 / Hjälptext och etiketter", "Visas i rapporter och används av AI-analysen."],
  ];
  return (
    <Section id="typografi" title="Typografi" intro="Figtree (som bastakompisar.se) i sex storlekar. Rubriker är kraftiga och täta i navy. Alla tal använder tabulära siffror så att kolumner linjerar.">
      <Panel>
        <dl className="divide-y">
          {rows.map(([cls, meta, sample]) => (
            <div key={meta} className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:items-baseline">
              <dt className="font-mono text-xs text-muted-foreground">{meta}</dt>
              <dd className={cls}>{sample}</dd>
            </div>
          ))}
          <div className="grid gap-1 py-3 sm:grid-cols-[200px_1fr] sm:items-baseline">
            <dt className="font-mono text-xs text-muted-foreground">Nyckeltal (tabulära)</dt>
            <dd className="tabular flex gap-8 text-h1 font-semibold text-heading">
              <span>1 111 kr</span>
              <span>8 888 kr</span>
            </dd>
          </div>
        </dl>
      </Panel>
    </Section>
  );
}

/* ─── Avstånd och form ───────────────────────────────────────────────────── */

function Shape() {
  return (
    <Section id="form" title="Avstånd och form" intro="Avstånd på ett 4/8-pixelsraster, hörnradier 6–12 px, tunna kantlinjer och en mjuk skugga.">
      <div className="grid gap-6 md:grid-cols-3">
        <Panel title="Avstånd">
          <ul className="space-y-2">
            {[4, 8, 12, 16, 24, 32, 48].map((px) => (
              <li key={px} className="flex items-center gap-3 text-xs">
                <span className="tabular w-8 text-muted-foreground">{px}</span>
                <span className="h-3 rounded-sm bg-primary/70" style={{ width: px * 2 }} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Hörnradier">
          <ul className="grid grid-cols-2 gap-3">
            {[
              ["rounded-sm", "6 · märken"],
              ["rounded-md", "8 · fält"],
              ["rounded-lg", "10 · knappar"],
              ["rounded-xl", "12 · kort"],
            ].map(([cls, l]) => (
              <li key={cls} className="text-xs text-muted-foreground">
                <div className={cn("mb-1.5 h-12 border-2 border-primary/50 bg-accent", cls)} />
                {l}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Ytor">
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="rounded-xl border bg-card p-4">Kort: kantlinje</div>
            <div className="rounded-xl border bg-card p-4 shadow-soft">Upphöjt: kantlinje + mjuk skugga</div>
            <div className="rounded-xl border border-dashed p-4">Tomt tillstånd: streckad</div>
          </div>
        </Panel>
      </div>
    </Section>
  );
}

/* ─── Knappar ────────────────────────────────────────────────────────────── */

function Buttons() {
  const variants = [
    ["default", "Primär", "En per vy: huvudåtgärden"],
    ["outline", "Sekundär", "Övriga åtgärder"],
    ["secondary", "Tonad", "Mindre viktiga, i grupper"],
    ["ghost", "Diskret", "Verktyg i kort och listor"],
    ["destructive", "Farlig", "Ta bort, med bekräftelse eller ångra"],
    ["link", "Länk", "Navigering i text"],
  ] as const;
  const states = ["Standard", "Hovring", "Fokus", "Nedtryckt", "Inaktiv", "Laddar"];
  return (
    <Section id="knappar" title="Knappar" intro="Högst en primär knapp per vy. Ikonknappar har alltid ett tillgängligt namn och en tooltip. Klickytan är minst 32 px (44 px på pekskärm).">
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr>
                <th className="pb-3 font-medium text-muted-foreground">Variant</th>
                {states.map((s) => (
                  <th key={s} className="pb-3 text-xs font-medium text-muted-foreground">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map(([v, label, use]) => (
                <tr key={v} className="border-t">
                  <td className="py-3 pr-4">
                    <span className="font-medium">{label}</span>
                    <StateLabel>{use}</StateLabel>
                  </td>
                  <td className="py-3 pr-2">
                    <Button variant={v}>Spara</Button>
                  </td>
                  <td className="py-3 pr-2">
                    <Button variant={v} className={HOVER[v]} tabIndex={-1}>
                      Spara
                    </Button>
                  </td>
                  <td className="py-3 pr-2">
                    <Button variant={v} className={FOCUS} tabIndex={-1}>
                      Spara
                    </Button>
                  </td>
                  <td className="py-3 pr-2">
                    <Button variant={v} className={cn(HOVER[v], "translate-y-px")} tabIndex={-1}>
                      Spara
                    </Button>
                  </td>
                  <td className="py-3 pr-2">
                    <Button variant={v} disabled>
                      Spara
                    </Button>
                  </td>
                  <td className="py-3">
                    <Button variant={v} disabled aria-busy>
                      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> Sparar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Storlekar och ikonknappar">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Liten</Button>
          <Button>Standard</Button>
          <Button size="lg">Stor</Button>
          <Button>
            <Plus /> Med ikon
          </Button>
          {[
            [Pencil, "Redigera"],
            [Download, "Ladda ner"],
            [Trash2, "Ta bort"],
          ].map(([Icon, l]) => {
            const I = Icon as typeof Pencil;
            return (
              <Tooltip key={l as string}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={l as string}>
                    <I />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{l as string}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </Panel>
    </Section>
  );
}

/* ─── Formulär ───────────────────────────────────────────────────────────── */

const DEMO_CLIENTS = ["Demo Center", "Demo Finans", "Demo Hälsa", "Demo Tandvård", "Demo Bygg", "Demo Motor"].map((c) => ({ value: c.toLowerCase(), label: c }));

function Forms() {
  const [multi, setMulti] = useState<string[]>(["demo center"]);
  const [range, setRange] = useState<DateRangeValue>({ preset: "last_30", range: { start: "2026-09-14", end: "2026-10-13" }, compare: "previous_period", compareRange: { start: "2026-08-15", end: "2026-09-13" } });
  return (
    <Section id="formular" title="Formulär" intro="Etiketten står alltid ovanför fältet. Hjälptext och fel kopplas till fältet för skärmläsare, och fel säger vad som behöver göras.">
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Textfält">
          <div className="space-y-4">
            <Field label="Standard" hint="Hjälptext under fältet.">
              {(p) => <Input {...p} placeholder="T.ex. Månadsrapport" />}
            </Field>
            <Field label="Fokus">{(p) => <Input {...p} defaultValue="Månadsrapport" className="border-ring ring-3 ring-ring/50" />}</Field>
            <Field label="Inaktiv">{(p) => <Input {...p} defaultValue="Kan inte ändras" disabled />}</Field>
            <Field label="Fel" error="Namnet måste vara minst 2 tecken.">
              {(p) => <Input {...p} defaultValue="M" />}
            </Field>
            <Field label="Flerradig">{(p) => <Textarea {...p} rows={2} placeholder="Kommentar till kunden …" />}</Field>
          </div>
        </Panel>
        <Panel title="Val">
          <div className="space-y-4">
            <Field label="Lista (ett val)">
              {(p) => (
                <Select defaultValue="sek">
                  <SelectTrigger id={p.id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sek">SEK – svenska kronor</SelectItem>
                    <SelectItem value="eur">EUR – euro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Flerval med sök" hint="Tomt val betyder alla kunder.">
              {(p) => <MultiSelect id={p.id} options={DEMO_CLIENTS} value={multi} onChange={setMulti} allLabel="Alla kunder" />}
            </Field>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Datumintervall med jämförelse</p>
              <DateRangePicker value={range} onApply={(v) => setRange({ ...range, preset: v.preset, compare: v.compare, ...(v.from && v.to ? { range: { start: v.from, end: v.to } } : {}) })} />
            </div>
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium">Kryssrutor och radioknappar</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked className="size-4 accent-[var(--primary)]" /> Visa jämförelse
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" disabled className="size-4" /> Inaktiv
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="ds-r" defaultChecked className="size-4 accent-[var(--primary)]" /> A4, paginerad
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="ds-r" className="size-4 accent-[var(--primary)]" /> En lång sida
              </label>
            </fieldset>
          </div>
        </Panel>
      </div>
    </Section>
  );
}

/* ─── Flikar och menyer ──────────────────────────────────────────────────── */

function Navigation() {
  return (
    <Section id="navigering" title="Flikar och menyer">
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Flikar (piltangenter byter flik)">
          <Tabs defaultValue="dash">
            <TabsList>
              <TabsTrigger value="dash">Dashboards</TabsTrigger>
              <TabsTrigger value="src">Källor</TabsTrigger>
              <TabsTrigger value="goals">Mål och larm</TabsTrigger>
            </TabsList>
            <TabsContent value="dash" className="pt-3 text-sm text-muted-foreground">
              Kundens rapporter.
            </TabsContent>
            <TabsContent value="src" className="pt-3 text-sm text-muted-foreground">
              Valda konton per plattform.
            </TabsContent>
            <TabsContent value="goals" className="pt-3 text-sm text-muted-foreground">
              Mål, budget och larm.
            </TabsContent>
          </Tabs>
        </Panel>
        <Panel title="Rullgardinsmeny">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" aria-label="Fler val">
                <MoreHorizontal /> Fler val
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Pencil /> Byt namn
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download /> Exportera
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2 /> Ta bort
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="mt-3 text-xs text-muted-foreground">Farliga val ligger sist, åtskilda och i röd text.</p>
        </Panel>
      </div>
    </Section>
  );
}

/* ─── Status och märken ──────────────────────────────────────────────────── */

const D = (d: Partial<Extract<Delta, { kind: "change" }>>): Delta => ({ kind: "change", previous: 100, relative: 0.12, absolute: 12, favorable: true, ...d });

function StatusSection() {
  return (
    <Section id="status" title="Status och märken" intro="Status visas med färg, form och text. Förändring visas med pil och tecken, och färgen säger om det är bra för kunden (högre CPA är rött).">
      <div className="grid gap-6 md:grid-cols-2">
        <Panel title="Källstatus">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="OK" />
            <StatusBadge status="PENDING" />
            <StatusBadge status="SYNC_ERROR" />
            <StatusBadge status="AUTH_REQUIRED" />
          </div>
        </Panel>
        <Panel title="Märken">
          <div className="flex flex-wrap gap-2">
            <Badge>Standard</Badge>
            <Badge variant="neutral">Neutral</Badge>
            <Badge variant="success">Skickat</Badge>
            <Badge variant="warning">Ej skickat</Badge>
            <Badge variant="destructive">Misslyckades</Badge>
            <Badge variant="info">Nytt</Badge>
            <Badge variant="outline">Kontur</Badge>
          </div>
        </Panel>
        <Panel title="Förändring mot jämförelseperiod">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-3">
              <DeltaBadge metric="sessions" delta={D({})} /> Bra ökning (fler besök)
            </li>
            <li className="flex items-center gap-3">
              <DeltaBadge metric="cpa" delta={D({ favorable: false })} /> Dålig ökning (dyrare konvertering)
            </li>
            <li className="flex items-center gap-3">
              <DeltaBadge metric="spend" delta={D({ favorable: null, relative: 0.018, absolute: 240 })} /> Neutral (spend)
            </li>
            <li className="flex items-center gap-3">
              <DeltaBadge metric="sessions" delta={{ kind: "new" }} /> Föregående period var 0 – aldrig ”+100 %”
            </li>
            <li className="flex items-center gap-3">
              <DeltaBadge metric="sessions" delta={{ kind: "flat", previous: 10 }} /> Oförändrat
            </li>
            <li className="flex items-center gap-3">
              <DeltaBadge metric="sessions" delta={{ kind: "none" }} /> Ingen jämförelsedata
            </li>
          </ul>
        </Panel>
        <Panel title="Källor">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PLATFORMS) as PlatformId[]).map((p) => (
              <SourceBadge key={p} platform={p} />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Monogrammets bakgrund mörknas automatiskt tills den vita texten klarar 4,5:1.</p>
        </Panel>
      </div>
    </Section>
  );
}

/* ─── Dialoger och aviseringar ───────────────────────────────────────────── */

function Overlays() {
  const [cmd, setCmd] = useState(false);
  return (
    <Section id="overlager" title="Dialoger och aviseringar" intro="Modal för beslut som kräver svar, sidopanel för redigering med sammanhang, aviseringar för bekräftelser (med Ångra där det går).">
      <Panel>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ta bort dashboarden?</DialogTitle>
                <DialogDescription>Månadsrapport och dess 12 widgets tas bort. Delade länkar slutar fungera.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost">Avbryt</Button>
                <Button variant="destructive">Ta bort</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Sidopanel</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Widgetinställningar</SheetTitle>
                <SheetDescription>Ändringar syns direkt i rapporten.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Button variant="outline" onClick={() => toast.success("Rapporten är sparad.")}>
            Avisering: lyckat
          </Button>
          <Button variant="outline" onClick={() => toast.error("PDF:en kunde inte skapas. Försök igen om en stund.")}>
            Avisering: fel
          </Button>
          <Button variant="outline" onClick={() => toast.success("Widgeten är borttagen.", { action: { label: "Ångra", onClick: () => toast.success("Widgeten är tillbaka.") } })}>
            Avisering med Ångra
          </Button>
          <Button variant="outline" onClick={() => setCmd(true)}>
            <Search /> Kommandopalett <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </Button>
        </div>
        <CommandDialog open={cmd} onOpenChange={setCmd}>
          <Command>
          <CommandInput placeholder="Sök kund, rapport eller åtgärd …" />
          <CommandList>
            <CommandEmpty>Inga träffar.</CommandEmpty>
            <CommandGroup heading="Kunder">
              <CommandItem>Demo Center</CommandItem>
              <CommandItem>Demo Finans</CommandItem>
            </CommandGroup>
            <CommandGroup heading="Åtgärder">
              <CommandItem>
                <Plus /> Ny dashboard <CommandShortcut>N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Plus /> Koppla källa
              </CommandItem>
            </CommandGroup>
          </CommandList>
          </Command>
        </CommandDialog>
      </Panel>
    </Section>
  );
}

/* ─── Tabell ─────────────────────────────────────────────────────────────── */

const ROWS = [
  { name: "[BK] Demo Center – Höstkampanj 2026 med ett mycket långt kampanjnamn som annars klipps", spend: 6503, ctr: 0.0124 },
  { name: "[BK] Hansa – Interaktion inlägg", spend: 3058, ctr: 0.0211 },
  { name: "[BK] Noomi – Awareness – Utsatta sv/eng", spend: 2591, ctr: 0.0089 },
  { name: "[BK] Noomi – Awareness – Utsatta minoritet", spend: 1287, ctr: 0.0102 },
];

function TableSection() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: "name" | "spend" | "ctr"; dir: 1 | -1 }>({ key: "spend", dir: -1 });
  const rows = useMemo(
    () => ROWS.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : -1) * sort.dir),
    [q, sort],
  );
  const th = (key: typeof sort.key, label: string, num?: boolean) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("sticky top-0 bg-muted/60 px-4 py-2.5 text-xs font-medium text-muted-foreground backdrop-blur", num && "text-right")}>
      <button type="button" onClick={() => setSort({ key, dir: sort.key === key ? ((sort.dir * -1) as 1 | -1) : -1 })} className="inline-flex items-center gap-1 hover:text-foreground">
        {label} <ArrowUpDown className="size-3" aria-hidden />
      </button>
    </th>
  );
  return (
    <Section id="tabell" title="Tabell" intro="Fast rubrikrad, sortering per kolumn, sök och tal högerställda med tabulära siffror. Lång text bryts på rader i stället för att klippas.">
      <Panel>
        <div className="mb-3 max-w-xs">
          <Input type="search" placeholder="Sök kampanj …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Sök kampanj" />
        </div>
        <div className="max-h-64 overflow-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {th("name", "Kampanj")}
                {th("spend", "Spend", true)}
                {th("ctr", "CTR", true)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.name} className="hover:bg-muted/40">
                  <td className="px-4 py-2.5 break-words">{r.name}</td>
                  <td className="tabular px-4 py-2.5 text-right">{r.spend.toLocaleString("sv-SE")} kr</td>
                  <td className="tabular px-4 py-2.5 text-right">{(r.ctr * 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} %</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    Inga kampanjer matchar ”{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </Section>
  );
}

/* ─── Laddning ───────────────────────────────────────────────────────────── */

function Loading() {
  return (
    <Section id="laddning" title="Laddning och sparstatus" intro="Platshållare med samma form som innehållet i stället för snurror, så att sidan inte hoppar. Autosparning visar alltid sin status.">
      <div className="grid gap-4 md:grid-cols-3">
        <WidgetSkeleton kind="kpi" />
        <WidgetSkeleton kind="chart" />
        <WidgetSkeleton kind="table" />
      </div>
      <TableSkeleton rows={3} />
      <Panel title="Sparstatus">
        <div className="flex flex-wrap gap-6">
          <SaveStatus state="saving" />
          <SaveStatus state="saved" />
          <SaveStatus state="error" onRetry={() => toast.success("Sparat.")} />
        </div>
      </Panel>
      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Hel sida som laddar</summary>
        <div className="mt-3 overflow-hidden rounded-lg border">
          <PageSkeleton />
        </div>
      </details>
    </Section>
  );
}

/* ─── Tomt, fel och behörighet ───────────────────────────────────────────── */

function EmptyStates() {
  return (
    <Section id="tomt" title="Tomt, fel och behörighet" intro="Varje tillstånd förklarar vad som hänt och erbjuder nästa steg. Fel visas på svenska; den tekniska texten finns hopfälld för support.">
      <div className="grid gap-4 md:grid-cols-2">
        <EmptyState icon={<BarChart3 />} title="Inga dashboards än" text="Skapa en tom dashboard eller utgå från en av byråns mallar." action={<Button><Plus /> Ny dashboard</Button>} />
        <EmptyState icon={<Inbox />} title="Ingen data för perioden" text="Källan har inte rapporterat något mellan 1 och 7 okt. Välj en längre period." action={<Button variant="outline">Senaste 30 dagarna</Button>} />
        <EmptyState
          icon={<FileWarning />}
          title="Inloggningen har gått ut"
          text={
            <>
              Meta-kontot kan inte synkas. Koppla om källan under Databaser.
              <details className="mt-2 text-left text-xs">
                <summary className="cursor-pointer">Teknisk information</summary>
                <span className="font-mono">Error validating access token (kod 190)</span>
              </details>
            </>
          }
          action={<Button>Koppla om</Button>}
        />
        <EmptyState icon={<Lock />} title="Du saknar behörighet" text="Den här sidan kräver rollen redaktör. Be en admin på byrån om ändrad roll." action={<Button variant="outline">Till kunderna</Button>} />
      </div>
    </Section>
  );
}

/* ─── Datavisualisering ──────────────────────────────────────────────────── */

function DataViz() {
  const rules = [
    ["Rätt diagram för uppgiften", "Utveckling över tid: linje. Jämföra delar: liggande staplar, sorterade. Andel av helhet: donut med högst 4 korta kategorier. Ett tal: KPI-kort."],
    ["Hög data-ink-ratio", "Få och svaga stödlinjer, ingen 3D, inga skuggor i diagram, axlar utan ramar."],
    ["En y-axel", "Två mått i olika skala visas i två diagram, aldrig med dubbla axlar."],
    ["Färg följer källan", "GA4 är alltid orange, Meta alltid lila, oavsett ordning eller filter."],
    ["Aldrig bara färg", "Legend för två eller fler serier, direkta etiketter för upp till fyra, och tabellvy."],
    ["Ärliga jämförelser", "\"Ny\" när föregående period var 0, valutor räknas om och förklaras, och staplar börjar på noll."],
  ];
  return (
    <Section id="data" title="Datavisualisering" intro="Principer från Tufte och Few som alla widgets följer.">
      <Panel>
        <dl className="grid gap-4 md:grid-cols-2">
          {rules.map(([t, d]) => (
            <div key={t}>
              <dt className="text-sm font-medium">{t}</dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </Section>
  );
}
