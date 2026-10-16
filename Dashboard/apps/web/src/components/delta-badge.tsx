import { useLang } from "@/components/lang-context";
import { formatDelta, formatMetric, type Delta, type MetricId, type MetricMeta } from "@rp/core";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Förändring mot jämförelseperioden. Riktning visas med pil, inte bara färg. */
export function DeltaBadge({ metric, delta, size = "md", className }: { metric: MetricId | MetricMeta; delta: Delta; size?: "sm" | "md"; className?: string }) {
  const lang = useLang();
  const label = formatDelta(metric, delta, lang);
  // En förändring som avrundas till ±0 visas neutral, utan pil och utan grön/röd ton.
  const rounded = delta.kind === "change" && label.startsWith("±");
  const tone =
    delta.kind === "change" && !rounded
      ? delta.favorable === null
        ? "bg-muted text-foreground/80"
        : delta.favorable
          ? "bg-success-soft text-success"
          : "bg-danger-soft text-destructive"
      : delta.kind === "new"
        ? "bg-accent text-accent-foreground"
        : "bg-muted text-muted-foreground";
  const Icon = delta.kind === "change" && !rounded ? (delta.absolute > 0 ? ArrowUpRight : ArrowDownRight) : delta.kind === "new" ? Sparkles : Minus;
  return (
    <span
      className={cn(
        "delta-badge tabular inline-flex items-center gap-0.5 rounded-full font-medium whitespace-nowrap",
        size === "md" ? "px-2 py-0.5 text-xs" : "px-1.5 py-px text-[11px]",
        tone,
        className,
      )}
      title={delta.kind === "new" ? (lang === "en" ? "The previous period was 0" : "Föregående period var 0") : delta.kind === "none" ? (lang === "en" ? "No comparison data" : "Ingen jämförelsedata") : undefined}
    >
      <Icon className={size === "md" ? "size-3.5" : "size-3"} aria-hidden />
      {label}
    </span>
  );
}

export function PreviousValue({ metric, delta, currency }: { metric: MetricId | MetricMeta; delta: Delta; currency?: string }) {
  const lang = useLang();
  if (delta.kind !== "change" && delta.kind !== "flat") return null;
  return <span className="tabular text-xs text-muted-foreground">{lang === "en" ? "prev." : "fg."} {formatMetric(metric, delta.previous, currency, lang)}</span>;
}
