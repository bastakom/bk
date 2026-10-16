"use client";

import { GRID_ROW_HEIGHT, PLATFORMS, WIDGET_META, type PlatformId, t, type Lang } from "@rp/core";
import { Info } from "lucide-react";
import { useEffect } from "react";
import { PlatformIcon } from "@/components/platform-icon";
import { WidgetView } from "@/components/widgets/widget-view";
import { clientVars } from "@/lib/brand";
import type { AccountInfo } from "@/lib/dashboard-data";
import type { DashboardWidget } from "@/lib/load-dashboard";
import { fontVar } from "@/lib/brand";
import { LangProvider, useLang } from "@/components/lang-context";
import { fixedPeriodText, WidgetFooter } from "@/components/widgets/widget-period";
import { PAGE_HEADING_PREFIX } from "@/lib/pages";
import { initials } from "@/lib/format";
import { toBands } from "@/lib/print-layout";
import { autoTitle } from "@/app/(app)/clients/[clientSlug]/dashboards/[dashboardId]/widget-title";

/** Innehållsbredd i CSS-pixlar. A4-sidan skalas ned till denna bredd av Playwright. */
export const PRINT_WIDTH = { paged: 880, long: 1200 } as const;
const GAP = 16;

/** Osynlig markör som PDF-renderaren letar efter för att hitta sektionernas sidnummer. */
export const sectionMarker = (i: number) => `@@S${i}@@`;

interface Props {
  part: "cover" | "content";
  layout: "paged" | "long";
  toc: { title: string; page: number }[];
  workspace: { name: string; logoUrl: string | null; brandColor: string; fontFamily: string };
  client: { name: string; currency: string; primaryColor: string; accentColor: string; logoUrl: string | null };
  dashboard: { id: string; name: string };
  period: string;
  comparePeriod: string | null;
  widgets: DashboardWidget[];
  /** KPI-kort som visas framhävda (se emphasizedIds). */
  emphasized?: string[];
  accounts: AccountInfo[];
  generatedAt: string;
  /** Osynliga sektionsmarkörer (bara i mätpasset, aldrig i den slutliga PDF:en). */
  markers: boolean;
  /** Kundens språk */
  lang: Lang;
}

declare global {
  interface Window {
    __printReady?: boolean;
    __printMeta?: { sections: string[]; footer: string; lang?: string };
  }
}

export function PrintDocument(props: Props) {
  const sections = [...props.widgets]
    .sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
    .filter((w) => w.type === "section")
    .map((w) => w.title || (w.config.platform ? PLATFORMS[w.config.platform as PlatformId]?.label : "Sektion") || "Sektion");

  // Signalera till Playwright när typsnitt och diagram har ritats.
  useEffect(() => {
    let cancelled = false;
    window.__printMeta = { sections, footer: `${props.client.name} · ${props.dashboard.name} · ${props.period}`, lang: props.lang };
    document.fonts.ready.then(() =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!cancelled) window.__printReady = true;
        }),
      ),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LangProvider lang={props.lang} document>
    <div
      className="print-root bg-white text-[#1c1b19]"
      style={{ width: props.part === "cover" ? "210mm" : PRINT_WIDTH[props.layout], fontFamily: `${fontVar(props.workspace.fontFamily)}, ui-sans-serif, system-ui, sans-serif` }}
    >
      <style>{PRINT_CSS}</style>
      {props.part === "cover" ? (
        <>
          <Cover {...props} />
          {props.toc.length > 1 && <Toc {...props} />}
        </>
      ) : (
        <>
          {props.layout === "long" && <Hero {...props} />}
          <Content {...props} />
        </>
      )}
    </div>
    </LangProvider>
  );
}

