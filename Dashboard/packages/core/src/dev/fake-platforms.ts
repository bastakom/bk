/**
 * Simulerade API-servrar för Meta, LinkedIn och TikTok – samma vägar,
 * format och felkoder som de riktiga, med data från mock-generatorn. Används
 * i tester och lokal utveckling tills byrån har sina API-godkännanden.
 *
 * Meta:  GET /vXX.X/me, /me/adaccounts, /act_X/insights, /act_X/ads
 *        act_403000001 → behörighetsfel (kod 200), act_429000001 → anropsgräns (kod 17) första gången
 *        POST /__admin/meta/revoke → token återkallad (kod 190)
 * LinkedIn: /oauth/v2/authorization, /oauth/v2/accessToken, /rest/adAccounts, /rest/adAnalytics,
 *        namnuppslag (titles, seniorities, industries, geo, organizationsLookup), creatives, posts, images.
 *        Konto 403000001 → 403.
 * TikTok: /portal/auth, /open_api/v1.3/... (access_token, advertiser, report/integrated, ad, file/video).
 *        Annonsör 7300000000000403 → kod 40002.
 */
import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { getConnector } from "../connectors/registry";
import { splitDimension } from "../filters";
import type { DimensionId, MetricId, NormalizedRow } from "../types";

export const FAKE_META_TOKEN = "fake-meta-system-user-token";

const META_ACCOUNTS = [
  { id: "act_1029384756", name: "Bästa Kompisar – Facebook & Instagram", currency: "SEK", timezone_name: "Europe/Stockholm", business: "Reklambyrån Bästa Kompisar" },
  { id: "act_1029384757", name: "Leads-kampanjer", currency: "SEK", timezone_name: "Europe/Stockholm", business: "Reklambyrån Bästa Kompisar" },
  { id: "act_5566778899", name: "Demo Fastighetsförmedling", currency: "EUR", timezone_name: "Europe/Stockholm", business: "Demo Fastighetsförmedling AB" },
  { id: "act_403000001", name: "Konto utan behörighet", currency: "SEK", timezone_name: "Europe/Stockholm", business: "Okänd kund" },
  { id: "act_429000001", name: "Konto med anropsgräns", currency: "SEK", timezone_name: "Europe/Stockholm", business: "Reklambyrån Bästa Kompisar" },
];

const LEVEL_DIM: Record<string, DimensionId> = { campaign: "campaign", adset: "ad_set", ad: "ad" };
const BREAKDOWN_DIM: Record<string, DimensionId> = { age: "age", gender: "gender", impression_device: "device", region: "region", country: "country", "age,gender": "age", "country,region": "region" };
/** Kontots custom conversions (id → namn). */
const CUSTOM_CONVERSIONS = [
  { id: "5551", name: "Köp Demoprodukt" },
  { id: "5552", name: "Nyhetsbrev" },
];
const toMetaValue = (dim: DimensionId, v: string) =>
  dim === "gender" ? ({ Kvinna: "female", Man: "male", Okänt: "unknown" } as Record<string, string>)[v] ?? v
  : dim === "device" ? ({ Mobil: "iphone", Dator: "desktop", Surfplatta: "ipad" } as Record<string, string>)[v] ?? v
  : dim === "age" ? v.replace("–", "-")
  : v;

