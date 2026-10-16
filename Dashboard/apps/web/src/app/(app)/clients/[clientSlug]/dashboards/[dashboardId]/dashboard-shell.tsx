"use client";

import { emphasizedIds } from "@/lib/emphasis";
import { clientVars } from "@/lib/brand";

import { dashboardPages, formatRange, GRID_COLS, GRID_ROW_HEIGHT, widgetPageId, WIDGET_META, type PlatformId } from "@rp/core";
import { AlertTriangle, Check, ChevronDown, Clock, Database, Download, Link2, Mail, MonitorPlay, Pencil, Plus, Share, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SaveStatus, type SaveState } from "@/components/ui/save-status";
import { initials } from "@/lib/format";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveLayout } from "./actions";
import { DashboardMenu } from "./dashboard-menu";
import { DashboardFilters } from "./dashboard-filters";
import { DateControls } from "./date-controls";
import { ExportDialog } from "./export-dialog";
import { ScheduleDialog, type ScheduleRow } from "./schedule-dialog";
import { ShareDialog, type ShareRowView } from "./share-dialog";
import type { DashboardWidget, LoadedDashboard } from "@/lib/load-dashboard";
import { EmphasisContext, WidgetCard } from "./widget-card";
import { WidgetEditor } from "./widget-editor";
import { defaultReportSources, ReportSources, reportSourceGroups } from "./report-sources";
import { SelectionBar } from "./selection-bar";
import { InsightPanel } from "./insight-panel";
import { PageTabs } from "./page-tabs";
import { PresentMode } from "./present-mode";
import { undoDelete } from "./undo";
import { hideMissingSources, missingByPlatform } from "@/lib/missing-sources";
import { EventsButton } from "./events-dialog";

type Props = LoadedDashboard & { canEdit: boolean; portalUsers: number; otherClients: { id: string; name: string; slug: string }[]; schedules: ScheduleRow[]; shareLinks: ShareRowView[] };

