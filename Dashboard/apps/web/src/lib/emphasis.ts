import type { WidgetConfig, WidgetLayout, WidgetType } from "@rp/core";

interface W {
  id: string;
  type: WidgetType;
  config: WidgetConfig;
  layout: WidgetLayout;
}

/**
 * Vilka KPI-kort som visas framhävda (mörkt block i kundens färg).
 * Valda kort (emphasis: true) gäller; annars framhävs första KPI-kortet med ett nyckeltal, om det inte valts bort.
 */
export function emphasizedIds(widgets: W[]): Set<string> {
  const kpis = widgets.filter((w) => w.type === "kpi" && w.config.metrics.length === 1);
  const chosen = kpis.filter((w) => w.config.emphasis === true);
  if (chosen.length) return new Set(chosen.map((w) => w.id));
  const first = [...kpis].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x).find((w) => w.config.emphasis !== false);
  return new Set(first ? [first.id] : []);
}
