"use client";

import { WIDGET_META } from "@rp/core";
import { Copy, Download, Filter, GripVertical, Info, Pencil, Table2, Trash2 } from "lucide-react";
import { createContext, useContext, useLayoutEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PlatformIcon } from "@/components/platform-icon";
import { Button } from "@/components/ui/button";
import { WidgetView } from "@/components/widgets/widget-view";
import type { AccountInfo } from "@/lib/dashboard-data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadCsv, widgetRows } from "@/lib/csv";
import { useLang } from "@/components/lang-context";
import { fixedPeriodText, WidgetFooter } from "@/components/widgets/widget-period";
import { cn } from "@/lib/utils";
import { GRID_ROW_HEIGHT, type PlatformId, type WidgetType } from "@rp/core";
import { deleteWidget, duplicateWidget } from "./actions";
import { toastDeleted } from "./undo";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { autoTitle } from "./widget-title";

/** Widgets vars innehåll har en naturlig höjd – de växer så att inget klipps. */
const GROWS: WidgetType[] = ["table", "ad_gallery", "text", "funnel", "kpi", "donut", "section"];
export const GRID_MARGIN = 16;
export const rowsFor = (px: number) => Math.ceil((px + GRID_MARGIN) / (GRID_ROW_HEIGHT + GRID_MARGIN));

/** KPI-kort som ska visas framhävda på aktuell sida (se emphasizedIds). */
export const EmphasisContext = createContext<Set<string>>(new Set());

