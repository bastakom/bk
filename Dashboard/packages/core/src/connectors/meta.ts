/**
 * Meta Ads (Facebook/Instagram) – riktig connector via Marketing API.
 *
 * Inloggning: en systemanvändar-token från byråns Business Manager (klistras
 * in en gång). Token ser alla annonskonton som tilldelats systemanvändaren,
 * även kunders konton som delats med byrån som partner. Behörighet: ads_read.
 *
 * Data: Insights API per dag (time_increment=1) på konto-, kampanj-, annonsgrupp-
 * och annonsnivå samt uppdelning på ålder, kön, enhet, region och land. Konverteringar
 * (custom conversions och standardhändelser) kan delas upp per konvertering och kampanj. Långa perioder
 * delas i bitar om 90 dagar. Med META_APP_SECRET skickas appsecret_proof (rekommenderat av Meta).
 */
import { createHmac } from "node:crypto";
import { chunkRange } from "../dates";
import { DIMENSION_SEPARATOR, joinDimension } from "../filters";
import { RateLimiter, withRetry } from "../http";
import {
  ConnectorAuthError,
  ConnectorRetryableError,
  type Connector,
  type CreativeEntity,
  type PlayableMedia,
  type PeriodQuery,
  type DimensionId,
  type ExternalAccount,
  type FetchQuery,
  type MetricId,
  type NormalizedRow,
  type TokenSet,
} from "../types";

function cfg() {
  return {
    base: process.env.META_GRAPH_BASE ?? "https://graph.facebook.com",
    version: process.env.META_API_VERSION ?? "v23.0",
    appSecret: process.env.META_APP_SECRET ?? "",
    conversionActions: (process.env.META_CONVERSION_ACTIONS ?? "purchase,lead").split(",").map((s) => s.trim()),
  };
}

/** Anrop per process – Metas gränser gäller per app och annonskonto. */
const limiter = new RateLimiter(4);

interface GraphError {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
}

/** Metas felkoder → connector-fel. */
function toError(status: number, body: GraphError, what: string): Error {
  const e = body.error ?? {};
  const msg = `${e.message ?? `HTTP ${status}`} (kod ${e.code ?? "?"}, ${what})`;
  const code = e.code ?? 0;
  if (code === 190 || code === 102) return new ConnectorAuthError(`Meta-token är ogiltig eller återkallad: ${msg}`, "connection", "revoked");
  if (code === 10 || code === 294 || (code >= 200 && code < 300)) return new ConnectorAuthError(`Token saknar åtkomst till kontot: ${msg}`, "account", "no_access");
  // 4/17/32/613 och 80000–80014 = anropsgränser; 1/2 = tillfälliga fel.
  // Ogiltiga anrop (kod 100) är inte tillfälliga även om Meta ibland svarar med HTTP 500.
  if ([1, 2, 4, 17, 32, 341, 613].includes(code) || (code >= 80000 && code <= 80014) || (status >= 500 && code !== 100)) {
    // Meta anger ingen exakt väntetid i felet; en minut räcker normalt för att kvoten ska fyllas på.
    const wait = Number(process.env.META_THROTTLE_WAIT_MS ?? 60_000);
    return new ConnectorRetryableError(`Meta begränsar eller är tillfälligt otillgängligt: ${msg}`, [1, 2].includes(code) ? Math.min(wait, 5_000) : wait);
  }
  return new Error(`Meta svarade med fel: ${msg}`);
}

