"use client";

import type { DataFilter, PlatformId } from "@rp/core";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeFilters, FilterBuilder, type DraftFilter } from "@/components/filter-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Catalog } from "@/lib/availability";
import { loadSourceFilterValues, saveClientSourceFilters } from "../actions";

/** Kundens filter för en källa: avgränsar kundens del av ett delat konto i alla kundens dashboards. */
export function SourceFilterDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  accountId: string;
  accountName: string;
  platform: PlatformId;
  filters: DataFilter[];
  catalog: Catalog;
}) {
  const [draft, setDraft] = useState<DraftFilter[]>(props.filters);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      const res = await saveClientSourceFilters(props.clientId, props.accountId, completeFilters(draft).map((f) => ({ ...f, platform: props.platform })));
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      props.onOpenChange(false);
    });

  return (
    <Dialog
      open={props.open}
      onOpenChange={(o) => {
        if (o) setDraft(props.filters);
        props.onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Filter för {props.accountName}</DialogTitle>
          <DialogDescription>
            Gäller kundens alla dashboards, delade länkar och rapporter. Använd det när kontot delas med andra kunder, t.ex. bara kampanjer som innehåller kundens namn.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <FilterBuilder
            filters={draft.map((f) => ({ ...f, platform: props.platform }))}
            onChange={setDraft}
            platforms={[props.platform]}
            catalog={props.catalog}
            lockPlatform
            loadValues={(_p, dimension) => loadSourceFilterValues(props.accountId, dimension)}
            hint="Ett filterfält i taget (t.ex. kampanj). Flera villkor på samma fält måste alla stämma."
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Spara filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
