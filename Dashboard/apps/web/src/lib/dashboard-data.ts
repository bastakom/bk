/**
 * Laddar data för widgets: läser normaliserade fakta ur databasen och kör
 * query-motorn. Anropas aldrig mot plattformarnas API:er.
 */
import "server-only";
import { loadPeriodRows } from "./period-facts";
import {
  breakdown,
  convertFacts,
  dimensionText,
  metricText,
  type Lang,
  dataFilterSchema,
  describeFilter,
  matchesDataFilter,
  planFilters,
  CURRENCY_METRICS,
  CUSTOM_PREFIX,
  isCustomId,
  MetricRegistry,
  COMPARE_MODES,
  compareRange,
  DIMENSIONS,
  funnel,
  kpi,
  PLATFORMS,
  RANGE_PRESETS,
  resolvePreset,
  timeseries,
  todayInTimezone,
  WIDGET_META,
  widgetConfigSchema,
  type CompareMode,
  type CustomMetricDef,
  type DataFilter,
  type DimensionId,
  type FilterPlan,
  type FxTable,
  type MetricMeta,
  type DateRange,
  type FactRow,
  type MetricId,
  METRICS,
  type PlatformId,
  type RangePreset,
  type WidgetConfig,
  type WidgetResult,
  type WidgetType,
} from "@rp/core";
import { loadFxTable, type TenantTx } from "@rp/db";
import { getConnector } from "@rp/core/server";
import { metricAvailability } from "./availability";
import { mediaUrl } from "./media";
import { parseSourceFilters } from "./source-facts";
import { loadGoalProgress, type GoalProgress } from "./goals";
import { buildCatalog, type Catalog } from "./catalog";

export interface DashboardRange {
  preset: RangePreset;
  range: DateRange;
  compare: CompareMode;
  compareRange: DateRange | null;
}

export interface DashboardSettings {
  range?: { preset: RangePreset; start?: string; end?: string };
  compare?: CompareMode;
  /** Filter som gäller alla widgets på dashboarden (läggs till widgetarnas egna). */
  filters?: DataFilter[];
  /** Rapportens källor: används som standard för nya widgets (konto-id:n). */
  sources?: string[];
  /** Sidor (flikar). Saknas = en sida, "Översikt". */
  pages?: { id: string; name: string }[];
}

