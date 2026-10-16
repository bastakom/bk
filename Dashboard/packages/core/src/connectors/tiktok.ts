/**
 * TikTok Ads – riktig connector via TikTok API for Business (v1.3).
 *
 *  - Auktorisering: annonsörsflödet i TikTok Business Center ger en auth_code som
 *    byts mot en långlivad access token (ingen refresh).
 *  - Konton: annonsörer som auktoriserats för appen (oauth2/advertiser/get).
 *  - Data: report/integrated/get per dag (högst 30 dagar per anrop) på
 *    annonsörs-, kampanj- och annonsnivå samt målgrupp (ålder, kön).
 *  - TikTok svarar HTTP 200 även vid fel; koden i svaret avgör.
 */
import { chunkRange } from "../dates";
import { RateLimiter, withRetry } from "../http";
import {
  ConnectorAuthError,
  ConnectorRetryableError,
  type Connector,
  type CreativeEntity,
  type DimensionId,
  type ExternalAccount,
  type FetchQuery,
  type MetricId,
  type NormalizedRow,
  type OAuthConfig,
  type TokenSet,
} from "../types";

function cfg() {
  return {
    appId: process.env.TIKTOK_APP_ID ?? "",
    secret: process.env.TIKTOK_APP_SECRET ?? "",
    authBase: process.env.TIKTOK_AUTH_BASE ?? "https://business-api.tiktok.com",
    apiBase: process.env.TIKTOK_API_BASE ?? "https://business-api.tiktok.com",
  };
}

const limiter = new RateLimiter(4);

interface TikTokResponse<T> {
  code: number;
  message: string;
  data?: T;
}

function toError(code: number, message: string, what: string): Error {
  const msg = `${message} (kod ${code}, ${what})`;
  if ([40104, 40105, 40102, 40103].includes(code)) return new ConnectorAuthError(`TikTok-token är ogiltig eller återkallad: ${msg}`, "connection", "revoked");
  if ([40001, 40002, 40007].includes(code)) return new ConnectorAuthError(`Saknar åtkomst till annonsören: ${msg}`, "account", "no_access");
  if ([40100, 40133, 50000, 50002].includes(code)) return new ConnectorRetryableError(`TikTok begränsar eller är tillfälligt otillgängligt: ${msg}`, Number(process.env.TIKTOK_THROTTLE_WAIT_MS ?? 30_000));
  return new Error(`TikTok svarade med fel: ${msg}`);
}

async function api<T>(tokens: TokenSet | null, path: string, params: Record<string, unknown>, what: string, method: "GET" | "POST" = "GET"): Promise<T> {
  const c = cfg();
  const url = new URL(`${c.apiBase}/open_api/v1.3/${path}`);
  if (method === "GET") for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  return limiter.run(() =>
    withRetry(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(tokens ? { "Access-Token": tokens.accessToken } : {}) },
        body: method === "POST" ? JSON.stringify(params) : undefined,
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status >= 500 || res.status === 429) throw new ConnectorRetryableError(`TikTok svarade ${res.status} (${what})`, Number(process.env.TIKTOK_THROTTLE_WAIT_MS ?? 30_000));
      const body = (await res.json()) as TikTokResponse<T>;
      if (body.code !== 0) throw toError(body.code, body.message, what);
      return body.data as T;
    }),
  );
}

const oauth: OAuthConfig = {
  type: "oauth2",
  scopes: ["Ads Management: läs", "Reporting"],
  getAuthorizationUrl({ state, redirectUri }) {
    const q = new URLSearchParams({ app_id: cfg().appId, state, redirect_uri: redirectUri });
    return `${cfg().authBase}/portal/auth?${q}`;
  },
  async exchangeCode({ code }) {
    const c = cfg();
    const data = await api<{ access_token: string; advertiser_ids?: string[]; scope?: number[] }>(null, "oauth2/access_token/", { app_id: c.appId, secret: c.secret, auth_code: code }, "token", "POST");
    return { accessToken: data.access_token, extra: { advertisers: (data.advertiser_ids ?? []).join(",") } };
  },
  // TikToks token för annonsörer är långlivad och har ingen refresh.
  async refresh(tokens) {
    return tokens;
  },
};

/** Dimension → rapporttyp, datanivå och dimensionsnamn i TikTok. */
const DIMENSIONS: Partial<Record<DimensionId, { reportType: string; dataLevel: string; dimension: string; nameField?: string; label?: (v: string) => string }>> = {
  campaign: { reportType: "BASIC", dataLevel: "AUCTION_CAMPAIGN", dimension: "campaign_id", nameField: "campaign_name" },
  ad: { reportType: "BASIC", dataLevel: "AUCTION_AD", dimension: "ad_id" },
  age: {
    reportType: "AUDIENCE",
    dataLevel: "AUCTION_ADVERTISER",
    dimension: "age",
    label: (v) => (v === "AGE_55_100" ? "55+" : v.replace(/^AGE_(\d+)_(\d+)$/, "$1–$2")),
  },
  gender: { reportType: "AUDIENCE", dataLevel: "AUCTION_ADVERTISER", dimension: "gender", label: (v) => ({ MALE: "Man", FEMALE: "Kvinna" })[v] ?? "Okänt" },
};

const FIELD_MAP: Partial<Record<MetricId, string>> = {
  spend: "spend",
  impressions: "impressions",
  clicks: "clicks",
  conversions: "conversion",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  follows: "follows",
  video_starts: "video_play_actions",
  video_views: "video_watched_2s",
  video_q25: "video_views_p25",
  video_q50: "video_views_p50",
  video_q75: "video_views_p75",
  video_completions: "video_views_p100",
};

