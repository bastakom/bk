"use client";

import { useLang } from "@/components/lang-context";
import { formatMetric, PLATFORMS , numberLocale } from "@rp/core";
import { useMemo } from "react";
import { chartColors, platformColor, useChartMode } from "./chart-theme";
import { metaOf } from "./meta";
import { EChart, type EChartsOption } from "./echart";
import type { WidgetViewProps } from "./types";

/** Donut med legend som lista (etikett, värde, andel) – identitet bärs aldrig av färg ensam. */
export function DonutWidget({ data, mode: forced, asTable }: WidgetViewProps) {
  const lang = useLang();
  const mode = useChartMode(forced);
  const c = chartColors(mode);
  const res = data?.result?.kind === "breakdown" ? data.result : undefined;
  const metricId = res ? Object.keys(res.total)[0] : undefined;
  const meta = metricId ? metaOf(data, metricId) : undefined;
  const currency = data?.currency ?? undefined;
  // Vid "Källa" används källornas egna färger, annars den kategoriska paletten i fast ordning.
  const platformByLabel = new Map(Object.values(PLATFORMS).map((p) => [p.label, p.id]));

  const slices = useMemo(() => {
    if (!res || !metricId) return [];
    const total = res.total[metricId] ?? 0;
    return res.rows.map((r, i) => {
      const platform = res.dimension === "source" ? platformByLabel.get(r.label) : undefined;
      return {
        name: r.label,
        value: r.values[metricId] ?? 0,
        share: total ? (r.values[metricId] ?? 0) / total : 0,
        color: r.isOther ? c.other : platform ? platformColor(platform, mode, c.categorical[i]!) : c.categorical[i]!,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res, metricId, c.other, c.categorical, mode]);

  const option = useMemo<EChartsOption>(
    () => ({
      animation: false,
      tooltip: {
        trigger: "item",
        backgroundColor: mode === "dark" ? "#24252d" : "#ffffff",
        borderColor: c.axis,
        textStyle: { color: mode === "dark" ? "#f0efea" : "#1c1b19", fontSize: 12 },
        formatter: (p: { name: string; value: number; percent: number }) =>
          `<b>${p.name}</b><br/>${formatMetric(meta!, p.value, currency, lang)} · ${p.percent.toLocaleString(numberLocale(lang), { maximumFractionDigits: 1 })} %`,
      },
      series: [
        {
          type: "pie",
          radius: ["62%", "88%"],
          padAngle: 1.5,
          itemStyle: { borderRadius: 4, borderColor: c.surface, borderWidth: 0 },
          label: { show: false },
          emphasis: { scale: false },
          data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
        },
      ],
    }),
    [slices, mode, c.axis, c.surface, meta, currency, lang],
  );

  if (!res || !metricId || !meta) return null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 items-center gap-4 @md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {!asTable && (
        <div className="relative mx-auto aspect-square h-full max-h-56 min-h-32">
          <EChart option={option} label={lang === "en" ? `Distribution of ${meta.label}` : `Fördelning av ${meta.label}`} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="tabular text-lg font-semibold">{formatMetric(meta, res.total[metricId] ?? null, currency, lang)}</p>
              <p className="text-xs text-muted-foreground">{meta.label}</p>
            </div>
          </div>
        </div>
      )}
      <ul className="min-w-0 space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 break-words">{s.name}</span>
            <span className="tabular font-medium">{formatMetric(meta, s.value, currency, lang)}</span>
            <span className="tabular w-14 text-right text-xs text-muted-foreground">{(s.share * 100).toLocaleString(numberLocale(lang), { maximumFractionDigits: 1 })} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
