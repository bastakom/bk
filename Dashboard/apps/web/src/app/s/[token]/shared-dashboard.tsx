"use client";

import { emphasizedIds } from "@/lib/emphasis";
import { clientVars } from "@/lib/brand";

import { GRID_COLS, GRID_ROW_HEIGHT, t, widgetPageId, type DashboardPage, type Lang, type PlatformId } from "@rp/core";
import { LangProvider } from "@/components/lang-context";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import ReactGridLayout, { useContainerWidth, verticalCompactor, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AccountInfo, DashboardRange } from "@/lib/dashboard-data";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { brandScope } from "@/lib/brand";
import { initials } from "@/lib/format";
import { DateControls } from "@/app/(app)/clients/[clientSlug]/dashboards/[dashboardId]/date-controls";
import { EmphasisContext, WidgetCard } from "@/app/(app)/clients/[clientSlug]/dashboards/[dashboardId]/widget-card";
import { PageTabs } from "@/app/(app)/clients/[clientSlug]/dashboards/[dashboardId]/page-tabs";
import { useSearchParams } from "next/navigation";

interface Props {
  /** Adress till PDF-exporten (utan query). */
  pdfUrl: string;
  workspace: { name: string; logoUrl: string | null; brandColor: string; fontFamily: string };
  client: { name: string; primaryColor: string; logoUrl: string | null };
  dashboard: { id: string; name: string };
  range: DashboardRange;
  periodLabel: string;
  widgets: DashboardWidget[];
  pages: DashboardPage[];
  accounts: AccountInfo[];
  lastSynced: string | null;
  allowDateChange: boolean;
  allowPdf: boolean;
  lang: Lang;
}

/** Läsvy för kunder: samma widgets och data som i appen, utan redigering. */
export function SharedDashboard(allProps: Props) {
  // Sidor visas som flikar; bara den aktiva sidans widgets renderas.
  const [activePage, setActivePage] = useState(allProps.pages[0]!.id);
  const pageWidgets = useMemo(() => allProps.widgets.filter((w) => widgetPageId(w.config, allProps.pages) === activePage), [allProps.widgets, allProps.pages, activePage]);
  const props = { ...allProps, widgets: pageWidgets };
  const { width, containerRef, mounted } = useContainerWidth();
  const [needed, setNeeded] = useState<Record<string, number>>({});
  const onNeedRows = useCallback((id: string, rows: number) => setNeeded((n) => (n[id] === rows ? n : { ...n, [id]: rows })), []);
  // Inte "static": då kan widgets som växer med sitt innehåll knuffa ned de under i stället för att själva flyttas längst ned.
  const layout = useMemo<Layout>(() => props.widgets.map((w) => ({ i: w.id, ...w.layout, h: Math.max(w.layout.h, needed[w.id] ?? 0) })), [props.widgets, needed]);
  const platformsFor = (w: DashboardWidget) => [...new Set(props.accounts.filter((a) => w.accountIds.includes(a.id)).map((a) => a.platform))] as PlatformId[];
  const stacked = mounted && width < 720;
  const ordered = [...props.widgets].sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x);

  return (
    <LangProvider lang={props.lang} document>
    <div className="brand-scope min-h-svh" {...brandScope(props.workspace.brandColor, props.workspace.fontFamily)}>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            {props.client.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.client.logoUrl} alt={props.client.name} className="h-9 max-w-40 object-contain" />
            ) : (
              <span className="grid size-9 place-items-center rounded-lg text-xs font-semibold text-white" style={{ background: props.client.primaryColor }}>
                {initials(props.client.name)}
              </span>
            )}
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{props.dashboard.name}</h1>
              <p className="text-sm text-muted-foreground">{props.client.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {props.allowPdf && <PdfButton url={props.pdfUrl} lang={props.lang} />}
            {props.workspace.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.workspace.logoUrl} alt={props.workspace.name} className="h-7 max-w-36 object-contain opacity-80" />
            ) : (
              <span className="text-xs text-muted-foreground">{props.workspace.name}</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        {props.allowDateChange ? (
          <DateControls range={props.range} lastSynced={props.lastSynced} dashboardId={props.dashboard.id} canEdit={false} />
        ) : (
          <p className="rounded-xl border bg-card px-4 py-3 text-sm shadow-soft">
            {t(props.lang, "period")}: <span className="font-medium">{props.periodLabel}</span>
          </p>
        )}
        <PageTabs dashboardId={props.dashboard.id} pages={props.pages} active={activePage} onSelect={setActivePage} editing={false} counts={{}} />
        <EmphasisContext.Provider value={emphasizedIds(props.widgets)}>
        <div style={clientVars(props.client.primaryColor)} className="contents">
        <div ref={containerRef} className="mt-6">
          {stacked ? (
            <div className="space-y-4">
              {ordered.map((w) => (
                <div key={w.id} className="flex" style={{ minHeight: w.type === "section" ? undefined : Math.min(w.layout.h * GRID_ROW_HEIGHT, 520) }}>
                  <WidgetCard widget={w} platforms={platformsFor(w)} accounts={props.accounts} editing={false} onNeedRows={onNeedRows} />
                </div>
              ))}
            </div>
          ) : (
            mounted && (
              <ReactGridLayout
                width={width}
                layout={layout}
                gridConfig={{ cols: GRID_COLS, rowHeight: GRID_ROW_HEIGHT, margin: [16, 16], containerPadding: [0, 0] }}
                dragConfig={{ enabled: false }}
                resizeConfig={{ enabled: false }}
                compactor={verticalCompactor}
              >
                {props.widgets.map((w) => (
                  <div key={w.id} className="flex">
                    <WidgetCard widget={w} platforms={platformsFor(w)} accounts={props.accounts} editing={false} onNeedRows={onNeedRows} />
                  </div>
                ))}
              </ReactGridLayout>
            )
          )}
        </div>
        </div>
      </EmphasisContext.Provider>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          {props.lang === "en" ? `Shared by ${props.workspace.name}. Data updates automatically.` : `Rapporten delas av ${props.workspace.name}. Data uppdateras automatiskt.`}
        </p>
      </main>
    </div>
    </LangProvider>
  );
}

function PdfButton({ url: pdfUrl, lang }: { url: string; lang: Lang }) {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`${pdfUrl}?${new URLSearchParams(sp)}`);
          if (!res.ok) throw new Error(lang === "en" ? "The PDF could not be created." : "PDF:en kunde inte skapas.");
          const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "rapport.pdf";
          const url = URL.createObjectURL(await res.blob());
          Object.assign(document.createElement("a"), { href: url, download: name }).click();
          URL.revokeObjectURL(url);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : lang === "en" ? "The PDF could not be created." : "PDF:en kunde inte skapas.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />} PDF
    </Button>
  );
}
