/**
 * Widget-definitioner som delas av builder (klient) och dataladdning (server).
 * Konfigurationen valideras med zod i båda ändar.
 */
import { z } from "zod";
import { dataFilterSchema, type DataFilter } from "./filters";
import type { DimensionId, MetricId, PlatformId } from "./types";

export const WIDGET_TYPES = ["kpi", "metric_list", "timeseries", "bar", "donut", "table", "funnel", "ad_gallery", "goal", "map", "summary", "media", "text", "section"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const WIDGET_META: Record<WidgetType, { label: string; description: string; defaultSize: { w: number; h: number }; minSize: { w: number; h: number }; needsData: boolean }> = {
  kpi: { label: "KPI-kort", description: "Ett nyckeltal med förändring och sparkline", defaultSize: { w: 3, h: 4 }, minSize: { w: 2, h: 3 }, needsData: true },
  metric_list: { label: "Nyckeltalslista", description: "Ett nyckeltal per källa (t.ex. Meta mot YouTube) eller flera nyckeltal med ikoner", defaultSize: { w: 4, h: 6 }, minSize: { w: 3, h: 4 }, needsData: true },
  timeseries: { label: "Trendgraf", description: "Linje, yta eller stapel över tid", defaultSize: { w: 6, h: 9 }, minSize: { w: 3, h: 6 }, needsData: true },
  bar: { label: "Stapeldiagram", description: "Nu mot föregående period per kampanj, källa eller annan dimension", defaultSize: { w: 6, h: 9 }, minSize: { w: 3, h: 6 }, needsData: true },
  donut: { label: "Donut", description: "Fördelning per dimension", defaultSize: { w: 6, h: 9 }, minSize: { w: 4, h: 7 }, needsData: true },
  table: { label: "Tabell", description: "Metrics per dimension, sorterbar", defaultSize: { w: 6, h: 10 }, minSize: { w: 3, h: 5 }, needsData: true },
  funnel: { label: "Funnel", description: "Steg-för-steg, t.ex. videovisningar", defaultSize: { w: 6, h: 9 }, minSize: { w: 4, h: 6 }, needsData: true },
  ad_gallery: { label: "Annonsgalleri", description: "Kreativ, text och resultat per annons", defaultSize: { w: 12, h: 14 }, minSize: { w: 4, h: 8 }, needsData: true },
  // Mål och budget hämtar data från kundens mål (egna källor per mål), inte från widgetens källor.
  goal: { label: "Mål och budget", description: "Utfall mot kundens mål och budgettakt", defaultSize: { w: 6, h: 7 }, minSize: { w: 3, h: 4 }, needsData: false },
  // Kundens sammanfattning: AI skriver ett utkast som byrån redigerar; utkast visas aldrig för kunden.
  summary: { label: "Sammanfattning", description: "AI-utkast till kundens sammanfattning, granskas innan publicering", defaultSize: { w: 12, h: 6 }, minSize: { w: 3, h: 3 }, needsData: false },
  map: { label: "Karta", description: "Resultat per land på karta (regioner som lista)", defaultSize: { w: 6, h: 10 }, minSize: { w: 3, h: 6 }, needsData: true },
  media: { label: "Bild eller video", description: "Uppladdad bild eller inbäddad YouTube-/Vimeo-video", defaultSize: { w: 6, h: 9 }, minSize: { w: 2, h: 3 }, needsData: false },
  text: { label: "Text", description: "Kommentar eller analys", defaultSize: { w: 6, h: 4 }, minSize: { w: 2, h: 2 }, needsData: false },
  section: { label: "Sektionsrubrik", description: "Rubrik med källans logga", defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 }, needsData: false },
};

const dimensionId = z.string() as unknown as z.ZodType<DimensionId>;

/** @deprecated Använd DataFilter (filters.ts). Äldre sparade filter konverteras automatiskt. */
export type WidgetFilter = DataFilter;

