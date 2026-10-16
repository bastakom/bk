/**
 * Google Ads – riktig connector via Google Ads API (REST, GAQL).
 *
 *  - Samma Google OAuth-klient som GA4, scope "adwords" (API:et har inget rent läs-scope;
 *    connectorn gör bara läsande sökningar).
 *  - Konton: listAccessibleCustomers + kundkonton under byråns MCC (customer_client).
 *    Konton som nås via MCC sparas som "<kund>@<mcc>" så att rätt login-customer-id skickas.
 *  - Data: searchStream med GAQL per dag; kostnader i micros räknas om till valuta.
 *
 * GOOGLE_ADS_DEVELOPER_TOKEN skickas om den finns (Google flyttar åtkomstnivåer
 * till Cloud-projektet – se docs/API-GODKANNANDEN.md). GOOGLE_ADS_API_VERSION
 * styr versionen; Google stänger äldre versioner efter ungefär ett år.
 */
import { joinDimension } from "../filters";
import { RateLimiter, withRetry } from "../http";
import { checkGoogle, googleOAuth } from "./google-oauth";
import type { Connector, DimensionId, ExternalAccount, FetchQuery, MetricId, NormalizedRow, TokenSet } from "../types";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/adwords"];

function cfg() {
  return {
    base: process.env.GOOGLE_ADS_BASE ?? "https://googleads.googleapis.com",
    // v22 stängdes 7 okt 2026; v25 gäller till aug 2027 (developers.google.com/google-ads/api/docs/sunset-dates).
    version: process.env.GOOGLE_ADS_API_VERSION ?? "v25",
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? "",
  };
}

const limiter = new RateLimiter(4);

/**
 * Google Ads-fel som inte löses genom att koppla om, t.ex. att projektets åtkomstnivå
 * bara gäller testkonton. Blir "Synkfel" (inte "Behörighet saknas") med en förklaring.
 */
export class GoogleAdsAccessError extends Error {
  readonly kind = "ads_access";
  constructor(
    message: string,
    readonly code: "access_level" | "developer_token" | "customer_not_enabled",
  ) {
    super(message);
  }
}

export const ADS_MESSAGES = {
  access_level: "Google Ads-åtkomsten är bara godkänd för testkonton. Riktiga konton kan synkas när åtkomstnivån Explorer är godkänd i Google Cloud Console.",
  developer_token: "Google Ads kräver en godkänd åtkomstnivå (eller utvecklartoken) för Cloud-projektet. Se docs/KOPPLINGAR.md.",
  customer_not_enabled: "Google Ads-kontot är inte aktivt (avslutat eller inte färdigställt hos Google).",
} as const;

/** Felkoder ur Google Ads-svarets GoogleAdsFailure (t.ex. authorizationError: DEVELOPER_TOKEN_NOT_APPROVED). */
export function googleAdsErrorCodes(body: unknown): string[] {
  const items = Array.isArray(body) ? body : [body];
  const codes: string[] = [];
  for (const item of items) {
    const details = (item as { error?: { details?: { errors?: { errorCode?: Record<string, string>; message?: string }[] }[] } })?.error?.details ?? [];
    for (const d of details) for (const e of d.errors ?? []) for (const v of Object.values(e.errorCode ?? {})) codes.push(String(v));
  }
  return codes;
}

/** Översätter Google Ads-specifika fel; null = låt den allmänna Google-hanteringen ta det. */
export function classifyGoogleAdsError(body: unknown): GoogleAdsAccessError | null {
  const codes = googleAdsErrorCodes(body);
  const text = JSON.stringify(body ?? "");
  // Åtkomstnivån styrs numera av Cloud-projektet; äldre svar nämner utvecklartoken.
  if (codes.some((c) => c === "DEVELOPER_TOKEN_NOT_APPROVED" || c === "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION") || /only approved for use with test accounts|not approved for production|access level/i.test(text)) return new GoogleAdsAccessError(ADS_MESSAGES.access_level, "access_level");
  if (codes.some((c) => c === "DEVELOPER_TOKEN_PARAMETER_MISSING" || c === "DEVELOPER_TOKEN_INVALID" || c === "DEVELOPER_TOKEN_PROHIBITED")) return new GoogleAdsAccessError(ADS_MESSAGES.developer_token, "developer_token");
  if (codes.includes("CUSTOMER_NOT_ENABLED")) return new GoogleAdsAccessError(ADS_MESSAGES.customer_not_enabled, "customer_not_enabled");
  return null;
}

