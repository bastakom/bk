"use client";

import {
  DIMENSIONS,
  METRICS,
  MetricRegistry,
  PLATFORMS,
  RANGE_PRESETS,
  VIDEO_FUNNEL,
  WIDGET_META,
  WIDGET_TYPES,
  widgetConfigSchema,
  type CustomMetricDef,
  type DimensionId,
  type PlatformId,
  type WidgetConfig,
  type WidgetType,
  videoEmbed,
} from "@rp/core";
import { BarChart3, ChevronDown, ChevronUp, Filter, Gauge, GalleryHorizontalEnd, Goal, FileText, ImagePlay, Earth, Sparkles, Heading, LineChart, Loader2, PieChart, Plus, Table2, TextIcon, TriangleRight, X, ListOrdered } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ICON_LABELS, MetricIcon, type MetricIconId } from "@/components/metric-icons";
import { WidgetView } from "@/components/widgets/widget-view";
import { metricAvailability, type Catalog } from "@/lib/availability";
import type { AccountInfo, WidgetData } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";
import { loadFilterValues, previewWidget, saveWidget, type WidgetInput } from "./actions";
import { draftClientSummary } from "./insight-actions";
import { completeFilters, FilterBuilder } from "@/components/filter-builder";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { autoTitle } from "./widget-title";

const TYPE_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  kpi: Gauge,
  metric_list: ListOrdered,
  timeseries: LineChart,
  bar: BarChart3,
  donut: PieChart,
  table: Table2,
  funnel: TriangleRight,
  ad_gallery: GalleryHorizontalEnd,
  goal: Goal,
  summary: FileText,
  media: ImagePlay,
  map: Earth,
  text: TextIcon,
  section: Heading,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  widget: DashboardWidget | null;
  accounts: AccountInfo[];
  catalog: Catalog;
  customMetrics: CustomMetricDef[];
  clientCurrency: string;
  /** Rapportens källor: nya widgets utgår från dem */
  reportSources?: string[];
  /** Kundens mål (för målwidgeten) */
  goals?: { id: string; label: string }[];
  clientSlug?: string;
  /** Sidan som en ny widget hamnar på */
  pageId?: string;
}

