/**
 * Vilka metrics som kan räknas ut med valda källor. Delas av server
 * (dataladdning) och klient (widget-editorn).
 */
import type { DimensionId, MetricId, MetricRegistry, PlatformId } from "@rp/core";

export type Catalog = Record<PlatformId, { metrics: MetricId[]; dimensions: DimensionId[] }>;

/** `ok` = går att räkna ut; `lacking` = valda plattformar som inte bidrar. */
export function metricAvailability(metric: string, platforms: PlatformId[], catalog: Catalog, reg: MetricRegistry) {
  const offers = (p: PlatformId, m: MetricId) => reg.baseMetrics(m).every((b) => catalog[p]?.metrics.includes(b));
  const refs = reg.refs(metric);
  const ok = refs.every((r) => (r.platform ? platforms.includes(r.platform) && offers(r.platform, r.metric) : platforms.some((p) => offers(p, r.metric))));
  const lacking = platforms.filter((p) => !refs.some((r) => (r.platform ? r.platform === p : offers(p, r.metric))));
  return { ok, lacking };
}
