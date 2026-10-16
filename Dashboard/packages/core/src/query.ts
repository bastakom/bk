/**
 * Query-motorn: tar normaliserade fakta och en widget-specifikation och
 * räknar fram det widgeten visar. Ren funktion utan databas, så den är lätt
 * att testa.
 *
 * Merge-regler:
 *  - Additiva metrics summeras över dagar och källor.
 *  - Kvoter och egna formler räknas alltid om från summorna (per rad/bucket),
 *    aldrig som medelvärde av medelvärden.
 *  - Belopp räknas om till rapportvalutan per dag innan de summeras (convertFacts).
 *  - Varje summa sparas även per källa ("spend@meta_ads") så att källfördelning
 *    och källbegränsade formler (sessions[ga4]) fungerar.
 */
import { computeDelta, METRICS, type Delta, type MetricSums } from "./metrics";
import { builtinRegistry, scopedKey, scopeSums, type MetricRegistry } from "./registry";
import { autoGranularity, bucketKey, type Granularity } from "./ranges";
import { eachDay } from "./dates";
import type { FxTable } from "./fx";
import type { DateRange, DimensionId, MetricId, PlatformId } from "./types";
import { filterApplies, matchesDataFilter } from "./filters";
import type { WidgetConfig } from "./widgets";

export interface FactRow {
  accountId: string;
  /** Källans plattform – används för källfördelning och källbegränsade formler. */
  platform?: PlatformId;
  /** YYYY-MM-DD */
  date: string;
  /** "" för dagstotaler */
  dimensionValue: string;
  metrics: MetricSums;
  /** Värde för hela perioden (t.ex. räckvidd), inte en dag: räknas i summor men aldrig per dag. */
  period?: boolean;
}

export type MetricValues = Partial<Record<string, number | null>>;

export function sumRows(rows: Iterable<FactRow>, into: MetricSums = {}): MetricSums {
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.metrics)) {
      if (v === undefined) continue;
      into[k] = (into[k] ?? 0) + v;
      if (r.platform) {
        const sk = scopedKey(k, r.platform);
        into[sk] = (into[sk] ?? 0) + v;
      }
    }
  }
  return into;
}

function mergeSums(into: MetricSums, from: MetricSums) {
  for (const [k, v] of Object.entries(from)) if (v !== undefined) into[k] = (into[k] ?? 0) + v;
  return into;
}

export function valuesFor(metrics: string[], sums: MetricSums, reg: MetricRegistry = builtinRegistry): MetricValues {
  const out: MetricValues = {};
  for (const m of metrics) out[m] = reg.compute(m, sums);
  return out;
}

/** Vilka additiva metrics som behöver hämtas för att räkna ut de valda. */
export function baseMetricsFor(metrics: string[], reg: MetricRegistry = builtinRegistry): MetricId[] {
  return [...new Set(metrics.flatMap((m) => reg.baseMetrics(m)))];
}

/** Belopp (format "currency") som ska räknas om mellan valutor. */
export const CURRENCY_METRICS = (Object.keys(METRICS) as MetricId[]).filter((m) => METRICS[m].format === "currency" && METRICS[m].aggregation !== "derived");

/**
 * Räknar om beloppen i varje faktarad till `target` med dagens kurs.
 * Originalet lämnas orört; nya rader returneras.
 */
export function convertFacts(rows: FactRow[], currencyOf: (accountId: string) => string, target: string, fx: FxTable): { rows: FactRow[]; missing: string[] } {
  const missing = new Set<string>();
  const out = rows.map((r) => {
    const from = currencyOf(r.accountId);
    if (from === target) return r;
    const rate = fx.rate(from, target, r.date);
    if (rate === null) {
      missing.add(from);
      return r;
    }
    const metrics = { ...r.metrics };
    for (const m of CURRENCY_METRICS) {
      const v = metrics[m];
      if (v !== undefined) metrics[m] = v * rate;
    }
    return { ...r, metrics };
  });
  return { rows: out, missing: [...missing] };
}

// ─── Resultattyper (serialiserbara, skickas till klienten) ─────────────────────

export interface SourceShare {
  platform: PlatformId;
  value: number | null;
  /** Andel av totalen (endast additiva metrics). */
  share: number | null;
}

export interface KpiResult {
  kind: "kpi";
  items: {
    metric: string;
    value: number | null;
    previous: number | null;
    delta: Delta;
    spark: (number | null)[];
    approx: boolean;
    /** Fördelning per källa när flera källor bidrar. */
    sources?: SourceShare[];
  }[];
}

