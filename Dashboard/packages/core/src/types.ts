/**
 * Gemensamma typer för connector-lagret. Allt som lämnar en connector är
 * normaliserat: kanoniska metric-id:n, kanoniska dimensioner och datum som
 * "YYYY-MM-DD" i kontots tidszon.
 */

export type PlatformId = "ga4" | "google_ads" | "meta_ads" | "linkedin_ads" | "tiktok_ads";

export type MetricId =
  // Additiva (lagras och summeras)
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "conversion_value"
  | "sessions"
  | "users"
  | "new_users"
  | "engaged_sessions"
  | "session_duration"
  | "video_starts"
  | "video_views"
  | "video_q25"
  | "video_q50"
  | "video_q75"
  | "video_completions"
  | "likes"
  | "comments"
  | "shares"
  | "follows"
  | "engagements"
  | "link_clicks"
  | "saves"
  | "reactions"
  | "page_views"
  | "engagement_time"
  // Unika personer över perioden (hämtas per period, summeras aldrig över dagar)
  | "reach"
  | "ad_recallers"
  // Beräknade (räknas alltid om från summor)
  | "ctr"
  | "cpc"
  | "cpm"
  | "cpa"
  | "roas"
  | "conversion_rate"
  | "engagement_rate"
  | "session_engagement_rate"
  | "bounce_rate"
  | "avg_session_duration"
  | "new_user_share"
  | "video_view_rate"
  | "video_completion_rate"
  | "frequency"
  | "eri"
  | "ad_recall_rate"
  | "link_ctr"
  | "views_per_user"
  | "avg_engagement_time"
  | "view_rate"
  | "cpv"
  | "video_q25_rate"
  | "video_q50_rate"
  | "video_q75_rate"
  | "video_q100_rate";

export type DimensionId =
  | "date"
  /** Pseudodimension: vilken källa (plattform) värdet kommer från. */
  | "source"
  | "campaign"
  | "ad_set"
  | "ad"
  | "keyword"
  | "country"
  | "region"
  | "device"
  | "age"
  | "gender"
  /** Kön och ålder i en dimension, t.ex. "Kvinna, 65+" */
  | "age_gender"
  /** Google Ads: söktermer som utlöst annonser */
  | "search_term"
  /** Google Ads: annonsens landningssida */
  | "landing_page"
  /** Google Ads: kampanjtyp (Sök, YouTube, Performance Max …) */
  | "channel_type"
  /** GA4: sidans titel */
  | "page_title"
  | "city"
  /** Region och land, t.ex. "Skåne · Sverige" */
  | "region_country"
  /** Konvertering (custom conversion eller standardhändelse som köp) */
  | "conversion"
  /** Kampanj och konvertering, t.ex. "Höst · Köp" */
  | "campaign_conversion"
  /** Tabeller med två dimensioner: kampanj och annonsgrupp/enhet/region, sida och trafikkälla */
  | "campaign_ad_set"
  | "campaign_device"
  | "campaign_region"
  | "page_channel"
  | "channel_group"
  | "page_path"
  | "industry"
  | "job_title"
  | "seniority"
  | "company";

export type MetricFormat = "number" | "currency" | "percent" | "duration";

export type MetricAggregation =
  /** Summeras över dagar och källor. */
  | "sum"
  /**
   * Summeras, men summan är en approximation (t.ex. unika användare över flera
   * dagar). UI:t markerar värdet med en fotnot.
   */
  | "sum_approx"
  /**
   * Unika personer över hela perioden (t.ex. räckvidd). Hämtas från plattformen för
   * exakt den perioden och summeras aldrig över dagar.
   */
  | "period"
  /** Beräknas från andra metrics via `formula`. */
  | "derived";