export const tiktokConnector: Connector = {
  id: "tiktok_ads",
  platform: "tiktok_ads",
  label: "TikTok Ads",
  isConfigured: () => Boolean(cfg().appId && cfg().secret),
  auth: oauth,

  async listAccounts({ tokens }) {
    const c = cfg();
    const { list = [] } = await api<{ list?: { advertiser_id: string; advertiser_name: string }[] }>(tokens, "oauth2/advertiser/get/", { app_id: c.appId, secret: c.secret }, "lista annonsörer");
    if (!list.length) return [];
    const info = await api<{ list?: { advertiser_id: string; name: string; currency: string; timezone?: string; display_timezone?: string }[] }>(
      tokens,
      "advertiser/info/",
      { advertiser_ids: list.map((a) => a.advertiser_id), fields: ["advertiser_id", "name", "currency", "timezone", "display_timezone"] },
      "läsa annonsörer",
    );
    const byId = new Map((info.list ?? []).map((i) => [i.advertiser_id, i]));
    return list.map((a): ExternalAccount => {
      const i = byId.get(a.advertiser_id);
      return { externalId: a.advertiser_id, name: i?.name ?? a.advertiser_name, currency: i?.currency, timezone: i?.display_timezone ?? i?.timezone };
    });
  },

  // Engagemang räknas som summan av likes, kommentarer, delningar och följare.
  availableMetrics: () => [...(Object.keys(FIELD_MAP) as MetricId[]), "engagements"],
  availableDimensions: () => ["date", ...(Object.keys(DIMENSIONS) as DimensionId[])],

  async fetch({ tokens }, query: FetchQuery) {
    const extra = query.dimensions.filter((d) => d !== "date");
    if (extra.length > 1) throw new Error("TikTok-connectorn hämtar max en dimension utöver datum per anrop.");
    const dim = extra[0];
    const spec = dim ? DIMENSIONS[dim] : undefined;
    if (dim && !spec) throw new Error(`Dimensionen ${dim} finns inte i TikTok.`);
    const wanted = query.metrics.filter((m) => FIELD_MAP[m] || m === "engagements");
    const metrics = [...new Set(wanted.flatMap((m) => (m === "engagements" ? ["likes", "comments", "shares", "follows"] : [FIELD_MAP[m]!])))];

    const rows: NormalizedRow[] = [];
    for (const part of chunkRange(query.dateRange, 30)) {
      for (let page = 1; ; page++) {
        const data = await api<{ list?: { dimensions: Record<string, string>; metrics: Record<string, string> }[]; page_info?: { page: number; total_page: number } }>(
          tokens,
          "report/integrated/get/",
          {
            advertiser_id: query.account.externalId,
            report_type: spec?.reportType ?? "BASIC",
            data_level: spec?.dataLevel ?? "AUCTION_ADVERTISER",
            dimensions: [...(spec ? [spec.dimension] : []), "stat_time_day"],
            metrics: [...metrics, ...(spec?.nameField ? [spec.nameField] : [])],
            start_date: part.start,
            end_date: part.end,
            page,
            page_size: 1000,
          },
          "hämta rapport",
        );
        for (const r of data.list ?? []) {
          const m: NormalizedRow["metrics"] = {};
          const num = (f: string) => Number(r.metrics[f] ?? 0);
          for (const k of wanted) m[k] = k === "engagements" ? num("likes") + num("comments") + num("shares") + num("follows") : num(FIELD_MAP[k]!);
          let value = "";
          if (spec) {
            const raw = spec.nameField ? (r.metrics[spec.nameField] ?? r.dimensions[spec.dimension]) : r.dimensions[spec.dimension];
            value = spec.label ? spec.label(String(raw)) : String(raw ?? "(okänt)");
          }
          rows.push({ date: r.dimensions.stat_time_day!.slice(0, 10), dims: dim ? { [dim]: value } : {}, metrics: m });
        }
        if (!data.page_info || data.page_info.page >= data.page_info.total_page) break;
      }
    }
    return { currency: query.account.currency ?? "SEK", rows };
  },

  async fetchCreatives({ tokens }, account) {
    const data = await api<{ list?: { ad_id: string; ad_name: string; ad_text?: string; campaign_name?: string; video_id?: string }[] }>(
      tokens,
      "ad/get/",
      { advertiser_id: account.externalId, fields: ["ad_id", "ad_name", "ad_text", "campaign_name", "video_id"], page_size: 100 },
      "hämta annonser",
    );
    const ads = data.list ?? [];
    // Omslagsbilder för videoannonser (best effort).
    const covers = new Map<string, string>();
    const videoIds = ads.map((a) => a.video_id).filter((v): v is string => !!v);
    if (videoIds.length) {
      try {
        const v = await api<{ list?: { video_id: string; video_cover_url?: string; poster_url?: string }[] }>(tokens, "file/video/ad/info/", { advertiser_id: account.externalId, video_ids: videoIds }, "hämta videoomslag");
        for (const x of v.list ?? []) if (x.video_cover_url ?? x.poster_url) covers.set(x.video_id, (x.video_cover_url ?? x.poster_url)!);
      } catch {
        // Annonserna visas utan omslag hellre än att synken fallerar.
      }
    }
    return ads.map(
      (a): CreativeEntity => ({
        externalId: a.ad_id,
        name: a.ad_name,
        text: a.ad_text,
        campaign: a.campaign_name,
        format: a.video_id ? "video" : "image",
        thumbnailUrl: a.video_id ? covers.get(a.video_id) : undefined,
      }),
    );
  },
};
