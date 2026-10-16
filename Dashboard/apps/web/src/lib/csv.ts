/**
 * CSV-export av en widgets data (i webbläsaren). Semikolon och decimalkomma så att
 * filen öppnas rätt i svenska Excel; UTF-8 med BOM för å, ä, ö.
 */
import { DIMENSIONS, PLATFORMS, type MetricMeta } from "@rp/core";
import type { WidgetData } from "./dashboard-data";

const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? "" : String(Math.round(v * 10000) / 10000).replace(".", ","));
const cell = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
const label = (meta: Record<string, MetricMeta>, id: string) => {
  const m = meta[id];
  if (!m) return id;
  return m.format === "currency" ? `${m.label}` : m.format === "percent" ? `${m.label} (andel)` : m.label;
};

/** Raderna för widgetens data, eller null om typen saknar tabelldata. */
export function widgetRows(data: WidgetData): string[][] | null {
  const r = data.result;
  const meta = data.meta;
  if (data.goals) {
    return [["Mål", "Utfall", "Mål", "Prognos", "Status", "Från", "Till"], ...data.goals.map((g) => [g.label, num(g.actual), num(g.target), num(g.evaluation.projection), g.evaluation.status, g.window.start, g.window.through])];
  }
  if (data.ads?.length) {
    const metrics = Object.keys(meta);
    return [["Annons", "Rubrik", "Text", "Format", ...metrics.map((m) => label(meta, m))], ...data.ads.map((a) => [a.name, a.headline ?? "", a.text ?? "", a.format ?? "", ...metrics.map((m) => num(a.values[m]))])];
  }
  if (!r) return null;
  switch (r.kind) {
    case "kpi":
      return [["Metric", "Värde", "Jämförelse"], ...r.items.map((it) => [label(meta, it.metric), num(it.value), num(it.previous)])];
    case "timeseries": {
      const head = ["Datum", ...r.series.flatMap((s) => [label(meta, s.metric), ...(s.previous ? [`${label(meta, s.metric)} (jämförelse)`] : [])])];
      return [head, ...r.keys.map((k, i) => [k, ...r.series.flatMap((s) => [num(s.values[i]), ...(s.previous ? [num(s.previous[i])] : [])])])];
    }
    case "breakdown": {
      const metrics = Object.keys(r.total);
      const dim = r.dimension === "source" ? "Källa" : (DIMENSIONS[r.dimension]?.label ?? r.dimension);
      return [
        [dim, ...metrics.map((m) => label(meta, m)), ...metrics.map((m) => `${label(meta, m)} (jämförelse)`), "Källor"],
        ...r.rows.map((row) => [
          row.label,
          ...metrics.map((m) => num(row.values[m])),
          ...metrics.map((m) => num(row.previous?.[m])),
          (row.platforms ?? []).map((p) => PLATFORMS[p]?.label ?? p).join(", "),
        ]),
      ];
    }
    case "funnel":
      return [["Steg", "Värde", "Andel av första", "Andel av föregående"], ...r.steps.map((s) => [label(meta, s.metric), num(s.value), num(s.ofFirst), num(s.ofPrevious)])];
  }
}

export function downloadCsv(rows: string[][], filename: string) {
  const text = "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${filename.replace(/[\\/:*?"<>|]+/g, "-").trim() || "widget"}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
