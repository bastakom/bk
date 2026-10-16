import type { AccountStatus } from "@rp/db";
import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

const TONE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const;

const DOT = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/50",
} as const;

export function StatusBadge({ status, className }: { status: AccountStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONE[meta.tone], className)}>
      <StatusShape tone={meta.tone} />
      {meta.label}
    </span>
  );
}

/** Statusen kodas med både färg och form, så att den går att läsa utan färgseende. */
export function StatusShape({ tone, className }: { tone: keyof typeof TONE; className?: string }) {
  if (tone === "warning" || tone === "danger") {
    return (
      <svg viewBox="0 0 10 10" className={cn("size-2.5", className)} aria-hidden>
        {tone === "warning" ? <path d="M5 1 9.5 9h-9z" fill="currentColor" /> : <rect x="1" y="1" width="8" height="8" rx="1.5" fill="currentColor" />}
      </svg>
    );
  }
  return <span aria-hidden className={cn("size-2 rounded-full", DOT[tone], className)} />;
}
