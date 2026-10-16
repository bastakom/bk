"use client";

import { useLang } from "@/components/lang-context";
import { computeDelta, formatCompact, formatMetric, PLATFORMS, type MetricMeta, type PlatformId, type TimeseriesResult , numberLocale } from "@rp/core";
import { useMemo } from "react";
import { DeltaBadge } from "@/components/delta-badge";
import { chartColors, platformColor, useChartMode } from "./chart-theme";
import { EChart, type EChartsOption } from "./echart";
import { axisLabel, tooltipLabel } from "./format-axis";
import { metaOf } from "./meta";
import type { WidgetViewProps } from "./types";

/**
 * Trendgraf. Metrics med olika enhet ritas som små multiplar (en graf per
 * metric) – aldrig med två y-axlar. Med "per källa" staplas additiva metrics
 * per plattform; kvoter ritas som en linje per källa.
 */
export function TimeseriesWidget(props: WidgetViewProps) {
  const res = props.data?.result?.kind === "timeseries" ? props.data.result : undefined;
  if (!res) return null;
  const formats = new Set(res.series.map((s) => metaOf(props.data, s.metric).format));
  const split = props.config.splitBySource && res.platforms.length > 1;
  if (formats.size > 1 || (split && res.series.length > 1)) {
    return (
      <div className="grid h-full gap-4" style={{ gridTemplateRows: `repeat(${res.series.length}, minmax(0, 1fr))` }}>
        {res.series.map((s, i) => (
          <SeriesChart key={s.metric} {...props} res={{ ...res, series: [s] }} slot={i} compact />
        ))}
      </div>
    );
  }
  return <SeriesChart {...props} res={res} slot={0} />;
}

const isAdditive = (m: MetricMeta) => m.aggregation === "sum" || m.aggregation === "sum_approx";

