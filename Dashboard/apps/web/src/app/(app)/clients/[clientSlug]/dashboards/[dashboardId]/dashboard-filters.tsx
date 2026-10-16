"use client";

import { describeFilter, PLATFORMS, type DataFilter, type PlatformId } from "@rp/core";
import { Filter, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeFilters, FilterBuilder, type DraftFilter } from "@/components/filter-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Catalog } from "@/lib/availability";
import { loadFilterValues, saveDashboardFilters } from "./actions";

/** Filter för hela dashboarden: knapp för redaktörer, aktiva filter som etiketter för alla. */
export function DashboardFilters({ dashboardId, filters, platforms, catalog, canEdit }: { dashboardId: string; filters: DataFilter[]; platforms: PlatformId[]; catalog: Catalog; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilter[]>(filters);
  const [pending, start] = useTransition();

  const save = (next: DataFilter[]) =>
    start(async () => {
      const res = await saveDashboardFilters(dashboardId, next);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    });

  if (!canEdit && filters.length === 0) return null;
  return (
    <>
      {canEdit && (
        <Button
          variant={filters.length ? "secondary" : "outline"}
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
        >
          <Filter /> Filter{filters.length ? ` (${filters.length})` : ""}
        </Button>
      )}
      {filters.length > 0 && (
        <ul className="flex basis-full flex-wrap gap-1.5" aria-label="Aktiva filter för dashboarden">
          {filters.map((f, i) => (
            <li key={i} className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-xs text-accent-foreground">
              <Filter className="size-3" aria-hidden /> {describeFilter(f, (p) => PLATFORMS[p].label)}
              {canEdit && (
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                  onClick={() => save(filters.filter((_, j) => j !== i))}
                  disabled={pending}
                  aria-label={`Ta bort filtret ${describeFilter(f, (p) => PLATFORMS[p].label)}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Filter för dashboarden</DialogTitle>
            <DialogDescription>Gäller alla widgets, även på delade länkar, i PDF:er och i schemalagda utskick. Widgets kan dessutom ha egna filter.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FilterBuilder
              filters={draft}
              onChange={setDraft}
              platforms={platforms}
              catalog={catalog}
              loadValues={(platform, dimension) => loadFilterValues(dashboardId, platform, dimension)}
              hint="Ett filterfält per kanal (t.ex. kampanj). Tabeller uppdelade på ett annat fält visar den kanalen ofiltrerad, med en förklaring."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={() => save(completeFilters(draft))} disabled={pending}>
              Spara filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