export function WidgetCard({
  widget,
  platforms,
  accounts,
  editing,
  onEdit,
  onNeedRows,
  selected = false,
  onToggleSelect,
}: {
  widget: DashboardWidget;
  platforms: PlatformId[];
  accounts: AccountInfo[];
  editing: boolean;
  onEdit?: () => void;
  /** Markerad för massåtgärder (redigeringsläget) */
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  /** Rapporterar hur många rader innehållet behöver (vy-läge). */
  onNeedRows?: (id: string, rows: number) => void;
}) {
  const [asTable, setAsTable] = useState(false);
  const emphasis = useContext(EmphasisContext).has(widget.id) && !asTable;
  const iconKpi = widget.type === "kpi" && widget.config.kpiStyle === "icon" && widget.config.metrics.length === 1;
  const sectionRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const body = bodyRef.current;
    if (!section || !body || !onNeedRows || !GROWS.includes(widget.type)) return;
    const measure = () => {
      const chrome = section.offsetHeight - body.clientHeight;
      onNeedRows(widget.id, rowsFor(chrome + body.scrollHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(body);
    if (body.firstElementChild) ro.observe(body.firstElementChild);
    return () => ro.disconnect();
  }, [widget.id, widget.type, onNeedRows, asTable]);
  const [pending, start] = useTransition();
  const lang = useLang();
  const title = widget.title || autoTitle(widget.type, widget.config, (id) => widget.data?.meta[id]?.label, lang);
  const isSection = widget.type === "section";
  const sources = accounts.filter((a) => widget.accountIds.includes(a.id));
  const canTable = widget.type === "timeseries" || widget.type === "bar" || widget.type === "donut";
  const hasData = !WIDGET_META[widget.type].needsData || widget.data?.result;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
    });

  return (
    <section
      ref={sectionRef}
      aria-label={title || WIDGET_META[widget.type].label}
      onClickCapture={(e) => {
        // Shift- eller Cmd/Ctrl-klick markerar widgeten i redigeringsläget.
        if (!editing || !onToggleSelect || !(e.shiftKey || e.metaKey || e.ctrlKey)) return;
        e.preventDefault();
        e.stopPropagation();
        onToggleSelect(widget.id);
      }}
      className={cn(
        "@container group/widget relative flex min-w-0 flex-1 flex-col",
        isSection ? "px-1" : "rounded-xl border bg-card p-5 shadow-soft",
        emphasis && "widget-hero",
        editing && "ring-primary/40 hover:ring-2",
        editing && selected && "ring-2 ring-primary hover:ring-primary",
        editing && isSection && "rounded-xl border border-dashed",
        pending && "opacity-60",
      )}
    >
      {(!isSection || editing) && (
        <header className={cn("flex items-start gap-2", !isSection && "mb-3")}>
          {editing && onToggleSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(widget.id)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
              aria-label={`Markera ${title || WIDGET_META[widget.type].label}`}
            />
          )}
          {editing && (
            <span className="widget-drag-handle -ml-1 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-hidden title="Dra för att flytta">
              <GripVertical className="size-4" />
            </span>
          )}
          {/* KPI med ikon visar rubriken bredvid ikonen i stället. */}
          {!isSection && !iconKpi && (
            <div className="min-w-0 flex-1">
              <h3 lang="sv" className={cn("hyphens-auto", widget.type === "kpi" ? "text-[13px] font-semibold text-muted-foreground" : "text-[15px] font-bold text-heading")}>
                {title}
              </h3>
              {widget.config.description && <p className="mt-0.5 text-xs text-muted-foreground">{widget.config.description}</p>}
              {fixedPeriodText(widget.config, widget.data, lang) && <p className="tabular mt-0.5 text-xs text-muted-foreground">{fixedPeriodText(widget.config, widget.data, lang)}</p>}
            </div>
          )}
          {iconKpi && <span className="flex-1" />}
          {isSection && <span className="flex-1" />}
          {!isSection && sources.length > 0 && (
            <span className="flex shrink-0 gap-0.5">
              {[...new Set(sources.map((s) => s.platform))].map((p) => (
                <PlatformIcon key={p} platform={p} size="sm" />
              ))}
            </span>
          )}
          {!isSection && widget.data?.filters && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span role="img" className="grid size-5 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground" tabIndex={0} aria-label={`${lang === "en" ? "Filtered" : "Filtrerad"}: ${widget.data.filters.join("; ")}`}>
                  <Filter className="size-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-72">
                <p className="mb-1 font-medium">{lang === "en" ? "Filtered" : "Filtrerad"}</p>
                <ul className="space-y-0.5">
                  {widget.data.filters.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          )}
          {!isSection && !editing && widget.data && widgetRows(widget.data) && (
            <Button
              variant="ghost"
              size="icon"
              className="-my-1 size-7 opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100"
              aria-label={`Ladda ner ${title || WIDGET_META[widget.type].label} som CSV`}
              title="Ladda ner som CSV (Excel)"
              onClick={() => downloadCsv(widgetRows(widget.data!)!, title || WIDGET_META[widget.type].label)}
            >
              <Download className="size-3.5" />
            </Button>
          )}
          {canTable && !editing && (
            <Button
              variant="ghost"
              size="icon"
              className="-my-1 size-7 opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100"
              aria-pressed={asTable}
              aria-label={asTable ? "Visa diagram" : "Visa som tabell"}
              onClick={() => setAsTable((t) => !t)}
            >
              <Table2 className="size-3.5" />
            </Button>
          )}
          {editing && (
            <span className="-my-1 flex shrink-0 items-center">
              <Button variant="ghost" size="icon" className="size-7" aria-label="Redigera widget" onClick={onEdit}>
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" aria-label="Duplicera widget" onClick={() => run(() => duplicateWidget(widget.id))}>
                <Copy className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="Ta bort widget" onClick={() =>
                  start(async () => {
                    const res = await deleteWidget(widget.id);
                    if (res.ok) toastDeleted(res.message ?? "Widgeten är borttagen.", res.data);
                    else toast.error(res.error);
                  })
                }>
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          )}
        </header>
      )}

      <div ref={bodyRef} className={cn("min-h-0 flex-1", editing ? "overflow-auto" : "overflow-hidden")}>
        {hasData ? (
          <WidgetView type={widget.type} title={widget.title} displayTitle={title} config={widget.config} data={widget.data} platforms={platforms} asTable={asTable} emphasis={emphasis} />
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <p>{widget.data?.notices[0] ?? "Ingen data för perioden."}</p>
          </div>
        )}
      </div>

      {hasData && widget.data && widget.data.notices.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-warning">
          {widget.data.notices.map((n) => (
            <li key={n} className="flex items-start gap-1.5">
              <Info className="mt-px size-3.5 shrink-0" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}
      {hasData && <WidgetFooter data={widget.data} lang={lang} />}
    </section>
  );
}