export const widgetConfigSchema = z.object({
  /** Inbyggda metric-id:n eller egna formler ("custom_<nyckel>"). */
  metrics: z.array(z.string()).default([]),
  dimension: dimensionId.optional(),
  chart: z.enum(["line", "area", "bar"]).default("line"),
  granularity: z.enum(["auto", "day", "week", "month"]).default("auto"),
  sort: z.object({ by: z.string(), dir: z.enum(["asc", "desc"]) }).optional(),
  limit: z.number().int().min(1).max(100).default(10),
  /** Datafilter (per kanal eller alla kanaler), se filters.ts. */
  filters: z.array(dataFilterSchema).default([]),
  /** Trendgraf: dela upp serien per källa (staplat). */
  splitBySource: z.boolean().default(false),
  /**
   * Fast period för widgeten oberoende av dashboardens period, t.ex. "I år" eller en kampanjperiod.
   * Jämförelsen följer dashboardens jämförelseläge.
   */
  fixedRange: z
    .object({
      preset: z.enum(["last_week", "last_7", "last_30", "last_90", "this_month", "last_month", "this_quarter", "last_quarter", "this_year", "last_year", "custom"]),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .refine((r) => r.preset !== "custom" || (!!r.start && !!r.end && r.start <= r.end), { message: "Ange start- och slutdatum." })
    .optional(),
  /** Sidfot med källor och period (som i Whatagraph). */
  showFooter: z.boolean().default(false),
  /** Tabell: kolumn med föregående periods värde bredvid varje nyckeltal. */
  showPrevious: z.boolean().default(false),
  /** Jämförelse per källa: visa YouTube som egen rad (Google Ads-kampanjer av typen video). */
  splitYouTube: z.boolean().default(false),
  /** Visa jämförelseperioden (om dashboarden har en). */
  showComparison: z.boolean().default(true),
  /** KPI-kort: "standard" (stort tal och kurva) eller "icon" (kompakt med illustrerad ikon). */
  kpiStyle: z.enum(["standard", "icon"]).default("standard"),
  /** Ikon för KPI-kort och nyckeltalslistor: "auto" = efter nyckeltalet, "none" = ingen, annars ikonens id. */
  icon: z.string().max(40).default("auto"),
  /** Kort förklaring under rubriken, t.ex. "Klick på annonsens länk". */
  description: z.string().max(200).optional(),
  /** Nyckeltalslista: ett nyckeltal per källa ("sources") eller flera nyckeltal ("metrics"). */
  listMode: z.enum(["sources", "metrics"]).default("metrics"),
  /** KPI-kort som framhävt block i kundens färg. Utan värde framhävs första KPI-kortet på sidan. */
  emphasis: z.boolean().optional(),
  /** Text/sektion */
  text: z.string().max(5000).optional(),
  /** Sidan i dashboarden som widgeten ligger på (saknas = första sidan) */
  pageId: z.string().optional(),
  /** Mål och budget: vilka av kundens mål som visas (id:n) */
  goalIds: z.array(z.string()).default([]),
  /** Sammanfattning: utkast syns bara för byrån, publicerad även för kunden */
  summaryStatus: z.enum(["draft", "published"]).default("draft"),
  /** Bild eller video: bilden som data-URL (förminskad vid uppladdning) eller videons adress */
  mediaKind: z.enum(["image", "video"]).optional(),
  mediaUrl: z.string().max(2_200_000).optional(),
  caption: z.string().max(300).optional(),
  /** Sektion: vilken plattform loggan visar */
  platform: z.string().optional(),
  /**
   * Kanaler widgeten bygger på (t.ex. ["ga4"]). Sparas med widgeten så att en widget
   * som tappat sin källa vet vilken kanal den behöver ("Rapportens källor").
   */
  sourcePlatforms: z.array(z.string() as unknown as z.ZodType<PlatformId>).default([]),
});
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;

export const layoutSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0), w: z.number().int().min(1), h: z.number().int().min(1) });
export type WidgetLayout = z.infer<typeof layoutSchema>;

export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 28;

/** Standardmetrics för videofunneln. */
export const VIDEO_FUNNEL: MetricId[] = ["video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"];

// ─── Sidor ──────────────────────────────────────────────────────────────────

export interface DashboardPage {
  id: string;
  name: string;
}

export const DEFAULT_PAGE: DashboardPage = { id: "main", name: "Översikt" };

/** Dashboardens sidor (minst en). */
export function dashboardPages(settings: { pages?: DashboardPage[] } | null | undefined): DashboardPage[] {
  const pages = (settings?.pages ?? []).filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
  return pages.length ? pages : [DEFAULT_PAGE];
}

/** Sidan en widget ligger på; okända eller saknade sidor räknas till första sidan. */
export function widgetPageId(config: { pageId?: string }, pages: DashboardPage[]): string {
  return config.pageId && pages.some((p) => p.id === config.pageId) ? config.pageId : pages[0]!.id;
}

// ─── Video ──────────────────────────────────────────────────────────────────

/** YouTube- eller Vimeo-länk → inbäddningsadress och (för YouTube) omslagsbild. Andra adresser godtas inte. */
export function videoEmbed(url: string): { embed: string; thumbnail: string | null; provider: "youtube" | "vimeo" } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let yt: string | null = null;
  if (host === "youtu.be") yt = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") yt = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  if (yt && /^[\w-]{6,20}$/.test(yt)) return { embed: `https://www.youtube-nocookie.com/embed/${yt}`, thumbnail: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`, provider: "youtube" };
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/(\d{5,})/)?.[1];
    if (id) return { embed: `https://player.vimeo.com/video/${id}`, thumbnail: null, provider: "vimeo" };
  }
  return null;
}
