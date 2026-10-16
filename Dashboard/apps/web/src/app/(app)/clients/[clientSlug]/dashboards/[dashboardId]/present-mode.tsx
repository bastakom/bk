"use client";

import { GRID_COLS, GRID_ROW_HEIGHT, type DashboardPage, type PlatformId } from "@rp/core";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import { Button } from "@/components/ui/button";
import type { AccountInfo } from "@/lib/dashboard-data";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { initials } from "@/lib/format";
import { WidgetCard } from "./widget-card";

/** Presentationsläge: helskärm, en sida i taget. Piltangenter byter sida, Esc avslutar. */
export function PresentMode({
  pages,
  startPage,
  widgetsByPage,
  accounts,
  title,
  client,
  periodLabel,
  onClose,
}: {
  pages: DashboardPage[];
  startPage: string;
  widgetsByPage: Record<string, DashboardWidget[]>;
  accounts: AccountInfo[];
  title: string;
  client: { name: string; primaryColor: string; logoUrl: string | null };
  periodLabel: string;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(Math.max(0, pages.findIndex((p) => p.id === startPage)));
  const page = pages[index]!;
  const widgets = useMemo(() => widgetsByPage[page.id] ?? [], [widgetsByPage, page.id]);
  const { width, containerRef, mounted } = useContainerWidth();
  const [needed, setNeeded] = useState<Record<string, number>>({});
  const onNeedRows = useCallback((id: string, rows: number) => setNeeded((n) => (n[id] === rows ? n : { ...n, [id]: rows })), []);
  const layout = useMemo<Layout>(() => widgets.map((w) => ({ i: w.id, ...w.layout, h: Math.max(w.layout.h, needed[w.id] ?? 0), static: true })), [widgets, needed]);
  const platformsFor = (w: DashboardWidget) => [...new Set(accounts.filter((a) => w.accountIds.includes(a.id)).map((a) => a.platform))] as PlatformId[];

  const go = useCallback((d: number) => setIndex((i) => Math.min(pages.length - 1, Math.max(0, i + d))), [pages.length]);

  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === "Escape") onClose();
    };
    const onFs = () => !document.fullscreenElement && onClose();
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [go, onClose]);

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Presentation" className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-8 py-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logoUrl} alt={client.name} className="h-9 max-w-36 object-contain" />
          ) : (
            <span className="grid size-9 place-items-center rounded-lg text-xs font-semibold text-white" style={{ background: client.primaryColor }}>
              {initials(client.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-xl text-heading">
              {pages.length > 1 ? page.name : title}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {client.name} · {pages.length > 1 ? `${title} · ` : ""}
              {periodLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pages.length > 1 && (
            <>
              <Button variant="outline" size="icon" onClick={() => go(-1)} disabled={index === 0} aria-label="Föregående sida">
                <ChevronLeft />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
                {index + 1} / {pages.length}
              </span>
              <Button variant="outline" size="icon" onClick={() => go(1)} disabled={index === pages.length - 1} aria-label="Nästa sida">
                <ChevronRight />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Avsluta presentationen">
            <X />
          </Button>
        </div>
      </header>
      <div ref={containerRef} className="mx-auto max-w-[1600px] px-8 py-6">
        {widgets.length === 0 ? (
          <p className="py-24 text-center text-muted-foreground">Sidan är tom.</p>
        ) : (
          mounted && (
            <ReactGridLayout
              key={page.id}
              width={width}
              layout={layout}
              gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: [16, 16], containerPadding: [0, 0] }}
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
              compactor={verticalCompactor}
            >
              {widgets.map((w) => (
                <div key={w.id} className="flex">
                  <WidgetCard widget={w} platforms={platformsFor(w)} accounts={accounts} editing={false} onNeedRows={onNeedRows} />
                </div>
              ))}
            </ReactGridLayout>
          )
        )}
      </div>
    </div>
  );
}
