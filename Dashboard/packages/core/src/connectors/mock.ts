/**
 * Mock-connectors som genererar realistisk, deterministisk data i exakt samma
 * normaliserade format som de riktiga connectorerna. Samma konto + datum ger
 * alltid samma siffror, och dimensionsuppdelningar summerar exakt till dagens
 * totaler, så att merge- och normaliseringslogik kan testas mot dem.
 *
 * Felsimulering: ett externt konto-id som slutar på "-expired" kastar
 * ConnectorAuthError så länge seed-tokenen används (en ny inloggning via
 * "Koppla om" löser det), "-broken" kastar alltid ett vanligt fel.
 */
import { COMPOSITE_DIMENSIONS, joinDimension } from "../filters";
import { DIMENSIONS } from "../metrics";
import { eachDay, toDate } from "../dates";
import { gaussian, hashString, rng, sampleInteger, splitInteger } from "../random";
import {
  ConnectorAuthError,
  type Connector,
  type CreativeEntity,
  type DimensionId,
  type ExternalAccount,
  type FetchQuery,
  type MetricId,
  type NormalizedRow,
  type PlatformId,
} from "../types";

type Sums = Partial<Record<MetricId, number>>;

interface Profile {
  platform: PlatformId;
  label: string;
  accounts: ExternalAccount[];
  metrics: MetricId[];
  dimensions: Partial<Record<DimensionId, string[]>>;
  /** Sammansatta dimensioner (två delar ur `dimensions`) som plattformen kan leverera. */
  composites?: DimensionId[];
  /** Genererar dagens totaler givet en nivåfaktor (≈1) och en slumpkälla. */
  day(level: number, r: () => number, scale: number): Sums;
}

const jitter = (r: () => number, sd = 0.12) => Math.exp(gaussian(r) * sd);
const int = (n: number) => Math.max(0, Math.round(n));
const money = (n: number) => Math.max(0, Math.round(n * 100) / 100);

function adFunnel(impressions: number, r: () => number, opts: { ctr: number; cpm: number; cvr: number; aov: number }): Sums {
  const clicks = int(impressions * opts.ctr * jitter(r, 0.2));
  const spend = money((impressions / 1000) * opts.cpm * jitter(r, 0.1));
  const conversions = int(clicks * opts.cvr * jitter(r, 0.35));
  return { impressions, clicks, spend, conversions, conversion_value: money(conversions * opts.aov * jitter(r, 0.25)) };
}

function videoFunnel(impressions: number, r: () => number, startRate: number): Sums {
  const video_starts = int(impressions * startRate * jitter(r, 0.15));
  const video_views = int(video_starts * 0.27 * jitter(r, 0.1));
  const video_q25 = int(video_views * 0.68 * jitter(r, 0.05));
  const video_q50 = int(video_q25 * 0.5 * jitter(r, 0.05));
  const video_q75 = int(video_q50 * 0.7 * jitter(r, 0.05));
  const video_completions = int(video_q75 * 0.69 * jitter(r, 0.05));
  return { video_starts, video_views, video_q25, video_q50, video_q75, video_completions };
}

function social(impressions: number, r: () => number, rate: number): Sums {
  const likes = int(impressions * rate * 0.55 * jitter(r, 0.4));
  const comments = int(impressions * rate * 0.05 * jitter(r, 0.6));
  const shares = int(impressions * rate * 0.12 * jitter(r, 0.5));
  const follows = int(impressions * rate * 0.08 * jitter(r, 0.6));
  const other = int(impressions * rate * 0.2 * jitter(r, 0.4));
  return { likes, comments, shares, follows, engagements: likes + comments + shares + follows + other };
}

const CAMPAIGNS = ["Varumärke – Always on", "Pension 55+", "Barnsparande", "Rekrytering", "Retargeting"];
const DEVICES = ["Mobil", "Dator", "Surfplatta"];
const REGIONS_SE = ["Skåne", "Stockholm", "Västra Götaland", "Östergötland", "Uppsala", "Halland", "Jönköping", "Örebro"];

