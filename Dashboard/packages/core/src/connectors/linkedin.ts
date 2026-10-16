/**
 * LinkedIn Ads – riktig connector via Marketing API (Advertising API).
 *
 *  - OAuth 2.0 med r_ads + r_ads_reporting (endast läsning).
 *  - Konton: adAccounts-sökning (konton inloggningen har åtkomst till).
 *  - Data: adAnalytics per dag med pivoter: kampanj, annons och demografi
 *    (jobbtitel, yrkesnivå, bransch, företag, region). Demografi är
 *    approximerad av LinkedIn (integritetsgränser, minst 3 händelser, topp 100).
 *  - URN:er (urn:li:title:123 m.fl.) översätts till namn; misslyckas det visas
 *    ett läsbart reservnamn i stället för att synken fallerar.
 *
 * Versionen sätts med LINKEDIN_API_VERSION (YYYYMM); LinkedIn stödjer varje version i ett år.
 */
import { chunkRange } from "../dates";
import { RateLimiter, retryAfterMs, withRetry } from "../http";
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

const SCOPES = ["r_ads", "r_ads_reporting"];

function cfg() {
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    authBase: process.env.LINKEDIN_AUTH_BASE ?? "https://www.linkedin.com",
    apiBase: process.env.LINKEDIN_API_BASE ?? "https://api.linkedin.com",
    version: process.env.LINKEDIN_API_VERSION ?? "202609",
  };
}

const limiter = new RateLimiter(4);

async function check(res: Response, what: string) {
  if (res.ok) return res;
  const body = (await res.json().catch(() => ({}))) as { message?: string; serviceErrorCode?: number; error?: string; error_description?: string };
  const msg = body.message ?? body.error_description ?? body.error ?? res.statusText;
  if (body.error === "invalid_grant") throw new ConnectorAuthError(`LinkedIn-behörigheten har återkallats: ${msg}`, "connection", "revoked");
  if (res.status === 401) throw new ConnectorAuthError(`LinkedIn-token är ogiltig: ${msg}`, "connection", "expired");
  if (res.status === 403) throw new ConnectorAuthError(`Inloggningen saknar åtkomst (${what}): ${msg}`, "account", "no_access");
  if (res.status === 429 || res.status >= 500) throw new ConnectorRetryableError(`LinkedIn svarade ${res.status} (${what}): ${msg}`, retryAfterMs(res.headers.get("retry-after")) ?? (res.status === 429 ? 60_000 : undefined));
  throw new Error(`LinkedIn svarade ${res.status} (${what}): ${msg}`);
}

async function rest<T>(tokens: TokenSet, pathAndQuery: string, what: string): Promise<T> {
  const c = cfg();
  return limiter.run(() =>
    withRetry(async () => {
      const res = await fetch(`${c.apiBase}/rest/${pathAndQuery}`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}`, "LinkedIn-Version": c.version, "X-Restli-Protocol-Version": "2.0.0" },
        signal: AbortSignal.timeout(90_000),
      });
      await check(res, what);
      return (await res.json()) as T;
    }),
  );
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const c = cfg();
  const res = await fetch(`${c.authBase}/oauth/v2/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...params }),
    signal: AbortSignal.timeout(20_000),
  });
  await check(res, "token");
  const t = (await res.json()) as { access_token: string; expires_in?: number; refresh_token?: string; scope?: string };
  return { accessToken: t.access_token, refreshToken: t.refresh_token ?? params.refresh_token, expiresAt: Date.now() + (t.expires_in ?? 5_184_000) * 1000, scope: t.scope };
}

const oauth: OAuthConfig = {
  type: "oauth2",
  scopes: SCOPES,
  getAuthorizationUrl({ state, redirectUri }) {
    const q = new URLSearchParams({ response_type: "code", client_id: cfg().clientId, redirect_uri: redirectUri, state, scope: SCOPES.join(" ") });
    return `${cfg().authBase}/oauth/v2/authorization?${q}`;
  },
  exchangeCode: ({ code, redirectUri }) => tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  async refresh(tokens) {
    if (!tokens.refreshToken) throw new ConnectorAuthError("LinkedIn-token har gått ut och saknar refresh token – koppla om.", "connection", "revoked");
    return tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refreshToken });
  },
};

