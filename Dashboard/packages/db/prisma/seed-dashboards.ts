/**
 * Demodashboard som speglar referensrapporten (Demo Finans 2025): GA4,
 * LinkedIn Ads och Google Ads med samma informationsstruktur.
 */
import type { MetricId, PlatformId, WidgetConfig, WidgetType } from "@rp/core";
import { widgetConfigSchema } from "@rp/core";
import type { PrismaClient } from "../src/generated/prisma/client";

type Spec = { type: WidgetType; title?: string; w: number; h: number; source?: PlatformId; sources?: string[]; config?: Partial<WidgetConfig> };

const section = (platform: PlatformId, text?: string): Spec => ({ type: "section", w: 12, h: 2, config: { platform, text } });
const kpi = (source: PlatformId, metric: MetricId, w = 3): Spec => ({ type: "kpi", w, h: 4, source, config: { metrics: [metric] } });

/** Rader av widgets; varje rad läggs under den föregående. */
const ANNUAL: Spec[][] = [
  [{ type: "text", title: "Året i korthet", w: 12, h: 3, config: { text: "Här skriver byrån sin analys av perioden: vad som gick bra, vad som ska justeras och nästa steg.\n\n- Texten följer med i PDF-rapporten\n- Redigera den via Redigera och pennan på widgeten" } }],
  [section("ga4", "Webbplatsens trafik och engagemang")],
  [kpi("ga4", "sessions"), kpi("ga4", "users"), kpi("ga4", "avg_session_duration"), kpi("ga4", "bounce_rate")],
  [
    { type: "timeseries", title: "Besök", w: 7, h: 9, source: "ga4", config: { metrics: ["sessions"], chart: "area" } },
    { type: "donut", title: "Trafikkällor", w: 5, h: 9, source: "ga4", config: { metrics: ["sessions"], dimension: "channel_group", limit: 6 } },
  ],
  [{ type: "table", title: "Sidor", w: 12, h: 13, source: "ga4", config: { metrics: ["users", "sessions", "new_user_share", "session_engagement_rate"], dimension: "page_path", limit: 8 } }],
  [section("linkedin_ads", "Betald annonsering på LinkedIn")],
  [kpi("linkedin_ads", "spend", 2), kpi("linkedin_ads", "impressions", 2), kpi("linkedin_ads", "cpm", 2), kpi("linkedin_ads", "clicks", 2), kpi("linkedin_ads", "cpc", 2), kpi("linkedin_ads", "engagement_rate", 2)],
  [
    { type: "kpi", title: "Engagemang", w: 4, h: 8, source: "linkedin_ads", config: { metrics: ["likes", "comments", "shares", "follows"] } },
    { type: "funnel", title: "Videoannonser", w: 8, h: 8, source: "linkedin_ads", config: { metrics: ["video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"] } },
  ],
  [
    { type: "table", title: "Företag", w: 4, h: 17, source: "linkedin_ads", config: { metrics: ["impressions", "engagement_rate"], dimension: "company", limit: 10 } },
    { type: "table", title: "Bransch", w: 4, h: 17, source: "linkedin_ads", config: { metrics: ["impressions", "engagement_rate"], dimension: "industry", limit: 10 } },
    { type: "table", title: "Yrkesnivå", w: 4, h: 17, source: "linkedin_ads", config: { metrics: ["impressions", "engagement_rate"], dimension: "seniority", limit: 10 } },
  ],
  [
    { type: "table", title: "Jobbtitel", w: 6, h: 16, source: "linkedin_ads", config: { metrics: ["impressions", "engagement_rate"], dimension: "job_title", limit: 10 } },
    { type: "table", title: "Geografisk exponering", w: 6, h: 16, source: "linkedin_ads", config: { metrics: ["impressions", "engagement_rate"], dimension: "region", limit: 10 } },
  ],
  [{ type: "ad_gallery", title: "Annonser", w: 12, h: 22, source: "linkedin_ads", config: { metrics: ["impressions", "clicks"], limit: 9, sort: { by: "clicks", dir: "desc" } } }],
  [section("google_ads", "Sökannonsering")],
  [kpi("google_ads", "spend", 2), kpi("google_ads", "impressions", 2), kpi("google_ads", "cpm", 2), kpi("google_ads", "cpc", 2), kpi("google_ads", "ctr", 2), kpi("google_ads", "clicks", 2)],
  [
    { type: "timeseries", title: "Klick", w: 7, h: 13, source: "google_ads", config: { metrics: ["clicks"], chart: "bar" } },
    { type: "table", title: "Sökord", w: 5, h: 13, source: "google_ads", config: { metrics: ["clicks", "ctr"], dimension: "keyword", limit: 8 } },
  ],
];