const PRINT_CSS = `
  html, body { background: #fff !important; }
  .print-band { break-inside: avoid; }
  .print-band[data-split] { break-inside: auto; }
  .print-band[data-section] { break-after: avoid; }
  .print-band[data-page-break] { break-before: page; }
  .print-widget { break-inside: avoid; }
  .print-widget[data-split] { break-inside: auto; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .print-widget tr, .print-widget li { break-inside: avoid; }
  .print-widget thead { display: table-header-group; }
  .print-page { width: 210mm; height: 297mm; overflow: hidden; break-after: page; position: relative; }
  .print-page:last-child { break-after: auto; }
  .print-marker { font-size: 2px; line-height: 0; color: #fff; }
`;

function ClientMark({ client, size }: { client: Props["client"]; size: number }) {
  if (client.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={client.logoUrl} alt={client.name} style={{ height: size }} className="object-contain" />;
  }
  return (
    <span className="grid place-items-center rounded-2xl font-semibold text-white" style={{ background: client.primaryColor, width: size, height: size, fontSize: size * 0.36 }}>
      {initials(client.name)}
    </span>
  );
}

function usedPlatforms(props: Props) {
  const ids = new Set(props.widgets.flatMap((w) => w.accountIds));
  return [...new Set(props.accounts.filter((a) => ids.has(a.id)).map((a) => a.platform))];
}