/** Dashboardens filter, tåligt mot gamla eller trasiga inställningar. */
export function dashboardFilters(settings: DashboardSettings | null | undefined): DataFilter[] {
  return (settings?.filters ?? []).flatMap((f) => {
    const r = dataFilterSchema.safeParse(f);
    return r.success ? [r.data] : [];
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** URL-parametrar vinner över dashboardens sparade standardperiod. */
export function resolveDashboardRange(sp: Record<string, string | string[] | undefined>, settings: DashboardSettings, timezone: string): DashboardRange {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const today = todayInTimezone(timezone);
  const presetParam = get("range") ?? settings.range?.preset ?? "last_30";
  const compareParam = get("compare") ?? settings.compare ?? "previous_period";
  const compare = (COMPARE_MODES.some((c) => c.id === compareParam) ? compareParam : "previous_period") as CompareMode;

  let preset: RangePreset = "last_30";
  let range: DateRange;
  const from = get("from") ?? settings.range?.start;
  const to = get("to") ?? settings.range?.end;
  if (presetParam === "custom" && from && to && DATE_RE.test(from) && DATE_RE.test(to) && from <= to) {
    preset = "custom";
    range = { start: from, end: to };
  } else {
    preset = (RANGE_PRESETS.some((p) => p.id === presetParam) ? presetParam : "last_30") as Exclude<RangePreset, "custom">;
    range = resolvePreset(preset as Exclude<RangePreset, "custom">, today);
  }
  return { preset, range, compare, compareRange: compareRange(range, compare, preset) };
}

export interface AccountInfo {
  id: string;
  name: string;
  platform: PlatformId;
  currency: string;
  /** Första datum som finns synkat (YYYY-MM-DD), null om aldrig synkat. */
  dataFrom: string | null;
  timezone: string;
  /** Kundens filter för källan (avgränsar kundens del av ett delat konto). */
  filters: DataFilter[];
}

/** Kundens valda källor (från Databaser) med kundens filter och hur långt bakåt data finns. */
export async function loadClientAccounts(tx: TenantTx, clientId: string): Promise<(AccountInfo & { status: string; lastSyncedAt: Date | null })[]> {
  const sources = await tx.clientSource.findMany({
    where: { clientId },
    orderBy: [{ account: { platform: "asc" } }, { account: { name: "asc" } }],
    select: { filters: true, account: { select: { id: true, name: true, platform: true, currency: true, timezone: true, status: true, lastSyncedAt: true } } },
  });
  const accounts = sources.map((s) => ({ ...s.account, filters: parseSourceFilters(s.filters) }));
  const coverage = await tx.syncRun.groupBy({
    by: ["accountId"],
    where: { accountId: { in: accounts.map((a) => a.id) }, status: "SUCCESS" },
    _min: { rangeStart: true },
  });
  const from = new Map(coverage.map((c) => [c.accountId, c._min.rangeStart?.toISOString().slice(0, 10) ?? null]));
  return accounts.map((a) => ({ ...a, platform: a.platform as PlatformId, dataFrom: from.get(a.id) ?? null }));
}

const fmtDay = { sv: new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) };
const prettyDate = (s: string, lang: Lang = "sv") => fmtDay[lang].format(new Date(`${s}T00:00:00Z`));

export interface AdItem {
  key: string;
  accountId: string;
  name: string;
  headline: string | null;
  text: string | null;
  /** Bild (signerad adress till den sparade bilden, annars plattformens länk). */
  thumbnailUrl: string | null;
  format: string | null;
  /** Signerad adress som ger en färsk uppspelningslänk (video eller förhandsvisning). */
  playUrl: string | null;
  permalink: string | null;
  values: Partial<Record<string, number | null>>;
}

export interface WidgetData {
  result: WidgetResult | null;
  ads?: AdItem[];
  /** Valuta för belopp (kundens rapportvaluta), null om omräkning inte gick. */
  currency: string | null;
  /** Metadata för widgetens metrics (inbyggda och egna formler). */
  meta: Record<string, MetricMeta>;
  notices: string[];
  /** Aktiva filter i klartext (visas som markering på widgeten). */
  filters?: string[];
  /** Mål och budget: kundens valda mål med utfall */
  goals?: GoalProgress[];
  /** Trendgraf: händelser i perioden */
  annotations?: AnnotationView[];
  /** Widgetens egen period (fast period), annars dashboardens. */
  range?: DateRange;
  /** Källorna bakom widgeten (namn), för sidfoten. */
  sources?: string[];
}

export interface WidgetInput {
  type: WidgetType;
  config: WidgetConfig;
  accountIds: string[];
}

/** Allt som behövs för att ladda data till en kunds widgets. Byggs en gång per dashboard. */
/** Vem datan laddas för: byrån (allt) eller kunden (inga interna händelser, inga utkast). */
export type Audience = "internal" | "client";

export interface AnnotationView {
  id: string;
  date: string;
  text: string;
  internal: boolean;
}

export interface DataContext {
  clientId: string;
  audience: Audience;
  /** Språk för namn och notiser (kundens språk när datan laddas för kunden). */
  lang: Lang;
  /** Kundens händelser i rapportens period (filtrerade efter audience) */
  annotations: AnnotationView[];
  accounts: AccountInfo[];
  catalog: Catalog;
  range: DashboardRange;
  clientCurrency: string;
  clientTimezone: string;
  registry: MetricRegistry;
  fx: FxTable;
  /** Dashboardens filter. */
  filters: DataFilter[];
}

export async function buildDataContext(
  tx: TenantTx,
  params: { clientId: string; clientCurrency: string; clientTimezone: string; range: DashboardRange; accounts?: AccountInfo[]; filters?: DataFilter[]; audience?: Audience; lang?: Lang },
): Promise<DataContext> {
  const accounts = params.accounts ?? (await loadClientAccounts(tx, params.clientId));
  const customs = await tx.customMetric.findMany({ orderBy: { name: "asc" } });
  const from = params.range.compareRange && params.range.compareRange.start < params.range.range.start ? params.range.compareRange.start : params.range.range.start;
  const audience = params.audience ?? "internal";
  const annotations = await tx.annotation.findMany({
    where: { clientId: params.clientId, date: { gte: new Date(params.range.range.start), lte: new Date(params.range.range.end) }, ...(audience === "client" ? { internal: false } : {}) },
    orderBy: { date: "asc" },
  });
  return {
    clientId: params.clientId,
    audience,
    lang: params.lang ?? "sv",
    annotations: annotations.map((a) => ({ id: a.id, date: a.date.toISOString().slice(0, 10), text: a.text, internal: a.internal })),
    accounts,
    catalog: buildCatalog(),
    range: params.range,
    clientCurrency: params.clientCurrency,
    clientTimezone: params.clientTimezone,
    registry: new MetricRegistry(customs.map(toCustomDef)),
    fx: await loadFxTable(tx, from, params.range.range.end),
    filters: params.filters ?? [],
  };
}

export function toCustomDef(c: { key: string; name: string; formula: string; format: string; higherIsBetter: boolean | null; description: string | null }): CustomMetricDef {
  return { id: `${CUSTOM_PREFIX}${c.key}`, label: c.name, formula: c.formula, format: c.format as CustomMetricDef["format"], higherIsBetter: c.higherIsBetter, description: c.description ?? undefined };
}

function toFacts(rows: { accountId: string; date: Date; dimensionValue: string; metrics: unknown }[], platformOf: (id: string) => PlatformId | undefined): FactRow[] {
  return rows.map((r) => ({
    accountId: r.accountId,
    platform: platformOf(r.accountId),
    date: r.date.toISOString().slice(0, 10),
    dimensionValue: r.dimensionValue,
    metrics: r.metrics as FactRow["metrics"],
  }));
}

/** Konverteringar räknas olika i GA4 och annonsplattformarna – summan kan dubbelräkna. */
const DOUBLE_COUNT: MetricId[] = ["conversions", "conversion_value"];

export async function loadWidgetData(tx: TenantTx, input: WidgetInput, ctx: DataContext): Promise<WidgetData> {
  const { type } = input;
  const reg = ctx.registry;
  const config = widgetConfigSchema.parse(input.config);
  const notices: string[] = [];
  // Namn på kundens språk (inbyggda metrics; byråns egna behåller sina namn).
  const L = (sv: string, en: string) => (ctx.lang === "en" ? en : sv);
  const tm = (m: string) => {
    const x = reg.meta(m);
    return { ...x, ...metricText(m, x, ctx.lang) };
  };
  const dimLabel = (d: DimensionId) => dimensionText(d, DIMENSIONS[d].label, ctx.lang);
  const day = (s: string) => prettyDate(s, ctx.lang);
  const meta = Object.fromEntries(config.metrics.map((m) => [m, tm(m)]));
  const empty = (extra: string[] = []): WidgetData => ({ result: null, currency: null, meta, notices: [...notices, ...extra] });
  if (type === "goal") {
    if (!config.goalIds.length) return empty([L("Välj vilka av kundens mål som ska visas.", "Select which goals to show.")]);
    const goals = await loadGoalProgress(tx, ctx, config.goalIds);
    return { result: null, currency: ctx.clientCurrency, meta, notices, goals };
  }
  if (!WIDGET_META[type].needsData) return empty();

  let accounts = ctx.accounts.filter((a) => input.accountIds.includes(a.id));
  if (accounts.length === 0) return empty([L("Välj minst en källa.", "Select at least one source.")]);

  const dimension =
    type === "ad_gallery"
      ? "ad"
      : type === "map"
        ? config.dimension === "region"
          ? "region"
          : "country"
        : type === "table" || type === "bar" || type === "donut"
          ? config.dimension
          : type === "metric_list" && config.listMode === "sources"
            ? "source"
            : undefined;
  if ((type === "table" || type === "bar" || type === "donut") && !dimension) return empty([L("Välj en dimension.", "Select a dimension.")]);

  // Källor som saknar dimensionen visas inte – och användaren får veta det.
  if (dimension && dimension !== "source") {
    const unsupported = accounts.filter((a) => !ctx.catalog[a.platform]?.dimensions.includes(dimension));
    if (unsupported.length) {
      const names = [...new Set(unsupported.map((a) => PLATFORMS[a.platform].label))].join(", ");
      notices.push(L(`${dimLabel(dimension)} finns inte för ${names} – den källan ingår inte här.`, `${dimLabel(dimension)} is not available for ${names} – that source is not included here.`));
      accounts = accounts.filter((a) => !unsupported.includes(a));
    }
    if (accounts.length === 0) return empty();
  }

  // Per konvertering finns bara konverteringar och konverteringsvärde (spend m.m. går inte att fördela).
  const perConversion = dimension === "conversion" || dimension === "campaign_conversion";
  if (perConversion) {
    const other = config.metrics.filter((m) => !reg.baseMetrics(m).every((b) => b === "conversions" || b === "conversion_value"));
    if (other.length) {
      const names = other.map((m) => tm(m).label).join(", ");
      notices.push(L(`${names} kan inte delas upp per konvertering och visas inte här.`, `${names} cannot be split by conversion and is not shown here.`));
    }
  }

  const platforms = [...new Set(accounts.map((a) => a.platform))];
  const metrics: string[] = [];
  for (const m of config.metrics) {
    if (perConversion && !reg.baseMetrics(m).every((b) => b === "conversions" || b === "conversion_value")) continue;
    const { ok, lacking } = metricAvailability(m, platforms, ctx.catalog, reg);
    if (!ok) {
      notices.push(L(`${tm(m).label} kan inte räknas ut med valda källor.`, `${tm(m).label} cannot be calculated from the selected sources.`));
      continue;
    }
    metrics.push(m);
    if (lacking.length && platforms.length > 1 && !isCustomId(m)) {
      const names = lacking.map((p) => PLATFORMS[p].label).join(", ");
      notices.push(L(`${tm(m).label} finns inte i ${names} – bara övriga källor bidrar.`, `${tm(m).label} is not available in ${names} – only the other sources contribute.`));
    }
  }
  if (metrics.length === 0) return empty([L("Välj minst en metric.", "Select at least one metric.")]);

  const usesDoubleCount = metrics.some((m) => reg.refs(m).some((r) => !r.platform && DOUBLE_COUNT.includes(r.metric)));
  if (usesDoubleCount && platforms.includes("ga4") && platforms.some((p) => p !== "ga4")) {
    notices.push(L("Konverteringar räknas olika i GA4 och annonsplattformarna – summan kan dubbelräkna samma köp.", "GA4 and the ad platforms count conversions differently – the total may count the same purchase twice."));
  }

  // Fast period: widgeten räknar på sin egen period (och jämförelse) i stället för dashboardens.
  const fixed = config.fixedRange;
  const today = todayInTimezone(ctx.clientTimezone);
  const range = fixed ? (fixed.preset === "custom" ? { start: fixed.start!, end: fixed.end! } : resolvePreset(fixed.preset, today)) : ctx.range.range;
  const prevRange = fixed ? compareRange(range, ctx.range.compare, fixed.preset) : ctx.range.compareRange;
  const fx = fixed ? await loadFxTable(tx, prevRange && prevRange.start < range.start ? prevRange.start : range.start, range.end) : ctx.fx;
  // Jämför aldrig mot en period där data saknas – det ger falska "+200 %".
  const dataFrom = accounts.reduce<string | null>((max, a) => (a.dataFrom && (!max || a.dataFrom > max) ? a.dataFrom : max), null);
  const prevCovered = !prevRange || (dataFrom !== null && dataFrom <= prevRange.start);
  if (config.showComparison && prevRange && !prevCovered && type !== "funnel" && type !== "ad_gallery") {
    notices.push(L(`Jämförelse saknas: data finns från ${dataFrom ? day(dataFrom) : "–"}.`, `No comparison: data is available from ${dataFrom ? day(dataFrom) : "–"}.`));
  }
  if (dataFrom && dataFrom > range.start) notices.push(L(`Data finns bara från ${day(dataFrom)}.`, `Data is only available from ${day(dataFrom)}.`));
  const wantPrev = config.showComparison && prevRange !== null && prevCovered;
  const minDate = wantPrev && prevRange!.start < range.start ? prevRange!.start : range.start;

  const byId = new Map(accounts.map((a) => [a.id, a]));

  // Filter: dashboardens + widgetens. Per konto avgörs vilka fakta som läses och vad som filtreras.
  const filters = [...ctx.filters, ...config.filters];
  const breakdownDim: DimensionId | undefined = type === "ad_gallery" ? "ad" : dimension && dimension !== "source" ? dimension : undefined;
  // Kundens filter på källan gäller alltid, utöver dashboardens och widgetens.
  const filtersFor = (a: AccountInfo) => [...filters, ...a.filters];
  const plans = new Map<string, FilterPlan>(
    accounts.map((a) => {
      const plan = planFilters(a.platform, breakdownDim, filtersFor(a), (d) => !!ctx.catalog[a.platform]?.dimensions.includes(d));
      // Per källa med YouTube separat: Google Ads läses per kanaltyp (om inget annat filter styr).
      const youTube = dimension === "source" && config.splitYouTube && a.platform === "google_ads" && plan.fetchDimension === "" && ctx.catalog.google_ads?.dimensions.includes("channel_type");
      return [a.id, youTube ? { ...plan, fetchDimension: "channel_type" as const } : plan];
    }),
  );
  // Annonsgalleriet: kampanjfilter tillämpas via annonsens kampanj (sparad med annonsen).
  const galleryCampaign = (accountId: string) =>
    type === "ad_gallery" ? plans.get(accountId)!.skipped.filter((s) => s.reason === "other_dimension" && s.filter.dimension === "campaign").map((s) => s.filter) : [];
  notices.push(...filterNotices(accounts, plans, breakdownDim, type === "ad_gallery", ctx.lang));
  const activeFilters = [
    ...new Set(
      accounts.flatMap((a) =>
        filtersFor(a)
          .filter((f) => plans.get(a.id)!.apply.includes(f) || galleryCampaign(a.id).includes(f))
          .map((f) => (a.filters.includes(f) ? `${a.name}: ${describeFilter({ ...f, platform: undefined }, undefined, ctx.lang)}` : describeFilter(f, (p) => PLATFORMS[p].label, ctx.lang))),
      ),
    ),
  ];

  const groups = new Map<string, string[]>();
  for (const a of accounts) {
    const d = plans.get(a.id)!.fetchDimension;
    groups.set(d, [...(groups.get(d) ?? []), a.id]);
  }
  const fetched = toFacts(
    await tx.metricFact.findMany({
      where: {
        OR: [...groups].map(([d, ids]) => ({ accountId: { in: ids }, dimension: d })),
        date: { gte: new Date(minDate), lte: new Date(range.end) },
      },
      select: { accountId: true, date: true, dimensionValue: true, metrics: true },
    }),
    (id) => byId.get(id)?.platform,
  );
  const raw = fetched.flatMap((f) => {
    const plan = plans.get(f.accountId)!;
    if (!plan.apply.every((flt) => matchesDataFilter(f.dimensionValue, flt, plan.fetchDimension))) return [];
    return [plan.collapse ? { ...f, dimensionValue: "" } : f];
  });

  // Valuta: räkna om belopp per dag till kundens rapportvaluta.
  const foreign = [...new Set(accounts.map((a) => a.currency).filter((c) => c !== ctx.clientCurrency))];
  const { rows: converted, missing } = convertFacts(raw, (id) => byId.get(id)!.currency, ctx.clientCurrency, fx);
  const hasMoney = metrics.some((m) => reg.meta(m).format === "currency" || reg.baseMetrics(m).some((b) => CURRENCY_METRICS.includes(b)));
  if (hasMoney && foreign.length && !missing.length)
    notices.push(L(`Belopp från ${foreign.join(", ")} är omräknade till ${ctx.clientCurrency} med ECB:s dagskurs.`, `Amounts in ${foreign.join(", ")} are converted to ${ctx.clientCurrency} at the ECB daily rate.`));
  if (hasMoney && missing.length) notices.push(L(`Valutakurs saknas för ${missing.join(", ")} – beloppen visas inte omräknade.`, `Exchange rate missing for ${missing.join(", ")} – amounts are not converted.`));
  const currency = missing.length ? null : ctx.clientCurrency;

  // Pseudodimensionen "Källa": dagstotaler grupperade per plattform.
  const sourceLabel = (f: FactRow) => (f.platform === "google_ads" && f.dimensionValue === "YouTube" ? "YouTube" : f.platform ? PLATFORMS[f.platform].label : "Okänd");
  const rows = dimension === "source" ? converted.map((f) => ({ ...f, dimensionValue: sourceLabel(f) })) : converted;
  const inRange = (r: DateRange) => (f: FactRow) => f.date >= r.start && f.date <= r.end;
  let current = rows.filter(inRange(range));
  let previous = wantPrev ? rows.filter(inRange(prevRange!)) : null;

  // Periodvärden (räckvidd m.fl. = unika personer) summeras aldrig per dag: de hämtas för hela perioden.
  const periodBase = [...new Set(metrics.flatMap((m) => reg.baseMetrics(m)))].filter((b) => METRICS[b]?.aggregation === "period");
  if (periodBase.length && type === "timeseries") {
    notices.push(L("Räckvidd och frekvens räknas för hela perioden och visas i KPI-kort och tabeller, inte per dag.", "Reach and frequency are counted for the whole period and shown in KPI cards and tables, not per day."));
  } else if (periodBase.length && type !== "ad_gallery" && !perConversion) {
    const periodDim = type === "table" || type === "bar" || type === "donut" || type === "map" ? (dimension === "source" ? undefined : dimension) : undefined;
    const capable = accounts.filter((a) => periodBase.some((b) => ctx.catalog[a.platform]?.metrics.includes(b)));
    const load = (r: DateRange) => loadPeriodRows(tx, { accounts: capable.map((a) => ({ id: a.id, platform: a.platform, filters: filtersFor(a) })), metrics: periodBase, dimension: periodDim, range: r, today });
    const strip = (fs: FactRow[]) => fs.map((f) => ({ ...f, metrics: Object.fromEntries(Object.entries(f.metrics).filter(([k]) => !periodBase.includes(k as MetricId))) }));
    const label = (fs: FactRow[]) => (dimension === "source" ? fs.map((f) => ({ ...f, dimensionValue: sourceLabel(f) })) : fs);
    const cur = await load(range);
    current = [...strip(current), ...label(cur.rows)];
    if (previous) previous = [...strip(previous), ...label((await load(prevRange!)).rows)];
    const skipped = [...new Set(cur.skipped.map((x) => byId.get(x.accountId)?.name ?? x.accountId))];
    if (cur.skipped.some((x) => x.reason === "filter"))
      notices.push(L("Räckvidd kan bara filtreras på kampanj, annonsgrupp och annons – källor med andra filter saknar räckvidd här.", "Reach can only be filtered by campaign, ad set and ad – sources with other filters have no reach here."));
    if (cur.skipped.some((x) => x.reason === "error")) notices.push(L(`Räckvidd kunde inte hämtas för ${skipped.join(", ")}. Försök igen senare.`, `Reach could not be loaded for ${skipped.join(", ")}. Try again later.`));
  }
  const done = (result: WidgetResult, ads?: AdItem[]): WidgetData => ({
    result,
    ads,
    currency,
    meta,
    notices,
    filters: activeFilters.length ? activeFilters : undefined,
    range: fixed || config.showFooter ? range : undefined,
    sources: config.showFooter ? [...new Set(accounts.map((a) => `${PLATFORMS[a.platform].label} · ${a.name}`))] : undefined,
  });

  switch (type) {
    case "kpi":
      return done(kpi(metrics, current, previous, range, reg));
    case "metric_list":
      // Ett nyckeltal per källa (rader = plattformar) eller flera nyckeltal (som KPI).
      return config.listMode === "sources"
        ? done(breakdown("source", metrics.slice(0, 1), current, previous, { ...config, limit: 20, sort: { by: metrics[0]!, dir: "desc" } }, reg))
        : done(kpi(metrics, current, previous, range, reg));
    case "timeseries":
      return { ...done(timeseries(metrics, current, previous, range, wantPrev ? prevRange : null, config.granularity, reg)), annotations: ctx.annotations.length ? ctx.annotations : undefined };
    case "funnel":
      return done(funnel(metrics, current, reg));
    case "map":
      // Alla länder/regioner (ingen "Övrigt"), sorterade på metricen.
      return done(breakdown(dimension!, metrics.slice(0, 1), current, previous, { ...config, limit: 250, sort: { by: metrics[0]!, dir: "desc" } }, reg));
    case "table":
    case "bar":
    case "donut": {
      const b = breakdown(dimension!, metrics, current, previous, { ...config, limit: type === "donut" ? Math.min(config.limit, 7) : config.limit, groupOther: type === "donut" }, reg);
      return done(ctx.lang === "en" ? { ...b, rows: b.rows.map((r) => (r.isOther ? { ...r, label: "Other" } : r)) } : b);
    }
    case "ad_gallery": {
      // Samma annons-id kan finnas i flera konton: gruppera på konto + annons.
      const creatives = await tx.creative.findMany({
        where: { accountId: { in: accounts.map((a) => a.id) } },
        // Bilddatan hämtas inte här; den serveras via /api/media.
        select: { id: true, workspaceId: true, accountId: true, externalId: true, name: true, headline: true, text: true, thumbnailUrl: true, format: true, permalink: true, imageType: true, campaign: true, account: { select: { connectorId: true } } },
      });
      const byKey = new Map(creatives.map((c) => [`${c.accountId}::${c.externalId}`, c]));
      const keyed = (fs: FactRow[]) =>
        fs.flatMap((f) => {
          const key = `${f.accountId}::${f.dimensionValue}`;
          const byCampaign = galleryCampaign(f.accountId);
          if (byCampaign.length && !byCampaign.every((flt) => matchesDataFilter(byKey.get(key)?.campaign ?? "", flt))) return [];
          return [{ ...f, dimensionValue: key }];
        });
      const res = breakdown("ad", metrics, keyed(current), null, { ...config, filters: [] }, reg);
      const ads = res.rows.map((r): AdItem => {
        const c = byKey.get(r.label);
        const [accountId] = r.label.split("::");
        return {
          key: r.label,
          accountId: accountId!,
          name: c?.name ?? r.label.split("::")[1]!,
          headline: c?.headline ?? null,
          text: c?.text ?? null,
          thumbnailUrl: c ? (c.imageType ? mediaUrl(c.workspaceId, c.id, "image") : c.thumbnailUrl) : null,
          format: c?.format ?? null,
          // Video spelas upp; annonser utan egen bild visas med plattformens förhandsvisning.
          playUrl: c && (c.format === "video" || !c.imageType) && getConnector(c.account.connectorId).resolveMedia ? mediaUrl(c.workspaceId, c.id, "play") : null,
          permalink: c?.permalink ?? null,
          values: r.values,
        };
      });
      return done(res, ads);
    }
    default:
      return empty();
  }
}

/** Förklaringar när ett filter inte kan användas för någon av widgetens källor. */
function filterNotices(accounts: AccountInfo[], plans: Map<string, FilterPlan>, breakdownDim: DimensionId | undefined, gallery: boolean, lang: Lang = "sv"): string[] {
  const L = (sv: string, en: string) => (lang === "en" ? en : sv);
  const out = new Set<string>();
  for (const a of accounts) {
    for (const { filter, reason } of plans.get(a.id)!.skipped) {
      const field = dimensionText(filter.dimension, DIMENSIONS[filter.dimension]?.label ?? filter.dimension, lang);
      const platform = PLATFORMS[a.platform].label;
      if (reason === "unsupported") out.add(L(`Filtret på ${field} gäller inte ${platform} (fältet finns inte där).`, `The ${field} filter does not apply to ${platform} (the field is not available there).`));
      else if (gallery && filter.dimension === "campaign") continue;
      else if (breakdownDim)
        out.add(
          L(
            `Filtret på ${field} kan inte kombineras med uppdelning per ${DIMENSIONS[breakdownDim].label} för ${platform} och används inte här.`,
            `The ${field} filter cannot be combined with a breakdown by ${dimensionText(breakdownDim, DIMENSIONS[breakdownDim].label, "en")} for ${platform} and is not applied here.`,
          ),
        );
      else out.add(L(`${platform}: bara ett filterfält per kanal kan användas samtidigt – filtret på ${field} används inte här.`, `${platform}: only one filter field per channel can be used at a time – the ${field} filter is not applied here.`));
    }
  }
  return [...out];
}
