"use client";

import { useLang } from "@/components/lang-context";
import { formatMetric , type Lang , numberLocale } from "@rp/core";
import { metaOf } from "./meta";
import { chartColors, platformColor, useChartMode } from "./chart-theme";
import type { WidgetViewProps } from "./types";

const pct = (v: number | null, lang: Lang = "sv") => (v === null ? "–" : `${(v * 100).toLocaleString(numberLocale(lang), { maximumFractionDigits: 1 })} %`);

/** Proportionell funnel. Visar både andel av första steget och av föregående steg, tydligt etiketterat. */
export function FunnelWidget({ data, platforms, mode: forced }: WidgetViewProps) {
  const lang = useLang();
  const mode = useChartMode(forced);
  const res = data?.result?.kind === "funnel" ? data.result : undefined;
  if (!res) return null;
  const color = platformColor(platforms.length === 1 ? platforms[0] : undefined, mode, chartColors(mode).categorical[0]!);
  const last = res.steps[res.steps.length - 1];

  return (
    <div className="flex h-full flex-col">
      <ol className="space-y-2.5">
        {res.steps.map((s, i) => (
          <li key={s.metric} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{metaOf(data, s.metric).label}</span>
            <span className="h-6 rounded bg-muted/60">
              <span className="block h-full rounded" style={{ width: `${Math.max((s.ofFirst ?? 0) * 100, 0.8)}%`, background: color, opacity: 1 - i * 0.1 }} />
            </span>
            <span className="tabular w-36 text-right">
              <span className="font-semibold">{formatMetric(metaOf(data, s.metric), s.value, undefined, lang)}</span>
              {i > 0 && <span className="ml-2 text-xs text-muted-foreground">{pct(s.ofPrevious, lang)} {lang === "en" ? "of previous step" : "av fg. steg"}</span>}
            </span>
          </li>
        ))}
      </ol>
      {last && res.steps.length > 1 && (
        <p className="mt-auto pt-3 text-sm text-muted-foreground">
          {lang === "en" ? "All the way:" : "Hela vägen:"} <span className="tabular font-semibold text-foreground">{pct(last.ofFirst, lang)}</span> {lang === "en" ? "of" : "av"} {metaOf(data, res.steps[0]!.metric).label.toLowerCase()}
        </p>
      )}
    </div>
  );
}