function metaRow(r: NormalizedRow) {
  const m = r.metrics;
  const act = (type: string, v?: number) => (v ? [{ action_type: type, value: String(v) }] : undefined);
  const actions = [
    ...(act("post_engagement", m.engagements) ?? []),
    ...(act("post_reaction", m.likes) ?? []),
    ...(act("comment", m.comments) ?? []),
    ...(act("post", m.shares) ?? []),
    ...(act("like", m.follows) ?? []),
    ...(act("onsite_conversion.post_save", Math.round((m.engagements ?? 0) * 0.02)) ?? []),
    ...(act("purchase", m.conversions) ?? []),
    ...(act("offsite_conversion.custom.5551", Math.round((m.conversions ?? 0) * 0.6)) ?? []),
    ...(act("offsite_conversion.custom.5552", Math.round((m.clicks ?? 0) * 0.03)) ?? []),
    // Typer som inte räknas som konvertering ska ignoreras av connectorn.
    { action_type: "link_click", value: String(m.clicks ?? 0) },
  ];
  return {
    date_start: r.date,
    date_stop: r.date,
    spend: (m.spend ?? 0).toFixed(2),
    impressions: String(m.impressions ?? 0),
    clicks: String(m.clicks ?? 0),
    inline_link_clicks: String(Math.round((m.clicks ?? 0) * 0.6)),
    actions,
    action_values: [...(act("purchase", m.conversion_value) ?? []), ...(act("offsite_conversion.custom.5551", Math.round((m.conversion_value ?? 0) * 0.6)) ?? [])],
    video_play_actions: act("video_view", m.video_starts),
    video_thruplay_watched_actions: act("video_view", m.video_views),
    video_p25_watched_actions: act("video_view", m.video_q25),
    video_p50_watched_actions: act("video_view", m.video_q50),
    video_p75_watched_actions: act("video_view", m.video_q75),
    video_p100_watched_actions: act("video_view", m.video_completions),
  };
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
const LI_ACCOUNTS = [
  { id: 508812341, name: "Huvudkonto", currency: "SEK" },
  { id: 508812342, name: "Employer branding", currency: "SEK" },
  { id: 509990012, name: "Nordics (EUR)", currency: "EUR" },
  { id: 403000001, name: "Konto utan åtkomst", currency: "SEK" },
];
const LI_PIVOT: Record<string, { dim?: DimensionId; urn: string; collection?: string }> = {
  ACCOUNT: { urn: "urn:li:sponsoredAccount" },
  CAMPAIGN: { dim: "campaign", urn: "urn:li:sponsoredCampaign" },
  CREATIVE: { dim: "ad", urn: "urn:li:sponsoredCreative" },
  MEMBER_JOB_TITLE: { dim: "job_title", urn: "urn:li:title", collection: "titles" },
  MEMBER_SENIORITY: { dim: "seniority", urn: "urn:li:seniority", collection: "seniorities" },
  MEMBER_INDUSTRY: { dim: "industry", urn: "urn:li:industry", collection: "industries" },
  MEMBER_COMPANY: { dim: "company", urn: "urn:li:organization", collection: "organizationsLookup" },
  MEMBER_REGION_V2: { dim: "region", urn: "urn:li:geo", collection: "geo" },
};
const LI_FIELDS: Record<string, MetricId> = {
  costInLocalCurrency: "spend", impressions: "impressions", clicks: "clicks", externalWebsiteConversions: "conversions",
  totalEngagements: "engagements", likes: "likes", comments: "comments", shares: "shares", follows: "follows",
  videoStarts: "video_starts", videoViews: "video_views", videoFirstQuartileCompletions: "video_q25",
  videoMidpointCompletions: "video_q50", videoThirdQuartileCompletions: "video_q75", videoCompletions: "video_completions",
};
/** Stabilt id för ett namn, så att URN ↔ namn går att slå upp åt båda hållen. */
const nameIds = new Map<string, string>();
const idNames = new Map<string, string>();
function idFor(name: string): string {
  let id = nameIds.get(name);
  if (!id) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9_000_000;
    id = String(1_000_000 + h);
    nameIds.set(name, id);
    idNames.set(id, name);
  }
  return id;
}

// ── TikTok ────────────────────────────────────────────────────────────────────
const TT_ADVERTISERS = [
  { id: "7301122334455667788", name: "TikTok – Sverige", currency: "SEK", tz: "Europe/Stockholm" },
  { id: "7301122334455667799", name: "TikTok – Spark Ads", currency: "SEK", tz: "Europe/Stockholm" },
  { id: "7300000000000403", name: "Annonsör utan åtkomst", currency: "SEK", tz: "Europe/Stockholm" },
];
const TT_FIELDS: Record<string, MetricId> = {
  spend: "spend", impressions: "impressions", clicks: "clicks", conversion: "conversions", likes: "likes", comments: "comments",
  shares: "shares", follows: "follows", video_play_actions: "video_starts", video_watched_2s: "video_views",
  video_views_p25: "video_q25", video_views_p50: "video_q50", video_views_p75: "video_q75", video_views_p100: "video_completions",
};
const toTikTokAge = (v: string) => (v === "55+" ? "AGE_55_100" : `AGE_${v.replace("–", "_")}`);
const toTikTokGender = (v: string) => ({ Kvinna: "FEMALE", Man: "MALE" })[v] ?? "NONE";

