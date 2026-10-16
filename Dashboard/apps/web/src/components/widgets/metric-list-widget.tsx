"use client";

import { computeDelta, formatMetric, type PlatformId } from "@rp/core";
import { DeltaBadge } from "@/components/delta-badge";
import { useLang } from "@/components/lang-context";
import { MetricIcon } from "@/components/metric-icons";
import { PlatformIcon, YouTubeIcon } from "@/components/platform-icon";
import { cn } from "@/lib/utils";
import { metaOf } from "./meta";
import type { WidgetViewProps } from "./types";

interface Row {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: React.ReactNode;
  previous: string | null;
}

/**
 * Nyckeltalslista: ett nyckeltal per källa (t.ex. Spend för Meta och Google Ads) eller
 * flera nyckeltal med ikoner (t.ex. reaktioner, kommentarer, delningar, sparade).
 * Varje rad visar värde, förändring och föregående periods värde inom parentes.
 */
export function MetricListWidget({ data, config }: WidgetViewProps) {
  const lang = useLang();
  const currency = data?.currency ?? undefined;
  const res = data?.result;
  const showIcons = config.icon !== "none";
  let rows: Row[] = [];

  if (res?.kind === "breakdown") {
    const metric = config.metrics[0]!;
    const meta = metaOf(data, metric);
    rows = res.rows.map((r) => {
      const v = r.values[metric] ?? null;
      const prev = r.previous ? (r.previous[metric] ?? null) : null;
      const platform = r.platforms?.[0] as PlatformId | undefined;
      return {
        key: r.label,
        icon: r.label === "YouTube" ? <YouTubeIcon size="sm" className="rounded-full" /> : platform ? <PlatformIcon platform={platform} size="sm" className="rounded-full" /> : null,
        label: r.label,
        value: formatMetric(meta, v, currency, lang),
        delta: r.previous ? <DeltaBadge metric={meta} delta={computeDelta(meta, v, prev)} size="sm" /> : null,
        previous: r.previous && prev !== null ? formatMetric(meta, prev, currency, lang) : null,
      };
    });
  } else if (res?.kind === "kpi") {
    rows = res.items.map((item) => {
      const meta = metaOf(data, item.metric);
      return {
        key: item.metric,
        icon: showIcons ? <MetricIcon metric={item.metric} className="size-6" /> : null,
        label: meta.label,
        value: formatMetric(meta, item.value, currency, lang),
        delta: item.delta.kind !== "none" ? <DeltaBadge metric={meta} delta={item.delta} size="sm" /> : null,
        previous: item.previous !== null ? formatMetric(meta, item.previous, currency, lang) : null,
      };
    });
  }
  if (!rows.length) return null;

  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.key} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm", i % 2 === 1 && "bg-muted/50")}>
          {r.icon}
          <span className="min-w-0 flex-1 truncate font-medium text-heading">{r.label}</span>
          <span className="tabular font-semibold whitespace-nowrap text-heading">{r.value}</span>
          {r.delta}
          {r.previous && <span className="tabular hidden text-xs whitespace-nowrap text-muted-foreground @[18rem]:inline">({r.previous})</span>}
        </li>
      ))}
    </ul>
  );
}
