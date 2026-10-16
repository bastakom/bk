"use client";

import { useLang } from "@/components/lang-context";
import { formatMetric } from "@rp/core";
import { DeltaBadge, PreviousValue } from "@/components/delta-badge";
import { MetricIcon } from "@/components/metric-icons";
import { chartColors, platformColor, useChartMode } from "./chart-theme";
import { metaOf } from "./meta";
import { SourceSplit } from "./source-split";
import type { WidgetViewProps } from "./types";

export function KpiWidget({ data, platforms, mode: forced, emphasis, config, displayTitle }: WidgetViewProps) {
  const lang = useLang();
  const mode = useChartMode(forced);
  const res = data?.result?.kind === "kpi" ? data.result : undefined;
  if (!res) return null;
  const color = emphasis ? "currentColor" : platformColor(platforms.length === 1 ? platforms[0] : undefined, mode, chartColors(mode).categorical[0]!);
  const currency = data?.currency ?? undefined;

  if (res.items.length === 1 && config.kpiStyle === "icon") {
    // Kompakt: illustrerad ikon, rubrik, värde och förändring (föregående värde inom parentes).
    const item = res.items[0]!;
    const meta = metaOf(data, item.metric);
    return (
      <div className="flex h-full items-center gap-4">
        {config.icon !== "none" && <MetricIcon metric={item.metric} icon={config.icon} className="size-14" />}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-muted-foreground">{displayTitle ?? meta.label}</p>
          {config.description && <p className="truncate text-xs text-muted-foreground">{config.description}</p>}
          <p className="tabular mt-0.5 text-[28px] leading-tight font-extrabold tracking-[-0.03em] whitespace-nowrap text-heading">{formatMetric(meta, item.value, currency, lang)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <DeltaBadge metric={meta} delta={item.delta} size="sm" />
            <PreviousValue metric={meta} delta={item.delta} currency={currency} />
          </div>
        </div>
      </div>
    );
  }

  if (res.items.length === 1) {
    const item = res.items[0]!;
    const meta = metaOf(data, item.metric);
    return (
      <div className="flex h-full flex-col">
        <p className="tabular text-[26px] leading-tight font-extrabold tracking-[-0.035em] whitespace-nowrap text-heading @[13rem]:text-[32px]">
          {formatMetric(meta, item.value, currency, lang)}
          {item.approx && (
            <sup className="ml-0.5 text-xs font-normal text-muted-foreground" title={meta.description}>
              *
            </sup>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <DeltaBadge metric={meta} delta={item.delta} />
          <PreviousValue metric={meta} delta={item.delta} currency={currency} />
        </div>
        {item.sources ? (
          <SourceSplit sources={item.sources} meta={meta} currency={currency} mode={mode} />
        ) : (
          <Sparkline values={item.spark} color={color} className="mt-auto pt-2" />
        )}
      </div>
    );
  }

  return (
    <dl className="grid h-full content-start gap-x-6 gap-y-1 divide-y sm:grid-cols-1">
      {res.items.map((item) => {
        const meta = metaOf(data, item.metric);
        return (
          <div key={item.metric} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-muted-foreground">{meta.label}</dt>
            <dd className="flex items-center gap-2">
              <span className="tabular font-semibold">{formatMetric(meta, item.value, currency, lang)}</span>
              <DeltaBadge metric={meta} delta={item.delta} size="sm" />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Sparkline({ values, color, className }: { values: (number | null)[]; color: string; className?: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return null;
  const ys = pts.map((p) => p[1]);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const W = 100;
  const H = 28;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => (max === min ? H / 2 : H - 2 - ((v - min) / (max - min)) * (H - 4));
  const line = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1]![0])} ${H} L${x(pts[0]![0])} ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ height: 36, width: "100%" }} aria-hidden>
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