export interface MetricDefinition {
  id: MetricId;
  label: string;
  shortLabel?: string;
  description?: string;
  format: MetricFormat;
  aggregation: MetricAggregation;
  /** För beräknade: (summa(numerator) [- summa(subtract)]) / summa(denominator) * multiplier */
  formula?: {
    numerator: MetricId[];
    denominator: MetricId[];
    multiplier?: number;
    /** "1 - x" för t.ex. bounce rate = 1 - engaged/sessions */
    complement?: boolean;
  };
  /** Avgör om en ökning färgas grön (true), röd (false) eller neutralt (null, t.ex. spend). */
  higherIsBetter: boolean | null;
}

export interface DimensionDefinition {
  id: DimensionId;
  label: string;
}

export interface DateRange {
  /** Inklusive, "YYYY-MM-DD" */
  start: string;
  /** Inklusive, "YYYY-MM-DD" */
  end: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms */
  expiresAt?: number;
  scope?: string;
  /** Plattformsspecifika extra fält (t.ex. login-customer-id). */
  extra?: Record<string, string>;
}

export interface ExternalAccount {
  externalId: string;
  name: string;
  currency?: string;
  timezone?: string;
  /** T.ex. "MCC 123-456-7890" eller "Business Manager X" */
  parentName?: string;
}

export interface ConnectorContext {
  tokens: TokenSet;
}

export interface FetchQuery {
  account: ExternalAccount;
  metrics: MetricId[];
  /** "date" ingår alltid implicit. Max en extra dimension per fetch. */
  dimensions: DimensionId[];
  dateRange: DateRange;
}

/** Värden för en hel period (t.ex. räckvidd), som inte kan summeras dag för dag. */
export interface PeriodQuery {
  account: ExternalAccount;
  metrics: MetricId[];
  /** Valfri uppdelning, t.ex. ålder eller kampanj. */
  dimension?: DimensionId;
  dateRange: DateRange;
  /** Filter som plattformen själv tillämpar (t.ex. bara vissa kampanjer), så att unika personer räknas rätt. */
  filters?: { dimension: DimensionId; op: "in" | "not_in" | "contains" | "not_contains"; values: string[] }[];
}

export interface PeriodRow {
  dims: Partial<Record<DimensionId, string>>;
  metrics: Partial<Record<MetricId, number>>;
}

export interface NormalizedRow {
  date: string;
  dims: Partial<Record<DimensionId, string>>;
  /** Endast additiva metrics, i kontots originalvaluta. */
  metrics: Partial<Record<MetricId, number>>;
}

/**
 * Slår ihop rader med samma datum och dimensionsvärden genom att summera.
 * Plattformar kan ge flera rader som blir samma värde efter normalisering
 * (t.ex. Metas "iphone" och "android_smartphone" → "Mobil", eller två kampanjer
 * med samma namn). Alla sparade metrics är additiva, så summan är korrekt.
 */
export function mergeDuplicateRows(rows: NormalizedRow[]): NormalizedRow[] {
  const byKey = new Map<string, NormalizedRow>();
  for (const r of rows) {
    const key = JSON.stringify([r.date, Object.entries(r.dims).sort(([a], [b]) => a.localeCompare(b))]);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { date: r.date, dims: r.dims, metrics: { ...r.metrics } });
      continue;
    }
    for (const [k, v] of Object.entries(r.metrics) as [MetricId, number][]) prev.metrics[k] = (prev.metrics[k] ?? 0) + v;
  }
  return [...byKey.values()];
}

export interface FetchResult {
  /** ISO 4217, valutan som spend/conversion_value är uttryckta i. */
  currency: string;
  rows: NormalizedRow[];
}

export interface CreativeEntity {
  externalId: string;
  name: string;
  /** Hela texten, aldrig trunkerad i datalagret. */
  text?: string;
  headline?: string;
  /** Bästa bilden för annonsen. Laddas ner och sparas vid synk (plattformarnas länkar slutar gälla). */
  thumbnailUrl?: string;
  format?: "image" | "video" | "carousel" | "text";
  campaign?: string;
  /** Länk till inlägget hos plattformen (t.ex. Instagram). */
  permalink?: string;
  /** Opak referens som connectorn själv använder i resolveMedia (t.ex. "ig:<id>"). */
  mediaRef?: string;
}

