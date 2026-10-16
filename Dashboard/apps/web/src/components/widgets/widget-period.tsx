import { formatRange, presetText, RANGE_PRESETS, type Lang, type WidgetConfig } from "@rp/core";
import type { WidgetData } from "@/lib/dashboard-data";
import { cn } from "@/lib/utils";

/** Widgetens fasta period, t.ex. "I år · 1 jan. – 14 okt. 2026" (visas under rubriken). */
export function fixedPeriodText(config: WidgetConfig, data: WidgetData | null | undefined, lang: Lang): string | null {
  if (!config.fixedRange || !data?.range) return null;
  const preset = config.fixedRange.preset;
  const name = preset === "custom" ? (lang === "en" ? "Fixed period" : "Fast period") : presetText(preset, RANGE_PRESETS.find((p) => p.id === preset)!.label, lang);
  return `${name} · ${formatRange(data.range, lang)}`;
}

/** Sidfot med källor och period, t.ex. "Källa: Meta Ads · Demoprodukt SE | Period: 1 jan. – 14 okt. 2026". */
export function WidgetFooter({ data, lang, className }: { data: WidgetData | null | undefined; lang: Lang; className?: string }) {
  if (!data?.sources?.length || !data.range) return null;
  const en = lang === "en";
  return (
    <p className={cn("mt-2 border-t pt-1.5 text-[11px] text-muted-foreground", className)}>
      {en ? "Source" : data.sources.length > 1 ? "Källor" : "Källa"}: {data.sources.join(", ")}
      <span aria-hidden> | </span>
      <span className="whitespace-nowrap">
        {en ? "Period" : "Period"}: {formatRange(data.range, lang)}
      </span>
    </p>
  );
}