export interface TimeseriesResult {
  kind: "timeseries";
  granularity: Granularity;
  /** Bucketens startdatum, i ordning. */
  keys: string[];
  /** Jämförelseperiodens bucket-nycklar, index-justerade mot `keys`. */
  previousKeys: string[] | null;
  /** Källorna i ordning (för färg och legend). */
  platforms: PlatformId[];
  series: {
    metric: string;
    values: (number | null)[];
    previous: (number | null)[] | null;
    total: number | null;
    previousTotal: number | null;
    /** Samma serie uppdelad per källa (när flera källor bidrar). */
    bySource?: Partial<Record<PlatformId, (number | null)[]>>;
  }[];
}

export interface BreakdownRow {
  label: string;
  values: MetricValues;
  previous: MetricValues | null;
  /** Rad som slagits ihop av resten ("Övrigt"). */
  isOther?: boolean;
  /** Källor som bidrar till raden. */
  platforms?: PlatformId[];
}

export interface BreakdownResult {
  kind: "breakdown";
  dimension: DimensionId;
  rows: BreakdownRow[];
  total: MetricValues;
  /** Antal värden totalt före limit. */
  distinctCount: number;
}

export interface FunnelResult {
  kind: "funnel";
  steps: { metric: string; value: number; ofFirst: number | null; ofPrevious: number | null }[];
}

export type WidgetResult = KpiResult | TimeseriesResult | BreakdownResult | FunnelResult;

const platformsIn = (rows: FactRow[]) => [...new Set(rows.map((r) => r.platform).filter((p): p is PlatformId => !!p))];

function isAdditive(reg: MetricRegistry, metric: string) {
  const a = reg.meta(metric).aggregation;
  return a === "sum" || a === "sum_approx";
}

/** I en tidsserie betyder en tom bucket "ingen aktivitet" (0) för additiva metrics, men ett glapp för kvoter. */
function bucketValue(reg: MetricRegistry, metric: string, sums: MetricSums): number | null {
  const v = reg.compute(metric, sums);
  return v === null && isAdditive(reg, metric) ? 0 : v;
}

function bucketize(rows: FactRow[], range: DateRange, g: Granularity) {
  const keys = [...new Set(eachDay(range).map((d) => bucketKey(d, g)))];
  const map = new Map(keys.map((k) => [k, {} as MetricSums]));
  for (const r of rows) {
    // Periodvärden (t.ex. räckvidd) gäller hela perioden och hör inte till någon dag.
    if (r.period) continue;
    const s = map.get(bucketKey(r.date, g));
    if (s) sumRows([r], s);
  }
  return keys.map((key) => ({ key, sums: map.get(key)! }));
}

// ─── Beräkningar ───────────────────────────────────────────────────────────────

export function kpi(metrics: string[], current: FactRow[], previous: FactRow[] | null, range: DateRange, reg: MetricRegistry = builtinRegistry): KpiResult {
  const cur = sumRows(current);
  const prev = previous ? sumRows(previous) : null;
  const g = autoGranularity(range);
  const buckets = bucketize(current, range, g);
  const platforms = platformsIn(current);
  return {
    kind: "kpi",
    items: metrics.map((metric) => {
      const value = reg.compute(metric, cur);
      // Saknas jämförelsedata helt (inga rader) är det "–", inte "Ny".
      const prevValue = prev && previous!.length > 0 ? reg.compute(metric, prev) : null;
      const additive = isAdditive(reg, metric);
      return {
        metric,
        value,
        previous: prevValue,
        delta: computeDelta(reg.meta(metric), value, prevValue),
        spark: buckets.map((b) => bucketValue(reg, metric, b.sums)),
        approx: reg.meta(metric).aggregation === "sum_approx",
        // Källfördelning är meningsfull för inbyggda metrics, inte för egna formler över flera källor.
        sources:
          platforms.length > 1 && reg.meta(metric).aggregation !== "custom"
            ? platforms.map((p) => {
                const v = reg.compute(metric, scopeSums(cur, p));
                return { platform: p, value: v, share: additive && value ? (v ?? 0) / value : null };
              })
            : undefined,
      };
    }),
  };
}