const dateFmt = { sv: new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" }), en: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }) };

/** Omslag (A4, egen sida). */
function Cover(props: Props) {
  const { client, workspace } = props;
  return (
    <section className="print-page flex flex-col">
      <div className="relative h-[118mm] overflow-hidden px-[18mm] pt-[18mm] text-white" style={{ background: client.primaryColor }}>
        <div
          className="absolute -top-24 -right-24 size-[130mm] rounded-full opacity-25"
          style={{ background: `radial-gradient(circle, ${client.accentColor} 0%, transparent 70%)` }}
        />
        {workspace.logoUrl ? (
          <span className="relative inline-flex rounded-lg bg-white/95 px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={workspace.logoUrl} alt={workspace.name} className="h-7 max-w-44 object-contain" />
          </span>
        ) : (
          <p className="relative text-sm font-medium tracking-wide uppercase opacity-80">{workspace.name}</p>
        )}
        <div className="relative mt-[38mm]">
          <p className="text-lg opacity-85">{client.name}</p>
          <h1 className="mt-2 text-[52px] leading-[1.08] font-normal">{props.dashboard.name}</h1>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-[18mm] pt-[14mm]">
        <dl className="grid grid-cols-2 gap-x-10 gap-y-6">
          <div>
            <dt className="text-xs font-medium tracking-[0.12em] text-[#5e6b7e] uppercase">{t(props.lang, "period")}</dt>
            <dd className="mt-1 text-xl font-bold text-heading">{props.period}</dd>
          </div>
          {props.comparePeriod && (
            <div>
              <dt className="text-xs font-medium tracking-[0.12em] text-[#5e6b7e] uppercase">{t(props.lang, "comparedWith")}</dt>
              <dd className="mt-1 text-xl">{props.comparePeriod}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium tracking-[0.12em] text-[#5e6b7e] uppercase">{t(props.lang, "sources")}</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {usedPlatforms(props).map((p) => (
                <span key={p} className="flex items-center gap-1.5 text-sm">
                  <PlatformIcon platform={p} size="sm" /> {PLATFORMS[p].label}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-[0.12em] text-[#5e6b7e] uppercase">{t(props.lang, "created")}</dt>
            <dd className="mt-1 text-sm">{dateFmt[props.lang].format(new Date(props.generatedAt))}</dd>
          </div>
        </dl>
        <div className="mt-auto flex items-end justify-between pb-[16mm]">
          <ClientMark client={client} size={64} />
          <p className="text-right text-xs text-[#5e6b7e]">
            {t(props.lang, "reportBasis")}
            <br />
            {t(props.lang, "amountsIn")} {client.currency}, {t(props.lang, "ratiosFromSums")}
          </p>
        </div>
      </div>
    </section>
  );
}

/** Innehållsförteckning (egen sida). Sidnumren matchar sidfoten i innehållet. */
function Toc(props: Props) {
  return (
    <section className="print-page px-[18mm] pt-[22mm]">
      <h2 className="text-3xl font-bold tracking-tight text-heading">{t(props.lang, "contents")}</h2>
      <ol className="mt-8 space-y-3">
        {props.toc.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3 text-base">
            <span className="tabular w-6 text-[#5e6b7e]">{i + 1}.</span>
            <span>{e.title}</span>
            <span className="flex-1 border-b border-dotted border-[#d9cfcb]" />
            <span className="tabular font-medium">{e.page}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Omslag överst i lång-sida-läget. */
function Hero(props: Props) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-2xl px-10 py-10 text-white" style={{ background: props.client.primaryColor }}>
      <div className="absolute -top-20 -right-16 size-80 rounded-full opacity-25" style={{ background: `radial-gradient(circle, ${props.client.accentColor} 0%, transparent 70%)` }} />
      <div className="relative flex items-end justify-between gap-8">
        <div>
          <p className="text-sm tracking-wide uppercase opacity-80">
            {props.workspace.name} · {props.client.name}
          </p>
          <h1 className="mt-2 text-4xl font-normal">{props.dashboard.name}</h1>
          <p className="mt-3 text-lg opacity-90">
            {props.period}
            {props.comparePeriod && <span className="opacity-75"> · {t(props.lang, "vsPeriod")} {props.comparePeriod}</span>}
          </p>
        </div>
        <div className="flex gap-1.5 rounded-xl bg-white/95 p-2">
          {usedPlatforms(props).map((p) => (
            <PlatformIcon key={p} platform={p} />
          ))}
        </div>
      </div>
    </header>
  );
}

function Content(props: Props) {
  const bands = toBands(props.widgets);
  let sectionIndex = 0;
  let pageHeadings = 0;
  return (
    <main className="flex flex-col" style={{ gap: GAP }}>
      {bands.map((band, b) => {
        const isSection = band.items.length === 1 && band.items[0]!.item.type === "section";
        // Fullbreda band blir vanliga block: Chrome delar nästlade grids över sidor opålitligt.
        const single = band.items.length === 1 && band.items[0]!.span === 12 ? band.items[0]! : null;
        if (single) {
          const index = single.item.type === "section" ? sectionIndex++ : -1;
          // Dashboardens sidor börjar på ny PDF-sida (utom den första).
          const pageBreak = props.layout === "paged" && single.item.id.startsWith(PAGE_HEADING_PREFIX) && pageHeadings++ > 0;
          return (
            <div key={b} className="print-band" data-section={isSection ? "" : undefined} data-page-break={pageBreak ? "" : undefined} data-split={single.item.type === "table" || single.item.type === "ad_gallery" ? "" : undefined}>
              <PrintWidget widget={single.item} accounts={props.accounts} emphasis={props.emphasized?.includes(single.item.id)} clientColor={props.client.primaryColor} marker={index >= 0 && props.markers ? sectionMarker(index) : undefined} />
            </div>
          );
        }
        return (
          <div
            key={b}
            className="print-band grid"
            data-section={isSection ? "" : undefined}
            /* I utskrift tar raderna bara den plats innehållet behöver (diagram har egen höjd). */
            style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: "minmax(0, auto)", gap: GAP }}
          >
            {band.items.map(({ item: w, col, span, row, rowSpan }) => {
              const index = w.type === "section" ? sectionIndex++ : -1;
              return (
                <div key={w.id} className="flex min-w-0" style={{ gridColumn: `${col} / span ${span}`, gridRow: `${row} / span ${rowSpan}` }}>
                  <PrintWidget widget={w} accounts={props.accounts} emphasis={props.emphasized?.includes(w.id)} clientColor={props.client.primaryColor} marker={index >= 0 && props.markers ? sectionMarker(index) : undefined} />
                </div>
              );
            })}
          </div>
        );
      })}
    </main>
  );
}

function PrintWidget({ widget: w, accounts, marker, emphasis = false, clientColor }: { widget: DashboardWidget; accounts: AccountInfo[]; marker?: string; emphasis?: boolean; clientColor?: string }) {
  const lang = useLang();
  const platforms = [...new Set(accounts.filter((a) => w.accountIds.includes(a.id)).map((a) => a.platform))];
  const title = w.title || autoTitle(w.type, w.config, (id) => w.data?.meta[id]?.label, lang);
  const hasData = !WIDGET_META[w.type].needsData || w.data?.result;
  // Diagram behöver en bestämd höjd; tabeller, gallerier och text växer med innehållet.
  const fixedHeight = w.type === "timeseries" || w.type === "bar" || w.type === "donut" ? w.layout.h * (GRID_ROW_HEIGHT + GAP) - GAP : undefined;
  const splittable = w.type === "table" || w.type === "ad_gallery";
  const iconKpi = w.type === "kpi" && w.config.kpiStyle === "icon" && w.config.metrics.length === 1;

  if (w.type === "section") {
    return (
      <div className="flex flex-1 items-end pt-4">
        <WidgetView type={w.type} title={w.title} config={w.config} data={w.data} platforms={platforms} mode="light" print />
        {marker && <span className="print-marker">{marker}</span>}
      </div>
    );
  }

  return (
    <section
      // Delbara widgets (tabell, galleri) är vanliga block – flex-kolumner med min-h-0 får fel höjd när Chrome delar dem över sidor.
      className={`print-widget @container rounded-xl border border-[#e7e6e2] bg-white p-4 ${splittable ? "block w-full" : "flex flex-1 flex-col"} ${emphasis ? "widget-hero" : ""}`}
      data-split={splittable ? "" : undefined}
      style={{ minHeight: fixedHeight, ...(emphasis && clientColor ? clientVars(clientColor) : {}) }}
    >
      <header className="mb-3 flex items-start gap-2">
        {iconKpi ? (
          <span className="flex-1" />
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium">{title}</h3>
            {w.config.description && <p className="mt-0.5 text-[11px] text-[#5e6b7e]">{w.config.description}</p>}
            {fixedPeriodText(w.config, w.data, lang) && <p className="mt-0.5 text-[11px] text-[#5e6b7e]">{fixedPeriodText(w.config, w.data, lang)}</p>}
          </div>
        )}
        {/* Smala kort: källan framgår redan av sektionsrubriken, och rubriken behöver platsen. */}
        {w.layout.w > 2 && (
          <span className="flex gap-0.5">
            {platforms.map((p) => (
              <PlatformIcon key={p} platform={p} size="sm" />
            ))}
          </span>
        )}
      </header>
      {w.data?.filters && <p className="-mt-2 mb-2 text-[11px] text-[#5e6b7e]">{t(lang, "filter")}: {w.data.filters.join(" · ")}</p>}
      <div className={splittable ? undefined : "flex min-h-0 flex-1 flex-col"} style={fixedHeight ? { height: fixedHeight - 60 } : undefined}>
        {hasData ? (
          <WidgetView type={w.type} title={w.title} displayTitle={title} config={w.config} data={w.data} platforms={platforms} mode="light" print emphasis={emphasis} />
        ) : (
          <p className="text-sm text-[#5e6b7e]">{w.data?.notices[0] ?? t(lang, "noData")}</p>
        )}
      </div>
      {hasData && w.data && w.data.notices.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-[#8a5a00]">
          {w.data.notices.map((n) => (
            <li key={n} className="flex items-start gap-1">
              <Info className="mt-px size-3 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      )}
      {hasData && <WidgetFooter data={w.data} lang={lang} className="border-[#e7e6e2] text-[#5e6b7e]" />}
    </section>
  );
}
