"use client";

import { useLang } from "@/components/lang-context";
import { COMPOSITE_DIMENSIONS, computeDelta, DIMENSIONS, dimensionText, formatMetric, splitDimension } from "@rp/core";
import { PlatformIcon } from "@/components/platform-icon";
import { metaOf, shortLabel } from "./meta";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo, useState } from "react";
import { DeltaBadge } from "@/components/delta-badge";
import { cn } from "@/lib/utils";
import type { WidgetViewProps } from "./types";

/** Tabell: text bryts i stället för att klippas, siffror är tabulära och högerställda. */
export function TableWidget({ data, config }: WidgetViewProps) {
  const lang = useLang();
  const res = data?.result?.kind === "breakdown" ? data.result : undefined;
  const metrics = res ? Object.keys(res.total) : [];
  const [sort, setSort] = useState<{ by: string; dir: "asc" | "desc" } | null>(null);
  const currency = data?.currency ?? undefined;

  const rows = useMemo(() => {
    if (!res) return [];
    if (!sort) return res.rows;
    return [...res.rows].sort((a, b) => {
      if (sort.by === "label") return a.label.localeCompare(b.label, "sv") * (sort.dir === "asc" ? 1 : -1);
      const av = a.values[sort.by] ?? -Infinity;
      const bv = b.values[sort.by] ?? -Infinity;
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [res, sort]);

  if (!res) return null;
  const showDelta = config.showComparison && res.rows.some((r) => r.previous);
  const showPrevious = showDelta && config.showPrevious;
  const prevLabel = lang === "en" ? "Prev." : "Föreg.";
  // Två dimensioner (t.ex. kampanj och enhet) visas som två kolumner.
  const parts = COMPOSITE_DIMENSIONS[res.dimension];
  const labelColumns = parts ?? [res.dimension];
  const cells = (label: string) => (parts ? splitDimension(label) : [label]);
  // Vid flera källor visas vilka som bidrar till varje rad.
  const multiSource = new Set(res.rows.flatMap((r) => r.platforms ?? [])).size > 1;
  const toggle = (by: string) => setSort((s) => ({ by, dir: s?.by === by && s.dir === "desc" ? "asc" : "desc" }));
  const sortIcon = (by: string) => (sort?.by === by ? sort.dir === "desc" ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null);

  return (
    <div>
      {/* I smala kort krymper text och delta-badges så att inga kolumner klipps. */}
      <table className="w-full border-separate border-spacing-0 text-sm @max-[24rem]:text-xs @max-[24rem]:[&_.delta-badge_svg]:hidden">
        <thead className="text-xs text-muted-foreground">
          <tr>
            {labelColumns.map((d, i) => (
              <th key={d} scope="col" className="border-b py-2 pr-3 text-left font-medium">
                {i === 0 ? (
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle("label")}>
                    {dimensionText(d, DIMENSIONS[d].label, lang)} {sortIcon("label")}
                  </button>
                ) : (
                  dimensionText(d, DIMENSIONS[d].label, lang)
                )}
              </th>
            ))}
            {metrics.map((m) => [
              <th key={m} scope="col" className="border-b py-2 pl-3 text-right font-medium whitespace-nowrap @max-[24rem]:pl-1.5">
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => toggle(m)}>
                  {sortIcon(m)} {shortLabel(metaOf(data, m))}
                </button>
              </th>,
              showPrevious && (
                <th key={`${m}-prev`} scope="col" className="border-b py-2 pl-3 text-right font-medium whitespace-nowrap @max-[24rem]:pl-1.5">
                  <span className="sr-only">{shortLabel(metaOf(data, m))}, </span>
                  {prevLabel}
                </th>
              ),
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="group">
              {parts && (
                <th scope="row" className="border-b py-2 pr-3 text-left align-top font-normal break-words group-last:border-b-0 @max-[24rem]:pr-1.5">
                  {cells(r.label)[0]}
                </th>
              )}
              <th scope="row" className="border-b py-2 pr-3 text-left align-top font-normal break-words group-last:border-b-0 @max-[24rem]:pr-1.5">
                {cells(r.label).at(-1)}
                {multiSource && r.platforms && (
                  <span className="ml-1.5 inline-flex translate-y-0.5 gap-0.5">
                    {r.platforms.map((p) => (
                      <PlatformIcon key={p} platform={p} size="sm" className="size-3.5 text-[7px]" />
                    ))}
                  </span>
                )}
              </th>
              {metrics.map((m) => [
                <td key={m} className="border-b py-2 pl-3 text-right align-top group-last:border-b-0 @max-[24rem]:pl-1.5">
                  <div className="font-medium whitespace-nowrap">{formatMetric(metaOf(data, m), r.values[m] ?? null, currency, lang)}</div>
                  {showDelta && r.previous && (
                    <DeltaBadge metric={metaOf(data, m)} delta={computeDelta(metaOf(data, m), r.values[m] ?? null, r.previous[m] ?? null)} size="sm" className="mt-0.5" />
                  )}
                </td>,
                showPrevious && (
                  <td key={`${m}-prev`} className="border-b py-2 pl-3 text-right align-top whitespace-nowrap text-muted-foreground group-last:border-b-0 @max-[24rem]:pl-1.5">
                    {formatMetric(metaOf(data, m), r.previous?.[m] ?? null, currency, lang)}
                  </td>
                ),
              ])}
            </tr>
          ))}
        </tbody>
        <tfoot className="text-xs text-muted-foreground">
          <tr>
            <td colSpan={metrics.length * (showPrevious ? 2 : 1) + labelColumns.length} className={cn("pt-2")}>
              {res.distinctCount > res.rows.length ? (lang === "en" ? `Showing ${res.rows.length} of ${res.distinctCount}` : `Visar ${res.rows.length} av ${res.distinctCount}`) : `${res.rows.length} ${lang === "en" ? "rows" : "rader"}`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
