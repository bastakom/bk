"use client";

import { useLang } from "@/components/lang-context";
import { formatMetric, PLATFORMS, type MetricMeta, type SourceShare } from "@rp/core";
import { platformColor, type ChartMode } from "./chart-theme";

/**
 * Källfördelning under ett KPI-värde: staplad stapel för additiva metrics
 * ("Meta 40 %, Google 35 %"), annars värde per källa.
 */
export function SourceSplit({ sources, meta, currency, mode }: { sources: SourceShare[]; meta: MetricMeta; currency?: string; mode: ChartMode }) {
  const lang = useLang();
  const additive = sources.some((s) => s.share !== null);
  const label = sources
    .map((s) => `${PLATFORMS[s.platform].label} ${additive ? `${Math.round((s.share ?? 0) * 100)} %` : formatMetric(meta, s.value, currency, lang)}`)
    .join(", ");
  return (
    <div className="mt-2" aria-label={`Fördelning per källa: ${label}`}>
      {additive && (
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {sources.map((s) => (
            <span key={s.platform} style={{ width: `${(s.share ?? 0) * 100}%`, background: platformColor(s.platform, mode, "#888") }} />
          ))}
        </div>
      )}
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {sources.map((s) => (
          <li key={s.platform} className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: platformColor(s.platform, mode, "#888") }} aria-hidden />
            {PLATFORMS[s.platform].label.replace(" Ads", "")}{" "}
            <span className="tabular font-medium text-foreground/80">
              {additive ? `${Math.round((s.share ?? 0) * 100)} %` : formatMetric(meta, s.value, currency, lang)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
