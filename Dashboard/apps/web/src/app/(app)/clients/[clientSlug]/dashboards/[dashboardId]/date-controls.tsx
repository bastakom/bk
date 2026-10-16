"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DashboardRange } from "@/lib/dashboard-data";
import { timeAgo } from "@/lib/format";
import { refreshDashboard } from "./actions";
import { useLang } from "@/components/lang-context";

export function DateControls({
  range,
  lastSynced,
  dashboardId,
  canEdit,
  filters,
  status,
}: {
  range: DashboardRange;
  lastSynced: string | null;
  dashboardId: string;
  canEdit: boolean;
  /** Dashboardens filterknapp och aktiva filter. */
  filters?: React.ReactNode;
  /** T.ex. sparstatus i redigeringsläget */
  status?: React.ReactNode;
}) {
  const lang = useLang();
  const en = lang === "en";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [navigating, startNav] = useTransition();
  const [syncing, startSync] = useTransition();

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    startNav(() => router.push(`${pathname}?${next}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePicker
        lang={lang}
        value={range}
        disabled={navigating}
        onApply={(v) => go({ range: v.preset, compare: v.compare, from: v.preset === "custom" ? (v.from ?? null) : null, to: v.preset === "custom" ? (v.to ?? null) : null })}
      />
      {filters}

      {navigating && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={en ? "Loading" : "Laddar"} />}

      <div className="ml-auto flex items-center gap-1">
        {status}
        <span className="text-xs text-muted-foreground" title={lastSynced ? new Date(lastSynced).toLocaleString("sv-SE") : undefined}>
          {en ? "Updated" : "Uppdaterad"} {timeAgo(lastSynced ? new Date(lastSynced) : null, undefined, lang)}
        </span>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Hämta ny data"
            disabled={syncing}
            onClick={() =>
              startSync(async () => {
                const res = await refreshDashboard(dashboardId);
                if (res.ok) toast.success(res.message);
                else toast.error(res.error);
              })
            }
          >
            <RefreshCw className={syncing ? "animate-spin" : undefined} />
          </Button>
        )}
      </div>
    </div>
  );
}
