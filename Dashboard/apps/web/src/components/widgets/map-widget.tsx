"use client";

import { useLang, useT } from "@/components/lang-context";
import { formatMetric, type BreakdownResult } from "@rp/core";
import { useEffect, useMemo, useState } from "react";
import { countryCode, countryName, numericCode } from "@/lib/countries";
import { chartColors, useChartMode } from "./chart-theme";
import { EChart, registerMap, type EChartsOption } from "./echart";
import { metaOf } from "./meta";
import type { WidgetViewProps } from "./types";

type World = { features: { id?: string | number; properties: { name: string } }[] };

/** Världskartan laddas först när en kartwidget visas. */
async function loadWorld(): Promise<World> {
  const [{ feature }, topo] = await Promise.all([import("topojson-client"), import("world-atlas/countries-110m.json")]);
  const t = (topo as { default?: unknown }).default ?? topo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geo = feature(t as any, (t as any).objects.countries) as unknown as World;
  registerMap("world", geo as never);
  return geo;
}

/** Karta per land (färgskala). Regioner saknar kartdata och visas som rangordnad lista. */
export function MapWidget(props: WidgetViewProps) {
  const lang = useLang(); const tt = useT();
  const res = props.data?.result?.kind === "breakdown" ? (props.data.result as BreakdownResult) : undefined;
  const metric = props.config.metrics[0];
  const meta = metaOf(props.data, metric ?? "");
  const currency = props.data?.currency ?? undefined;
  const mode = useChartMode(props.mode);
  const c = chartColors(mode);
  const [world, setWorld] = useState<World | null>(null);
  const isRegion = res?.dimension === "region";

  useEffect(() => {
    if (isRegion) return;
    let alive = true;
    loadWorld().then((w) => alive && setWorld(w));
    return () => {
      alive = false;
    };
  }, [isRegion]);

  // Landets värde → kartans namn (via numerisk ISO-kod).
  const countriesData = useMemo(() => {
    if (!res || !metric || !world) return { rows: [], unknown: 0 };
    const byNumeric = new Map(world.features.map((f) => [String(f.id).padStart(3, "0"), f.properties.name]));
    let unknown = 0;
    const rows = res.rows.flatMap((r) => {
      const a2 = countryCode(r.label);
      const num = a2 ? numericCode(a2) : null;
      const name = num ? byNumeric.get(num) : undefined;
      const value = r.values[metric] ?? null;
      if (!a2 || !name) {
        unknown++;
        return [];
      }
      return [{ name, label: countryName(a2, lang), value }];
    });
    return { rows, unknown };
  }, [res, metric, world, lang]);

  const option = useMemo<EChartsOption>(() => {
    const values = countriesData.rows.map((r) => r.value ?? 0);
    return {
      animation: false,
      tooltip: {
        trigger: "item",
        backgroundColor: mode === "dark" ? "#24252d" : "#ffffff",
        borderColor: c.axis,
        textStyle: { color: mode === "dark" ? "#f0efea" : "#1c1b19", fontSize: 12 },
        formatter: (p: { name: string; value?: number }) => {
          const row = countriesData.rows.find((r) => r.name === p.name);
          return row ? `<b>${row.label}</b><br/>${meta.label}: ${formatMetric(meta, row.value, currency, lang)}` : p.name;
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(1, ...values),
        show: false,
        inRange: { color: mode === "dark" ? ["#2a3a55", "#ff8a8b"] : ["#f7dad2", "#25364f"] },
      },
      series: [
        {
          type: "map",
          map: "world",
          roam: false,
          nameProperty: "name",
          itemStyle: { areaColor: mode === "dark" ? "#1c2a40" : "#efeae7", borderColor: c.surface, borderWidth: 0.5 },
          emphasis: { label: { show: false }, itemStyle: { areaColor: "#ff6062" } },
          select: { disabled: true },
          data: countriesData.rows.map((r) => ({ name: r.name, value: r.value })),
        },
      ],
    };
  }, [countriesData, mode, c.axis, c.surface, meta, currency, lang]);

  if (!res || !metric) return null;
  const top = [...res.rows].slice(0, isRegion ? 15 : 5);
  const max = Math.max(1, ...top.map((r) => r.values[metric] ?? 0));

  const list = (
    <ol className="space-y-1.5" aria-label={isRegion ? (lang === "en" ? "Regions" : "Regioner") : tt("biggestCountries")}>
      {top.map((r) => {
        const v = r.values[metric] ?? null;
        const a2 = isRegion ? null : countryCode(r.label);
        return (
          <li key={r.label} className="text-sm">
            <div className="flex justify-between gap-3">
              <span className="truncate">{a2 ? countryName(a2, lang) : /^(unknown|\(not set\)|okänt)$/i.test(r.label) ? tt("unknown") : r.label}</span>
              <span className="tabular font-medium">{formatMetric(meta, v, currency, lang)}</span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${((v ?? 0) / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );

  if (isRegion) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">{tt("regionsAsList")}</p>
        {list}
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {world ? <EChart option={option} label={`${meta.label} per land på karta`} className="min-h-40 flex-1" /> : <div className="min-h-40 flex-1 animate-pulse rounded-lg bg-muted" />}
      {list}
      {countriesData.unknown > 0 && <p className="text-xs text-muted-foreground">{countriesData.unknown} {tt("notPlaced")}</p>}
    </div>
  );
}