/** Spelbar media för en annons. Plattformarnas länkar är kortlivade och hämtas därför vid uppspelning. */
export type PlayableMedia = { kind: "video"; url: string; poster?: string } | { kind: "iframe"; url: string; width: number; height: number };

export interface OAuthConfig {
  type: "oauth2";
  /** Minsta möjliga, endast läsrättigheter. */
  scopes: string[];
  getAuthorizationUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(params: { code: string; redirectUri: string }): Promise<TokenSet>;
  refresh(tokens: TokenSet): Promise<TokenSet>;
}

/**
 * Inloggning med en token som användaren klistrar in en gång, t.ex. Metas
 * systemanvändar-token från byråns Business Manager. Ingen OAuth-redirect.
 */
export interface TokenAuthConfig {
  type: "token";
  /** Minsta möjliga behörigheter som token ska ha (visas i UI:t). */
  scopes: string[];
  /** Vad användaren ska klistra in, t.ex. "Systemanvändar-token". */
  tokenLabel: string;
  /** Kort instruktion som visas vid inklistringen. */
  help: string;
  helpUrl?: string;
  /** Kontrollerar token mot plattformen och returnerar inloggningens namn. */
  validate(token: string): Promise<{ label: string; tokens: TokenSet }>;
}

export interface Connector {
  /** Unikt id, t.ex. "ga4" eller "mock_ga4". */
  id: string;
  /** Vilken plattform datan representerar. Mallar och merge matchar på plattform. */
  platform: PlatformId;
  label: string;
  isMock?: boolean;
  /** false när appens nycklar (t.ex. GOOGLE_CLIENT_ID) saknas – kopplingen visas då som ej tillgänglig. */
  isConfigured?(): boolean;
  auth: OAuthConfig | TokenAuthConfig;
  listAccounts(ctx: ConnectorContext): Promise<ExternalAccount[]>;
  availableMetrics(): MetricId[];
  availableDimensions(): DimensionId[];
  fetch(ctx: ConnectorContext, query: FetchQuery): Promise<FetchResult>;
  /** Valfri: kreativ/annonsmetadata för annonsgalleriet. */
  fetchCreatives?(ctx: ConnectorContext, account: ExternalAccount): Promise<CreativeEntity[]>;
  /** Metrics med aggregation "period" som connectorn kan hämta för en hel period. */
  periodMetrics?(): MetricId[];
  /** Hämtar periodvärden (t.ex. räckvidd) för exakt den perioden. Filter som inte stöds kastar fel. */
  fetchPeriod?(ctx: ConnectorContext, query: PeriodQuery): Promise<PeriodRow[]>;
  /** Färsk länk för uppspelning av en annons (video eller plattformens förhandsvisning). */
  resolveMedia?(ctx: ConnectorContext, account: ExternalAccount, ad: { externalId: string; mediaRef?: string | null }): Promise<PlayableMedia | null>;
}

/**
 * Fel som betyder att användaren måste koppla om. `scope` avgör om hela
 * inloggningen är ogiltig (alla konton påverkas) eller bara åtkomsten till
 * ett enskilt konto/property.
 */
export class ConnectorAuthError extends Error {
  readonly kind = "auth";
  constructor(
    message: string,
    readonly scope: "connection" | "account" = "connection",
    /** "expired" = access token ogiltig men kan förnyas; "revoked" = inloggningen återkallad. */
    readonly reason: "expired" | "revoked" | "no_access" = "revoked",
  ) {
    super(message);
  }
}

/** Tillfälligt fel (rate limit, 5xx) som ska försökas igen med backoff. */
export class ConnectorRetryableError extends Error {
  readonly kind = "retryable";
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/** OAuth-konfigurationen för en connector som loggar in via redirect (kastar annars). */
export function oauthOf(connector: Connector): OAuthConfig {
  if (connector.auth.type !== "oauth2") throw new Error(`${connector.label} använder inte OAuth`);
  return connector.auth;
}
