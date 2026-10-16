"use client";

import { useLang } from "@/components/lang-context";
import { computeDelta, DIMENSIONS, dimensionText, formatCompact, formatMetric, numberLocale, type PlatformId } from "@rp/core";
import { useMemo } from "react";
import { DeltaBadge } from "@/components/delta-badge";
import { chartColors, platformColor, useChartMode } from "./chart-theme";
import { EChart, type EChartsOption } from "./echart";
import { metaOf } from "./meta";
import type { WidgetViewProps } from "./types";

/**
 * Grupperade staplar: ett värde per dimension (kampanj, källa …) med vald period och
 * jämförelseperioden bredvid. Liggande staplar så att långa namn får plats; största överst.
 */
export function BarWidget({ data, config, mode: forced, asTable }: WidgetViewProps) {
  const lang = useLang();
  const mode = useChartMode(forced);
  const c = chartColors(mode);
  const res = data?.result?.kind === "breakdown" ? data.result : undefined;
  const metricId = res ? Object.keys(res.total)[0] : undefined;
  const meta = metricId ? metaOf(data, metricId) : undefined;
  const currency = data?.currency ?? undefined;
  const hasPrev = !!res && config.showComparison && res.rows.some((r) => r.previous);
  // En källa: källans färg. Annars första färgen i den kategoriska paletten.
  const platforms = [...new Set(res?.rows.flatMap((r) => r.platforms ?? []) ?? [])] as PlatformId[];
  const color = platformColor(platforms.length === 1 ? platforms[0] : undefined, mode, c.categorical[0]!);
  const T = lang === "en" ? { now: "Selected period", prev: "Comparison period" } : { now: "Vald period", prev: "Jämförelseperiod" };
  const rows = useMemo(() => (res ? res.rows.filter((r) => !r.isOther) : []), [res]);

  const option = useMemo<EChartsOption>(() => {
    if (!res || !metricId || !meta) return {};
    const fmt = (v: number | null) => formatMetric(meta, v, currency, lang);
    const axisFmt = (v: number) => (meta.format === "percent" ? `${Math.round(v * 1000) / 10} %` : Math.abs(v) < 10_000 ? v.toLocaleString(numberLocale(lang)) : formatCompact(v, lang));
    // ECharts ritar kategorier nerifrån och upp; vänd så att största värdet hamnar överst.
    const ordered = [...rows].reverse();
    const bar = (name: string, values: (number | null)[], fill: string, label: boolean) => ({
      name,
      type: "bar" as const,
      data: values,
      barMaxWidth: 16,
      barGap: "15%",
      itemStyle: { color: fill, borderRadius: [0, 4, 4, 0] },
      label: label ? { show: true, position: "right" as const, color: c.muted, fontSize: 11, formatter: (p: { value: number }) => fmt(p.value) } : { show: false },
    });
    return {
      animation: false,
      grid: { left: 4, right: 56, top: 4, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: mode === "dark" ? "rgba(255,255,255,.04)" : "rgba(19,33,58,.04)" } },
        backgroundColor: mode === "dark" ? "#24252d" : "#ffffff",
        borderColor: c.axis,
        textStyle: { color: mode === "dark" ? "#f0efea" : "#1c1b19", fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          const r = ordered[params[0]?.dataIndex ?? 0]!;
          const line = (swatch: string, label: string, v: number | null) =>
            `<div style="display:flex;gap:16px;justify-content:space-between"><span><span style="display:inline-block;width:8px;height:8px;border-radius:9px;background:${swatch};margin-right:6px"></span>${label}</span><b style="font-variant-numeric:tabular-nums">${fmt(v)}</b></div>`;
          return `<div style="font-weight:600;margin-bottom:4px">${r.label}</div>${line(color, T.now, r.values[metricId] ?? null)}${hasPrev ? line(c.comparison, T.prev, r.previous?.[metricId] ?? null) : ""}`;
        },
      },
      xAxis: { type: "value", splitNumber: 3, splitLine: { lineStyle: { color: c.grid, width: 1 } }, axisLabel: { color: c.muted, fontSize: 11, formatter: axisFmt } },
      yAxis: {
        type: "category",
        data: ordered.map((r) => r.label),
        axisLine: { lineStyle: { color: c.axis } },
        axisTick: { show: false },
        axisLabel: { color: c.muted, fontSize: 11, width: 150, overflow: "truncate" },
      },
      // Första serien hamnar överst i varje grupp: vald period först, jämförelsen under.
      series: [
        bar(T.now, ordered.map((r) => r.values[metricId] ?? null), color, true),
        ...(hasPrev ? [bar(T.prev, ordered.map((r) => r.previous?.[metricId] ?? null), c.comparison, false)] : []),
      ],
    };
  }, [res, rows, metricId, meta, currency, lang, mode, c.axis, c.grid, c.muted, c.comparison, color, hasPrev, T.now, T.prev]);

  if (!res || !metricId || !meta) return null;
  const dimLabel = dimensionText(res.dimension, DIMENSIONS[res.dimension].label, lang);
  const label = lang === "en" ? `${meta.label} by ${dimLabel.toLowerCase()}` : `${meta.label} per ${dimLabel.toLowerCase()}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden /> {T.now}
        </span>
        {hasPrev && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: c.comparison }} aria-hidden /> {T.prev}
          </span>
        )}
      </div>
      {asTable ? (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="border-b py-1.5 text-left font-medium">
                {dimLabel}
              </th>
              <th scope="col" className="border-b py-1.5 text-right font-medium">
                {T.now}
              </th>
              {hasPrev && (
                <th scope="col" className="border-b py-1.5 text-right font-medium">
                  {T.prev}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="border-b py-1.5 text-left font-normal">
                  {r.label}
                </th>
                <td className="tabular border-b py-1.5 text-right">
                  {formatMetric(meta, r.values[metricId] ?? null, currency, lang)}
                  {hasPrev && r.previous && <DeltaBadge metric={meta} delta={computeDelta(meta, r.values[metricId] ?? null, r.previous[metricId] ?? null)} size="sm" className="ml-1.5" />}
                </td>
                {hasPrev && <td className="tabular border-b py-1.5 text-right text-muted-foreground">{formatMetric(meta, r.previous?.[metricId] ?? null, currency, lang)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EChart option={option} label={label} className="min-h-40 flex-1" />
      )}
    </div>
  );
}