/**
 * "Alla kanaler": källorna mergade i samma widgets. `sources` pekar på
 * nycklar i params.accounts (t.ex. "google_ads", "google_ads_usd").
 */
const ADS = ["google_ads", "google_ads_usd", "linkedin_ads"];
const ALL = ["ga4", ...ADS];
const OVERVIEW: Spec[][] = [
  [{ type: "text", title: "Alla kanaler", w: 12, h: 3, config: { text: "Google Ads (två konton, varav ett i USD), LinkedIn och GA4 sammanslagna. Belopp är omräknade till SEK med ECB:s dagskurs och alla kvoter räknas om från summorna." } }],
  [
    { type: "kpi", w: 3, h: 5, sources: ADS, config: { metrics: ["spend"] } },
    { type: "kpi", w: 3, h: 5, sources: ADS, config: { metrics: ["clicks"] } },
    { type: "kpi", w: 3, h: 5, sources: ADS, config: { metrics: ["cpc"] } },
    { type: "kpi", w: 3, h: 5, sources: ALL, config: { metrics: ["custom_kostnad_per_besok"] } },
  ],
  [
    { type: "timeseries", title: "Klick per källa", w: 8, h: 11, sources: ADS, config: { metrics: ["clicks"], chart: "bar", splitBySource: true } },
    { type: "donut", title: "Spend per källa", w: 4, h: 11, sources: ADS, config: { metrics: ["spend"], dimension: "source" } },
  ],
  [{ type: "table", title: "Kampanjer i alla annonskanaler", w: 12, h: 9, sources: ADS, config: { metrics: ["spend", "clicks", "ctr", "cpc"], dimension: "campaign", limit: 10 } }],
  [
    { type: "timeseries", title: "Kostnad per besök över tid", w: 6, h: 10, sources: ALL, config: { metrics: ["custom_kostnad_per_besok"] } },
    { type: "table", title: "Jobbtitel (bara LinkedIn har dimensionen)", w: 6, h: 10, sources: ["ga4", "linkedin_ads"], config: { metrics: ["impressions", "clicks"], dimension: "job_title", limit: 6 } },
  ],
];

export async function seedOverview(prisma: PrismaClient, params: { workspaceId: string; clientId: string; dashboardId: string; accounts: Record<string, string | undefined> }) {
  return placeRows(prisma, OVERVIEW, params);
}

export async function seedAnnualReport(prisma: PrismaClient, params: { workspaceId: string; clientId: string; dashboardId: string; accounts: Partial<Record<PlatformId, string>> }) {
  return placeRows(prisma, ANNUAL, params);
}

async function placeRows(prisma: PrismaClient, rows: Spec[][], params: { workspaceId: string; clientId: string; dashboardId: string; accounts: Record<string, string | undefined> }) {
  let y = 0;
  for (const row of rows) {
    let x = 0;
    let rowH = 0;
    for (const spec of row) {
      const accountIds = (spec.sources ?? (spec.source ? [spec.source] : [])).map((k) => params.accounts[k]).filter((x): x is string => !!x);
      await prisma.widget.create({
        data: {
          workspaceId: params.workspaceId,
          clientId: params.clientId,
          dashboardId: params.dashboardId,
          type: spec.type,
          title: spec.title ?? null,
          config: widgetConfigSchema.parse(spec.config ?? {}),
          layout: { x, y, w: spec.w, h: spec.h },
          sources: accountIds.length ? { create: accountIds.map((accountId) => ({ workspaceId: params.workspaceId, accountId })) } : undefined,
        },
      });
      x += spec.w;
      rowH = Math.max(rowH, spec.h);
    }
    y += rowH;
  }
}
