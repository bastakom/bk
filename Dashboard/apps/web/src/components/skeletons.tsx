import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Platshållare med samma form som innehållet, så att sidan inte hoppar när data kommer. */
export function WidgetSkeleton({ kind = "chart", className }: { kind?: "kpi" | "chart" | "table"; className?: string }) {
  return (
    <div className={cn("flex h-full min-h-32 flex-col rounded-xl border bg-card p-4", className)} aria-hidden>
      <Skeleton className="h-4 w-1/3" />
      {kind === "kpi" && (
        <>
          <Skeleton className="mt-4 h-8 w-1/2" />
          <Skeleton className="mt-3 h-4 w-1/4" />
          <Skeleton className="mt-auto h-8 w-full" />
        </>
      )}
      {kind === "chart" && <Skeleton className="mt-4 min-h-24 w-full flex-1" />}
      {kind === "table" && (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card" aria-hidden>
      <div className="border-b bg-muted/40 px-5 py-3">
        <Skeleton className="h-3 w-1/4" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

/** Sidrubrik + innehåll, för loading.tsx. */
export function PageSkeleton({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8" role="status" aria-label="Laddar">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-8">{children ?? <TableSkeleton />}</div>
    </div>
  );
}