function SeriesChart({ res, config, platforms, data, mode: forced, asTable, slot, compact }: WidgetViewProps & { res: TimeseriesResult; slot: number; compact?: boolean }) {
  const lang = useLang();
  const mode = useChartMode(forced);
  const c = chartColors(mode);
  const currency = data?.currency ?? undefined;
  const single = res.series.length === 1;
  const split = config.splitBySource && res.platforms.length > 1 && single;
  const colorFor = (i: number) => (single && platforms.length === 1 && slot === 0 ? platformColor(platforms[0], mode, c.categorical[0]!) : c.categorical[(slot + i) % 8]!);
  const hasPrev = config.showComparison && res.series.some((s) => s.previous);
  const metas = res.series.map((s) => metaOf(data, s.metric));

  // Händelser placeras i den bucket (dag/vecka/månad) de infaller i.
  const marks = useMemo(
    () =>
      (data?.annotations ?? []).flatMap((a, n) => {
        let idx = -1;
        res.keys.forEach((k, i) => {
          if (k <= a.date) idx = i;
        });
        return idx >= 0 ? [{ n: n + 1, key: res.keys[idx]!, ...a }] : [];
      }),
    [data?.annotations, res.keys],
  );

  const option = useMemo<EChartsOption>(() => {
    const meta0 = metas[0]!;
    const series: object[] = [];
    const line = (name: string, values: (number | null)[], color: string, extra: object = {}) => ({
      name,
      type: config.chart === "bar" ? "bar" : "line",
      data: values,
      showSymbol: false,
      symbolSize: 8,
      lineStyle: { width: 2, color, cap: "round", join: "round" },
      itemStyle: { color, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 24,
      z: 2,
      ...extra,
    });

    res.series.forEach((s, i) => {
      const meta = metas[i]!;
      if (hasPrev && s.previous) {
        series.push({
          name: `${meta.label} (jämförelse)`,
          type: "line",
          data: s.previous,
          showSymbol: false,
          lineStyle: { width: 1.5, color: c.comparison },
          itemStyle: { color: c.comparison },
          emphasis: { disabled: true },
          z: 3,
        });
      }
      if (split && s.bySource) {
        const stack = isAdditive(meta);
        res.platforms.forEach((p) => {
          const color = platformColor(p, mode, c.categorical[0]!);
          series.push(
            line(PLATFORMS[p].label, s.bySource![p] ?? [], color, {
              stack: stack ? "källa" : undefined,
              areaStyle: stack && config.chart !== "bar" ? { color, opacity: 0.85 } : undefined,
              lineStyle: { width: stack ? 0 : 2, color },
              // Tunn yta i surface-färg separerar staplade segment.
              itemStyle: { color, borderRadius: stack ? 0 : [4, 4, 0, 0], borderColor: c.surface, borderWidth: stack && config.chart === "bar" ? 1 : 0 },
            }),
          );
        });
      } else {
        const color = colorFor(i);
        series.push(line(meta.label, s.values, color, { areaStyle: config.chart === "area" ? { color, opacity: 0.1 } : undefined }));
      }
    });

    if (marks.length && series[0]) {
      (series[series.length - 1] as Record<string, unknown>).markLine = {
        silent: true,
        symbol: "none",
        lineStyle: { type: "dashed", color: c.muted, width: 1 },
        label: { formatter: (p: { data: { name: string } }) => p.data.name, position: "end", rotate: 0, color: c.muted, fontSize: 10, fontWeight: "bold" },
        data: marks.map((m) => ({ xAxis: m.key, name: String(m.n) })),
      };
    }

    return {
      animation: false,
      grid: { left: 4, right: 12, top: marks.length ? 18 : 12, bottom: 4, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: c.axis } },
        backgroundColor: mode === "dark" ? "#24252d" : "#ffffff",
        borderColor: c.axis,
        textStyle: { color: mode === "dark" ? "#f0efea" : "#1c1b19", fontSize: 12 },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0]?.dataIndex ?? 0;
          const row = (color: string, label: string, value: string, muted = false) =>
            `<div style="display:flex;gap:16px;justify-content:space-between;${muted ? "opacity:.75" : ""}"><span><span style="display:inline-block;width:8px;height:8px;border-radius:9px;background:${color};margin-right:6px"></span>${label}</span><b style="font-variant-numeric:tabular-nums">${value}</b></div>`;
          let html = `<div style="font-weight:600;margin-bottom:4px">${tooltipLabel(res.keys[i]!, res.granularity, lang)}</div>`;
          res.series.forEach((s, k) => {
            const meta = metas[k]!;
            const total = s.values[i] ?? null;
            html += row(split ? "transparent" : colorFor(k), split ? `${meta.label} ${lang === "en" ? "total" : "totalt"}` : meta.label, formatMetric(meta, total, currency, lang));
            // Källfördelning i tooltipen: "Meta 40 %, Google 35 %…"
            if (s.bySource) {
              for (const p of res.platforms) {
                const v = s.bySource[p]?.[i] ?? null;
                const share = isAdditive(meta) && total ? ` · ${Math.round(((v ?? 0) / total) * 100)} %` : "";
                html += row(platformColor(p as PlatformId, mode, "#888"), PLATFORMS[p].label, `${formatMetric(meta, v, currency, lang)}${share}`, true);
              }
            }
            if (hasPrev && s.previous) {
              html += row(c.comparison, `${lang === "en" ? "Comparison" : "Jämförelse"} · ${tooltipLabel(res.previousKeys?.[i] ?? "", res.granularity, lang)}`, formatMetric(meta, s.previous[i] ?? null, currency, lang), true);
            }
          });
          return html;
        },
      },
      xAxis: {
        type: "category",
        data: res.keys,
        boundaryGap: config.chart === "bar",
        axisLine: { lineStyle: { color: c.axis } },
        axisTick: { show: false },
        axisLabel: { color: c.muted, fontSize: 11, hideOverlap: true, formatter: (k: string) => axisLabel(k, res.granularity, lang) },
      },
      yAxis: {
        type: "value",
        splitNumber: compact ? 2 : 4,
        splitLine: { lineStyle: { color: c.grid, width: 1 } },
        axisLabel: {
          color: c.muted,
          fontSize: 11,
          formatter: (v: number) =>
            meta0.format === "percent" ? `${Math.round(v * 1000) / 10} %` : Math.abs(v) < 10_000 ? v.toLocaleString(numberLocale(lang)) : formatCompact(v, lang),
        },
      },
      series,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, mode, config.chart, hasPrev, currency, compact, split, marks]);

  const label = `${metas.map((m) => m.label).join(", ")} över tid`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {res.series.map((s, i) => (
          <SeriesHeader key={s.metric} meta={metas[i]!} total={s.total} previousTotal={hasPrev ? s.previousTotal : null} color={colorFor(i)} showSwatch={!single} currency={currency} />
        ))}
        {split &&
          res.platforms.map((p) => (
            <span key={p} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-sm" style={{ background: platformColor(p, mode, "#888") }} aria-hidden /> {PLATFORMS[p].label}
            </span>
          ))}
        {hasPrev && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-0.5 w-3 rounded" style={{ background: c.comparison }} aria-hidden /> Jämförelseperiod
          </span>
        )}
      </div>
      {asTable ? <SeriesTable res={res} metas={metas} currency={currency} /> : <EChart option={option} label={label} className="flex-1" />}
      {marks.length > 0 && slot === 0 && (
        <ol className="mt-2 space-y-0.5 text-xs text-muted-foreground" aria-label={lang === "en" ? "Events in the chart" : "Händelser i grafen"}>
          {marks.map((m) => (
            <li key={m.id}>
              <span className="tabular font-medium text-foreground">{m.n}.</span> {fmtEventDay[lang].format(new Date(`${m.date}T00:00:00Z`))} – {m.text}
              {m.internal && <span className="ml-1 rounded bg-muted px-1 py-px text-[10px]">intern</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SeriesHeader({ meta, total, previousTotal, color, showSwatch, currency }: { meta: MetricMeta; total: number | null; previousTotal: number | null; color: string; showSwatch: boolean; currency?: string }) {
  const lang = useLang();
  return (
    <div className="flex items-center gap-2">
      {showSwatch && <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />}
      <span className="text-xs text-muted-foreground">{meta.label}</span>
      <span className="tabular text-sm font-semibold">{formatMetric(meta, total, currency, lang)}</span>
      {previousTotal !== null && <DeltaBadge metric={meta} delta={computeDelta(meta, total, previousTotal)} size="sm" />}
    </div>
  );
}

function SeriesTable({ res, metas, currency }: { res: TimeseriesResult; metas: MetricMeta[]; currency?: string }) {
  const lang = useLang();
  const sources = res.series.length === 1 && res.series[0]!.bySource ? res.platforms : [];
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-xs text-muted-foreground">
          <tr>
            <th className="py-1.5 text-left font-medium">Period</th>
            {res.series.map((s, i) => (
              <th key={s.metric} className="py-1.5 text-right font-medium">
                {metas[i]!.label}
              </th>
            ))}
            {sources.map((p) => (
              <th key={p} className="py-1.5 text-right font-medium">
                {PLATFORMS[p].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {res.keys.map((k, i) => (
            <tr key={k}>
              <td className="py-1.5">{tooltipLabel(k, res.granularity)}</td>
              {res.series.map((s, j) => (
                <td key={s.metric} className="py-1.5 text-right">
                  {formatMetric(metas[j]!, s.values[i] ?? null, currency, lang)}
                </td>
              ))}
              {sources.map((p) => (
                <td key={p} className="py-1.5 text-right text-muted-foreground">
                  {formatMetric(metas[0]!, res.series[0]!.bySource![p]?.[i] ?? null, currency, lang)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const fmtEventDay = { sv: new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", timeZone: "UTC" }), en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) };
