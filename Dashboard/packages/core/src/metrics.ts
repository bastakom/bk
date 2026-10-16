import type { DimensionDefinition, DimensionId, MetricDefinition, MetricId } from "./types";

const m = (def: MetricDefinition) => def;

export const METRICS: Record<MetricId, MetricDefinition> = {
  spend: m({ id: "spend", label: "Spend", format: "currency", aggregation: "sum", higherIsBetter: null }),
  impressions: m({ id: "impressions", label: "Exponeringar", format: "number", aggregation: "sum", higherIsBetter: true }),
  clicks: m({ id: "clicks", label: "Klick", format: "number", aggregation: "sum", higherIsBetter: true }),
  conversions: m({ id: "conversions", label: "Konverteringar", format: "number", aggregation: "sum", higherIsBetter: true }),
  conversion_value: m({ id: "conversion_value", label: "Konverteringsvärde", format: "currency", aggregation: "sum", higherIsBetter: true }),
  sessions: m({ id: "sessions", label: "Besök", format: "number", aggregation: "sum", higherIsBetter: true }),
  users: m({
    id: "users",
    label: "Användare",
    description: "Summerat per dag; unika användare över hela perioden kan vara färre.",
    format: "number",
    aggregation: "sum_approx",
    higherIsBetter: true,
  }),
  new_users: m({ id: "new_users", label: "Nya användare", format: "number", aggregation: "sum", higherIsBetter: true }),
  engaged_sessions: m({ id: "engaged_sessions", label: "Engagerade besök", format: "number", aggregation: "sum", higherIsBetter: true }),
  session_duration: m({ id: "session_duration", label: "Total besökstid", format: "duration", aggregation: "sum", higherIsBetter: true }),
  video_starts: m({ id: "video_starts", label: "Videostarter", format: "number", aggregation: "sum", higherIsBetter: true }),
  video_views: m({ id: "video_views", label: "Videovisningar", format: "number", aggregation: "sum", higherIsBetter: true }),
  video_q25: m({ id: "video_q25", label: "Sett 25 %", format: "number", aggregation: "sum", higherIsBetter: true }),
  video_q50: m({ id: "video_q50", label: "Sett 50 %", format: "number", aggregation: "sum", higherIsBetter: true }),
  video_q75: m({ id: "video_q75", label: "Sett 75 %", format: "number", aggregation: "sum", higherIsBetter: true }),
  video_completions: m({ id: "video_completions", label: "Sett 100 %", format: "number", aggregation: "sum", higherIsBetter: true }),
  likes: m({ id: "likes", label: "Likes", format: "number", aggregation: "sum", higherIsBetter: true }),
  comments: m({ id: "comments", label: "Kommentarer", format: "number", aggregation: "sum", higherIsBetter: true }),
  shares: m({ id: "shares", label: "Delningar", format: "number", aggregation: "sum", higherIsBetter: true }),
  follows: m({ id: "follows", label: "Följare", format: "number", aggregation: "sum", higherIsBetter: true }),
  engagements: m({ id: "engagements", label: "Engagemang", format: "number", aggregation: "sum", higherIsBetter: true }),
  link_clicks: m({ id: "link_clicks", label: "Länkklick", description: "Klick på annonsens länk (inte alla klick).", format: "number", aggregation: "sum", higherIsBetter: true }),
  saves: m({ id: "saves", label: "Sparade", format: "number", aggregation: "sum", higherIsBetter: true }),
  reactions: m({ id: "reactions", label: "Reaktioner", format: "number", aggregation: "sum", higherIsBetter: true }),
  page_views: m({ id: "page_views", label: "Sidvisningar", format: "number", aggregation: "sum", higherIsBetter: true }),
  engagement_time: m({ id: "engagement_time", label: "Total engagemangstid", description: "Tid då sidan var i fokus i webbläsaren eller appen.", format: "duration", aggregation: "sum", higherIsBetter: true }),
  reach: m({ id: "reach", label: "Räckvidd", description: "Unika personer som sett annonserna under perioden.", format: "number", aggregation: "period", higherIsBetter: true }),
  ad_recallers: m({
    id: "ad_recallers",
    label: "Ad recall (personer)",
    description: "Metas uppskattning av hur många som skulle minnas annonsen inom två dagar.",
    format: "number",
    aggregation: "period",
    higherIsBetter: true,
  }),

  ctr: m({
    id: "ctr",
    label: "CTR",
    description: "Klick / exponeringar",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["clicks"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  cpc: m({
    id: "cpc",
    label: "Kostnad per klick",
    shortLabel: "CPC",
    format: "currency",
    aggregation: "derived",
    formula: { numerator: ["spend"], denominator: ["clicks"] },
    higherIsBetter: false,
  }),
  cpm: m({
    id: "cpm",
    label: "Kostnad per 1 000 exponeringar",
    shortLabel: "CPM",
    format: "currency",
    aggregation: "derived",
    formula: { numerator: ["spend"], denominator: ["impressions"], multiplier: 1000 },
    higherIsBetter: false,
  }),
  cpa: m({
    id: "cpa",
    label: "Kostnad per konvertering",
    shortLabel: "CPA",
    format: "currency",
    aggregation: "derived",
    formula: { numerator: ["spend"], denominator: ["conversions"] },
    higherIsBetter: false,
  }),
  roas: m({
    id: "roas",
    label: "ROAS",
    description: "Konverteringsvärde / spend",
    format: "number",
    aggregation: "derived",
    formula: { numerator: ["conversion_value"], denominator: ["spend"] },
    higherIsBetter: true,
  }),
  conversion_rate: m({
    id: "conversion_rate",
    label: "Konverteringsgrad",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["conversions"], denominator: ["clicks"] },
    higherIsBetter: true,
  }),
  engagement_rate: m({
    id: "engagement_rate",
    label: "Engagemangsgrad",
    shortLabel: "Eng.grad",
    description: "Engagemang / exponeringar",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["engagements"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  session_engagement_rate: m({
    id: "session_engagement_rate",
    label: "Engagemang %",
    description: "Engagerade besök / besök",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["engaged_sessions"], denominator: ["sessions"] },
    higherIsBetter: true,
  }),
  bounce_rate: m({
    id: "bounce_rate",
    label: "Bounce rate",
    description: "1 − engagerade besök / besök (viktad på besök)",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["engaged_sessions"], denominator: ["sessions"], complement: true },
    higherIsBetter: false,
  }),
  avg_session_duration: m({
    id: "avg_session_duration",
    label: "Genomsnittlig besökstid",
    shortLabel: "Snitt besökstid",
    format: "duration",
    aggregation: "derived",
    formula: { numerator: ["session_duration"], denominator: ["sessions"] },
    higherIsBetter: true,
  }),
  new_user_share: m({
    id: "new_user_share",
    label: "Nya besökare %",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["new_users"], denominator: ["users"] },
    higherIsBetter: true,
  }),
  video_view_rate: m({
    id: "video_view_rate",
    label: "Visningsgrad video",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_views"], denominator: ["video_starts"] },
    higherIsBetter: true,
  }),
  frequency: m({
    id: "frequency",
    label: "Frekvens",
    description: "Exponeringar / räckvidd: hur många gånger en person i snitt sett annonserna.",
    format: "number",
    aggregation: "derived",
    formula: { numerator: ["impressions"], denominator: ["reach"] },
    higherIsBetter: null,
  }),
  eri: m({
    id: "eri",
    label: "ERI",
    description: "Engagemang per exponering (engagement rate per impression).",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["engagements"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  ad_recall_rate: m({
    id: "ad_recall_rate",
    label: "Ad recall lift",
    description: "Andel av räckvidden som Meta uppskattar minns annonsen.",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["ad_recallers"], denominator: ["reach"] },
    higherIsBetter: true,
  }),
  link_ctr: m({
    id: "link_ctr",
    label: "CTR (länkklick)",
    description: "Länkklick / exponeringar",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["link_clicks"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  views_per_user: m({
    id: "views_per_user",
    label: "Visningar per användare",
    format: "number",
    aggregation: "derived",
    formula: { numerator: ["page_views"], denominator: ["users"] },
    higherIsBetter: true,
  }),
  avg_engagement_time: m({
    id: "avg_engagement_time",
    label: "Genomsnittlig engagemangstid",
    shortLabel: "Snitt engagemangstid",
    description: "Engagemangstid per användare (som i GA4).",
    format: "duration",
    aggregation: "derived",
    formula: { numerator: ["engagement_time"], denominator: ["users"] },
    higherIsBetter: true,
  }),
  view_rate: m({
    id: "view_rate",
    label: "View rate",
    description: "Videovisningar / exponeringar (som i Google Ads).",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_views"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  cpv: m({
    id: "cpv",
    label: "Kostnad per visning",
    shortLabel: "CPV",
    format: "currency",
    aggregation: "derived",
    formula: { numerator: ["spend"], denominator: ["video_views"] },
    higherIsBetter: false,
  }),
  video_q25_rate: m({
    id: "video_q25_rate",
    label: "Spelad till 25 %",
    description: "Andel av exponeringarna där videon spelades till 25 %.",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_q25"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  video_q50_rate: m({
    id: "video_q50_rate",
    label: "Spelad till 50 %",
    description: "Andel av exponeringarna där videon spelades till 50 %.",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_q50"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  video_q75_rate: m({
    id: "video_q75_rate",
    label: "Spelad till 75 %",
    description: "Andel av exponeringarna där videon spelades till 75 %.",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_q75"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  video_q100_rate: m({
    id: "video_q100_rate",
    label: "Spelad till 100 %",
    description: "Andel av exponeringarna där videon spelades till 100 %.",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_completions"], denominator: ["impressions"] },
    higherIsBetter: true,
  }),
  video_completion_rate: m({
    id: "video_completion_rate",
    label: "Andel sett klart",
    format: "percent",
    aggregation: "derived",
    formula: { numerator: ["video_completions"], denominator: ["video_starts"] },
    higherIsBetter: true,
  }),
};

export const DIMENSIONS: Record<DimensionId, DimensionDefinition> = {
  date: { id: "date", label: "Datum" },
  source: { id: "source", label: "Källa" },
  campaign: { id: "campaign", label: "Kampanj" },
  ad_set: { id: "ad_set", label: "Annonsgrupp" },
  ad: { id: "ad", label: "Annons" },
  keyword: { id: "keyword", label: "Sökord" },
  country: { id: "country", label: "Land" },
  region: { id: "region", label: "Region" },
  device: { id: "device", label: "Enhet" },
  age: { id: "age", label: "Ålder" },
  gender: { id: "gender", label: "Kön" },
  age_gender: { id: "age_gender", label: "Kön och ålder" },
  search_term: { id: "search_term", label: "Sökterm" },
  landing_page: { id: "landing_page", label: "Landningssida" },
  channel_type: { id: "channel_type", label: "Kanaltyp" },
  page_title: { id: "page_title", label: "Sidtitel" },
  city: { id: "city", label: "Stad" },
  region_country: { id: "region_country", label: "Region och land" },
  conversion: { id: "conversion", label: "Konvertering" },
  campaign_conversion: { id: "campaign_conversion", label: "Kampanj och konvertering" },
  campaign_ad_set: { id: "campaign_ad_set", label: "Kampanj och annonsgrupp" },
  campaign_device: { id: "campaign_device", label: "Kampanj och enhet" },
  campaign_region: { id: "campaign_region", label: "Kampanj och region" },
  page_channel: { id: "page_channel", label: "Sida och trafikkälla" },
  channel_group: { id: "channel_group", label: "Trafikkälla" },
  page_path: { id: "page_path", label: "Sida" },
  industry: { id: "industry", label: "Bransch" },
  job_title: { id: "job_title", label: "Jobbtitel" },
  seniority: { id: "seniority", label: "Yrkesnivå" },
  company: { id: "company", label: "Företag" },
};

export const isDerived = (id: MetricId) => METRICS[id].aggregation === "derived";

/** De additiva metrics som krävs för att räkna ut `id` (eller id självt). */
export function requiredBaseMetrics(id: MetricId): MetricId[] {
  const f = METRICS[id].formula;
  return f ? [...new Set([...f.numerator, ...f.denominator])] : [id];
}

/** Summor per metric. Kan även innehålla källbegränsade nycklar som "sessions@ga4". */
export type MetricSums = Partial<Record<string, number>>;

/**
 * Räknar ut ett metric-värde från summor. Beräknade metrics räknas ALLTID om
 * från summorna – aldrig som medelvärde av dagliga kvoter.
 * Returnerar null när nämnaren är 0 eller data saknas.
 */
export function computeMetric(id: MetricId, sums: MetricSums): number | null {
  const def = METRICS[id];
  if (!def.formula) {
    const v = sums[id];
    return v === undefined ? null : v;
  }
  const { numerator, denominator, multiplier = 1, complement } = def.formula;
  const sum = (ids: MetricId[]) => {
    let total = 0;
    for (const k of ids) {
      const v = sums[k];
      if (v === undefined) return null;
      total += v;
    }
    return total;
  };
  const num = sum(numerator);
  const den = sum(denominator);
  if (num === null || den === null || den === 0) return null;
  const ratio = (num / den) * multiplier;
  return complement ? 1 - ratio : ratio;
}

export type Delta =
  /** Ingen jämförelsedata alls. */
  | { kind: "none" }
  /** Föregående period var 0 och nuvarande > 0. */
  | { kind: "new" }
  /** Båda 0 eller oförändrat. */
  | { kind: "flat"; previous: number }
  | {
      kind: "change";
      previous: number;
      /** Relativ förändring, 0.12 = +12 % */
      relative: number;
      /** Absolut förändring i metricens enhet. */
      absolute: number;
      /** För procent-metrics: förändring i procentenheter (0.012 = +1,2 pp). */
      percentagePoints?: number;
      /** true/false om förändringen är bra/dålig för kunden (styr färgen), null = neutral. */
      favorable: boolean | null;
    };

/** En metric anges antingen som inbyggt id eller som metadata (t.ex. en egen formel). */
export type MetricRef = MetricId | Pick<MetricDefinition, "format" | "higherIsBetter">;
const resolve = (ref: MetricRef) => (typeof ref === "string" ? METRICS[ref] : ref);

export function computeDelta(id: MetricRef, current: number | null, previous: number | null): Delta {
  if (previous === null || current === null) return { kind: "none" };
  if (previous === 0) return current === 0 ? { kind: "flat", previous } : { kind: "new" };
  const absolute = current - previous;
  if (absolute === 0) return { kind: "flat", previous };
  const def = resolve(id);
  return {
    kind: "change",
    previous,
    relative: absolute / Math.abs(previous),
    absolute,
    percentagePoints: def.format === "percent" ? absolute : undefined,
    favorable: def.higherIsBetter === null ? null : def.higherIsBetter ? absolute > 0 : absolute < 0,
  };
}
