"use client";

import type { DashboardPage } from "@rp/core";
import { ArrowLeft, ArrowRight, Check, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addPage, deletePage, movePage, renamePage } from "./page-actions";

/** Flikar för dashboardens sidor. I redigeringsläget kan sidor skapas, döpas om, flyttas och tas bort. */
export function PageTabs({
  dashboardId,
  pages,
  active,
  onSelect,
  editing,
  counts,
}: {
  dashboardId: string;
  pages: DashboardPage[];
  active: string;
  onSelect: (id: string) => void;
  editing: boolean;
  /** Antal widgets per sida */
  counts: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string; data?: unknown }>, after?: (data: unknown) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (res.message) toast.success(res.message);
      after?.(res.data);
    });

  const submitName = () => {
    if (!naming?.name.trim()) return setNaming(null);
    const { id, name } = naming;
    run(() => (id ? renamePage(dashboardId, id, name) : addPage(dashboardId, name)), (newId) => {
      setNaming(null);
      if (!id && typeof newId === "string") onSelect(newId);
    });
  };

  if (pages.length <= 1 && !editing) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-1 border-b">
      {/* Bara flikarna i tablist; åtgärderna ligger bredvid (WAI-ARIA tabs). Piltangenter byter flik. */}
      <div
        role="tablist"
        aria-label="Sidor"
        className="flex flex-wrap items-center gap-1"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const idx = pages.findIndex((p) => p.id === active);
          const next = pages[(idx + (e.key === "ArrowRight" ? 1 : -1) + pages.length) % pages.length]!;
          onSelect(next.id);
          requestAnimationFrame(() => (e.currentTarget.querySelector(`[data-page="${next.id}"]`) as HTMLElement | null)?.focus());
        }}
      >
      {pages.map((p) =>
        naming?.id === p.id ? (
          <NameInput key={p.id} value={naming.name} onChange={(name) => setNaming({ id: p.id, name })} onSubmit={submitName} onCancel={() => setNaming(null)} />
        ) : (
          <div key={p.id} className="flex items-center">
            <button
              role="tab"
              data-page={p.id}
              tabIndex={p.id === active ? 0 : -1}
              aria-selected={p.id === active}
              onClick={() => onSelect(p.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                p.id === active ? "border-primary font-medium text-heading" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {p.name}
              {editing && <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{counts[p.id] ?? 0}</span>}
            </button>
          </div>
        ),
      )}
      </div>
      {editing &&
        pages
          .map((p, i) => ({ p, i }))
          .filter(({ p }) => p.id === active && naming?.id !== p.id)
          .map(({ p, i }) => (
            <div key={p.id}>
            {(
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Fler val för sidan ${p.name}`} disabled={pending}>
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setNaming({ id: p.id, name: p.name })}>
                      <Pencil /> Byt namn
                    </DropdownMenuItem>
                    {i > 0 && (
                      <DropdownMenuItem onClick={() => run(() => movePage(dashboardId, p.id, -1))}>
                        <ArrowLeft /> Flytta vänster
                      </DropdownMenuItem>
                    )}
                    {i < pages.length - 1 && (
                      <DropdownMenuItem onClick={() => run(() => movePage(dashboardId, p.id, 1))}>
                        <ArrowRight /> Flytta höger
                      </DropdownMenuItem>
                    )}
                    {pages.length > 1 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => {
                            if (!window.confirm(`Ta bort sidan "${p.name}"${counts[p.id] ? ` och dess ${counts[p.id]} widgets` : ""}?`)) return;
                            run(() => deletePage(dashboardId, p.id), () => onSelect(pages.find((x) => x.id !== p.id)!.id));
                          }}
                        >
                          <Trash2 /> Ta bort sidan
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              </div>
          ))}
      {editing &&
        (naming?.id === null ? (
          <NameInput value={naming.name} onChange={(name) => setNaming({ id: null, name })} onSubmit={submitName} onCancel={() => setNaming(null)} />
        ) : (
          <Button variant="ghost" size="sm" className="mb-1" onClick={() => setNaming({ id: null, name: "" })} disabled={pending}>
            <Plus /> Ny sida
          </Button>
        ))}
    </div>
  );
}

function NameInput({ value, onChange, onSubmit, onCancel }: { value: string; onChange: (v: string) => void; onSubmit: () => void; onCancel: () => void }) {
  return (
    <form
      className="mb-1 flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder="Sidans namn"
        aria-label="Sidans namn"
        className="h-8 w-40"
        maxLength={40}
      />
      <Button type="submit" variant="ghost" size="icon" className="size-8" aria-label="Spara namn">
        <Check className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onCancel} aria-label="Avbryt">
        <X className="size-3.5" />
      </Button>
    </form>
  );
}