async function graph<T>(tokens: TokenSet, pathOrUrl: string, params: Record<string, string> = {}, what = "Graph API"): Promise<T> {
  const c = cfg();
  const url = new URL(pathOrUrl.startsWith("http") ? pathOrUrl : `${c.base}/${c.version}/${pathOrUrl}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!url.searchParams.has("access_token")) url.searchParams.set("access_token", tokens.accessToken);
  if (c.appSecret && !url.searchParams.has("appsecret_proof")) url.searchParams.set("appsecret_proof", createHmac("sha256", c.appSecret).update(tokens.accessToken).digest("hex"));
  return limiter.run(() =>
    withRetry(async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(90_000) });
      const body = (await res.json().catch(() => ({}))) as T & GraphError;
      if (!res.ok || body.error) throw toError(res.status, body, what);
      return body;
    }),
  );
}

/** Följer Metas paginering (paging.next är en färdig URL). */
async function all<T>(tokens: TokenSet, path: string, params: Record<string, string>, what: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = path;
  let first = true;
  while (next) {
    const page: { data?: T[]; paging?: { next?: string } } = await graph(tokens, next, first ? params : {}, what);
    out.push(...(page.data ?? []));
    next = page.paging?.next;
    first = false;
  }
  return out;
}

type Action = { action_type: string; value: string };
interface InsightRow {
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  reach?: string;
  estimated_ad_recallers?: string;
  actions?: Action[];
  action_values?: Action[];
  video_play_actions?: Action[];
  video_thruplay_watched_actions?: Action[];
  video_p25_watched_actions?: Action[];
  video_p50_watched_actions?: Action[];
  video_p75_watched_actions?: Action[];
  video_p100_watched_actions?: Action[];
  campaign_name?: string;
  adset_name?: string;
  ad_id?: string;
  age?: string;
  gender?: string;
  impression_device?: string;
  region?: string;
  country?: string;
}

/** Hur varje dimension hämtas: nivå (level) eller uppdelning (breakdowns). */
const genderLabel = (v: string) => ({ female: "Kvinna", male: "Man", unknown: "Okänt" })[v] ?? v;
const ageLabel = (v: string) => (v === "Unknown" ? "Okänd ålder" : v.replace("-", "–"));

const countryNames = new Intl.DisplayNames(["sv"], { type: "region" });
const countryLabel = (code?: string) => {
  try {
    return code ? (countryNames.of(code.toUpperCase()) ?? code) : "Okänt land";
  } catch {
    return code ?? "Okänt land";
  }
};

interface DimensionSpec {
  level?: string;
  breakdown?: string;
  /** Uppdelning att använda om Meta inte godtar `breakdown` (t.ex. land + region i samma anrop). */
  fallbackBreakdown?: string;
  field: keyof InsightRow;
  /** Fler fält att hämta (sammansatta dimensioner, t.ex. kampanjnamnet för annonsgrupper). */
  extraFields?: (keyof InsightRow)[];
  label?: (v: string) => string;
  value?: (r: InsightRow) => string;
  /** En rad per konvertering (custom conversions och standardhändelser) i stället för en per rad. */
  conversions?: boolean;
}

const deviceLabel = (v: string) => (/desktop/.test(v) ? "Dator" : /ipad|tablet/.test(v) ? "Surfplatta" : "Mobil");
const campaignOf = (r: InsightRow) => r.campaign_name ?? "(okänd kampanj)";

const DIMENSIONS: Partial<Record<DimensionId, DimensionSpec>> = {
  campaign: { level: "campaign", field: "campaign_name" },
  ad_set: { level: "adset", field: "adset_name" },
  ad: { level: "ad", field: "ad_id" },
  age: { breakdown: "age", field: "age", label: (v) => v.replace("-", "–") },
  gender: { breakdown: "gender", field: "gender", label: genderLabel },
  age_gender: { breakdown: "age,gender", field: "age", value: (r) => `${genderLabel(String(r.gender ?? "unknown"))}, ${ageLabel(String(r.age ?? "Unknown"))}` },
  device: { breakdown: "impression_device", field: "impression_device", label: deviceLabel },
  region: { breakdown: "region", field: "region" },
  country: { breakdown: "country", field: "country" },
  region_country: {
    breakdown: "country,region",
    fallbackBreakdown: "region",
    field: "region",
    value: (r) => (r.country ? `${r.region ?? "Okänd region"}${DIMENSION_SEPARATOR}${countryLabel(r.country)}` : (r.region ?? "Okänd region")),
  },
  conversion: { field: "actions", conversions: true },
  campaign_ad_set: { level: "adset", field: "adset_name", extraFields: ["campaign_name"], value: (r) => joinDimension([campaignOf(r), r.adset_name ?? "(okänd annonsgrupp)"]) },
  campaign_device: { level: "campaign", field: "campaign_name", breakdown: "impression_device", value: (r) => joinDimension([campaignOf(r), deviceLabel(String(r.impression_device ?? ""))]) },
  campaign_region: { level: "campaign", field: "campaign_name", breakdown: "region", value: (r) => joinDimension([campaignOf(r), r.region ?? "Okänd region"]) },
  campaign_conversion: { level: "campaign", field: "campaign_name", conversions: true },
};

/** Svenska namn på Metas standardhändelser (övriga visas med Metas id). */
const ACTION_LABELS: Record<string, string> = {
  purchase: "Köp",
  lead: "Lead",
  complete_registration: "Registrering",
  add_to_cart: "Lägg i varukorg",
  initiate_checkout: "Påbörjat köp",
  contact: "Kontakt",
  subscribe: "Prenumeration",
  "offsite_conversion.fb_pixel_purchase": "Köp (pixel)",
  "offsite_conversion.fb_pixel_lead": "Lead (pixel)",
};
const CUSTOM_PREFIX = "offsite_conversion.custom.";

/**
 * En rad per konvertering: custom conversions (namn från kontots lista) och de standardhändelser
 * som räknas som konverteringar. Övriga nyckeltal (spend m.m.) går inte att fördela per konvertering.
 */
function conversionRows(r: InsightRow, conversionActions: string[], customNames: Map<string, string>): { name: string; conversions: number; value: number }[] {
  const values = new Map((r.action_values ?? []).map((a) => [a.action_type, Number(a.value)]));
  return (r.actions ?? []).flatMap((a) => {
    const custom = a.action_type.startsWith(CUSTOM_PREFIX);
    if (!custom && !conversionActions.includes(a.action_type)) return [];
    const name = custom
      ? (customNames.get(a.action_type.slice(CUSTOM_PREFIX.length)) ?? `Custom conversion ${a.action_type.slice(CUSTOM_PREFIX.length)}`)
      : (ACTION_LABELS[a.action_type] ?? a.action_type);
    return [{ name, conversions: Number(a.value), value: values.get(a.action_type) ?? 0 }];
  });
}

/** Kontots custom conversions (id → namn). Saknas behörighet visas id:t i stället. */
async function customConversionNames(tokens: TokenSet, accountId: string): Promise<Map<string, string>> {
  const list = await all<{ id: string; name: string }>(tokens, `${accountId}/customconversions`, { fields: "id,name", limit: "200" }, "hämta custom conversions").catch(() => []);
  return new Map(list.map((c) => [c.id, c.name]));
}

/** Metas felmeddelande när en kombination av uppdelningar inte stöds (kod 100). */
const isInvalidBreakdown = (e: unknown) => e instanceof Error && /kod 100/.test(e.message) && /breakdown/i.test(e.message);

const METRICS: MetricId[] = [
  "spend", "impressions", "clicks", "conversions", "conversion_value", "engagements", "likes", "comments", "shares", "follows",
  "video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions", "link_clicks", "saves", "reactions"];

const FIELDS = [
  "spend", "impressions", "clicks", "inline_link_clicks", "actions", "action_values",
  "video_play_actions", "video_thruplay_watched_actions", "video_p25_watched_actions",
  "video_p50_watched_actions", "video_p75_watched_actions", "video_p100_watched_actions",
];

const sumActions = (list: Action[] | undefined, types: string[]) => (list ?? []).filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
const firstAction = (list: Action[] | undefined) => (list ?? []).reduce((s, a) => s + Number(a.value), 0);

/** Dimensionsvärdet för en rad (kombinerade uppdelningar som kön × ålder byggs av flera fält). */
function dimValue(spec: DimensionSpec, r: InsightRow): string {
  if (spec.value) return spec.value(r);
  const raw = String(r[spec.field] ?? "(okänt)");
  return spec.label ? spec.label(raw) : raw;
}

/** Rapportens filter → Metas filtering-parameter (bara kampanj, annonsgrupp och annons stöds). */
const FILTER_FIELD: Partial<Record<DimensionId, string>> = { campaign: "campaign.name", ad_set: "adset.name", ad: "ad.name" };
const FILTER_OP = { in: "IN", not_in: "NOT_IN", contains: "CONTAIN", not_contains: "NOT_CONTAIN" } as const;
export function metaFiltering(filters: NonNullable<PeriodQuery["filters"]>): string | undefined {
  if (!filters.length) return undefined;
  return JSON.stringify(
    filters.flatMap((f) => {
      const field = FILTER_FIELD[f.dimension];
      if (!field) throw new Error(`Filter på ${f.dimension} stöds inte för räckvidd i Meta.`);
      // CONTAIN tar ett värde; flera ord ("höst" eller "vinter") kan inte uttryckas, så första ordet används.
      return [{ field, operator: FILTER_OP[f.op], value: f.op === "in" || f.op === "not_in" ? f.values : f.values[0] }];
    }),
  );
}

/** Normaliserar en Insights-rad till det gemensamma schemat. */
export function metaRowMetrics(r: InsightRow, conversionActions: string[]): NormalizedRow["metrics"] {
  return {
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    conversions: sumActions(r.actions, conversionActions),
    conversion_value: sumActions(r.action_values, conversionActions),
    engagements: sumActions(r.actions, ["post_engagement"]),
    link_clicks: Number(r.inline_link_clicks ?? 0),
    likes: sumActions(r.actions, ["post_reaction"]),
    reactions: sumActions(r.actions, ["post_reaction"]),
    saves: sumActions(r.actions, ["onsite_conversion.post_save"]),
    comments: sumActions(r.actions, ["comment"]),
    shares: sumActions(r.actions, ["post"]),
    follows: sumActions(r.actions, ["like"]),
    video_starts: firstAction(r.video_play_actions),
    video_views: firstAction(r.video_thruplay_watched_actions),
    video_q25: firstAction(r.video_p25_watched_actions),
    video_q50: firstAction(r.video_p50_watched_actions),
    video_q75: firstAction(r.video_p75_watched_actions),
    video_completions: firstAction(r.video_p100_watched_actions),
  };
}

const AD_FIELDS =
  "id,name,campaign{name},creative{object_type,title,body,image_url,thumbnail_url,video_id,effective_object_story_id,effective_instagram_media_id,instagram_permalink_url,object_story_spec,asset_feed_spec}";

interface MetaAd {
  id: string;
  name: string;
  campaign?: { name: string };
  creative?: {
    object_type?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
    video_id?: string;
    effective_object_story_id?: string;
    effective_instagram_media_id?: string;
    instagram_permalink_url?: string;
    object_story_spec?: {
      link_data?: { name?: string; message?: string; picture?: string; child_attachments?: unknown[] };
      video_data?: { title?: string; message?: string; image_url?: string };
    };
    asset_feed_spec?: { titles?: { text: string }[]; bodies?: { text: string }[] };
  };
}
interface IgMedia {
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  children?: { data?: IgMedia[] };
  caption?: string;
}
interface FbPost {
  full_picture?: string;
  permalink_url?: string;
  message?: string;
}

/**
 * Hämtar objekt ett och ett (best effort; ?ids= finns inte från Graph API v26).
 * Anropen går genom samma begränsare som övriga. Med `stopOnDenied` avbryts det
 * vid första behörighetsfelet – saknad behörighet gäller då alla objekt.
 */
async function byIds<T>(tokens: TokenSet, ids: (string | undefined)[], fields: string, stopOnDenied = false): Promise<Map<string, T>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, T>();
  let denied = false;
  await Promise.all(
    unique.map(async (id) => {
      if (denied) return;
      try {
        out.set(id, await graph<T>(tokens, id, { fields }, "hämta inlägg"));
      } catch (e) {
        // Saknad behörighet eller borttaget inlägg: annonsen visas utan den bilden.
        if (stopOnDenied && e instanceof ConnectorAuthError) denied = true;
      }
    }),
  );
  return out;
}

export const metaConnector: Connector = {
  id: "meta_ads",
  platform: "meta_ads",
  label: "Meta Ads",

  auth: {
    type: "token",
    scopes: ["ads_read"],
    tokenLabel: "Systemanvändar-token",
    help: "Business Manager → Företagsinställningar → Systemanvändare → Generera ny token. Välj er app, utgång \"Aldrig\" och endast behörigheten ads_read.",
    helpUrl: "https://business.facebook.com/settings/system-users",
    async validate(token) {
      const tokens: TokenSet = { accessToken: token.trim() };
      const me = await graph<{ id: string; name?: string }>(tokens, "me", { fields: "id,name" }, "kontrollera token");
      // Token måste ha ads_read. Går listan inte att läsa (äldre tokentyper) räcker kontrollen ovan.
      const perms = await graph<{ data?: { permission: string; status: string }[] }>(tokens, "me/permissions", {}, "kontrollera behörigheter").catch(() => null);
      if (perms?.data && !perms.data.some((p) => p.permission === "ads_read" && p.status === "granted")) {
        throw new ConnectorAuthError("Token saknar behörigheten ads_read.", "connection", "revoked");
      }
      return { label: me.name ? `${me.name} (systemanvändare)` : `Meta-token ${me.id}`, tokens: { ...tokens, extra: { userId: me.id } } };
    },
  },

  async listAccounts({ tokens }) {
    const accounts = await all<{ id: string; name: string; currency: string; timezone_name: string; account_status: number; business?: { name: string } }>(
      tokens,
      "me/adaccounts",
      { fields: "id,name,currency,timezone_name,account_status,business{name}", limit: "200" },
      "lista annonskonton",
    );
    return accounts.map(
      (a): ExternalAccount => ({
        externalId: a.id,
        name: a.account_status === 1 ? a.name : `${a.name} (inaktivt)`,
        currency: a.currency,
        timezone: a.timezone_name,
        parentName: a.business?.name,
      }),
    );
  },

  availableMetrics: () => METRICS,
  availableDimensions: () => ["date", ...(Object.keys(DIMENSIONS) as DimensionId[])],

  async fetch({ tokens }, query: FetchQuery) {
    const extra = query.dimensions.filter((d) => d !== "date");
    if (extra.length > 1) throw new Error("Meta-connectorn hämtar max en dimension utöver datum per anrop.");
    const dim = extra[0];
    const spec = dim ? DIMENSIONS[dim] : undefined;
    if (dim && !spec) throw new Error(`Dimensionen ${dim} finns inte i Meta.`);
    const { conversionActions } = cfg();
    const levelFields: string[] = spec?.level ? [spec.field as string, ...(spec.extraFields ?? [])] : [];
    const customNames = spec?.conversions ? await customConversionNames(tokens, query.account.externalId) : new Map<string, string>();
    let breakdowns = spec?.breakdown;

    const rows: NormalizedRow[] = [];
    for (const part of chunkRange(query.dateRange)) {
      const params = (b: string | undefined) => ({
        level: spec?.level ?? "account",
        time_increment: "1",
        time_range: JSON.stringify({ since: part.start, until: part.end }),
        fields: [...(spec?.conversions ? ["actions", "action_values"] : FIELDS), ...levelFields].join(","),
        ...(b ? { breakdowns: b } : {}),
        action_attribution_windows: '["7d_click","1d_view"]',
        limit: "500",
      });
      const data = await all<InsightRow>(tokens, `${query.account.externalId}/insights`, params(breakdowns), "hämta insights").catch(async (e) => {
        // T.ex. land + region: stöds kombinationen inte hämtas bara regionen.
        if (!spec?.fallbackBreakdown || breakdowns === spec.fallbackBreakdown || !isInvalidBreakdown(e)) throw e;
        breakdowns = spec.fallbackBreakdown;
        return all<InsightRow>(tokens, `${query.account.externalId}/insights`, params(breakdowns), "hämta insights");
      });
      for (const r of data) {
        if (spec?.conversions) {
          for (const c of conversionRows(r, conversionActions, customNames)) {
            const value = dim === "campaign_conversion" ? `${r.campaign_name ?? "(okänd kampanj)"}${DIMENSION_SEPARATOR}${c.name}` : c.name;
            rows.push({ date: r.date_start, dims: { [dim!]: value }, metrics: { conversions: c.conversions, conversion_value: c.value } });
          }
          continue;
        }
        rows.push({ date: r.date_start, dims: dim ? { [dim]: dimValue(spec!, r) } : {}, metrics: metaRowMetrics(r, conversionActions) });
      }
    }
    return { currency: query.account.currency ?? "SEK", rows };
  },

  periodMetrics: () => ["reach", "ad_recallers"],

  /** Räckvidd och ad recall för hela perioden (Meta räknar unika personer; går inte att summera per dag). */
  async fetchPeriod({ tokens }, query) {
    const spec = query.dimension && query.dimension !== "date" ? DIMENSIONS[query.dimension] : undefined;
    if ((query.dimension && query.dimension !== "date" && !spec) || spec?.conversions) throw new Error(`Räckvidd per ${query.dimension} finns inte i Meta.`);
    const filtering = metaFiltering(query.filters ?? []);
    const params = (b: string | undefined) => ({
      level: spec?.level ?? "account",
      time_range: JSON.stringify({ since: query.dateRange.start, until: query.dateRange.end }),
      fields: ["reach", "estimated_ad_recallers", ...(spec?.level ? [spec.field as string, ...(spec.extraFields ?? [])] : [])].join(","),
      ...(b ? { breakdowns: b } : {}),
      ...(filtering ? { filtering } : {}),
      limit: "500",
    });
    const path = `${query.account.externalId}/insights`;
    const data = await all<InsightRow>(tokens, path, params(spec?.breakdown), "hämta räckvidd").catch((e) => {
      if (!spec?.fallbackBreakdown || !isInvalidBreakdown(e)) throw e;
      return all<InsightRow>(tokens, path, params(spec.fallbackBreakdown), "hämta räckvidd");
    });
    return data.map((r) => ({
      dims: query.dimension && spec ? { [query.dimension]: dimValue(spec, r) } : {},
      metrics: { reach: Number(r.reach ?? 0), ad_recallers: Number(r.estimated_ad_recallers ?? 0) },
    }));
  },

  async fetchCreatives({ tokens }, account) {
    const ads = await all<MetaAd>(tokens, `${account.externalId}/ads`, { fields: AD_FIELDS, limit: "100", thumbnail_width: "1080", thumbnail_height: "1080" }, "hämta annonser");

    // Annonser som bygger på befintliga inlägg har bilden i inlägget, inte i annonsen.
    // Instagram-inlägg går att läsa med ads_read; Facebook-inlägg kräver pages_read_engagement.
    const ig = await byIds<IgMedia>(tokens, ads.map((a) => a.creative?.effective_instagram_media_id), "media_type,media_url,thumbnail_url,permalink,caption,children{media_type,media_url,thumbnail_url}");
    const posts = await byIds<FbPost>(
      tokens,
      ads.filter((a) => !a.creative?.effective_instagram_media_id && !a.creative?.image_url).map((a) => a.creative?.effective_object_story_id),
      "full_picture,permalink_url,message",
      // Saknas pages_read_engagement gäller det alla inlägg.
      true,
    );

    return ads.map((a): CreativeEntity => {
      const c = a.creative ?? {};
      const spec = c.object_story_spec;
      const feed = c.asset_feed_spec;
      const media = c.effective_instagram_media_id ? ig.get(c.effective_instagram_media_id) : undefined;
      const post = c.effective_object_story_id ? posts.get(c.effective_object_story_id) : undefined;
      const first = media?.children?.data?.[0];
      const isVideo = media ? media.media_type === "VIDEO" : c.object_type === "VIDEO" || !!c.video_id || !!spec?.video_data;
      const isCarousel = media?.media_type === "CAROUSEL_ALBUM" || (spec?.link_data?.child_attachments?.length ?? 0) > 1;

      // Bildens prioritet: inlägget i full storlek → annonsens bild → miniatyr. För STATUS-annonser
      // (befintligt Facebook-inlägg) är miniatyren sidans profilbild och används därför inte.
      const image =
        (media && (media.media_type === "VIDEO" ? media.thumbnail_url : media.media_type === "CAROUSEL_ALBUM" ? (first?.media_type === "VIDEO" ? first.thumbnail_url : first?.media_url) : media.media_url)) ??
        post?.full_picture ??
        c.image_url ??
        spec?.link_data?.picture ??
        spec?.video_data?.image_url ??
        (c.object_type === "STATUS" ? undefined : c.thumbnail_url);

      return {
        externalId: a.id,
        name: a.name,
        headline: c.title ?? spec?.link_data?.name ?? spec?.video_data?.title ?? feed?.titles?.[0]?.text,
        // Boostade inlägg saknar ofta text i annonsen; den finns då i inläggets bildtext.
        text: c.body ?? spec?.link_data?.message ?? spec?.video_data?.message ?? feed?.bodies?.[0]?.text ?? media?.caption ?? post?.message,
        thumbnailUrl: image,
        format: isVideo ? "video" : isCarousel ? "carousel" : "image",
        campaign: a.campaign?.name,
        permalink: media?.permalink ?? c.instagram_permalink_url ?? post?.permalink_url,
        // Instagram-inlägg kan spelas direkt; övriga visas med Metas förhandsvisning (resolveMedia).
        mediaRef: c.effective_instagram_media_id ? `ig:${c.effective_instagram_media_id}` : "preview",
      };
    });
  },

  async resolveMedia({ tokens }, _account, ad): Promise<PlayableMedia | null> {
    // Instagram-video: direktlänk till filen (gäller några timmar).
    if (ad.mediaRef?.startsWith("ig:")) {
      try {
        const m = await graph<IgMedia>(tokens, ad.mediaRef.slice(3), { fields: "media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}" }, "hämta video");
        const video = m.media_type === "VIDEO" ? m : m.children?.data?.find((x) => x.media_type === "VIDEO");
        if (video?.media_url) return { kind: "video", url: video.media_url, poster: video.thumbnail_url };
      } catch {
        // Faller tillbaka på Metas förhandsvisning nedan.
      }
    }
    // Metas egen förhandsvisning av annonsen (fungerar med ads_read, även för Facebook-video).
    for (const format of ad.mediaRef?.startsWith("ig:") ? ["INSTAGRAM_STANDARD", "MOBILE_FEED_STANDARD"] : ["MOBILE_FEED_STANDARD", "INSTAGRAM_STANDARD"]) {
      try {
        const { data = [] } = await graph<{ data?: { body: string }[] }>(tokens, `${ad.externalId}/previews`, { ad_format: format }, "hämta förhandsvisning");
        const html = data[0]?.body ?? "";
        const src = /src="([^"]+)"/.exec(html)?.[1];
        if (src) {
          const num = (attr: string, d: number) => Number(new RegExp(`${attr}="(\\d+)"`).exec(html)?.[1] ?? d);
          return { kind: "iframe", url: src.replaceAll("&amp;", "&"), width: num("width", 320), height: num("height", 570) };
        }
      } catch {
        // Prova nästa format.
      }
    }
    return null;
  },
};

