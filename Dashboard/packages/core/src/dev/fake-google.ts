/**
 * Simulerad Google-server för utveckling och tester (OAuth, Analytics Admin
 * API och Analytics Data API) med samma URL:er, format och felkoder som Google.
 * GA4-connectorn körs oförändrad mot den genom att peka om bas-URL:erna.
 *
 * Data genereras av mock-generatorn, så siffrorna är realistiska och stabila.
 * Felfall att testa:
 *   properties/403000001  → 403 PERMISSION_DENIED (inloggningen saknar åtkomst)
 *   properties/429000001  → 429 RESOURCE_EXHAUSTED de två första anropen
 *   state.expireAccessTokens() / state.revokeRefreshTokens() → utgången/återkallad behörighet
 *
 * Google Ads (GAQL searchStream): MCC 987-654-3210 med kundkonton, ett direktkopplat konto,
 * och 403-000-0001 som ger PERMISSION_DENIED.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { splitDimension } from "../filters";
import { getConnector } from "../connectors/registry";
import type { DimensionId, MetricId } from "../types";

const ACCOUNTS = [
  {
    name: "accounts/1001",
    displayName: "Bästa Kompisar – kundkonton",
    properties: [
      { id: "properties/312450981", name: "Demo Finans – webbplats", currency: "SEK", tz: "Europe/Stockholm" },
      { id: "properties/298110433", name: "Demo Fastighetsförmedling", currency: "SEK", tz: "Europe/Stockholm" },
      { id: "properties/350000777", name: "Demo Tandvård", currency: "SEK", tz: "Europe/Stockholm" },
      { id: "properties/361111222", name: "Demo Cykelverkstad", currency: "SEK", tz: "Europe/Stockholm" },
    ],
  },
  {
    name: "accounts/1002",
    displayName: "Testkonton",
    properties: [
      { id: "properties/403000001", name: "Gammal property (ingen åtkomst)", currency: "SEK", tz: "Europe/Stockholm" },
      { id: "properties/429000001", name: "Kvottest", currency: "EUR", tz: "Europe/Berlin" },
    ],
  },
];

const GA_TO_METRIC: Record<string, MetricId> = {
  sessions: "sessions",
  totalUsers: "users",
  newUsers: "new_users",
  engagedSessions: "engaged_sessions",
  keyEvents: "conversions",
  screenPageViews: "page_views",
  userEngagementDuration: "engagement_time",
};
const GA_TO_DIM: Record<string, DimensionId> = {
  sessionDefaultChannelGroup: "channel_group",
  pagePath: "page_path",
  pageTitle: "page_title",
  city: "city",
  deviceCategory: "device",
  region: "region",
  country: "country",
  sessionCampaignName: "campaign",
};

const ADS_CUSTOMERS: Record<string, { name: string; currency: string; tz: string; manager?: boolean; children?: string[] }> = {
  "9876543210": { name: "Bästa Kompisar MCC", currency: "SEK", tz: "Europe/Stockholm", manager: true, children: ["1234567890", "1234567891", "9876543211", "4030000001"] },
  "5550102020": { name: "Direktkopplat konto", currency: "SEK", tz: "Europe/Stockholm" },
  "1234567890": { name: "Demo Finans – Sök", currency: "SEK", tz: "Europe/Stockholm" },
  "1234567891": { name: "Demo Tandvård – Performance Max", currency: "SEK", tz: "Europe/Stockholm" },
  "9876543211": { name: "Legacy-konto (USD)", currency: "USD", tz: "America/New_York" },
  "4030000001": { name: "Konto utan åtkomst", currency: "SEK", tz: "Europe/Stockholm" },
};
/** Vilken dimension en GAQL-fråga gäller, utifrån de valda fälten. */
const ADS_FIELD_DIM: [RegExp, DimensionId][] = [
  [/campaign\.name.*segments\.device/, "campaign_device"],
  [/campaign\.name.*ad_group\.name/, "campaign_ad_set"],
  [/segments\.device/, "device"],
  [/campaign\.advertising_channel_type/, "channel_type"],
  [/campaign\.name/, "campaign"],
  [/ad_group\.name/, "ad_set"],
  [/keyword\.text/, "keyword"],
  [/search_term_view\.search_term/, "search_term"],
  [/landing_page_view\.unexpanded_final_url/, "landing_page"],
];
const ADS_CHANNEL: Record<string, string> = { Sök: "SEARCH", YouTube: "VIDEO", "Performance Max": "PERFORMANCE_MAX", Display: "DISPLAY" };
const ADS_DEVICE: Record<string, string> = { Mobil: "MOBILE", Dator: "DESKTOP", Surfplatta: "TABLET" };