/** "1234567890@9876543210" → kund + MCC; "123-456-7890" → bara kund. */
export function parseCustomer(externalId: string) {
  const [customer, manager] = externalId.split("@");
  return { customer: customer!.replaceAll("-", ""), manager: manager?.replaceAll("-", "") };
}
const pretty = (id: string) => `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;

async function call<T>(tokens: TokenSet, path: string, opts: { body?: unknown; loginCustomerId?: string; what: string }): Promise<T> {
  const c = cfg();
  return limiter.run(() =>
    withRetry(async () => {
      const res = await fetch(`${c.base}/${c.version}/${path}`, {
        method: opts.body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
          ...(c.developerToken ? { "developer-token": c.developerToken } : {}),
          ...(opts.loginCustomerId ? { "login-customer-id": opts.loginCustomerId } : {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) {
        const ads = classifyGoogleAdsError(await res.clone().json().catch(() => null));
        if (ads) throw ads;
      }
      await checkGoogle(res, opts.what);
      return (await res.json()) as T;
    }),
  );
}

type GaqlRow = Record<string, Record<string, unknown>>;

/** searchStream returnerar en lista med batchar; plattas ut till rader. */
async function gaql(tokens: TokenSet, customer: string, manager: string | undefined, query: string, what: string): Promise<GaqlRow[]> {
  const batches = await call<{ results?: GaqlRow[] }[]>(tokens, `customers/${customer}/googleAds:searchStream`, { body: { query }, loginCustomerId: manager, what });
  return batches.flatMap((b) => b.results ?? []);
}

/** Dimension → resurs i GAQL och fältet som blir dimensionsvärde. */
interface DimensionSpec {
  from: string;
  field: string;
  path: [string, string];
  label?: (v: string) => string;
  where?: string;
  /** Andra delen i en sammansatt dimension (t.ex. annonsgruppen i "Kampanj · Annonsgrupp"). */
  second?: { field: string; path: [string, string]; label?: (v: string) => string };
}

const deviceLabel = (v: string) => ({ MOBILE: "Mobil", DESKTOP: "Dator", TABLET: "Surfplatta", CONNECTED_TV: "TV" })[v] ?? "Övrigt";

const CHANNEL_TYPES: Record<string, string> = {
  SEARCH: "Sök",
  DISPLAY: "Display",
  VIDEO: "YouTube",
  PERFORMANCE_MAX: "Performance Max",
  SHOPPING: "Shopping",
  DEMAND_GEN: "Demand Gen",
  DISCOVERY: "Demand Gen",
  SMART: "Smart",
  LOCAL: "Lokal",
  MULTI_CHANNEL: "App",
};

/** Landningssidans adress utan protokoll och avslutande snedstreck, t.ex. "exempel.se/kampanj". */
export const landingPageLabel = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "") || "(okänd)";

const DIMENSIONS: Partial<Record<DimensionId, DimensionSpec>> = {
  campaign: { from: "campaign", field: "campaign.name", path: ["campaign", "name"] },
  ad_set: { from: "ad_group", field: "ad_group.name", path: ["adGroup", "name"] },
  keyword: { from: "keyword_view", field: "ad_group_criterion.keyword.text", path: ["adGroupCriterion", "keyword"], where: "ad_group_criterion.type = 'KEYWORD'" },
  search_term: { from: "search_term_view", field: "search_term_view.search_term", path: ["searchTermView", "searchTerm"] },
  landing_page: { from: "landing_page_view", field: "landing_page_view.unexpanded_final_url", path: ["landingPageView", "unexpandedFinalUrl"], label: landingPageLabel },
  channel_type: { from: "campaign", field: "campaign.advertising_channel_type", path: ["campaign", "advertisingChannelType"], label: (v) => CHANNEL_TYPES[v] ?? "Övrigt" },
  device: { from: "campaign", field: "segments.device", path: ["segments", "device"], label: deviceLabel },
  campaign_ad_set: { from: "ad_group", field: "campaign.name", path: ["campaign", "name"], second: { field: "ad_group.name", path: ["adGroup", "name"] } },
  campaign_device: { from: "campaign", field: "campaign.name", path: ["campaign", "name"], second: { field: "segments.device", path: ["segments", "device"], label: deviceLabel } },
};

/** Ett fält ur en GAQL-rad (sökord har värdet i .text). */
function readField(r: GaqlRow, path: [string, string], label?: (v: string) => string): string {
  const node = r[path[0]] as Record<string, unknown> | undefined;
  const raw = node?.[path[1]];
  const value = typeof raw === "object" && raw ? String((raw as { text?: string }).text ?? "") : String(raw ?? "(okänt)");
  return label ? label(value) : value;
}

/**
 * Videonyckeltal (YouTube m.fl.) finns på kampanj- och annonsgruppsnivå. Totaler hämtas därför från
 * kampanjerna (summan av kampanjerna är kontots total). Kvartilerna anges av Google som andel av
 * exponeringarna och räknas om till antal så att de kan summeras.
 */
const VIDEO_RESOURCES = new Set(["campaign", "ad_group"]);
const VIDEO_FIELDS = [
  "metrics.video_trueview_views",
  "metrics.video_quartile_p25_rate",
  "metrics.video_quartile_p50_rate",
  "metrics.video_quartile_p75_rate",
  "metrics.video_quartile_p100_rate",
];

const METRICS: MetricId[] = ["spend", "impressions", "clicks", "conversions", "conversion_value", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"];

export const googleAdsConnector: Connector = {
  id: "google_ads",
  platform: "google_ads",
  label: "Google Ads",
  isConfigured: () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  auth: googleOAuth(SCOPES),

  async listAccounts({ tokens }) {
    const { resourceNames = [] } = await call<{ resourceNames?: string[] }>(tokens, "customers:listAccessibleCustomers", { what: "lista konton" });
    const out = new Map<string, ExternalAccount>();
    // Konton som inte går att läsa hoppas över; men om inget konto gick att läsa på grund av
    // åtkomstnivån visas det felet i stället för "0 konton".
    let accessError: GoogleAdsAccessError | null = null;
    for (const rn of resourceNames) {
      const id = rn.split("/")[1]!;
      const [me] = await gaql(tokens, id, undefined, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1", "läsa konto").catch((e: unknown) => {
        if (e instanceof GoogleAdsAccessError && e.code !== "customer_not_enabled") accessError ??= e;
        return [];
      });
      const c = me?.customer as { descriptiveName?: string; currencyCode?: string; timeZone?: string; manager?: boolean } | undefined;
      if (!c) continue;
      if (!c.manager) {
        out.set(id, { externalId: pretty(id), name: c.descriptiveName ?? pretty(id), currency: c.currencyCode, timezone: c.timeZone });
        continue;
      }
      // MCC: hämta kundkontona under byråns förvaltarkonto.
      const children = await gaql(
        tokens,
        id,
        id,
        "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager FROM customer_client WHERE customer_client.manager = FALSE AND customer_client.status = 'ENABLED'",
        "lista kundkonton under MCC",
      );
      for (const row of children) {
        const cc = row.customerClient as { id: string; descriptiveName?: string; currencyCode?: string; timeZone?: string };
        if (out.has(cc.id)) continue;
        out.set(cc.id, { externalId: `${pretty(cc.id)}@${pretty(id)}`, name: cc.descriptiveName ?? pretty(cc.id), currency: cc.currencyCode, timezone: cc.timeZone, parentName: `MCC ${c.descriptiveName ?? pretty(id)}` });
      }
    }
    if (out.size === 0 && accessError) throw accessError;
    return [...out.values()];
  },

  availableMetrics: () => METRICS,
  availableDimensions: () => ["date", ...(Object.keys(DIMENSIONS) as DimensionId[])],

  async fetch({ tokens }, query: FetchQuery) {
    const extra = query.dimensions.filter((d) => d !== "date");
    if (extra.length > 1) throw new Error("Google Ads-connectorn hämtar max en dimension utöver datum per anrop.");
    const dim = extra[0];
    const spec = dim ? DIMENSIONS[dim] : undefined;
    if (dim && !spec) throw new Error(`Dimensionen ${dim} finns inte i Google Ads.`);
    const { customer, manager } = parseCustomer(query.account.externalId);
    const from = spec?.from ?? "campaign";
    const video = VIDEO_RESOURCES.has(from);
    const fields = [
      "segments.date",
      ...(spec ? [spec.field, ...(spec.second ? [spec.second.field] : [])] : []),
      "metrics.cost_micros",
      "metrics.impressions",
      "metrics.clicks",
      "metrics.conversions",
      "metrics.conversions_value",
      ...(video ? VIDEO_FIELDS : []),
    ];
    const where = [`segments.date BETWEEN '${query.dateRange.start}' AND '${query.dateRange.end}'`, ...(spec?.where ? [spec.where] : [])];
    const rows = await gaql(tokens, customer, manager, `SELECT ${fields.join(", ")} FROM ${from} WHERE ${where.join(" AND ")}`, "hämta rapport");

    // Flera rader per dag och värde (t.ex. samma sökord i flera annonsgrupper, eller kampanjer för totalen): summera.
    const acc = new Map<string, NormalizedRow>();
    const zero = () => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0, ...(video ? { video_views: 0, video_q25: 0, video_q50: 0, video_q75: 0, video_completions: 0 } : {}) });
    for (const r of rows) {
      const date = (r.segments as { date: string }).date;
      const value = !spec ? "" : spec.second ? joinDimension([readField(r, spec.path, spec.label), readField(r, spec.second.path, spec.second.label)]) : readField(r, spec.path, spec.label);
      const key = `${date}|${value}`;
      const m = r.metrics as {
        costMicros?: string;
        impressions?: string;
        clicks?: string;
        conversions?: number;
        conversionsValue?: number;
        videoTrueviewViews?: string;
        videoQuartileP25Rate?: number;
        videoQuartileP50Rate?: number;
        videoQuartileP75Rate?: number;
        videoQuartileP100Rate?: number;
      };
      const row = acc.get(key) ?? { date, dims: dim ? { [dim]: value } : {}, metrics: zero() };
      const impressions = Number(m.impressions ?? 0);
      const x = row.metrics;
      x.spend! += Number(m.costMicros ?? 0) / 1e6;
      x.impressions! += impressions;
      x.clicks! += Number(m.clicks ?? 0);
      x.conversions! += Number(m.conversions ?? 0);
      x.conversion_value! += Number(m.conversionsValue ?? 0);
      if (video) {
        x.video_views! += Number(m.videoTrueviewViews ?? 0);
        x.video_q25! += Math.round(Number(m.videoQuartileP25Rate ?? 0) * impressions);
        x.video_q50! += Math.round(Number(m.videoQuartileP50Rate ?? 0) * impressions);
        x.video_q75! += Math.round(Number(m.videoQuartileP75Rate ?? 0) * impressions);
        x.video_completions! += Math.round(Number(m.videoQuartileP100Rate ?? 0) * impressions);
      }
      acc.set(key, row);
    }
    const wanted = new Set(query.metrics);
    return {
      currency: query.account.currency ?? "SEK",
      rows: [...acc.values()].map((r) => ({ ...r, metrics: Object.fromEntries(Object.entries(r.metrics).filter(([k]) => wanted.has(k as MetricId))) })),
    };
  },
};
