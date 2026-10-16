import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFakeGoogle } from "../src/dev/fake-google";
import { ConnectorAuthError, oauthOf, type TokenSet } from "../src";
import { googleAdsConnector as ads, parseCustomer } from "../src/connectors/google-ads";

let fake: Awaited<ReturnType<typeof startFakeGoogle>>;
let tokens: TokenSet;
const redirectUri = "http://localhost:3000/api/connect/callback";

beforeAll(async () => {
  fake = await startFakeGoogle();
  Object.assign(process.env, fake.env);
  const consent = await (await fetch(oauthOf(ads).getAuthorizationUrl({ state: "s", redirectUri }))).text();
  const code = new URL(/href="([^"]+)">Tillåt/.exec(consent)![1]!.replaceAll("&amp;", "&")).searchParams.get("code")!;
  tokens = await oauthOf(ads).exchangeCode({ code, redirectUri });
});
afterAll(() => fake.close());

describe("Google Ads", () => {
  it("begär adwords-scope via samma Google-klient som GA4", () => {
    expect(new URL(oauthOf(ads).getAuthorizationUrl({ state: "s", redirectUri })).searchParams.get("scope")).toContain("https://www.googleapis.com/auth/adwords");
  });

  it("listar direktkopplade konton och kundkonton under byråns MCC", async () => {
    const accounts = await ads.listAccounts({ tokens });
    const ids = accounts.map((a) => a.externalId);
    expect(ids).toContain("555-010-2020");
    expect(ids).toContain("123-456-7890@987-654-3210");
    expect(ids.some((i) => i.startsWith("987-654-3210@"))).toBe(false); // MCC:n själv är inget annonskonto
    expect(accounts.find((a) => a.externalId.startsWith("987-654-3211"))).toMatchObject({ currency: "USD", parentName: "MCC Bästa Kompisar MCC" });
  });

  it("skickar login-customer-id för konton under MCC och räknar om micros", async () => {
    expect(parseCustomer("123-456-7890@987-654-3210")).toEqual({ customer: "1234567890", manager: "9876543210" });
    const res = await ads.fetch({ tokens }, { account: { externalId: "123-456-7890@987-654-3210", name: "K", currency: "SEK" }, metrics: ["spend", "clicks"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-31" } });
    expect(res.rows).toHaveLength(31);
    expect(res.rows[0]!.metrics.spend).toBeGreaterThan(0);
    // Micros → kronor ger hela ören (med flyttalsmarginal).
    const cents = res.rows[0]!.metrics.spend! * 100;
    expect(Math.abs(cents - Math.round(cents))).toBeLessThan(1e-6);
  });

  it("ger samma totaler som källan per sökord och kampanj", async () => {
    const { getConnector } = await import("../src/server");
    const dateRange = { start: "2025-02-01", end: "2025-04-30" };
    for (const dim of ["keyword", "campaign"] as const) {
      const expected = await getConnector("mock_google_ads").fetch({ tokens: { accessToken: "x" } }, { account: { externalId: "123-456-7890" , name: "K" }, metrics: ["clicks"], dimensions: [dim], dateRange });
      const res = await ads.fetch({ tokens }, { account: { externalId: "123-456-7890@987-654-3210", name: "K" }, metrics: ["clicks"], dimensions: [dim], dateRange });
      const sum = (rows: { metrics: { clicks?: number } }[]) => rows.reduce((s, r) => s + (r.metrics.clicks ?? 0), 0);
      expect(sum(res.rows)).toBe(sum(expected.rows));
    }
  });

  it("översätter enheter till svenska", async () => {
    const res = await ads.fetch({ tokens }, { account: { externalId: "555-010-2020", name: "D" }, metrics: ["clicks"], dimensions: ["device"], dateRange: { start: "2025-01-01", end: "2025-01-07" } });
    expect(new Set(res.rows.map((r) => r.dims.device))).toEqual(new Set(["Mobil", "Dator", "Surfplatta"]));
  });

  it("saknad åtkomst till ett kundkonto påverkar bara det kontot", async () => {
    const err = await ads.fetch({ tokens }, { account: { externalId: "403-000-0001@987-654-3210", name: "X" }, metrics: ["clicks"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-02" } }).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorAuthError);
    expect(err.scope).toBe("account");
  });

  it("YouTube: videovisningar och kvartiler (andel av exponeringar → antal)", async () => {
    const res = await ads.fetch({ tokens }, { account: { externalId: "555-010-2020", name: "D" }, metrics: ["impressions", "video_views", "video_q25", "video_q50", "video_q75", "video_completions"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-31" } });
    const sum = (k: string) => res.rows.reduce((s, r) => s + ((r.metrics as Record<string, number>)[k] ?? 0), 0);
    expect(sum("video_views")).toBeGreaterThan(0);
    // Kvartilerna avtar: fler ser 25 % än 100 %.
    expect(sum("video_q25")).toBeGreaterThan(sum("video_q50"));
    expect(sum("video_q75")).toBeGreaterThan(sum("video_completions"));
    expect(sum("video_q25") / sum("impressions")).toBeCloseTo(0.3, 1);
  });

  it("söktermer, landningssidor och kanaltyp", async () => {
    const q = (dim: "search_term" | "landing_page" | "channel_type") =>
      ads.fetch({ tokens }, { account: { externalId: "555-010-2020", name: "D" }, metrics: ["clicks", "video_views"], dimensions: [dim], dateRange: { start: "2025-01-01", end: "2025-01-14" } });
    const terms = await q("search_term");
    expect(terms.rows.some((r) => r.dims.search_term === "spara pension själv")).toBe(true);
    // Söktermer har inga videonyckeltal (frågas inte efter).
    expect(terms.rows.every((r) => r.metrics.video_views === undefined)).toBe(true);
    const pages = await q("landing_page");
    expect(pages.rows.some((r) => r.dims.landing_page === "demofinans.se/pension")).toBe(true);
    const types = await q("channel_type");
    expect(new Set(types.rows.map((r) => r.dims.channel_type))).toEqual(new Set(["Sök", "YouTube", "Performance Max", "Display"]));
  });

  it("två dimensioner: kampanj · annonsgrupp och kampanj · enhet summerar som kampanjerna", async () => {
    const q = (dim: "campaign" | "campaign_ad_set" | "campaign_device") =>
      ads.fetch({ tokens }, { account: { externalId: "555-010-2020", name: "D" }, metrics: ["impressions"], dimensions: [dim], dateRange: { start: "2025-01-01", end: "2025-01-14" } });
    const byCampaign = new Map<string, number>();
    for (const r of (await q("campaign")).rows) byCampaign.set(r.dims.campaign!, (byCampaign.get(r.dims.campaign!) ?? 0) + (r.metrics.impressions ?? 0));
    for (const dim of ["campaign_ad_set", "campaign_device"] as const) {
      const sums = new Map<string, number>();
      for (const r of (await q(dim)).rows) {
        const [campaign, second] = r.dims[dim]!.split(" · ");
        expect(second).toBeTruthy();
        sums.set(campaign!, (sums.get(campaign!) ?? 0) + (r.metrics.impressions ?? 0));
      }
      expect(sums).toEqual(byCampaign);
    }
  });
});
