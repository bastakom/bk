import { cn } from "@/lib/utils";

/** Liten trendkurva utan axlar (för kort och KPI:er). Dekorativ; värdet står alltid i text bredvid. */
export function Sparkline({ values, className, tone = "default" }: { values: number[]; className?: string; tone?: "default" | "inverse" }) {
  if (values.length < 2) return null;
  const w = 200;
  const h = 40;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 4)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-10 w-full", className)} aria-hidden>
      <path d={`${line} L${w} ${h} L0 ${h}Z`} className={tone === "inverse" ? "fill-white/10" : "fill-primary/8"} />
      <path d={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" className={tone === "inverse" ? "stroke-white" : "stroke-primary"} />
    </svg>
  );
}
