/**
 * Google Analytics 4 – riktig connector.
 *
 *  - OAuth 2.0 mot Google med minsta möjliga scope (analytics.readonly + e-post
 *    för att visa vilken inloggning som används).
 *  - Properties listas via Admin API (accountSummaries + properties.get för valuta/tidszon).
 *  - Data hämtas via Data API (runReport), en dag per rad, med paginering.
 *
 * Alla adresser kan pekas om via miljövariabler, så att samma kod körs mot en
 * simulerad Google-server i utveckling och tester (src/dev/fake-google.ts).
 */
import { joinDimension } from "../filters";
import { RateLimiter, withRetry } from "../http";
import { checkGoogle as check, googleCfg, googleOAuth } from "./google-oauth";
import {
  type Connector,
  type DimensionId,
  type ExternalAccount,
  type FetchQuery,
  type MetricId,
  type NormalizedRow,
  type TokenSet,
} from "../types";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/analytics.readonly"];

function cfg() {
  return {
    ...googleCfg(),
    adminBase: process.env.GA4_ADMIN_BASE ?? "https://analyticsadmin.googleapis.com",
    dataBase: process.env.GA4_DATA_BASE ?? "https://analyticsdata.googleapis.com",
  };
}

/** Kanoniska metrics → GA4 API-namn. session_duration räknas från snittet × besök per rad. */
const METRIC_MAP: Partial<Record<MetricId, string>> = {
  sessions: "sessions",
  users: "totalUsers",
  new_users: "newUsers",
  engaged_sessions: "engagedSessions",
  conversions: "keyEvents",
  page_views: "screenPageViews",
  engagement_time: "userEngagementDuration",
};

/** Dimension → GA4-dimension (två för sammansatta dimensioner, t.ex. kampanj och enhet). */
const DIMENSION_MAP: Partial<Record<DimensionId, string | [string, string]>> = {
  date: "date",
  channel_group: "sessionDefaultChannelGroup",
  page_path: "pagePath",
  page_title: "pageTitle",
  city: "city",
  device: "deviceCategory",
  region: "region",
  country: "country",
  campaign: "sessionCampaignName",
  campaign_device: ["sessionCampaignName", "deviceCategory"],
  campaign_region: ["sessionCampaignName", "region"],
  page_channel: ["pagePath", "sessionDefaultChannelGroup"],
};

/** Data API tillåter 10 samtidiga anrop per property; vi håller oss lägre för hela appen. */
const limiter = new RateLimiter(6);

async function api<T>(tokens: TokenSet, url: string, what: string, init?: { method?: string; body?: unknown }): Promise<T> {
  return limiter.run(() =>
    withRetry(async () => {
      const res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "Content-Type": "application/json" },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(60_000),
      });
      await check(res, what);
      return (await res.json()) as T;
    }),
  );
}

interface RunReportResponse {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  rowCount?: number;
}

const toIsoDate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
/** Rader per sida i runReport (Googles max är 250 000). Läses vid anrop så att den kan ändras i drift och tester. */
const pageSize = () => Number(process.env.GA4_PAGE_SIZE ?? 100_000);

export const ga4Connector: Connector = {
  id: "ga4",
  platform: "ga4",
  label: "Google Analytics 4",
  isConfigured: () => Boolean(cfg().clientId && cfg().clientSecret),

  auth: googleOAuth(SCOPES),

  async listAccounts({ tokens }) {
    const c = cfg();
    const props: { id: string; name: string; account: string }[] = [];
    let pageToken = "";
    do {
      const q = new URLSearchParams({ pageSize: "200", ...(pageToken ? { pageToken } : {}) });
      const res = await api<{
        accountSummaries?: { displayName: string; propertySummaries?: { property: string; displayName: string }[] }[];
        nextPageToken?: string;
      }>(tokens, `${c.adminBase}/v1beta/accountSummaries?${q}`, "lista properties");
      for (const a of res.accountSummaries ?? []) for (const p of a.propertySummaries ?? []) props.push({ id: p.property, name: p.displayName, account: a.displayName });
      pageToken = res.nextPageToken ?? "";
    } while (pageToken);

    // Valuta och tidszon per property (behövs för omräkning och dagsgränser).
    return Promise.all(
      props.map(async (p): Promise<ExternalAccount> => {
        const d = await api<{ currencyCode?: string; timeZone?: string }>(tokens, `${c.adminBase}/v1beta/${p.id}`, "läsa property");
        return { externalId: p.id, name: p.name, parentName: p.account, currency: d.currencyCode ?? "SEK", timezone: d.timeZone ?? "Europe/Stockholm" };
      }),
    );
  },

  availableMetrics: () => [...(Object.keys(METRIC_MAP) as MetricId[]), "session_duration"],
  availableDimensions: () => Object.keys(DIMENSION_MAP) as DimensionId[],

  async fetch({ tokens }, query: FetchQuery) {
    const extra = query.dimensions.filter((d) => d !== "date");
    if (extra.length > 1) throw new Error("GA4-connectorn hämtar max en dimension utöver datum per anrop.");
    const dim = extra[0];
    if (dim && !DIMENSION_MAP[dim]) throw new Error(`Dimensionen ${dim} finns inte i GA4.`);

    const wanted = query.metrics.filter((m) => METRIC_MAP[m] || m === "session_duration");
    const apiMetrics = [...new Set(wanted.flatMap((m) => (m === "session_duration" ? ["averageSessionDuration", "sessions"] : [METRIC_MAP[m]!])))];
    const dims = ["date", ...(dim ? [DIMENSION_MAP[dim]!].flat() : [])];

    const rows: NormalizedRow[] = [];
    const PAGE_SIZE = pageSize();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const res = await api<RunReportResponse>(tokens, `${cfg().dataBase}/v1beta/${query.account.externalId}:runReport`, "hämta rapport", {
        method: "POST",
        body: {
          dateRanges: [{ startDate: query.dateRange.start, endDate: query.dateRange.end }],
          dimensions: dims.map((name) => ({ name })),
          metrics: apiMetrics.map((name) => ({ name })),
          limit: PAGE_SIZE,
          offset,
          keepEmptyRows: false,
        },
      });
      const mIdx = new Map((res.metricHeaders ?? []).map((h, i) => [h.name, i]));
      for (const r of res.rows ?? []) {
        const num = (name: string) => Number(r.metricValues[mIdx.get(name)!]?.value ?? 0);
        const metrics: NormalizedRow["metrics"] = {};
        for (const m of wanted) {
          // Summan av besökstid = snitt × besök per rad (exakt på radnivå).
          metrics[m] = m === "session_duration" ? num("averageSessionDuration") * num("sessions") : num(METRIC_MAP[m]!);
        }
        const value = r.dimensionValues.slice(1).map((v) => v.value);
        rows.push({ date: toIsoDate(r.dimensionValues[0]!.value), dims: dim ? { [dim]: joinDimension(value) } : {}, metrics });
      }
      if (offset + PAGE_SIZE >= (res.rowCount ?? 0)) break;
    }
    return { currency: query.account.currency ?? "SEK", rows };
  },
};
