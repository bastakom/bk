/**
 * Vilka metrics och dimensioner varje plattform erbjuder, sammanställt från
 * connector-registret. Skickas till buildern så att bara giltiga val visas.
 */
import "server-only";
import { METRICS, PLATFORM_IDS, requiredBaseMetrics, type DimensionId, type MetricId } from "@rp/core";
import { connectorsForPlatform } from "@rp/core/server";
import type { Catalog } from "./availability";

export type { Catalog } from "./availability";

export function buildCatalog(): Catalog {
  const out = {} as Catalog;
  for (const p of PLATFORM_IDS) {
    const base = new Set<MetricId>();
    const dims = new Set<DimensionId>();
    for (const c of connectorsForPlatform(p)) {
      c.availableMetrics().forEach((m) => base.add(m));
      // Periodvärden (t.ex. räckvidd) hämtas för hela perioden när en rapport behöver dem.
      c.periodMetrics?.().forEach((m) => base.add(m));
      c.availableDimensions().forEach((d) => dims.add(d));
    }
    // Beräknade metrics är tillgängliga när alla deras byggstenar finns.
    const derived = (Object.keys(METRICS) as MetricId[]).filter(
      (m) => METRICS[m].aggregation === "derived" && requiredBaseMetrics(m).every((b) => base.has(b)),
    );
    out[p] = { metrics: [...base, ...derived], dimensions: [...dims] };
  }
  return out;
}
