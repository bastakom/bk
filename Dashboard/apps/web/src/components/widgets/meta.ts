import { METRICS, type MetricId, type MetricMeta } from "@rp/core";
import type { WidgetData } from "@/lib/dashboard-data";

/** Metadata för en metric i widgeten (egna formler kommer från servern). */
export function metaOf(data: WidgetData | null | undefined, id: string): MetricMeta {
  const fromData = data?.meta?.[id];
  if (fromData) return fromData;
  const builtin = METRICS[id as MetricId];
  return builtin ? { ...builtin, id } : { id, label: id, format: "number", aggregation: "sum", higherIsBetter: null };
}

export const shortLabel = (m: MetricMeta) => m.shortLabel ?? m.label;