function consentPage(title: string, approve: string, deny: string) {
  return `<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:system-ui;background:#f3f2ef;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;border-radius:12px;padding:32px;max-width:380px;box-shadow:0 1px 3px #0002}a{display:inline-block;margin:12px 8px 0 0;padding:10px 18px;border-radius:20px;text-decoration:none}.ok{background:#0a66c2;color:#fff}.no{color:#0a66c2}</style></head>
<body><main><p style="color:#666;font-size:13px">SIMULERAD INLOGGNING</p><h1 style="font-size:20px">${title}</h1><p>Rapportplattform begär läsåtkomst till annonskonton och statistik.</p>
<a class="ok" href="${approve}">Tillåt</a><a class="no" href="${deny}">Avbryt</a></main></body></html>`;
}

export async function startFakePlatforms(opts: { port?: number } = {}) {
  const state = { metaTokens: new Set([FAKE_META_TOKEN]), linkedinTokens: new Set<string>(), tiktokTokens: new Set<string>(), calls: new Map<string, number>(), metaRejectCountryRegion: false };
  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => resolve(b));
    });
  const html = (res: ServerResponse, body: string) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  };
  const count = (k: string) => {
    const n = (state.calls.get(k) ?? 0) + 1;
    state.calls.set(k, n);
    return n;
  };
  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  const metaError = (res: ServerResponse, status: number, code: number, message: string, type = "OAuthException") =>
    json(res, status, { error: { message, type, code, fbtrace_id: "FakeTrace" } });
  const base = () => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const mockMeta = getConnector("mock_meta_ads");

  /** Paginering i Metas stil: { data, paging: { cursors, next } } */
  const page = (url: URL, items: unknown[]) => {
    const limit = Number(url.searchParams.get("limit") ?? 25);
    const after = Number(url.searchParams.get("after") ?? 0);
    const slice = items.slice(after, after + limit);
    const next = after + limit < items.length ? new URL(url) : null;
    if (next) next.searchParams.set("after", String(after + limit));
    return { data: slice, paging: { cursors: { before: String(after), after: String(after + limit) }, ...(next ? { next: next.toString() } : {}) } };
  };

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", base());
    try {
      if (req.method === "POST" && url.pathname === "/__admin/meta/revoke") {
        state.metaTokens.clear();
        return json(res, 200, { ok: true });
      }

      // ── LinkedIn OAuth ────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/oauth/v2/authorization") {
        const back = (extra: Record<string, string>) => {
          const u = new URL(url.searchParams.get("redirect_uri")!);
          for (const [k, v] of Object.entries({ ...extra, state: url.searchParams.get("state") ?? "" })) u.searchParams.set(k, v);
          return u.toString();
        };
        return html(res, consentPage("Logga in med LinkedIn (simulerad)", back({ code: `li-code-${randomBytes(6).toString("hex")}` }), back({ error: "user_cancelled_authorize" })));
      }
      if (req.method === "POST" && url.pathname === "/oauth/v2/accessToken") {
        const p = new URLSearchParams(await readBody(req));
        if (!p.get("client_id") || !p.get("client_secret")) return json(res, 401, { error: "invalid_client" });
        if (p.get("grant_type") === "refresh_token" && !state.linkedinTokens.size) return json(res, 400, { error: "invalid_grant", error_description: "The provided authorization grant is invalid" });
        const token = `li-at-${randomBytes(8).toString("hex")}`;
        state.linkedinTokens.add(token);
        return json(res, 200, { access_token: token, expires_in: 5_184_000, refresh_token: `li-rt-${randomBytes(8).toString("hex")}`, refresh_token_expires_in: 31_536_000, scope: "r_ads,r_ads_reporting" });
      }

      // ── LinkedIn REST ─────────────────────────────────────────────────
      if (url.pathname.startsWith("/rest/")) {
        const token = String(req.headers.authorization ?? "").replace("Bearer ", "");
        if (!state.linkedinTokens.has(token)) return json(res, 401, { status: 401, serviceErrorCode: 65601, message: "The token used in the request has been revoked by the user" });
        if (!req.headers["linkedin-version"]) return json(res, 400, { status: 400, code: "VERSION_MISSING", message: "A version must be present" });
        const path = decodeURIComponent(url.pathname.slice(6));
        if (path === "adAccounts") return json(res, 200, { elements: LI_ACCOUNTS.map((a) => ({ ...a, status: "ACTIVE", type: "BUSINESS" })), metadata: {} });
        if (path === "adAnalytics") {
          const raw = decodeURIComponent(url.search);
          const pivot = LI_PIVOT[url.searchParams.get("pivot") ?? "ACCOUNT"]!;
          const accountId = /sponsoredAccount:(\d+)/.exec(raw)![1]!;
          if (accountId === "403000001") return json(res, 403, { status: 403, serviceErrorCode: 100, message: "Not enough permissions to access: adAnalytics" });
          const [, sy, sm, sd, ey, em, ed] = /start:\(year:(\d+),month:(\d+),day:(\d+)\),end:\(year:(\d+),month:(\d+),day:(\d+)\)/.exec(raw)!;
          const p2 = (n: string) => n.padStart(2, "0");
          const acc = LI_ACCOUNTS.find((a) => String(a.id) === accountId)!;
          const data = await getConnector("mock_linkedin_ads").fetch(
            { tokens: { accessToken: "x" } },
            { account: { externalId: `urn:li:sponsoredAccount:${accountId}`, name: acc.name, currency: acc.currency }, metrics: Object.values(LI_FIELDS), dimensions: pivot.dim ? [pivot.dim] : [], dateRange: { start: `${sy}-${p2(sm!)}-${p2(sd!)}`, end: `${ey}-${p2(em!)}-${p2(ed!)}` } },
          );
          const fields = (url.searchParams.get("fields") ?? "").split(",");
          const elements = data.rows
            .filter((r) => (r.metrics.impressions ?? 0) > 0)
            .map((r) => {
              const [y, m, d] = r.date.split("-").map(Number);
              const value = pivot.dim ? r.dims[pivot.dim]! : "";
              const pv = pivot.dim === "ad" ? `${pivot.urn}:${value.replace("li_ad_", "100")}` : pivot.dim ? `${pivot.urn}:${idFor(value)}` : `urn:li:sponsoredAccount:${accountId}`;
              const out: Record<string, unknown> = { dateRange: { start: { year: y, month: m, day: d }, end: { year: y, month: m, day: d } }, pivotValues: [pv] };
              for (const f of fields) if (LI_FIELDS[f]) out[f] = f === "costInLocalCurrency" ? String(r.metrics.spend ?? 0) : (r.metrics[LI_FIELDS[f]!] ?? 0);
              return out;
            });
          return json(res, 200, { elements, paging: { start: 0, count: elements.length, links: [] } });
        }
        const campaigns = /^adAccounts\/(\d+)\/adCampaigns$/.exec(path);
        if (campaigns) {
          const names = ["Varumärke – Always on", "Pension 55+", "Barnsparande", "Rekrytering", "Retargeting"];
          return json(res, 200, { elements: names.map((n) => ({ id: Number(idFor(n)), name: n, status: "ACTIVE" })) });
        }
        const creatives = /^adAccounts\/(\d+)\/creatives$/.exec(path);
        if (creatives) {
          const list = await getConnector("mock_linkedin_ads").fetchCreatives!({ tokens: { accessToken: "x" } }, { externalId: `urn:li:sponsoredAccount:${creatives[1]}`, name: "x" });
          return json(res, 200, { elements: list.map((c, i) => ({ id: `urn:li:sponsoredCreative:100${i + 1}`, name: c.name, content: { reference: `urn:li:share:200${i + 1}` } })) });
        }
        const post = /^posts\/urn:li:share:200(\d+)$/.exec(path);
        if (post) {
          const list = await getConnector("mock_linkedin_ads").fetchCreatives!({ tokens: { accessToken: "x" } }, { externalId: "urn:li:sponsoredAccount:508812341", name: "x" });
          const c = list[Number(post[1]) - 1]!;
          return json(res, 200, { commentary: c.text, content: { media: { id: `urn:li:image:300${post[1]}`, title: c.headline } } });
        }
        const image = /^images\/urn:li:image:300(\d+)$/.exec(path);
        if (image) {
          const list = await getConnector("mock_linkedin_ads").fetchCreatives!({ tokens: { accessToken: "x" } }, { externalId: "urn:li:sponsoredAccount:508812341", name: "x" });
          return json(res, 200, { downloadUrl: list[Number(image[1]) - 1]!.thumbnailUrl, status: "AVAILABLE" });
        }
        const lookup = /^(titles|seniorities|industries|geo|organizationsLookup)$/.exec(path);
        if (lookup) {
          const ids = /ids=List\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",") ?? [];
          const results: Record<string, unknown> = {};
          for (const id of ids) {
            const name = idNames.get(id);
            if (!name) continue;
            results[id] = lookup[1] === "organizationsLookup" ? { localizedName: name } : { name: { localized: { en_US: name } } };
          }
          return json(res, 200, { results, errors: {}, statuses: {} });
        }
        return json(res, 404, { status: 404, message: `Resource ${path} does not exist` });
      }

      // ── TikTok ────────────────────────────────────────────────────────
      if (req.method === "GET" && url.pathname === "/portal/auth") {
        const back = (extra: Record<string, string>) => {
          const u = new URL(url.searchParams.get("redirect_uri")!);
          for (const [k, v] of Object.entries({ ...extra, state: url.searchParams.get("state") ?? "" })) u.searchParams.set(k, v);
          return u.toString();
        };
        return html(res, consentPage("TikTok for Business (simulerad)", back({ auth_code: `tt-code-${randomBytes(6).toString("hex")}` }), back({ error: "access_denied" })));
      }
      if (url.pathname.startsWith("/open_api/v1.3/")) {
        const path = url.pathname.slice("/open_api/v1.3/".length);
        const ok = (data: unknown) => json(res, 200, { code: 0, message: "OK", request_id: "fake", data });
        const fail = (code: number, message: string) => json(res, 200, { code, message, request_id: "fake" });
        if (path === "oauth2/access_token/" && req.method === "POST") {
          const b = JSON.parse(await readBody(req)) as { app_id?: string; secret?: string; auth_code?: string };
          if (!b.app_id || !b.secret || !b.auth_code) return fail(40001, "Missing parameter");
          const token = `tt-at-${randomBytes(8).toString("hex")}`;
          state.tiktokTokens.add(token);
          return ok({ access_token: token, advertiser_ids: TT_ADVERTISERS.map((a) => a.id), scope: [4, 5] });
        }
        if (!state.tiktokTokens.has(String(req.headers["access-token"] ?? ""))) return fail(40105, "The access token is invalid or has been revoked.");
        // Bara listor/objekt tolkas som JSON – id:n på 19 siffror får aldrig bli tal (precisionsförlust).
        const param = (k: string) => {
          const v = url.searchParams.get(k);
          if (v && /^[[{]/.test(v)) return JSON.parse(v);
          return v ?? undefined;
        };
        if (path === "oauth2/advertiser/get/") return ok({ list: TT_ADVERTISERS.map((a) => ({ advertiser_id: a.id, advertiser_name: a.name })) });
        if (path === "advertiser/info/") {
          const ids = param("advertiser_ids") as string[];
          return ok({ list: TT_ADVERTISERS.filter((a) => ids.includes(a.id)).map((a) => ({ advertiser_id: a.id, name: a.name, currency: a.currency, timezone: "Etc/GMT-1", display_timezone: a.tz })) });
        }
        if (path === "report/integrated/get/") {
          const adv = String(param("advertiser_id"));
          if (adv === "7300000000000403") return fail(40002, "No permission to operate advertiser");
          const dims = param("dimensions") as string[];
          const metricsReq = param("metrics") as string[];
          const start = String(param("start_date"));
          const end = String(param("end_date"));
          if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > 30) return fail(40002, "The time range cannot exceed 30 days for daily data.");
          const extra = dims.find((d) => d !== "stat_time_day");
          const dim: DimensionId | undefined = extra === "campaign_id" ? "campaign" : extra === "ad_id" ? "ad" : (extra as DimensionId | undefined);
          const acc = TT_ADVERTISERS.find((a) => a.id === adv)!;
          const data = await getConnector("mock_tiktok_ads").fetch(
            { tokens: { accessToken: "x" } },
            { account: { externalId: adv, name: acc.name, currency: acc.currency }, metrics: Object.values(TT_FIELDS), dimensions: dim ? [dim] : [], dateRange: { start, end } },
          );
          const list = data.rows
            .filter((r) => (r.metrics.impressions ?? 0) > 0)
            .map((r) => {
              const v = dim ? r.dims[dim]! : "";
              const metrics: Record<string, string> = {};
              for (const f of metricsReq) if (TT_FIELDS[f]) metrics[f] = String(r.metrics[TT_FIELDS[f]!] ?? 0);
              if (metricsReq.includes("campaign_name")) metrics.campaign_name = v;
              const dimensions: Record<string, string> = { stat_time_day: `${r.date} 00:00:00` };
              if (extra === "campaign_id") dimensions.campaign_id = idFor(v);
              if (extra === "ad_id") dimensions.ad_id = v;
              if (extra === "age") dimensions.age = toTikTokAge(v);
              if (extra === "gender") dimensions.gender = toTikTokGender(v);
              return { dimensions, metrics };
            });
          const page = Number(param("page") ?? 1);
          const size = Number(param("page_size") ?? 10);
          return ok({ list: list.slice((page - 1) * size, page * size), page_info: { page, page_size: size, total_number: list.length, total_page: Math.max(1, Math.ceil(list.length / size)) } });
        }
        if (path === "ad/get/") {
          const adv = String(param("advertiser_id"));
          const list = await getConnector("mock_tiktok_ads").fetchCreatives!({ tokens: { accessToken: "x" } }, { externalId: adv, name: "x" });
          return ok({ list: list.map((c) => ({ ad_id: c.externalId, ad_name: c.name, ad_text: c.text, campaign_name: c.campaign, video_id: c.format === "video" ? `v_${c.externalId}` : undefined })), page_info: { page: 1, total_page: 1 } });
        }
        if (path === "file/video/ad/info/") {
          const ids = param("video_ids") as string[];
          return ok({ list: ids.map((id) => ({ video_id: id, video_cover_url: "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/%3E" })) });
        }
        return fail(40000, `Unknown endpoint ${path}`);
      }

      // ── Meta Graph API ─────────────────────────────────────────────────
      const meta = /^\/v\d+\.\d+\/(.+)$/.exec(url.pathname);
      if (meta && req.method === "GET") {
        const path = meta[1]!;
        const token = url.searchParams.get("access_token") ?? "";
        if (!state.metaTokens.has(token)) return metaError(res, 400, 190, "Error validating access token: The session has been invalidated.");
        if (path === "me") return json(res, 200, { id: "1000999000", name: "Rapportplattform" });
        if (path === "me/adaccounts") {
          return json(res, 200, page(url, META_ACCOUNTS.map((a) => ({ id: a.id, account_id: a.id.slice(4), name: a.name, currency: a.currency, timezone_name: a.timezone_name, account_status: 1, business: { name: a.business } }))));
        }
        if (/^act_\d+\/customconversions$/.test(path)) return json(res, 200, page(url, CUSTOM_CONVERSIONS));
        const insights = /^(act_\d+)\/insights$/.exec(path);
        if (insights) {
          const acc = META_ACCOUNTS.find((a) => a.id === insights[1]);
          if (!acc) return metaError(res, 400, 100, "Unsupported get request.", "GraphMethodException");
          if (acc.id === "act_403000001") return metaError(res, 400, 200, "(#200) Ad account owner has NOT grant ads_management or ads_read permission");
          if (acc.id === "act_429000001" && count(acc.id) === 1) return metaError(res, 400, 17, "(#17) User request limit reached", "OAuthException");
          const level = url.searchParams.get("level") ?? "account";
          const breakdown = url.searchParams.get("breakdowns") ?? "";
          if (breakdown === "country,region" && state.metaRejectCountryRegion) return metaError(res, 400, 100, "(#100) Current combination of data breakdown columns (country, region) is invalid", "OAuthException");
          const fieldList = url.searchParams.get("fields") ?? "";
          // Sammansatta dimensioner: nivå + uppdelning (eller kampanjnamn på annonsgruppsnivå).
          const composite: DimensionId | undefined =
            level === "adset" && fieldList.includes("campaign_name") ? "campaign_ad_set"
            : level === "campaign" && breakdown === "impression_device" ? "campaign_device"
            : level === "campaign" && breakdown === "region" ? "campaign_region"
            : undefined;
          const dim = composite ?? LEVEL_DIM[level] ?? BREAKDOWN_DIM[breakdown];
          const tr = JSON.parse(url.searchParams.get("time_range") ?? "{}") as { since: string; until: string };
          const data = await mockMeta.fetch(
            { tokens: { accessToken: "x" } },
            {
              account: { externalId: acc.id, name: acc.name, currency: acc.currency, timezone: acc.timezone_name },
              metrics: mockMeta.availableMetrics(),
              dimensions: dim && dim !== "country" ? [dim] : [],
              dateRange: { start: tr.since, end: tr.until },
            },
          );
          const field = level === "campaign" ? "campaign_name" : level === "adset" ? "adset_name" : level === "ad" ? "ad_id" : breakdown === "country,region" ? "region" : breakdown;
          const both = breakdown === "age,gender";
          // Kön × ålder: den simulerade datan har bara ålder, så könet fördelas deterministiskt.
          const withDims = (r: NormalizedRow, i: number) => composite ? compositeFields(composite, r.dims[composite] ?? "") : ({
            ...(dim ? { [field === "age,gender" ? "age" : field]: dim === "country" ? "SE" : toMetaValue(dim, r.dims[dim] ?? "") } : {}),
            ...(both ? { gender: i % 3 === 0 ? "male" : "female" } : {}),
            ...(breakdown === "country,region" ? { country: "SE" } : {}),
          });
          function compositeFields(d: DimensionId, value: string): Record<string, string> {
            const [a, b] = splitDimension(value);
            if (d === "campaign_ad_set") return { campaign_name: a, adset_name: b };
            if (d === "campaign_device") return { campaign_name: a, impression_device: toMetaValue("device", b) };
            return { campaign_name: a, region: b };
          }
          const filtering = JSON.parse(url.searchParams.get("filtering") ?? "[]") as { field: string; operator: string; value: string[] | string }[];
          const daily = data.rows.filter((r) => (r.metrics.impressions ?? 0) > 0);
          if (!url.searchParams.get("time_increment")) {
            // Hela perioden i en rad per värde, med räckvidd (unika personer) – som Metas riktiga API.
            const groups = new Map<string, { dims: Record<string, string>; impressions: number }>();
            daily.forEach((r, i) => {
              const dims = withDims(r, i);
              const name = String(dims[field as keyof typeof dims] ?? "");
              if (filtering.some((f) => f.field === "campaign.name" && f.operator === "IN" && !(f.value as string[]).includes(name))) return;
              const key = JSON.stringify(dims);
              const g = groups.get(key) ?? { dims: dims as Record<string, string>, impressions: 0 };
              g.impressions += r.metrics.impressions ?? 0;
              groups.set(key, g);
            });
            const rows = [...groups.values()].map((g) => {
              const reach = Math.round(g.impressions / 3.1);
              return { ...g.dims, reach: String(reach), estimated_ad_recallers: String(Math.round(reach * 0.04)), date_start: tr.since, date_stop: tr.until };
            });
            return json(res, 200, page(url, rows));
          }
          const rows = daily.map((r, i) => ({ ...metaRow(r), ...withDims(r, i) }));
          return json(res, 200, page(url, rows));
        }
        const ads = /^(act_\d+)\/ads$/.exec(path);
        if (ads) {
          const acc = META_ACCOUNTS.find((a) => a.id === ads[1])!;
          const creatives = await mockMeta.fetchCreatives!({ tokens: { accessToken: "x" } }, { externalId: acc.id, name: acc.name });
          return json(
            res,
            200,
            page(url, creatives.map((c) => ({ id: c.externalId, name: c.name, campaign: { name: c.campaign }, creative: { title: c.headline, body: c.text, image_url: c.thumbnailUrl, object_type: c.format === "video" ? "VIDEO" : "SHARE" } }))),
          );
        }
        const preview = /^([^/]+)\/previews$/.exec(path);
        if (preview) {
          const src = `https://www.facebook.com/ads/api/preview_iframe.php?d=${preview[1]}&amp;t=fake`;
          return json(res, 200, { data: [{ body: `<iframe src="${src}" width="320" height="570" scrolling="yes" style="border: none;"></iframe>` }] });
        }
        return metaError(res, 400, 100, `Unknown path components: /${path}`, "GraphMethodException");
      }
      return json(res, 404, { error: "not found" });
    } catch (e) {
      return json(res, 500, { error: { message: e instanceof Error ? e.message : String(e), code: 2 } });
    }
  });

  await new Promise<void>((r) => server.listen(opts.port ?? 0, "127.0.0.1", r));
  return {
    url: base(),
    state,
    env: {
      META_GRAPH_BASE: base(),
      META_API_VERSION: "v23.0",
      LINKEDIN_CLIENT_ID: "fake-linkedin-client",
      LINKEDIN_CLIENT_SECRET: "fake-linkedin-secret",
      LINKEDIN_AUTH_BASE: base(),
      LINKEDIN_API_BASE: base(),
      TIKTOK_APP_ID: "fake-tiktok-app",
      TIKTOK_APP_SECRET: "fake-tiktok-secret",
      TIKTOK_AUTH_BASE: base(),
      TIKTOK_API_BASE: base(),
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