const enc = encodeURIComponent;
const dateObj = (d: string) => `(year:${Number(d.slice(0, 4))},month:${Number(d.slice(5, 7))},day:${Number(d.slice(8, 10))})`;
const accountUrn = (id: string) => (id.startsWith("urn:") ? id : `urn:li:sponsoredAccount:${id}`);
const idOf = (urn: string) => urn.split(":").pop()!;

/** Pivoter och hur deras URN:er översätts till namn. */
const PIVOTS: Partial<Record<DimensionId, { pivot: string; resolve: "campaign" | "creative" | "standard"; collection?: string; fallback: string }>> = {
  campaign: { pivot: "CAMPAIGN", resolve: "campaign", fallback: "Kampanj" },
  ad: { pivot: "CREATIVE", resolve: "creative", fallback: "Annons" },
  job_title: { pivot: "MEMBER_JOB_TITLE", resolve: "standard", collection: "titles", fallback: "Jobbtitel" },
  seniority: { pivot: "MEMBER_SENIORITY", resolve: "standard", collection: "seniorities", fallback: "Yrkesnivå" },
  industry: { pivot: "MEMBER_INDUSTRY", resolve: "standard", collection: "industries", fallback: "Bransch" },
  company: { pivot: "MEMBER_COMPANY", resolve: "standard", collection: "organizationsLookup", fallback: "Företag" },
  region: { pivot: "MEMBER_REGION_V2", resolve: "standard", collection: "geo", fallback: "Region" },
};

const FIELD_MAP: Partial<Record<MetricId, string>> = {
  spend: "costInLocalCurrency",
  impressions: "impressions",
  clicks: "clicks",
  conversions: "externalWebsiteConversions",
  engagements: "totalEngagements",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  follows: "follows",
  video_starts: "videoStarts",
  video_views: "videoViews",
  video_q25: "videoFirstQuartileCompletions",
  video_q50: "videoMidpointCompletions",
  video_q75: "videoThirdQuartileCompletions",
  video_completions: "videoCompletions",
};

type Localized = { localized?: Record<string, string> } | string | undefined;
const localizedName = (n: Localized) => (typeof n === "string" ? n : n?.localized ? (n.localized.sv_SE ?? n.localized.en_US ?? Object.values(n.localized)[0]) : undefined);

/** Slår upp namn för URN:er i en standardiserad samling; tål fel (ger reservnamn). */
async function resolveNames(tokens: TokenSet, accountId: string, spec: NonNullable<(typeof PIVOTS)[DimensionId]>, urns: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(urns.map(idOf))];
  try {
    if (spec.resolve === "campaign" || spec.resolve === "creative") {
      const path = spec.resolve === "campaign" ? "adCampaigns?q=search&pageSize=1000" : "creatives?q=criteria&pageSize=100";
      const res = await rest<{ elements?: { id: string | number; name?: string }[] }>(tokens, `adAccounts/${idOf(accountId)}/${path}`, "läsa namn");
      for (const e of res.elements ?? []) out.set(idOf(String(e.id)), e.name ?? `${spec.fallback} ${idOf(String(e.id))}`);
    } else {
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const res = await rest<{ results?: Record<string, { name?: Localized; localizedName?: string; defaultLocalizedName?: Localized }> }>(
          tokens,
          `${spec.collection}?ids=List(${batch.map(enc).join(",")})`,
          "läsa namn",
        );
        for (const [id, v] of Object.entries(res.results ?? {})) {
          const name = v.localizedName ?? localizedName(v.name) ?? localizedName(v.defaultLocalizedName);
          if (name) out.set(idOf(id), name);
        }
      }
    }
  } catch {
    // Namnuppslagning är inte kritisk – synken fortsätter med reservnamn.
  }
  for (const id of ids) if (!out.has(id)) out.set(id, `${spec.fallback} ${id}`);
  return out;
}