export function timeseries(
  metrics: string[],
  current: FactRow[],
  previous: FactRow[] | null,
  range: DateRange,
  prevRange: DateRange | null,
  granularity: Granularity | "auto" = "auto",
  reg: MetricRegistry = builtinRegistry,
): TimeseriesResult {
  const g = granularity === "auto" ? autoGranularity(range) : granularity;
  const cur = bucketize(current, range, g);
  const prev = previous && prevRange ? bucketize(previous, prevRange, g) : null;
  const curTotal = sumRows(current);
  const prevTotal = previous ? sumRows(previous) : null;
  const platforms = platformsIn(current);
  return {
    kind: "timeseries",
    granularity: g,
    keys: cur.map((b) => b.key),
    previousKeys: prev ? cur.map((_, i) => prev[i]?.key ?? "") : null,
    platforms,
    series: metrics.map((metric) => ({
      metric,
      values: cur.map((b) => bucketValue(reg, metric, b.sums)),
      previous: prev ? cur.map((_, i) => (prev[i] ? bucketValue(reg, metric, prev[i]!.sums) : null)) : null,
      total: reg.compute(metric, curTotal),
      previousTotal: prevTotal && previous!.length > 0 ? reg.compute(metric, prevTotal) : null,
      bySource:
        platforms.length > 1 && reg.meta(metric).aggregation !== "custom"
          ? Object.fromEntries(platforms.map((p) => [p, cur.map((b) => bucketValue(reg, metric, scopeSums(b.sums, p)))]))
          : undefined,
    })),
  };
}

export function breakdown(
  dimension: DimensionId,
  metrics: string[],
  current: FactRow[],
  previous: FactRow[] | null,
  opts: Pick<WidgetConfig, "sort" | "limit" | "filters"> & { groupOther?: boolean },
  reg: MetricRegistry = builtinRegistry,
): BreakdownResult {
  // Filter på uppdelningens dimension, för radens kanal (eller alla kanaler).
  const filters = opts.filters.filter((f) => filterApplies(f.dimension, dimension));
  const keep = (r: FactRow) => filters.every((f) => (f.platform && f.platform !== r.platform) || matchesDataFilter(r.dimensionValue, f, dimension));
  const group = (rows: FactRow[]) => {
    const m = new Map<string, { sums: MetricSums; platforms: Set<PlatformId> }>();
    for (const r of rows) {
      if (!keep(r)) continue;
      let g = m.get(r.dimensionValue);
      if (!g) m.set(r.dimensionValue, (g = { sums: {}, platforms: new Set() }));
      sumRows([r], g.sums);
      if (r.platform) g.platforms.add(r.platform);
    }
    return m;
  };
  const cur = group(current);
  const prev = previous ? group(previous) : null;
  const hasPrev = !!previous && previous.length > 0;

  const sortBy = opts.sort?.by ?? metrics[0];
  const dir = opts.sort?.dir ?? "desc";
  const entries = [...cur.entries()].map(([label, g]) => ({ label, sums: g.sums, platforms: [...g.platforms], values: valuesFor(metrics, g.sums, reg) }));
  entries.sort((a, b) => {
    if (sortBy === "label" || !sortBy) return a.label.localeCompare(b.label, "sv") * (dir === "asc" ? 1 : -1);
    const av = reg.compute(sortBy, a.sums) ?? -Infinity;
    const bv = reg.compute(sortBy, b.sums) ?? -Infinity;
    return dir === "asc" ? av - bv : bv - av;
  });

  const top = entries.slice(0, opts.limit);
  const restEntries = entries.slice(opts.limit);
  const rows: BreakdownRow[] = top.map((e) => ({
    label: e.label,
    values: e.values,
    previous: hasPrev ? valuesFor(metrics, prev!.get(e.label)?.sums ?? {}, reg) : null,
    platforms: e.platforms.length ? e.platforms : undefined,
  }));
  if (opts.groupOther && restEntries.length > 0) {
    const restSums: MetricSums = {};
    for (const e of restEntries) mergeSums(restSums, e.sums);
    rows.push({ label: "Övrigt", values: valuesFor(metrics, restSums, reg), previous: null, isOther: true });
  }
  const totalSums: MetricSums = {};
  for (const e of entries) mergeSums(totalSums, e.sums);

  return { kind: "breakdown", dimension, rows, total: valuesFor(metrics, totalSums, reg), distinctCount: entries.length };
}

export function funnel(metrics: string[], current: FactRow[], reg: MetricRegistry = builtinRegistry): FunnelResult {
  const sums = sumRows(current);
  const values = metrics.map((m) => reg.compute(m, sums) ?? 0);
  const first = values[0] ?? 0;
  return {
    kind: "funnel",
    steps: metrics.map((metric, i) => ({
      metric,
      value: values[i]!,
      ofFirst: first > 0 ? values[i]! / first : null,
      ofPrevious: i === 0 ? null : values[i - 1]! > 0 ? values[i]! / values[i - 1]! : null,
    })),
  };
}