export function DashboardShell(props: Props) {
  const { dashboard, client, widgets: allWidgets, accounts, canEdit } = props;
  // Sidor: aktiv sida i URL:en (?page=), så att länkar och omladdning behåller den.
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pages = useMemo(() => dashboardPages(dashboard.settings), [dashboard.settings]);
  const activePage = pages.some((p) => p.id === sp.get("page")) ? sp.get("page")! : pages[0]!.id;
  const [editing, setEditingState] = useState(false);
  // Utanför redigeringsläget döljs widgets utan källa (t.ex. LinkedIn-delen av en mall när kunden saknar LinkedIn).
  const { visible: shownWidgets, hidden: hiddenWidgets } = useMemo(
    () => (editing ? { visible: allWidgets, hidden: [] as DashboardWidget[] } : hideMissingSources(allWidgets)),
    [allWidgets, editing],
  );
  const widgetsByPage = useMemo(() => {
    const out: Record<string, DashboardWidget[]> = {};
    for (const w of shownWidgets) (out[widgetPageId(w.config, pages)] ??= []).push(w);
    return out;
  }, [shownWidgets, pages]);
  const widgets = useMemo(() => widgetsByPage[activePage] ?? [], [widgetsByPage, activePage]);
  const [presenting, setPresenting] = useState(false);
  const selectPage = (id: string) => {
    const next = new URLSearchParams(sp);
    if (id === pages[0]!.id) next.delete("page");
    else next.set("page", id);
    setSelected([]);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const [selected, setSelected] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const setEditing = (fn: (e: boolean) => boolean) =>
    setEditingState((e) => {
      const next = fn(e);
      if (!next) setSelected([]);
      return next;
    });
  // ⌘Z / Ctrl+Z ångrar senaste borttagningen (inte när man skriver i ett fält).
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || !(e.metaKey || e.ctrlKey) || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      void undoDelete().then((did) => did && e.preventDefault());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit]);
  // Markera med kryssruta, eller Shift/Cmd-klick på kortet.
  const toggleSelect = useCallback((id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);
  const settingsSources = useMemo(() => dashboard.settings.sources ?? [], [dashboard.settings.sources]);
  const reportDefaults = useMemo(() => defaultReportSources(reportSourceGroups(allWidgets, accounts, settingsSources)), [allWidgets, accounts, settingsSources]);
  const selectedData = widgets.filter((w) => selected.includes(w.id) && WIDGET_META[w.type].needsData);
  const commonSources = selectedData.length ? selectedData.map((w) => w.accountIds).reduce((a, b) => a.filter((x) => b.includes(x))) : [];
  const [editor, setEditor] = useState<{ widget: DashboardWidget | null } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [shareOpen, setShareOpen] = useState(false);
  const { width, containerRef, mounted } = useContainerWidth();
  const platformsById = useMemo(() => new Map(accounts.map((a) => [a.id, a.platform])), [accounts]);
  const platformsFor = useCallback(
    (w: DashboardWidget) => [...new Set(w.accountIds.map((id) => platformsById.get(id)).filter(Boolean))] as PlatformId[],
    [platformsById],
  );

  const serverLayout = useMemo<Layout>(
    () => widgets.map((w) => ({ i: w.id, ...w.layout, minW: 2, minH: 2 })),
    [widgets],
  );
  // Lokal layout under redigering; nollställs när servern skickar ny layout.
  const [local, setLocal] = useState<{ src: Layout; layout: Layout }>({ src: serverLayout, layout: serverLayout });
  const layout = local.src === serverLayout ? local.layout : serverLayout;
  const setLayout = (next: Layout) => setLocal({ src: serverLayout, layout: next });

  // I vy-läge växer widgets till sitt innehåll så att inget klipps (sparas inte).
  const [needed, setNeeded] = useState<Record<string, number>>({});
  const onNeedRows = useCallback((id: string, rows: number) => setNeeded((n) => (n[id] === rows ? n : { ...n, [id]: rows })), []);
  const viewLayout = useMemo<Layout>(() => serverLayout.map((l) => ({ ...l, h: Math.max(l.h, needed[l.i] ?? 0) })), [serverLayout, needed]);

  // Spara layout med fördröjning efter drag/resize.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLayoutChange = (next: Layout) => {
    if (!editing) return;
    setLayout(next);
    const changed = next.some((n) => {
      const w = widgets.find((x) => x.id === n.i);
      return w && (w.layout.x !== n.x || w.layout.y !== n.y || w.layout.w !== n.w || w.layout.h !== n.h);
    });
    if (!changed) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      const res = await saveLayout(dashboard.id, next.map((n) => ({ id: n.i, x: n.x, y: n.y, w: n.w, h: n.h })));
      setSaveState(res.ok ? "saved" : "error");
      if (!res.ok) toast.error(res.error);
    }, 600);
  };

  const stacked = mounted && width < 720;
  const ordered = [...widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          {client.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={client.logoUrl} alt="" className="size-14 shrink-0 rounded-2xl bg-card object-contain p-2 shadow-soft ring-1 ring-border" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white" style={{ background: client.primaryColor }} aria-hidden>
              {initials(client.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">{client.name}</p>
            <h1 className="mt-0.5 truncate text-[34px] leading-tight font-extrabold tracking-[-0.035em] text-heading">{dashboard.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Intern AI-analys: finns bara i appen, aldrig på delade länkar, i PDF eller utskick. */}
          {!editing && (
            <Button variant="ghost" size="lg" onClick={() => setInsightsOpen(true)}>
              <Sparkles className="text-highlight" /> AI-analys
            </Button>
          )}
          {canEdit && editing && (
            <>
              <Button variant="outline" size="lg" onClick={() => setSourcesOpen(true)}>
                <Database /> Rapportens källor
              </Button>
              <Button variant="outline" size="lg" onClick={() => setEditor({ widget: null })}>
                <Plus /> Lägg till widget
              </Button>
            </>
          )}
          {canEdit && (
            <Button variant={editing ? "default" : "outline"} size="lg" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
              {editing ? <Check /> : <Pencil />}
              {editing ? "Klar" : "Redigera"}
            </Button>
          )}
          {!editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg">
                  <Share /> Dela och exportera <ChevronDown className="opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {canEdit && (
                  <DropdownMenuItem onClick={() => setShareOpen(true)}>
                    <Link2 /> Dela länk med kunden
                    {props.shareLinks.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{props.shareLinks.length}</span>}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setExportOpen(true)}>
                  <Download /> Exportera PDF
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => setScheduleOpen(true)}>
                    <Mail /> Schemalägg utskick
                    {props.schedules.filter((s) => s.active).length > 0 && <span className="ml-auto text-xs text-muted-foreground">{props.schedules.filter((s) => s.active).length}</span>}
                  </DropdownMenuItem>
                )}
                {allWidgets.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPresenting(true)}>
                      <MonitorPlay /> Presentera i helskärm
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canEdit && (
            <DashboardMenu
              dashboard={dashboard}
              clientSlug={client.slug}
              otherClients={props.otherClients}
              range={props.range}
            />
          )}
        </div>
      </header>
      <ExportDialog dashboardId={dashboard.id} periodLabel={formatRange(props.range.range)} open={exportOpen} onOpenChange={setExportOpen} />

      <DateControls
        range={props.range}
        lastSynced={props.lastSynced}
        dashboardId={dashboard.id}
        canEdit={canEdit}
        status={editing && saveState !== "idle" ? <SaveStatus state={saveState} className="mr-2" /> : null}
        filters={
          <>
          <EventsButton clientId={client.id} annotations={props.annotations} defaultDate={props.range.range.end} canEdit={canEdit} />
          <DashboardFilters
            key={JSON.stringify(dashboard.settings.filters ?? [])}
            dashboardId={dashboard.id}
            filters={dashboard.settings.filters ?? []}
            platforms={[...new Set(accounts.map((a) => a.platform))]}
            catalog={props.catalog}
            canEdit={canEdit}
          />
          </>
        }
      />

      {props.brokenSources.length > 0 && (
        <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Data kan vara inaktuell: {props.brokenSources.join(", ")} har tappat behörighet eller fått synkfel.{" "}
            <Link href={`/clients/${client.slug}`} className="font-medium underline underline-offset-2">
              Åtgärda under kundens konton
            </Link>
          </p>
        </div>
      )}

      {hiddenWidgets.length > 0 && (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm">
          <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1">
            {hiddenWidgets.length} {hiddenWidgets.length === 1 ? "widget visas inte" : "widgets visas inte"} eftersom kunden saknar källa för{" "}
            {missingByPlatform(hiddenWidgets)
              .map((m) => `${m.label} (${m.count})`)
              .join(", ")}
            . De döljs även för kunden.
          </p>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setSourcesOpen(true)}>
              Välj källor
            </Button>
          )}
        </div>
      )}

      {props.timezoneNotes.length > 0 && (
        <p className="mt-3 flex items-start gap-2 px-1 text-xs text-muted-foreground">
          <Clock className="mt-px size-3.5 shrink-0" />
          Dagsgränser följer respektive kontos tidszon: {props.timezoneNotes.join(", ")}. Övriga källor rapporterar i {props.clientTimezone}.
        </p>
      )}

      <PageTabs
        dashboardId={dashboard.id}
        pages={pages}
        active={activePage}
        onSelect={selectPage}
        editing={canEdit && editing}
        counts={Object.fromEntries(pages.map((p) => [p.id, widgetsByPage[p.id]?.length ?? 0]))}
      />

      <EmphasisContext.Provider value={emphasizedIds(widgets)}>
        <div style={clientVars(client.primaryColor)} className="contents">
        <div ref={containerRef} className="mt-6">
        {widgets.length === 0 ? (
          <EmptyDashboard canEdit={canEdit} onAdd={() => (setEditing(() => true), setEditor({ widget: null }))} />
        ) : stacked ? (
          <div className="space-y-4">
            {ordered.map((w) => (
              <div key={w.id} style={{ minHeight: w.type === "section" ? undefined : Math.min(w.layout.h * GRID_ROW_HEIGHT, 520) }} className="flex">
                <WidgetCard widget={w} platforms={platformsFor(w)} accounts={accounts} editing={false} onNeedRows={onNeedRows} />
              </div>
            ))}
          </div>
        ) : (
          mounted && (
            <ReactGridLayout
              width={width}
              layout={editing ? layout : viewLayout}
              gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: [16, 16], containerPadding: [0, 0] }}
              dragConfig={{ enabled: editing, handle: ".widget-drag-handle", cancel: "button, a, input" }}
              resizeConfig={{ enabled: editing, handles: ["se"] }}
              compactor={verticalCompactor}
              onLayoutChange={onLayoutChange}
              className={editing ? "rgl-editing" : undefined}
            >
              {widgets.map((w) => (
                <div key={w.id} className="flex">
                  <WidgetCard
                    widget={w}
                    platforms={platformsFor(w)}
                    accounts={accounts}
                    editing={editing}
                    onEdit={() => setEditor({ widget: w })}
                    onNeedRows={editing ? undefined : onNeedRows}
                    selected={selected.includes(w.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </ReactGridLayout>
          )
        )}
      </div>
        </div>
      </EmphasisContext.Provider>

      {canEdit && (
        <ScheduleDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          dashboardId={dashboard.id}
          defaultSubject={`${client.name} – ${dashboard.name}`}
          schedules={props.schedules}
          timezone={props.clientTimezone}
        />
      )}

      {canEdit && (
        <ReportSources
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          dashboardId={dashboard.id}
          clientSlug={client.slug}
          widgets={allWidgets}
          accounts={accounts}
          settingsSources={settingsSources}
        />
      )}

      {presenting && (
        <PresentMode
          pages={pages.filter((p) => (widgetsByPage[p.id]?.length ?? 0) > 0)}
          startPage={activePage}
          widgetsByPage={widgetsByPage}
          accounts={accounts}
          title={dashboard.name}
          client={client}
          periodLabel={formatRange(props.range.range)}
          onClose={() => setPresenting(false)}
        />
      )}

      <InsightPanel
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        dashboardId={dashboard.id}
        clientSlug={client.slug}
        canEdit={canEdit}
        periodLabel={formatRange(props.range.range)}
        hasBrief={client.hasBrief}
      />

      {canEdit && editing && selected.length > 0 && (
        <SelectionBar
          key={selected.join(",")}
          dashboardId={dashboard.id}
          selected={selected}
          total={widgets.length}
          dataSelected={selectedData.length}
          accounts={accounts}
          catalog={props.catalog}
          initialSources={commonSources}
          onSelectAll={() => setSelected(widgets.map((w) => w.id))}
          onClear={() => setSelected([])}
          pages={pages.filter((p) => p.id !== activePage)}
        />
      )}

      {canEdit && <ShareDialog open={shareOpen} onOpenChange={setShareOpen} dashboardId={dashboard.id} links={props.shareLinks} inPortal={dashboard.inPortal} portalUsers={props.portalUsers} />}

      {editor && (
        <WidgetEditor
          open
          onOpenChange={(o) => !o && setEditor(null)}
          dashboardId={dashboard.id}
          widget={editor.widget}
          accounts={accounts}
          catalog={props.catalog}
          customMetrics={props.customMetrics}
          clientCurrency={client.currency}
          reportSources={reportDefaults}
          goals={props.goals}
          clientSlug={client.slug}
          pageId={activePage}
        />
      )}
    </div>
  );
}

function EmptyDashboard({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/50 px-6 py-20 text-center">
      <p className="font-medium">Dashboarden är tom</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">Lägg till KPI-kort, grafer, tabeller och annonser. Du väljer källor och metrics utan att skriva kod.</p>
      {canEdit && (
        <Button className="mt-5" onClick={onAdd}>
          <Plus /> Lägg till första widgeten
        </Button>
      )}
    </div>
  );
}

