"use client";

import { PLATFORMS, type PlatformId } from "@rp/core";
import { Copy, Database, FileStack, Filter, Loader2, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeFilters, FilterBuilder, type DraftFilter } from "@/components/filter-builder";
import { PlatformIcon } from "@/components/platform-icon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Catalog } from "@/lib/availability";
import type { AccountInfo } from "@/lib/dashboard-data";
import { loadFilterValues } from "./actions";
import { bulkAddFilters, bulkDelete, bulkDuplicate, bulkSetSources } from "./bulk-actions";
import { toastDeleted } from "./undo";
import { moveWidgetsToPage } from "./page-actions";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Dialogs = "sources" | "filter" | "delete" | null;

/** Åtgärder för flera markerade widgets (redigeringsläget). */
export function SelectionBar({
  dashboardId,
  selected,
  total,
  dataSelected,
  accounts,
  catalog,
  initialSources,
  onSelectAll,
  onClear,
  pages = [],
}: {
  dashboardId: string;
  selected: string[];
  total: number;
  /** Antal markerade widgets som visar data (text och sektioner har inga källor) */
  dataSelected: number;
  accounts: AccountInfo[];
  catalog: Catalog;
  /** Källor som alla markerade widgets redan har gemensamt */
  initialSources: string[];
  onSelectAll: () => void;
  onClear: () => void;
  /** Andra sidor att flytta till */
  pages?: { id: string; name: string }[];
}) {
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [sources, setSources] = useState<string[]>(initialSources);
  const [filters, setFilters] = useState<DraftFilter[]>([]);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>, done?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message ?? "Klart");
      setDialog(null);
      done?.();
    });

  const platforms = [...new Set(accounts.map((a) => a.platform))] as PlatformId[];

  return (
    <>
      <div
        role="toolbar"
        aria-label="Åtgärder för markerade widgets"
        className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-xl border bg-popover p-1.5 shadow-lg"
      >
        <span className="px-2 text-sm font-medium tabular-nums">{selected.length} markerade</span>
        {selected.length < total && (
          <Button variant="ghost" size="sm" onClick={onSelectAll}>
            Markera alla
          </Button>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          variant="ghost"
          size="sm"
          disabled={!dataSelected || pending}
          onClick={() => {
            setSources(initialSources);
            setDialog("sources");
          }}
        >
          <Database /> Källor
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!dataSelected || pending}
          onClick={() => {
            setFilters([]);
            setDialog("filter");
          }}
        >
          <Filter /> Filter
        </Button>
        {pages.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={pending}>
                <FileStack /> Flytta till sida
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top">
              {pages.map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => run(() => moveWidgetsToPage(dashboardId, selected, p.id), onClear)}>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => bulkDuplicate(dashboardId, selected), onClear)}>
          {pending ? <Loader2 className="animate-spin" /> : <Copy />} Duplicera
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setDialog("delete")}>
          <Trash2 /> Ta bort
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClear} aria-label="Avmarkera alla">
          <X />
        </Button>
      </div>

      <Dialog open={dialog === "sources"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Källor för {dataSelected} widgets</DialogTitle>
            <DialogDescription>Ersätter källorna på de markerade widgetarna. Text och sektionsrubriker påverkas inte.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border">
            {accounts.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={sources.includes(a.id)}
                    onChange={(e) => setSources((s) => (e.target.checked ? [...s, a.id] : s.filter((x) => x !== a.id)))}
                    aria-label={`${a.name} (${PLATFORMS[a.platform].label})`}
                  />
                  <PlatformIcon platform={a.platform} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                </label>
              </li>
            ))}
            {accounts.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Kunden har inga källor än.</li>}
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Avbryt
            </Button>
            <Button disabled={pending || sources.length === 0} onClick={() => run(() => bulkSetSources(dashboardId, selected, sources))}>
              {pending && <Loader2 className="animate-spin" />} Använd på {dataSelected} widgets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "filter"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Filter för {dataSelected} widgets</DialogTitle>
            <DialogDescription>Läggs till utöver widgetarnas egna filter.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <FilterBuilder
              filters={filters}
              onChange={setFilters}
              platforms={platforms}
              catalog={catalog}
              loadValues={(platform, dimension) => loadFilterValues(dashboardId, platform, dimension)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Avbryt
            </Button>
            <Button disabled={pending || completeFilters(filters).length === 0} onClick={() => run(() => bulkAddFilters(dashboardId, selected, completeFilters(filters)))}>
              {pending && <Loader2 className="animate-spin" />} Lägg till på {dataSelected} widgets
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort {selected.length} widgets?</AlertDialogTitle>
            <AlertDialogDescription>Widgetarna tas bort från dashboarden. Datan i källorna påverkas inte.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() =>
                start(async () => {
                  const res = await bulkDelete(dashboardId, selected);
                  if (!res.ok) return void toast.error(res.error);
                  toastDeleted(res.message ?? "Widgets är borttagna.", res.data);
                  setDialog(null);
                  onClear();
                })
              }>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