export function WidgetEditor({ open, onOpenChange, dashboardId, widget, accounts, catalog, customMetrics, reportSources = [], goals = [], clientSlug, pageId }: Props) {
  const reg = useMemo(() => new MetricRegistry(customMetrics), [customMetrics]);
  const sp = useSearchParams();
  const [type, setTypeState] = useState<WidgetType>(widget?.type ?? "kpi");
  const [title, setTitle] = useState(widget?.title ?? "");
  // Ny widget: rapportens källa för första kanalen (t.ex. rapportens GA4-property), annars kundens första källa.
  const defaultIds = useMemo(() => {
    const report = reportSources.map((id) => accounts.find((a) => a.id === id)).filter((a): a is AccountInfo => !!a);
    if (report.length) return report.filter((a) => a.platform === report[0]!.platform).map((a) => a.id);
    return accounts[0] ? [accounts[0].id] : [];
  }, [reportSources, accounts]);
  const [accountIds, setAccountIdsState] = useState<string[]>(widget?.accountIds ?? defaultIds);
  const [config, setConfig] = useState<WidgetConfig>(
    () => widget?.config ?? withDefaults(widgetConfigSchema.parse({ metrics: [] }), "kpi", defaultIds, accounts, catalog, reg),
  );
  // Typ- och källbyten justerar konfigurationen direkt (i händelsen, inte i en effekt).
  const setType = (t: WidgetType) => {
    setTypeState(t);
    setConfig((c) => withDefaults(c, t, accountIds, accounts, catalog, reg));
  };
  const setAccountIds = (update: (ids: string[]) => string[]) => {
    const next = update(accountIds);
    setAccountIdsState(next);
    setConfig((c) => withDefaults(c, type, next, accounts, catalog, reg));
  };
  const [preview, setPreview] = useState<WidgetData | null>(widget?.data ?? null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, startSave] = useTransition();

  const meta = WIDGET_META[type];
  const { platforms, availableMetrics, availableDimensions } = useMemo(() => availability(accountIds, accounts, catalog, reg), [accountIds, accounts, catalog, reg]);

  const patch = (p: Partial<WidgetConfig>) => setConfig((c) => ({ ...c, ...p }));

  const input: WidgetInput = useMemo(
    () => ({
      dashboardId,
      widgetId: widget?.id,
      type,
      title: title || null,
      config: { ...config, filters: completeFilters(config.filters), pageId: config.pageId ?? pageId },
      accountIds: meta.needsData ? accountIds : [],
    }),
    [dashboardId, widget?.id, type, title, config, accountIds, meta.needsData, pageId],
  );

  // Live-förhandsvisning (debounce). Målwidgeten hämtar data från kundens mål.
  const previewable = meta.needsData || type === "goal";
  useEffect(() => {
    if (!previewable) return;
    const params = Object.fromEntries(sp.entries());
    const t = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        setPreview(await previewWidget(input, params));
      } finally {
        setLoadingPreview(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input, sp, previewable]);

  const onSave = () =>
    startSave(async () => {
      const res = await saveWidget(input);
      if (res.ok) {
        toast.success(widget ? "Widgeten är uppdaterad." : "Widgeten är tillagd.");
        onOpenChange(false);
      } else toast.error(res.error);
    });

  const canSave = type === "media" ? !!config.mediaUrl && (config.mediaKind !== "video" || !!videoEmbed(config.mediaUrl)) : type === "summary" ? true : type === "goal" ? config.goalIds.length > 0 : !meta.needsData || (accountIds.length > 0 && config.metrics.length > 0 && (!(type === "table" || type === "bar" || type === "donut") || !!config.dimension));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[min(1100px,96vw)]">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{widget ? "Redigera widget" : "Ny widget"}</SheetTitle>
          <SheetDescription>Välj typ, källor och metrics. Förhandsvisningen använder dashboardens period.</SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 md:grid-cols-[400px_minmax(0,1fr)]">
          <div className="min-h-0 space-y-6 overflow-y-auto border-r px-6 py-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Typ</legend>
              <div className="grid grid-cols-4 gap-2">
                {WIDGET_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      aria-pressed={type === t}
                      title={WIDGET_META[t].description}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        type === t ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {WIDGET_META[t].label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="w-title">{type === "section" ? "Rubrik" : "Rubrik (valfri)"}</Label>
              <Input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle(type, config, (id) => reg.meta(id).label) || "Rubrik"} />
            </div>

            {meta.needsData && (
              <div className="space-y-1.5">
                <Label htmlFor="w-description">Beskrivning (valfri)</Label>
                <Input id="w-description" value={config.description ?? ""} maxLength={200} onChange={(e) => patch({ description: e.target.value || undefined })} placeholder="T.ex. Klick på annonsens länk" />
              </div>
            )}

            {type === "metric_list" && (
              <fieldset className="space-y-1.5">
                <legend className="mb-1 text-sm font-medium">Visa</legend>
                {(
                  [
                    ["metrics", "Flera nyckeltal, ett per rad (t.ex. reaktioner, kommentarer, delningar)"],
                    ["sources", "Ett nyckeltal per källa (t.ex. spend för Meta och Google Ads)"],
                  ] as const
                ).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2.5 text-sm">
                    <input type="radio" name="list-mode" className="size-4 accent-[var(--primary)]" checked={config.listMode === v} onChange={() => patch({ listMode: v, ...(v === "sources" ? { metrics: config.metrics.slice(0, 1) } : {}) })} />
                    {l}
                  </label>
                ))}
              </fieldset>
            )}

            {(type === "kpi" || type === "metric_list") && (
              <div className="grid gap-3 sm:grid-cols-2">
                {type === "kpi" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="f-kpi-stil">Stil</Label>
                    <Select value={config.kpiStyle} onValueChange={(v) => patch({ kpiStyle: v as "standard" | "icon" })}>
                      <SelectTrigger id="f-kpi-stil" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Stort tal med kurva</SelectItem>
                        <SelectItem value="icon">Kompakt med ikon</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(type === "metric_list" || config.kpiStyle === "icon") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="f-ikon">Ikon</Label>
                    <Select value={config.icon} onValueChange={(v) => patch({ icon: v })}>
                      <SelectTrigger id="f-ikon" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatisk (efter nyckeltalet)</SelectItem>
                        <SelectItem value="none">Ingen ikon</SelectItem>
                        {(Object.keys(ICON_LABELS) as MetricIconId[]).map((id) => (
                          <SelectItem key={id} value={id}>
                            <MetricIcon metric="" icon={id} className="size-5" /> {ICON_LABELS[id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {type === "section" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="f-kallans-logga">Källans logga</Label>
                  <Select value={config.platform ?? "none"} onValueChange={(v) => patch({ platform: v === "none" ? undefined : v })}>
                    <SelectTrigger id="f-kallans-logga" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {Object.values(PLATFORMS).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-sub">Underrubrik (valfri)</Label>
                  <Input id="w-sub" value={config.text ?? ""} onChange={(e) => patch({ text: e.target.value })} />
                </div>
              </>
            )}

            {type === "goal" && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">Mål att visa</legend>
                {goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Kunden har inga mål än.{" "}
                    {clientSlug && (
                      <a href={`/clients/${clientSlug}#goals-heading`} className="font-medium text-link underline-offset-2 hover:underline">
                        Lägg till mål på kundsidan
                      </a>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {goals.map((g) => (
                      <li key={g.id}>
                        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                          <input
                            type="checkbox"
                            className="size-4 accent-[var(--primary)]"
                            checked={config.goalIds.includes(g.id)}
                            onChange={(e) => patch({ goalIds: e.target.checked ? [...config.goalIds, g.id] : config.goalIds.filter((x) => x !== g.id) })}
                          />
                          {g.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">Visar målperioden (månad, kvartal eller år) som innehåller rapportens slutdatum.</p>
              </fieldset>
            )}

            {type === "media" && <MediaEditor config={config} onChange={patch} />}

            {type === "summary" && (
              <SummaryEditor
                dashboardId={dashboardId}
                text={config.text ?? ""}
                status={config.summaryStatus}
                onText={(text) => patch({ text })}
                onStatus={(summaryStatus) => patch({ summaryStatus })}
              />
            )}

            {type === "text" && (
              <div className="space-y-1.5">
                <Label htmlFor="w-text">Text</Label>
                <Textarea id="w-text" rows={10} value={config.text ?? ""} onChange={(e) => patch({ text: e.target.value })} placeholder={"Skriv en kommentar eller analys.\n\nTom rad = nytt stycke. Rader som börjar med \"- \" blir en lista."} />
              </div>
            )}

            {meta.needsData && (
              <>
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Källor</legend>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Kunden har inga källor än. Välj källor på kundsidan.</p>
                  ) : (
                    <ul className="space-y-1">
                      {[...accounts].sort((a, b) => Number(reportSources.includes(b.id)) - Number(reportSources.includes(a.id))).map((a) => (
                        <li key={a.id}>
                          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                            <input
                              type="checkbox"
                              className="size-4 accent-[var(--primary)]"
                              checked={accountIds.includes(a.id)}
                              onChange={(e) => setAccountIds((ids) => (e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id)))}
                            />
                            <PlatformIcon platform={a.platform} size="sm" />
                            <span className="min-w-0 flex-1 truncate">{a.name}</span>
                            {reportSources.includes(a.id) && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">I rapporten</span>}
                            <span className="text-xs text-muted-foreground">{a.currency}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  {accountIds.length > 1 && <p className="mt-2 text-xs text-muted-foreground">Flera källor summeras. Kvoter räknas om från summorna.</p>}
                </fieldset>

                <MetricPicker
                  label={type === "funnel" ? "Steg i ordning" : "Metrics"}
                  value={config.metrics}
                  options={availableMetrics}
                  registry={reg}
                  max={type === "donut" || type === "bar" || type === "map" || (type === "metric_list" && config.listMode === "sources") ? 1 : type === "kpi" ? 6 : 8}
                  ordered={type === "funnel" || type === "table" || type === "kpi" || type === "metric_list"}
                  onChange={(metrics) => patch({ metrics })}
                />

                {(type === "table" || type === "bar" || type === "donut") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="f-dimension">Dimension</Label>
                    <Select value={config.dimension} onValueChange={(v) => patch({ dimension: v as DimensionId })}>
                      <SelectTrigger id="f-dimension" className="w-full">
                        <SelectValue placeholder="Välj dimension" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDimensions.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {DIMENSIONS[d.id].label}
                            {d.partial && <span className="text-muted-foreground"> (endast {d.platforms.map((p) => PLATFORMS[p].label).join(", ")})</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {type === "map" && (
                  <div className="space-y-1.5">
                    <Label>Visa per</Label>
                    <Select value={config.dimension === "region" ? "region" : "country"} onValueChange={(v) => patch({ dimension: v as DimensionId })}>
                      <SelectTrigger className="w-full" aria-label="Visa per">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="country">Land (karta)</SelectItem>
                        <SelectItem value="region">Region (lista)</SelectItem>
                      </SelectContent>
                    </Select>
                    {!availableDimensions.some((d) => d.id === (config.dimension === "region" ? "region" : "country")) && (
                      <p className="text-xs text-destructive">Valda källor har ingen uppdelning per {config.dimension === "region" ? "region" : "land"}.</p>
                    )}
                  </div>
                )}

                {type === "timeseries" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="f-diagram">Diagram</Label>
                      <Select value={config.chart} onValueChange={(v) => patch({ chart: v as WidgetConfig["chart"] })}>
                        <SelectTrigger id="f-diagram" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line">Linje</SelectItem>
                          <SelectItem value="area">Yta</SelectItem>
                          <SelectItem value="bar">Stapel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="f-upplosning">Upplösning</Label>
                      <Select value={config.granularity} onValueChange={(v) => patch({ granularity: v as WidgetConfig["granularity"] })}>
                        <SelectTrigger id="f-upplosning" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatisk</SelectItem>
                          <SelectItem value="day">Dag</SelectItem>
                          <SelectItem value="week">Vecka</SelectItem>
                          <SelectItem value="month">Månad</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {(type === "table" || type === "bar" || type === "donut" || type === "ad_gallery") && (
                  <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
                    <div className="space-y-1.5">
                      <Label>Sortera på</Label>
                      <Select
                        value={`${config.sort?.by ?? config.metrics[0] ?? ""}:${config.sort?.dir ?? "desc"}`}
                        onValueChange={(v) => {
                          const [by, dir] = v.split(":");
                          patch({ sort: { by: by!, dir: dir as "asc" | "desc" } });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {config.metrics.flatMap((m) => [
                            <SelectItem key={`${m}:desc`} value={`${m}:desc`}>
                              {reg.meta(m).label}, högst först
                            </SelectItem>,
                            <SelectItem key={`${m}:asc`} value={`${m}:asc`}>
                              {reg.meta(m).label}, lägst först
                            </SelectItem>,
                          ])}
                          <SelectItem value="label:asc">Namn A–Ö</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="w-limit">{type === "donut" ? "Delar" : "Antal"}</Label>
                      <Input
                        id="w-limit"
                        type="number"
                        min={1}
                        max={type === "donut" ? 7 : 100}
                        value={config.limit}
                        onChange={(e) => patch({ limit: Math.max(1, Math.min(Number(e.target.value) || 1, type === "donut" ? 7 : 100)) })}
                      />
                    </div>
                  </div>
                )}

                <fieldset>
                  <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Filter className="size-3.5" /> Filter
                  </legend>
                  <FilterBuilder
                    filters={config.filters}
                    onChange={(filters) => patch({ filters })}
                    platforms={platforms}
                    catalog={catalog}
                    loadValues={(platform, dimension) => loadFilterValues(dashboardId, platform, dimension)}
                    hint={
                      type === "table" || type === "bar" || type === "donut"
                        ? "Filter på samma fält som uppdelningen fungerar för alla kanaler. Filter på andra fält kan inte kombineras med uppdelningen."
                        : type === "ad_gallery"
                          ? "Annonser kan filtreras på kampanj."
                          : "Ett filterfält per kanal, t.ex. kampanj. Dashboardens filter gäller också."
                    }
                  />
                </fieldset>

                {type === "table" && config.showComparison && (
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={config.showPrevious} onChange={(e) => patch({ showPrevious: e.target.checked })} />
                    Visa kolumn med föregående period
                  </label>
                )}

                {type === "timeseries" && platforms.length > 1 && (
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={config.splitBySource} onChange={(e) => patch({ splitBySource: e.target.checked })} />
                    Dela upp per källa (staplat)
                  </label>
                )}

                {platforms.includes("google_ads") && ((type === "metric_list" && config.listMode === "sources") || ((type === "table" || type === "bar" || type === "donut") && config.dimension === "source")) && (
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={config.splitYouTube} onChange={(e) => patch({ splitYouTube: e.target.checked })} />
                    Visa YouTube som egen källa
                  </label>
                )}

                {type !== "funnel" && type !== "ad_gallery" && (
                  <label className="flex items-center gap-2.5 text-sm">
                    <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={config.showComparison} onChange={(e) => patch({ showComparison: e.target.checked })} />
                    Visa jämförelse med föregående period
                  </label>
                )}

                {type !== "ad_gallery" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="w-fixed-range">Period</Label>
                    <Select
                      value={config.fixedRange?.preset ?? "dashboard"}
                      onValueChange={(v) => patch({ fixedRange: v === "dashboard" ? undefined : v === "custom" ? { preset: "custom", start: config.fixedRange?.start ?? `${new Date().getFullYear()}-01-01`, end: config.fixedRange?.end ?? `${new Date().getFullYear()}-12-31` } : { preset: v as Exclude<NonNullable<WidgetConfig["fixedRange"]>["preset"], "custom"> } })}
                    >
                      <SelectTrigger id="w-fixed-range" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">Samma som dashboarden</SelectItem>
                        {RANGE_PRESETS.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            Alltid {p.label.charAt(0).toLowerCase() + p.label.slice(1)}
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">Egen period (t.ex. kampanjperiod)</SelectItem>
                      </SelectContent>
                    </Select>
                    {config.fixedRange?.preset === "custom" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="w-fixed-start" className="text-xs">Från</Label>
                          <Input id="w-fixed-start" type="date" value={config.fixedRange.start ?? ""} onChange={(e) => patch({ fixedRange: { ...config.fixedRange!, start: e.target.value } })} />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="w-fixed-end" className="text-xs">Till</Label>
                          <Input id="w-fixed-end" type="date" value={config.fixedRange.end ?? ""} onChange={(e) => patch({ fixedRange: { ...config.fixedRange!, end: e.target.value } })} />
                        </div>
                      </div>
                    )}
                    {config.fixedRange && <p className="text-xs text-muted-foreground">Widgeten visar alltid den här perioden, oavsett vilken period som väljs i dashboarden.</p>}
                  </div>
                )}

                <label className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={config.showFooter} onChange={(e) => patch({ showFooter: e.target.checked })} />
                  Visa sidfot med källa och period
                </label>

                {type === "kpi" && config.metrics.length === 1 && (
                  <fieldset className="space-y-1.5">
                    <legend className="text-sm">Framhävt block (mörkt, i kundens färg)</legend>
                    {(
                      [
                        [undefined, "Automatiskt (första KPI-kortet på sidan)"],
                        [true, "Alltid framhävt"],
                        [false, "Aldrig framhävt"],
                      ] as const
                    ).map(([v, l]) => (
                      <label key={String(v)} className="flex items-center gap-2.5 text-sm">
                        <input type="radio" name="kpi-emphasis" className="size-4 accent-[var(--primary)]" checked={config.emphasis === v} onChange={() => patch({ emphasis: v })} />
                        {l}
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}
          </div>

          <div className="flex min-h-[360px] flex-col bg-muted/40 p-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Förhandsvisning {loadingPreview && <Loader2 className="size-3.5 animate-spin" />}
            </div>
            <div
              className={cn("@container flex flex-col rounded-xl border bg-card p-4 shadow-soft", type === "kpi" ? (config.kpiStyle === "icon" ? "h-32 max-w-sm" : "h-44 max-w-xs") : type === "metric_list" ? "max-w-sm" : type === "section" ? "" : "min-h-80 flex-1")}
            >
              {type !== "section" && <h3 className="mb-3 text-sm font-medium">{title || autoTitle(type, config, (id) => reg.meta(id).label)}</h3>}
              <div className="min-h-0 flex-1">
                {!meta.needsData || preview?.result ? (
                  <WidgetView type={type} title={title || null} config={config} data={preview} platforms={platforms} />
                ) : (
                  <p className="grid h-full place-items-center text-sm text-muted-foreground">{preview?.notices[0] ?? "Välj källor och metrics."}</p>
                )}
              </div>
              {preview && preview.notices.length > 0 && preview.result && <p className="mt-2 text-xs text-warning">{preview.notices.join(" ")}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={onSave} disabled={!canSave || saving}>
            {saving && <Loader2 className="animate-spin" />}
            {widget ? "Spara" : "Lägg till"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function availability(accountIds: string[], accounts: AccountInfo[], catalog: Catalog, reg: MetricRegistry) {
  const platforms = [...new Set(accounts.filter((a) => accountIds.includes(a.id)).map((a) => a.platform))] as PlatformId[];
  // Inbyggda metrics och egna formler som går att räkna ut med valda källor.
  const all = [...(Object.keys(METRICS) as string[]), ...reg.customList().map((c) => c.id)];
  const availableMetrics = all.filter((m) => metricAvailability(m, platforms, catalog, reg).ok);
  const dims = new Map<DimensionId, PlatformId[]>();
  platforms.forEach((p) => catalog[p]?.dimensions.forEach((d) => d !== "date" && dims.set(d, [...(dims.get(d) ?? []), p])));
  const availableDimensions = [...dims.entries()].map(([id, ps]) => ({ id, platforms: ps, partial: ps.length < platforms.length }));
  // "Källa" fungerar alltid – den grupperar på plattform.
  if (platforms.length > 0) availableDimensions.unshift({ id: "source", platforms, partial: false });
  return { platforms, availableMetrics, availableDimensions };
}

/** Rimliga standardval när typ eller källor ändras. */
function withDefaults(c: WidgetConfig, type: WidgetType, accountIds: string[], accounts: AccountInfo[], catalog: Catalog, reg: MetricRegistry): WidgetConfig {
  const { availableMetrics, availableDimensions } = availability(accountIds, accounts, catalog, reg);
  const next = { ...c };
  const has = (m: string) => availableMetrics.includes(m);
  if (type === "funnel") {
    if (!c.metrics.length || !c.metrics.every((m) => (VIDEO_FUNNEL as string[]).includes(m))) next.metrics = VIDEO_FUNNEL.filter(has);
  } else if (type === "ad_gallery") {
    if (!c.metrics.length) next.metrics = ["impressions", "clicks"].filter(has);
  } else if (WIDGET_META[type].needsData) {
    next.metrics = c.metrics.filter(has);
    if (!next.metrics.length) {
      const first = ["spend", "sessions", "impressions", "clicks"].find(has) ?? availableMetrics[0];
      next.metrics = first ? [first] : [];
    }
  }
  const realDims = availableDimensions.filter((d) => d.id !== "source");
  if ((type === "table" || type === "bar" || type === "donut") && (!c.dimension || !availableDimensions.some((d) => d.id === c.dimension))) {
    next.dimension = realDims.find((d) => !d.partial)?.id ?? availableDimensions[0]?.id;
  }
  if ((type === "donut" || type === "bar" || type === "map") && next.metrics.length > 1) next.metrics = next.metrics.slice(0, 1);
  if (type === "map" && next.dimension !== "region") next.dimension = "country";
  return next;
}

function MetricPicker({
  label,
  value,
  options,
  registry,
  max,
  ordered,
  onChange,
}: {
  label: string;
  value: string[];
  options: string[];
  registry: MetricRegistry;
  max: number;
  ordered: boolean;
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const remaining = options.filter((m) => !value.includes(m));
  const agg = (m: string) => registry.meta(m).aggregation;
  const groups = [
    { label: "Volym", items: remaining.filter((m) => agg(m) === "sum" || agg(m) === "sum_approx") },
    { label: "Kvoter och kostnader", items: remaining.filter((m) => agg(m) === "derived") },
    { label: "Byråns egna metrics", items: remaining.filter((m) => agg(m) === "custom") },
  ];
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d]!, next[i]!];
    onChange(next);
  };
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <ul className="space-y-1">
        {value.map((m, i) => (
          <li key={m} className="flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{registry.meta(m).label}</span>
            {ordered && value.length > 1 && (
              <>
                <Button variant="ghost" size="icon" className="size-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Flytta upp ${registry.meta(m).label}`}>
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Flytta ned ${registry.meta(m).label}`}>
                  <ChevronDown className="size-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="size-6" onClick={() => onChange(value.filter((x) => x !== m))} aria-label={`Ta bort ${registry.meta(m).label}`}>
              <X className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {value.length < max && remaining.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="mt-2">
              <Plus /> Lägg till metric
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <Command>
              <CommandInput placeholder="Sök metric…" />
              <CommandList>
                <CommandEmpty>Ingen metric hittades.</CommandEmpty>
                {groups.map(
                  (g) =>
                    g.items.length > 0 && (
                      <CommandGroup key={g.label} heading={g.label}>
                        {g.items.map((m) => (
                          <CommandItem
                            key={m}
                            value={`${registry.meta(m).label} ${registry.meta(m).shortLabel ?? ""} ${m}`}
                            onSelect={() => {
                              onChange([...value, m]);
                              setOpen(false);
                            }}
                          >
                            <span className="flex-1">{registry.meta(m).label}</span>
                            {registry.meta(m).shortLabel && <span className="text-xs text-muted-foreground">{registry.meta(m).shortLabel}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ),
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </fieldset>
  );
}

/** Sammanfattning till kunden: AI skriver ett utkast som byrån redigerar och publicerar. */
function SummaryEditor(props: { dashboardId: string; text: string; status: "draft" | "published"; onText: (t: string) => void; onStatus: (s: "draft" | "published") => void }) {
  const sp = useSearchParams();
  const [writing, startWriting] = useTransition();
  const write = () =>
    startWriting(async () => {
      if (props.text.trim() && !window.confirm("Ersätta den nuvarande texten med ett nytt AI-utkast?")) return;
      const res = await draftClientSummary(props.dashboardId, Object.fromEntries(sp.entries()));
      if (!res.ok) return void toast.error(res.error);
      props.onText(res.data ?? "");
      props.onStatus("draft");
      toast.success("Utkastet är klart. Läs igenom och redigera innan du publicerar.");
    });
  return (
    <div className="space-y-4">
      <Button type="button" variant="outline" onClick={write} disabled={writing}>
        {writing ? <Loader2 className="animate-spin" /> : <Sparkles className="text-highlight" />} {writing ? "Skriver …" : "Skriv utkast med AI"}
      </Button>
      <div className="space-y-1.5">
        <Label htmlFor="w-summary">Text</Label>
        <Textarea id="w-summary" rows={12} value={props.text} onChange={(e) => props.onText(e.target.value)} placeholder={"Skriv sammanfattningen till kunden.\n\nTom rad = nytt stycke. Rader som börjar med \"- \" blir en lista."} />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={props.status} onValueChange={(v) => props.onStatus(v as "draft" | "published")}>
          <SelectTrigger className="w-full" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Utkast – bara byrån ser den</SelectItem>
            <SelectItem value="published">Publicerad – kunden ser den</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Utkast visas aldrig på delade länkar, i PDF:er eller i utskick.</p>
      </div>
    </div>
  );
}

/** Bild (laddas upp och förminskas i webbläsaren) eller YouTube-/Vimeo-video. */
function MediaEditor({ config, onChange }: { config: WidgetConfig; onChange: (p: Partial<WidgetConfig>) => void }) {
  const kind = config.mediaKind ?? "image";
  const [busy, setBusy] = useState(false);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return void toast.error("Välj en PNG-, JPEG-, WebP- eller GIF-bild.");
    setBusy(true);
    try {
      onChange({ mediaKind: "image", mediaUrl: await shrinkImage(file) });
    } catch {
      toast.error("Kunde inte läsa bilden.");
    } finally {
      setBusy(false);
    }
  };
  const video = kind === "video" && config.mediaUrl ? videoEmbed(config.mediaUrl) : null;
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Typ av media">
        {(["image", "video"] as const).map((k) => (
          <Button key={k} type="button" size="sm" variant="ghost" className={cn("flex-1", kind === k && "bg-card shadow-soft")} aria-pressed={kind === k} onClick={() => k !== kind && onChange({ mediaKind: k, mediaUrl: undefined })}>
            {k === "image" ? "Bild" : "Video"}
          </Button>
        ))}
      </div>
      {kind === "image" ? (
        <div className="space-y-1.5">
          <Label htmlFor="w-image">Bild</Label>
          <Input id="w-image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => onFile(e.target.files?.[0])} disabled={busy} />
          <p className="text-xs text-muted-foreground">Förminskas automatiskt till högst 1 600 pixel.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="w-video">Länk till video</Label>
          <Input id="w-video" value={config.mediaUrl ?? ""} onChange={(e) => onChange({ mediaKind: "video", mediaUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
          <p className={cn("text-xs", config.mediaUrl && !video ? "text-destructive" : "text-muted-foreground")}>
            {config.mediaUrl && !video ? "Bara YouTube- och Vimeo-länkar kan bäddas in." : "YouTube eller Vimeo. I PDF visas omslagsbilden med länk."}
          </p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="w-caption">Bildtext (valfri)</Label>
        <Input id="w-caption" value={config.caption ?? ""} maxLength={300} onChange={(e) => onChange({ caption: e.target.value })} />
      </div>
    </div>
  );
}

/** Förminskar en bild till högst 1600 px (JPEG, eller PNG om den har genomskinlighet). */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale) });
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";
  let url = canvas.toDataURL(type, 0.85);
  if (url.length > 2_000_000) url = canvas.toDataURL("image/jpeg", 0.7);
  if (url.length > 2_150_000) throw new Error("För stor bild");
  return url;
}