export interface FakeGoogleState {
  clientId: string;
  clientSecret: string;
  email: string;
  accessTtlSeconds: number;
  /** Räknare per path, för felsimulering och tester */
  calls: Map<string, number>;
  expireAccessTokens(): void;
  revokeRefreshTokens(): void;
}

export async function startFakeGoogle(opts: { port?: number; clientId?: string; clientSecret?: string } = {}) {
  const codes = new Map<string, { redirectUri: string }>();
  const access = new Map<string, number>();
  const refresh = new Set<string>();
  const state: FakeGoogleState = {
    clientId: opts.clientId ?? "fake-client-id",
    clientSecret: opts.clientSecret ?? "fake-client-secret",
    email: "marknad@bastakompisar.se",
    accessTtlSeconds: 3600,
    calls: new Map(),
    expireAccessTokens: () => access.clear(),
    revokeRefreshTokens: () => refresh.clear(),
  };
  const mock = getConnector("mock_ga4");
  const allProps = ACCOUNTS.flatMap((a) => a.properties);
  const count = (key: string) => {
    const n = (state.calls.get(key) ?? 0) + 1;
    state.calls.set(key, n);
    return n;
  };

  const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };
  const apiError = (res: ServerResponse, code: number, status: string, message: string, headers?: Record<string, string>) =>
    json(res, code, { error: { code, status, message } }, headers);
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => resolve(b));
    });
  const issueTokens = (withRefresh: boolean, existingRefresh?: string) => {
    const at = `fake-at-${randomBytes(8).toString("hex")}`;
    access.set(at, Date.now() + state.accessTtlSeconds * 1000);
    const rt = existingRefresh ?? `fake-rt-${randomBytes(8).toString("hex")}`;
    if (withRefresh) refresh.add(rt);
    const idToken = ["e30", Buffer.from(JSON.stringify({ email: state.email, email_verified: true })).toString("base64url"), "sig"].join(".");
    return { access_token: at, expires_in: state.accessTtlSeconds, token_type: "Bearer", scope: "openid email https://www.googleapis.com/auth/analytics.readonly", id_token: idToken, ...(withRefresh && !existingRefresh ? { refresh_token: rt } : {}) };
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      // ── OAuth: samtyckessida ─────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/o/oauth2/v2/auth") {
        const q = url.searchParams;
        if (q.get("client_id") !== state.clientId) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          return res.end("<h1>Fel 401: invalid_client</h1><p>OAuth-klienten hittades inte.</p>");
        }
        const code = randomBytes(12).toString("hex");
        codes.set(code, { redirectUri: q.get("redirect_uri")! });
        const ok = new URL(q.get("redirect_uri")!);
        ok.searchParams.set("code", code);
        ok.searchParams.set("state", q.get("state") ?? "");
        ok.searchParams.set("scope", q.get("scope") ?? "");
        const deny = new URL(q.get("redirect_uri")!);
        deny.searchParams.set("error", "access_denied");
        deny.searchParams.set("state", q.get("state") ?? "");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(`<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>Logga in – Google (simulerad)</title>
<style>body{font-family:system-ui;background:#f1f3f4;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;border-radius:12px;padding:32px;max-width:380px;box-shadow:0 1px 3px #0002}a{display:inline-block;margin-top:12px;margin-right:8px;padding:10px 18px;border-radius:6px;text-decoration:none}.ok{background:#1a73e8;color:#fff}.no{color:#1a73e8}</style></head>
<body><main><p style="color:#5f6368;font-size:13px">SIMULERAD GOOGLE-INLOGGNING</p><h1 style="font-size:20px">Rapportplattform vill komma åt ditt Google-konto</h1><p>${state.email}</p>
<ul><li>Se din Google Analytics-data (endast läsning)</li><li>Se din e-postadress</li></ul>
<a class="ok" href="${ok}">Tillåt</a><a class="no" href="${deny}">Avbryt</a></main></body></html>`);
      }

      // ── OAuth: token ─────────────────────────────────────────────────────
      if (req.method === "POST" && url.pathname === "/token") {
        const p = new URLSearchParams(await readBody(req));
        if (p.get("client_id") !== state.clientId || p.get("client_secret") !== state.clientSecret) return json(res, 401, { error: "invalid_client" });
        if (p.get("grant_type") === "authorization_code") {
          const c = codes.get(p.get("code") ?? "");
          codes.delete(p.get("code") ?? "");
          if (!c || c.redirectUri !== p.get("redirect_uri")) return json(res, 400, { error: "invalid_grant", error_description: "Bad Request" });
          return json(res, 200, issueTokens(true));
        }
        if (p.get("grant_type") === "refresh_token") {
          const rt = p.get("refresh_token") ?? "";
          if (!refresh.has(rt)) return json(res, 400, { error: "invalid_grant", error_description: "Token has been expired or revoked." });
          return json(res, 200, issueTokens(true, rt));
        }
        return json(res, 400, { error: "unsupported_grant_type" });
      }

      // ── Testkontroller (finns bara i den simulerade servern) ─────────────
      if (req.method === "POST" && url.pathname === "/__admin/expire") {
        state.expireAccessTokens();
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && url.pathname === "/__admin/revoke") {
        state.revokeRefreshTokens();
        state.expireAccessTokens();
        return json(res, 200, { ok: true });
      }

      // ── API: kräver giltig access token ──────────────────────────────────
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const exp = access.get(token);
      if (!exp || exp < Date.now()) return apiError(res, 401, "UNAUTHENTICATED", "Request had invalid authentication credentials.");

      // ── Google Ads API ────────────────────────────────────────────────────
      if (req.method === "GET" && /^\/v\d+\/customers:listAccessibleCustomers$/.test(url.pathname)) {
        return json(res, 200, { resourceNames: ["customers/9876543210", "customers/5550102020"] });
      }
      const ads = /^\/v\d+\/customers\/(\d+)\/googleAds:searchStream$/.exec(url.pathname);
      if (req.method === "POST" && ads) {
        const id = ads[1]!;
        const c = ADS_CUSTOMERS[id];
        const login = String(req.headers["login-customer-id"] ?? "");
        const viaMcc = login && ADS_CUSTOMERS[login]?.children?.includes(id);
        if (!c || id === "4030000001" || (!viaMcc && login !== id && !["9876543210", "5550102020"].includes(id))) {
          return json(res, 403, [{ error: { code: 403, status: "PERMISSION_DENIED", message: "The caller does not have permission" } }]);
        }
        const { query } = JSON.parse(await readBody(req)) as { query: string };
        const from = /FROM\s+(\w+)/i.exec(query)![1]!;
        if (from === "customer" && /customer\.manager/.test(query)) {
          return json(res, 200, [{ results: [{ customer: { resourceName: `customers/${id}`, id, descriptiveName: c.name, currencyCode: c.currency, timeZone: c.tz, manager: !!c.manager } }] }]);
        }
        if (from === "customer_client") {
          return json(res, 200, [{ results: (c.children ?? []).map((cid) => ({ customerClient: { id: cid, descriptiveName: ADS_CUSTOMERS[cid]!.name, currencyCode: ADS_CUSTOMERS[cid]!.currency, timeZone: ADS_CUSTOMERS[cid]!.tz, manager: false } })) }]);
        }
        const [, start, end] = /BETWEEN '(\d{4}-\d{2}-\d{2})' AND '(\d{4}-\d{2}-\d{2})'/.exec(query)!;
        const dim = ADS_FIELD_DIM.find(([re]) => re.test(query.split(" FROM ")[0]!))?.[1];
        const video = /video_trueview_views/.test(query);
        const data = await getConnector("mock_google_ads").fetch(
          { tokens: { accessToken: "x" } },
          { account: { externalId: `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`, name: c.name, currency: c.currency }, metrics: ["spend", "impressions", "clicks", "conversions", "conversion_value", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"], dimensions: dim ? [dim] : [], dateRange: { start: start!, end: end! } },
        );
        const results = data.rows
          .filter((r) => (r.metrics.impressions ?? 0) > 0)
          .map((r) => {
            const v = dim ? r.dims[dim]! : "";
            const [part1, part2] = splitDimension(v);
            return {
              segments: { date: r.date, ...(dim === "device" ? { device: ADS_DEVICE[v] ?? "OTHER" } : {}), ...(dim === "campaign_device" ? { device: ADS_DEVICE[part2] ?? "OTHER" } : {}) },
              metrics: {
                costMicros: String(Math.round((r.metrics.spend ?? 0) * 1e6)),
                impressions: String(r.metrics.impressions ?? 0),
                clicks: String(r.metrics.clicks ?? 0),
                conversions: r.metrics.conversions ?? 0,
                conversionsValue: r.metrics.conversion_value ?? 0,
                ...(video
                  ? {
                      videoTrueviewViews: String(r.metrics.video_views ?? 0),
                      videoQuartileP25Rate: (r.metrics.video_q25 ?? 0) / (r.metrics.impressions ?? 1),
                      videoQuartileP50Rate: (r.metrics.video_q50 ?? 0) / (r.metrics.impressions ?? 1),
                      videoQuartileP75Rate: (r.metrics.video_q75 ?? 0) / (r.metrics.impressions ?? 1),
                      videoQuartileP100Rate: (r.metrics.video_completions ?? 0) / (r.metrics.impressions ?? 1),
                    }
                  : {}),
              },
              ...(dim === "campaign" ? { campaign: { name: v } } : {}),
              ...(dim === "campaign_device" || dim === "campaign_ad_set" ? { campaign: { name: part1 } } : {}),
              ...(dim === "campaign_ad_set" ? { adGroup: { name: part2 } } : {}),
              ...(dim === "channel_type" ? { campaign: { advertisingChannelType: ADS_CHANNEL[v] ?? "UNKNOWN" } } : {}),
              ...(dim === "search_term" ? { searchTermView: { searchTerm: v } } : {}),
              ...(dim === "landing_page" ? { landingPageView: { unexpandedFinalUrl: `https://${v}/` } } : {}),
              ...(dim === "ad_set" ? { adGroup: { name: v } } : {}),
              ...(dim === "keyword" ? { adGroupCriterion: { keyword: { text: v, matchType: "PHRASE" } } } : {}),
            };
          });
        // searchStream: resultaten kommer i batchar om högst 10 000 rader.
        const batches = [];
        for (let i = 0; i < results.length || i === 0; i += 10_000) batches.push({ results: results.slice(i, i + 10_000), requestId: "fake" });
        return json(res, 200, batches);
      }

      if (req.method === "GET" && url.pathname === "/v1beta/accountSummaries") {
        return json(res, 200, {
          accountSummaries: ACCOUNTS.map((a) => ({
            account: a.name,
            displayName: a.displayName,
            propertySummaries: a.properties.map((p) => ({ property: p.id, displayName: p.name, propertyType: "PROPERTY_TYPE_ORDINARY" })),
          })),
        });
      }

      const propMatch = /^\/v1beta\/(properties\/\d+)$/.exec(url.pathname);
      if (req.method === "GET" && propMatch) {
        const p = allProps.find((x) => x.id === propMatch[1]);
        if (!p) return apiError(res, 404, "NOT_FOUND", "Property not found");
        return json(res, 200, { name: p.id, displayName: p.name, currencyCode: p.currency, timeZone: p.tz });
      }

      const reportMatch = /^\/v1beta\/(properties\/\d+):runReport$/.exec(url.pathname);
      if (req.method === "POST" && reportMatch) {
        const propertyId = reportMatch[1]!;
        const n = count(propertyId);
        if (propertyId === "properties/403000001") return apiError(res, 403, "PERMISSION_DENIED", "User does not have sufficient permissions for this property.");
        if (propertyId === "properties/429000001" && n <= 2) return apiError(res, 429, "RESOURCE_EXHAUSTED", "Exhausted property tokens per hour.", { "Retry-After": "1" });
        const p = allProps.find((x) => x.id === propertyId);
        if (!p) return apiError(res, 404, "NOT_FOUND", "Property not found");

        const body = JSON.parse(await readBody(req)) as {
          dateRanges: { startDate: string; endDate: string }[];
          dimensions: { name: string }[];
          metrics: { name: string }[];
          limit?: number;
          offset?: number;
        };
        const dimNames = body.dimensions.map((d) => d.name);
        const extraNames = dimNames.filter((d) => d !== "date");
        const extraGa = extraNames.join(",") || undefined;
        const GA_COMPOSITE: Record<string, DimensionId> = { "sessionCampaignName,deviceCategory": "campaign_device", "sessionCampaignName,region": "campaign_region", "pagePath,sessionDefaultChannelGroup": "page_channel" };
        const extra = extraGa ? (GA_COMPOSITE[extraGa] ?? GA_TO_DIM[extraGa]) : undefined;
        if (extraGa && !extra) return apiError(res, 400, "INVALID_ARGUMENT", `Field ${extraGa} is not a valid dimension.`);
        const metricNames = body.metrics.map((m) => m.name);
        // country finns inte i mock-profilen: allt räknas till Sweden.
        const canonical = [...new Set(metricNames.flatMap((m) => (m === "averageSessionDuration" ? ["session_duration", "sessions"] : [GA_TO_METRIC[m]!])))] as MetricId[];
        const mockRes = await mock.fetch(
          { tokens: { accessToken: "fake" } },
          {
            account: { externalId: p.id, name: p.name, currency: p.currency, timezone: p.tz },
            metrics: canonical,
            dimensions: extra && extra !== "country" ? [extra] : [],
            dateRange: { start: body.dateRanges[0]!.startDate, end: body.dateRanges[0]!.endDate },
          },
        );
        const rows = mockRes.rows
          .map((r) => ({
            dimensionValues: [
              { value: r.date.replaceAll("-", "") },
              ...(!extra ? [] : extraNames.length === 2 ? splitDimension(r.dims[extra] ?? "").map((value) => ({ value })) : [{ value: extra === "country" ? "Sweden" : (r.dims[extra] ?? "(not set)") }]),
            ],
            metricValues: metricNames.map((m) => {
              if (m === "averageSessionDuration") {
                const s = r.metrics.sessions ?? 0;
                return { value: String(s ? (r.metrics.session_duration ?? 0) / s : 0) };
              }
              return { value: String(r.metrics[GA_TO_METRIC[m]!] ?? 0) };
            }),
          }))
          // Google utelämnar tomma rader när keepEmptyRows är false.
          .filter((r) => r.metricValues.some((v) => Number(v.value) !== 0));
        const offset = body.offset ?? 0;
        const limit = body.limit ?? 10_000;
        return json(res, 200, {
          dimensionHeaders: dimNames.map((name) => ({ name })),
          metricHeaders: metricNames.map((name) => ({ name, type: name === "averageSessionDuration" ? "TYPE_SECONDS" : "TYPE_INTEGER" })),
          rows: rows.slice(offset, offset + limit),
          rowCount: rows.length,
          metadata: { currencyCode: p.currency, timeZone: p.tz },
          kind: "analyticsData#runReport",
        });
      }

      return apiError(res, 404, "NOT_FOUND", `Okänd sökväg ${url.pathname}`);
    } catch (e) {
      return apiError(res, 500, "INTERNAL", e instanceof Error ? e.message : String(e));
    }
  });

  await new Promise<void>((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  return {
    url: base,
    state,
    /** Miljövariabler som pekar GA4-connectorn hit. */
    env: {
      GOOGLE_CLIENT_ID: state.clientId,
      GOOGLE_CLIENT_SECRET: state.clientSecret,
      GOOGLE_AUTH_BASE: base,
      GOOGLE_TOKEN_URL: `${base}/token`,
      GA4_ADMIN_BASE: base,
      GA4_DATA_BASE: base,
      GOOGLE_ADS_BASE: base,
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