export const linkedinConnector: Connector = {
  id: "linkedin_ads",
  platform: "linkedin_ads",
  label: "LinkedIn Ads",
  isConfigured: () => Boolean(cfg().clientId && cfg().clientSecret),
  auth: oauth,

  async listAccounts({ tokens }) {
    const out: ExternalAccount[] = [];
    let pageToken = "";
    do {
      const res = await rest<{ elements?: { id: number; name: string; currency: string; status: string; reference?: string }[]; metadata?: { nextPageToken?: string } }>(
        tokens,
        `adAccounts?q=search&search=(status:(values:List(ACTIVE,DRAFT)))&pageSize=100${pageToken ? `&pageToken=${enc(pageToken)}` : ""}`,
        "lista annonskonton",
      );
      // LinkedIn rapporterar dagar i UTC.
      for (const a of res.elements ?? []) out.push({ externalId: accountUrn(String(a.id)), name: a.name, currency: a.currency, timezone: "UTC" });
      pageToken = res.metadata?.nextPageToken ?? "";
    } while (pageToken);
    return out;
  },

  availableMetrics: () => Object.keys(FIELD_MAP) as MetricId[],
  availableDimensions: () => ["date", ...(Object.keys(PIVOTS) as DimensionId[])],

  async fetch({ tokens }, query: FetchQuery) {
    const extra = query.dimensions.filter((d) => d !== "date");
    if (extra.length > 1) throw new Error("LinkedIn-connectorn hämtar max en dimension utöver datum per anrop.");
    const dim = extra[0];
    const spec = dim ? PIVOTS[dim] : undefined;
    if (dim && !spec) throw new Error(`Dimensionen ${dim} finns inte i LinkedIn.`);
    const wanted = query.metrics.filter((m) => FIELD_MAP[m]);
    const fields = [...wanted.map((m) => FIELD_MAP[m]!), "dateRange", "pivotValues"].join(",");

    // Högst 15 000 rader per svar: demografi hämtas i kortare bitar.
    const raw: { date: string; urn: string; metrics: NormalizedRow["metrics"] }[] = [];
    for (const part of chunkRange(query.dateRange, spec?.resolve === "standard" ? 31 : 90)) {
      const res = await rest<{ elements?: Record<string, unknown>[] }>(
        tokens,
        `adAnalytics?q=analytics&pivot=${spec?.pivot ?? "ACCOUNT"}&timeGranularity=DAILY&dateRange=(start:${dateObj(part.start)},end:${dateObj(part.end)})&accounts=List(${enc(accountUrn(query.account.externalId))})&fields=${fields}`,
        "hämta statistik",
      );
      for (const e of res.elements ?? []) {
        const s = (e.dateRange as { start: { year: number; month: number; day: number } }).start;
        const date = `${s.year}-${String(s.month).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
        const metrics: NormalizedRow["metrics"] = {};
        for (const m of wanted) metrics[m] = Number(e[FIELD_MAP[m]!] ?? 0);
        raw.push({ date, urn: ((e.pivotValues as string[] | undefined) ?? [""])[0]!, metrics });
      }
    }
    const names = spec ? await resolveNames(tokens, query.account.externalId, spec, raw.map((r) => r.urn)) : new Map<string, string>();
    return {
      currency: query.account.currency ?? "SEK",
      rows: raw.map((r) => ({ date: r.date, dims: dim ? { [dim]: dim === "ad" ? idOf(r.urn) : (names.get(idOf(r.urn)) ?? r.urn) } : {}, metrics: r.metrics })),
    };
  },

  async fetchCreatives({ tokens }, account) {
    const res = await rest<{ elements?: { id: string; name?: string; content?: { reference?: string } }[] }>(tokens, `adAccounts/${idOf(account.externalId)}/creatives?q=criteria&pageSize=100`, "hämta annonser");
    const out: CreativeEntity[] = [];
    for (const c of res.elements ?? []) {
      const entity: CreativeEntity = { externalId: idOf(c.id), name: c.name ?? `Annons ${idOf(c.id)}` };
      // Text och bild hämtas från inlägget annonsen bygger på; best effort.
      if (c.content?.reference) {
        try {
          const post = await rest<{ commentary?: string; content?: { media?: { id?: string; title?: string }; article?: { title?: string; thumbnail?: string } } }>(tokens, `posts/${enc(c.content.reference)}`, "hämta inlägg");
          entity.text = post.commentary;
          entity.headline = post.content?.media?.title ?? post.content?.article?.title;
          const media = post.content?.media?.id ?? post.content?.article?.thumbnail;
          if (media?.startsWith("urn:li:image")) {
            const img = await rest<{ downloadUrl?: string }>(tokens, `images/${enc(media)}`, "hämta bild");
            entity.thumbnailUrl = img.downloadUrl;
          }
          if (media?.startsWith("urn:li:video")) entity.format = "video";
        } catch {
          // Annonsen visas utan text/bild hellre än att synken fallerar.
        }
      }
      out.push(entity);
    }
    return out;
  },
};