const PROFILES: Profile[] = [
  {
    platform: "ga4",
    label: "Google Analytics 4",
    accounts: [
      { externalId: "properties/312450981", name: "Webbplats – produktion", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "properties/312450982", name: "Kampanjsajt", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "properties/298110433", name: "Webbshop", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "properties/401229874-expired", name: "Gammal property (UA-migrering)", currency: "SEK", timezone: "Europe/Stockholm" },
    ],
    metrics: ["sessions", "users", "new_users", "engaged_sessions", "session_duration", "conversions", "page_views", "engagement_time"],
    dimensions: {
      channel_group: ["Organic Search", "Direct", "Paid Search", "Referral", "Paid Social", "Organic Social", "Email", "Unassigned"],
      page_path: ["/", "/om-oss", "/tjanster", "/tjanster/pension", "/tjanster/barnsparande", "/kontakt", "/artiklar/spara-till-pension", "/artiklar/kapitalforsakring-for-barn", "/boka-mote", "/integritetspolicy"],
      device: DEVICES,
      page_title: ["Start – Demo Finans", "Om oss", "Våra tjänster", "Pension", "Barnsparande", "Kontakta oss", "Spara till pension – guide", "Kapitalförsäkring för barn", "Boka möte", "Integritetspolicy"],
      region: REGIONS_SE,
      city: ["Stockholm", "Göteborg", "Malmö", "Helsingborg", "Uppsala", "Lund", "Linköping", "Örebro", "Jönköping", "Västerås"],
      campaign: CAMPAIGNS,
    },
    composites: ["campaign_device", "campaign_region", "page_channel"],
    day(level, r, scale) {
      const sessions = int(19 * scale * level);
      const users = int(sessions * 0.47 * jitter(r, 0.05));
      const engaged = int(sessions * 0.57 * jitter(r, 0.04));
      return {
        sessions,
        users,
        new_users: int(users * 0.8 * jitter(r, 0.05)),
        engaged_sessions: Math.min(sessions, engaged),
        session_duration: int(sessions * 150 * jitter(r, 0.15)),
        conversions: int(sessions * 0.012 * jitter(r, 0.5)),
        page_views: int(sessions * 2.3 * jitter(r, 0.08)),
        engagement_time: int(users * 95 * jitter(r, 0.15)),
      };
    },
  },
  {
    platform: "google_ads",
    label: "Google Ads",
    accounts: [
      { externalId: "123-456-7890", name: "Sök – Sverige", currency: "SEK", timezone: "Europe/Stockholm", parentName: "MCC Bästa Kompisar" },
      { externalId: "123-456-7891", name: "Performance Max", currency: "SEK", timezone: "Europe/Stockholm", parentName: "MCC Bästa Kompisar" },
      { externalId: "987-654-3210", name: "Legacy-konto (USD)", currency: "USD", timezone: "America/New_York", parentName: "MCC Bästa Kompisar" },
      { externalId: "555-010-2020-broken", name: "Testkonto med fel", currency: "SEK", timezone: "Europe/Stockholm", parentName: "MCC Bästa Kompisar" },
    ],
    metrics: ["spend", "impressions", "clicks", "conversions", "conversion_value", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"],
    dimensions: {
      campaign: CAMPAIGNS,
      channel_type: ["Sök", "YouTube", "Performance Max", "Display"],
      search_term: [
        "kapitalförsäkring barn bäst",
        "spara pension själv",
        "pensionsrådgivare malmö",
        "hur mycket ska man spara till pension",
        "barnsparande fond eller isk",
        "demo finans omdöme",
        "tjänstepension enskild firma",
        "rådgivning pension helsingborg",
      ],
      landing_page: ["demofinans.se/pension", "demofinans.se/barnsparande", "demofinans.se", "demofinans.se/boka-mote", "demofinans.se/kampanj/host"],
      ad_set: ["Pension – generiskt", "Pension – varumärke", "Barnsparande – generiskt", "Kapitalförsäkring", "Konkurrenter"],
      keyword: [
        "kapitalförsäkring barn",
        "spara till pension",
        "pensionsrådgivning malmö",
        "privat pensionssparande",
        "barnsparande fonder",
        "finansiell rådgivare helsingborg",
        "tjänstepension egenföretagare",
        "demo finans",
        "bästa sparformen för barn",
        "pensionsförsäkring",
      ],
      device: DEVICES,
      region: REGIONS_SE,
    },
    composites: ["campaign_ad_set", "campaign_device"],
    day(level, r, scale) {
      const ads = adFunnel(int(220 * scale * level), r, { ctr: 0.045, cpm: 95, cvr: 0.06, aov: 2400 });
      // YouTube-delen: Google anger kvartilerna som andel av exponeringarna.
      const imp = ads.impressions ?? 0;
      const q = (share: number) => int(imp * share * jitter(r, 0.08));
      return { ...ads, video_views: q(0.09), video_q25: q(0.3), video_q50: q(0.2), video_q75: q(0.14), video_completions: q(0.1) };
    },
  },
  {
    platform: "linkedin_ads",
    label: "LinkedIn Ads",
    accounts: [
      { externalId: "urn:li:sponsoredAccount:508812341", name: "Huvudkonto", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "urn:li:sponsoredAccount:508812342", name: "Employer branding", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "urn:li:sponsoredAccount:509990012", name: "Nordics (EUR)", currency: "EUR", timezone: "Europe/Stockholm" },
    ],
    metrics: [
      "spend", "impressions", "clicks", "conversions", "engagements", "likes", "comments", "shares", "follows",
      "video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions",
    ],
    dimensions: {
      campaign: CAMPAIGNS,
      ad: ["li_ad_1", "li_ad_2", "li_ad_3", "li_ad_4", "li_ad_5", "li_ad_6", "li_ad_7", "li_ad_8", "li_ad_9"],
      job_title: ["Owner", "Chief Executive Officer", "Project Manager", "Manager", "Salesperson", "Sales Manager", "Board Member", "Founder", "Location Manager", "Key Account Manager", "Consultant", "Chief Financial Officer"],
      seniority: ["Entry", "Senior", "Manager", "Director", "Owner", "CXO", "Partner", "VP", "Unpaid", "Training"],
      industry: [
        "Government Administration", "Business Consulting and Services", "Machinery Manufacturing", "Construction",
        "IT Services and IT Consulting", "Retail", "Technology, Information and Internet", "Real Estate",
        "Hospitals and Health Care", "Chemical Manufacturing", "Transportation Equipment Manufacturing",
      ],
      company: ["Demoföretag A", "Demoföretag B", "Demoföretag C", "Demoföretag D", "Demoföretag E", "Demoföretag F", "Demoföretag G", "Demoföretag H", "Demoföretag I", "Demoföretag J", "Demoföretag K"],
      region: [
        "Greater Helsingborg Metropolitan Area", "Greater Malmö Metropolitan Area", "Greater Stockholm Metropolitan Area",
        "Greater Gothenburg Metropolitan Area", "Greater Norrköping Metropolitan Area", "Greater Linköping Metropolitan Area",
        "Greater Västerås Metropolitan Area", "Greater Jönköping Metropolitan Area", "Greater Uppsala Metropolitan Area", "Greater Örebro Metropolitan Area",
      ],
    },
    day(level, r, scale) {
      const impressions = int(140 * scale * level);
      return {
        ...adFunnel(impressions, r, { ctr: 0.0055, cpm: 510, cvr: 0.04, aov: 0 }),
        ...social(impressions, r, 0.0055),
        ...videoFunnel(impressions, r, 0.23),
      };
    },
  },
  {
    platform: "meta_ads",
    label: "Meta Ads",
    accounts: [
      { externalId: "act_1029384756", name: "Facebook & Instagram", currency: "SEK", timezone: "Europe/Stockholm", parentName: "Business Manager Bästa Kompisar" },
      { externalId: "act_1029384757", name: "Leads-kampanjer", currency: "SEK", timezone: "Europe/Stockholm", parentName: "Business Manager Bästa Kompisar" },
      { externalId: "act_5566778899-expired", name: "Kundens eget BM", currency: "SEK", timezone: "Europe/Stockholm" },
    ],
    metrics: [
      "spend", "impressions", "clicks", "conversions", "conversion_value", "engagements", "likes", "comments", "shares", "follows",
      "video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions",
    ],
    dimensions: {
      campaign: CAMPAIGNS,
      ad_set: ["Lookalike 1 %", "Intressen – sparande", "Retargeting 30 d", "Bred – 25–65"],
      ad: ["meta_ad_1", "meta_ad_2", "meta_ad_3", "meta_ad_4", "meta_ad_5", "meta_ad_6"],
      age: ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
      gender: ["Kvinna", "Man", "Okänt"],
      device: DEVICES,
      region: REGIONS_SE,
    },
    composites: ["campaign_ad_set", "campaign_device", "campaign_region"],
    day(level, r, scale) {
      const impressions = int(2600 * scale * level);
      return {
        ...adFunnel(impressions, r, { ctr: 0.011, cpm: 62, cvr: 0.035, aov: 900 }),
        ...social(impressions, r, 0.012),
        ...videoFunnel(impressions, r, 0.31),
      };
    },
  },
  {
    platform: "tiktok_ads",
    label: "TikTok Ads",
    accounts: [
      { externalId: "7301122334455667788", name: "TikTok – Sverige", currency: "SEK", timezone: "Europe/Stockholm" },
      { externalId: "7301122334455667799", name: "TikTok – Spark Ads", currency: "SEK", timezone: "Europe/Stockholm" },
    ],
    metrics: [
      "spend", "impressions", "clicks", "conversions", "engagements", "likes", "comments", "shares", "follows",
      "video_starts", "video_views", "video_q25", "video_q50", "video_q75", "video_completions",
    ],
    dimensions: {
      campaign: CAMPAIGNS,
      ad: ["tt_ad_1", "tt_ad_2", "tt_ad_3", "tt_ad_4"],
      age: ["18–24", "25–34", "35–44", "45–54", "55+"],
      gender: ["Kvinna", "Man", "Okänt"],
    },
    day(level, r, scale) {
      const impressions = int(4100 * scale * level);
      return {
        ...adFunnel(impressions, r, { ctr: 0.008, cpm: 38, cvr: 0.02, aov: 650 }),
        ...social(impressions, r, 0.02),
        ...videoFunnel(impressions, r, 0.85),
      };
    },
  },
];

const AD_TEXTS = [
  "Demotext 1: en kort annonstext som visar hur annonsgalleriet ser ut med flera rader text.",
  "Demotext 2: här står annonsens brödtext. Den är påhittad och används bara som exempel.",
  "Demotext 3: annonsgalleriet visar text, bild och nyckeltal för varje annons.",
  "Demotext 4: en längre exempeltext för att visa hur galleriet hanterar text som bryts över flera rader utan att klippas.",
  "Demotext 5: påhittat erbjudande för att visa layouten.",
  "Demotext 6: exempel på en annons med fokus på varumärke.",
  "Demotext 7: exempel på en annons med fokus på konvertering.",
  "Demotext 8: exempel på en annons som riktar sig till en ny målgrupp.",
  "Demotext 9: exempel på en säsongsannons.",
];
const AD_HEADLINES = [
  "Demoannons 1",
  "Demoannons 2",
  "Demoannons 3",
  "Demoannons 4",
  "Demoannons 5",
  "Demoannons 6",
  "Demoannons 7",
  "Demoannons 8",
  "Demoannons 9",
];

function thumbnail(seed: string, headline: string): string {
  const r = rng(seed);
  const palettes = [
    ["#0f2a44", "#3b6ea8"],
    ["#1e293b", "#64748b"],
    ["#3f2d20", "#c2410c"],
    ["#14352b", "#4d7c0f"],
  ];
  const [bg, accent] = palettes[Math.floor(r() * palettes.length)]!;
  const words = headline.split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 18) lines[lines.length - 1] = `${last} ${w}`;
    else lines.push(w);
  }
  const text = lines
    .slice(0, 4)
    .map((l, i) => `<tspan x="40" dy="${i === 0 ? 0 : 38}">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="${bg}"/><circle cx="${300 + r() * 60}" cy="${60 + r() * 40}" r="${90 + r() * 40}" fill="${accent}" opacity="0.55"/><text x="40" y="200" font-family="Georgia, serif" font-size="30" fill="#fff">${text}</text><text x="40" y="360" font-family="Arial, sans-serif" font-size="13" letter-spacing="2" fill="#fff" opacity="0.7">ANNONS</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Nivåfaktor för en dag: säsong, veckodag, långsiktig trend och brus. */
function dayLevel(accountSeed: number, date: string): number {
  const d = toDate(date);
  const r = rng(accountSeed ^ hashString(date));
  const dayOfYear = (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000;
  const season = 1 + 0.22 * Math.cos(((dayOfYear - 20) / 365) * 2 * Math.PI) - (d.getUTCMonth() === 6 ? 0.35 : 0);
  const weekday = d.getUTCDay();
  const week = weekday === 0 || weekday === 6 ? 0.62 : weekday === 1 ? 1.12 : 1;
  const years = (d.getTime() - Date.UTC(2024, 0, 1)) / (365 * 86_400_000);
  const trend = 1 + 0.18 * years;
  const spike = r() < 0.015 ? 1.8 + r() : 1;
  return Math.max(0.05, season * week * trend * spike * jitter(r, 0.14));
}

/** Stabila vikter per dimensionsvärde (Zipf-liknande) med lite dagsvariation. */
function weightsFor(accountSeed: number, dim: DimensionId, values: string[], date: string): number[] {
  const base = rng(accountSeed ^ hashString(dim));
  const order = values.map((_, i) => i).sort(() => base() - 0.5);
  const r = rng(accountSeed ^ hashString(dim + date));
  const w = new Array<number>(values.length);
  order.forEach((idx, rank) => {
    w[idx] = (1 / Math.pow(rank + 1, 1.05)) * jitter(r, 0.25);
  });
  return w;
}

function splitDay(totals: Sums, weights: number[], r: () => number): Sums[] {
  const parts: Sums[] = weights.map(() => ({}));
  for (const [key, total] of Object.entries(totals) as [MetricId, number][]) {
    if (key === "spend" || key === "conversion_value") {
      const cents = splitInteger(Math.round(total * 100), weights);
      cents.forEach((c, i) => (parts[i]![key] = c / 100));
    } else {
      sampleInteger(total, weights, r).forEach((v, i) => (parts[i]![key] = v));
    }
  }
  // Håll relationerna rimliga i små segment (t.ex. aldrig fler engagerade besök än besök).
  for (const p of parts) {
    if (p.engaged_sessions !== undefined && p.sessions !== undefined) p.engaged_sessions = Math.min(p.engaged_sessions, p.sessions);
    if (p.clicks !== undefined && p.impressions !== undefined) p.clicks = Math.min(p.clicks, p.impressions);
  }
  return parts;
}

function createMockConnector(profile: Profile): Connector {
  const id = `mock_${profile.platform}`;
  const findAccount = (externalId: string) => profile.accounts.find((a) => a.externalId === externalId);

  return {
    id,
    platform: profile.platform,
    label: `${profile.label} (mock)`,
    isMock: true,
    auth: {
      type: "oauth2",
      scopes: ["mock.readonly"],
      getAuthorizationUrl({ state, redirectUri }) {
        const origin = new URL(redirectUri).origin;
        const q = new URLSearchParams({ connector: id, state, redirect_uri: redirectUri });
        return `${origin}/connect/mock-consent?${q}`;
      },
      async exchangeCode({ code }) {
        return { accessToken: `mock-access-${code}`, refreshToken: `mock-refresh-${code}`, expiresAt: Date.now() + 3600_000, scope: "mock.readonly" };
      },
      async refresh(tokens) {
        return { ...tokens, accessToken: `${tokens.accessToken}-r`, expiresAt: Date.now() + 3600_000 };
      },
    },
    async listAccounts() {
      return profile.accounts;
    },
    availableMetrics: () => profile.metrics,
    availableDimensions: () => ["date", ...(Object.keys(profile.dimensions) as DimensionId[]), ...(profile.composites ?? [])],

    async fetch(ctx, query: FetchQuery) {
      const { account } = query;
      if (account.externalId.endsWith("-expired") && ctx.tokens.accessToken.startsWith("seed-")) throw new ConnectorAuthError("Åtkomsttoken har återkallats av användaren.");
      if (account.externalId.endsWith("-broken")) throw new Error("API svarade 500: internal error (simulerat)");

      const known = findAccount(account.externalId) ?? account;
      const seed = hashString(`${id}:${account.externalId}`);
      const scale = 0.6 + rng(seed)() * 1.2;
      const extraDims = query.dimensions.filter((d) => d !== "date");
      if (extraDims.length > 1) throw new Error("Mock-connectorn stöder max en dimension utöver datum.");
      const dim = extraDims[0];
      // Sammansatta dimensioner: dagens del per första värdet delas vidare på andra delen.
      const parts = dim && profile.composites?.includes(dim) ? COMPOSITE_DIMENSIONS[dim] : undefined;
      const values = parts ? profile.dimensions[parts[0]]!.flatMap((a) => profile.dimensions[parts[1]]!.map((b) => joinDimension([a, b]))) : dim ? profile.dimensions[dim] : undefined;
      if (dim && !values) throw new Error(`Dimensionen ${DIMENSIONS[dim].label} finns inte för ${profile.label}.`);
      const wanted = new Set(query.metrics.filter((mId) => profile.metrics.includes(mId)));

      const rows: NormalizedRow[] = [];
      for (const date of eachDay(query.dateRange)) {
        const level = dayLevel(seed, date);
        const totals = profile.day(level, rng(seed ^ hashString(`totals:${date}`)), scale);
        const pick = (s: Sums) => Object.fromEntries(Object.entries(s).filter(([k]) => wanted.has(k as MetricId))) as Sums;
        if (!dim || !values) {
          rows.push({ date, dims: {}, metrics: pick(totals) });
          continue;
        }
        if (parts) {
          const [first, second] = [profile.dimensions[parts[0]]!, profile.dimensions[parts[1]]!];
          // Samma fördelning på första delen som den enkla dimensionen, så att summorna stämmer.
          splitDay(totals, weightsFor(seed, parts[0], first, date), rng(seed ^ hashString(`split:${parts[0]}:${date}`))).forEach((part, i) => {
            splitDay(part, weightsFor(seed ^ i, parts[1], second, date), rng(seed ^ hashString(`split:${dim}:${i}:${date}`))).forEach((sub, j) => {
              rows.push({ date, dims: { [dim]: joinDimension([first[i]!, second[j]!]) }, metrics: pick(sub) });
            });
          });
          continue;
        }
        splitDay(totals, weightsFor(seed, dim, values, date), rng(seed ^ hashString(`split:${dim}:${date}`))).forEach((part, i) => {
          rows.push({ date, dims: { [dim]: values[i]! }, metrics: pick(part) });
        });
      }
      return { currency: known.currency ?? "SEK", rows };
    },

    async fetchCreatives(_ctx, account) {
      const ads = profile.dimensions.ad ?? [];
      const seed = hashString(`${id}:${account.externalId}`);
      return ads.map((adId, i): CreativeEntity => {
        const k = (i + (seed % AD_TEXTS.length)) % AD_TEXTS.length;
        return {
          externalId: adId,
          name: `Annons ${i + 1}`,
          headline: AD_HEADLINES[k],
          text: AD_TEXTS[k],
          format: i % 4 === 3 ? "video" : "image",
          thumbnailUrl: thumbnail(`${account.externalId}:${adId}`, AD_HEADLINES[k]!),
          campaign: CAMPAIGNS[i % CAMPAIGNS.length],
        };
      });
    },
  };
}

export const mockConnectors: Connector[] = PROFILES.map(createMockConnector);
