import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFakePlatforms } from "../src/dev/fake-platforms";
import { ConnectorAuthError, oauthOf, type TokenSet } from "../src";
import { linkedinConnector as li } from "../src/connectors/linkedin";
import { tiktokConnector as tt } from "../src/connectors/tiktok";
import { getConnector } from "../src/server";

let fake: Awaited<ReturnType<typeof startFakePlatforms>>;
const redirectUri = "http://localhost:3000/api/connect/callback";

beforeAll(async () => {
  fake = await startFakePlatforms();
  Object.assign(process.env, fake.env, { TIKTOK_THROTTLE_WAIT_MS: "50" });
});
afterAll(() => fake.close());

/** Följ den simulerade samtyckessidan och returnera koden. */
async function consent(url: string, param: string) {
  const page = await (await fetch(url)).text();
  return new URL(/href="([^"]+)">Tillåt/.exec(page)![1]!.replaceAll("&amp;", "&")).searchParams.get(param)!;
}
const sum = (rows: { metrics: Partial<Record<string, number>> }[], m: string) => rows.reduce((s, r) => s + (r.metrics[m] ?? 0), 0);

describe("LinkedIn Ads", () => {
  let tokens: TokenSet;
  const account = { externalId: "urn:li:sponsoredAccount:508812341", name: "Huvudkonto", currency: "SEK" };

  it("loggar in med OAuth och bara läs-scopes", async () => {
    const url = oauthOf(li).getAuthorizationUrl({ state: "s", redirectUri });
    expect(new URL(url).searchParams.get("scope")).toBe("r_ads r_ads_reporting");
    tokens = await oauthOf(li).exchangeCode({ code: await consent(url, "code"), redirectUri });
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.expiresAt! - Date.now()).toBeGreaterThan(59 * 86_400_000);
  });

  it("listar annonskonton (dagar i UTC)", async () => {
    const accounts = await li.listAccounts({ tokens });
    expect(accounts).toHaveLength(4);
    expect(accounts[0]).toMatchObject({ externalId: "urn:li:sponsoredAccount:508812341", timezone: "UTC" });
  });

  it("översätter demografiska URN:er till namn och tappar ingen data", async () => {
    const dateRange = { start: "2025-01-01", end: "2025-03-31" };
    const expected = await getConnector("mock_linkedin_ads").fetch({ tokens: { accessToken: "x" } }, { account, metrics: ["impressions"], dimensions: ["job_title"], dateRange });
    const res = await li.fetch({ tokens }, { account, metrics: ["impressions", "engagements"], dimensions: ["job_title"], dateRange });
    expect(sum(res.rows, "impressions")).toBe(sum(expected.rows, "impressions"));
    expect(new Set(res.rows.map((r) => r.dims.job_title))).toContain("Chief Executive Officer");
  });

  it("hämtar kampanjnamn och videofunnel", async () => {
    const res = await li.fetch({ tokens }, { account, metrics: ["video_starts", "video_completions"], dimensions: ["campaign"], dateRange: { start: "2025-01-01", end: "2025-01-31" } });
    expect(new Set(res.rows.map((r) => r.dims.campaign))).toContain("Pension 55+");
    expect(sum(res.rows, "video_starts")).toBeGreaterThan(sum(res.rows, "video_completions"));
  });

  it("hämtar annonser med text och bild från inläggen", async () => {
    const ads = await li.fetchCreatives!({ tokens }, account);
    expect(ads).toHaveLength(9);
    expect(ads[0]!.text!.length).toBeGreaterThan(50);
    expect(ads[0]!.thumbnailUrl).toMatch(/^data:image/);
  });

  it("403 på ett konto påverkar bara det kontot", async () => {
    const err = await li.fetch({ tokens }, { account: { ...account, externalId: "urn:li:sponsoredAccount:403000001" }, metrics: ["clicks"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-02" } }).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorAuthError);
    expect(err.scope).toBe("account");
  });
});

describe("TikTok Ads", () => {
  let tokens: TokenSet;
  const account = { externalId: "7301122334455667788", name: "TikTok – Sverige", currency: "SEK" };

  it("auktoriserar via annonsörsflödet (auth_code) och får långlivad token", async () => {
    const url = oauthOf(tt).getAuthorizationUrl({ state: "s", redirectUri });
    tokens = await oauthOf(tt).exchangeCode({ code: await consent(url, "auth_code"), redirectUri });
    expect(tokens.accessToken).toMatch(/^tt-at-/);
    expect(await oauthOf(tt).refresh(tokens)).toEqual(tokens);
  });

  it("listar annonsörer med valuta och IANA-tidszon", async () => {
    const accounts = await tt.listAccounts({ tokens });
    expect(accounts).toHaveLength(3);
    expect(accounts[0]).toMatchObject({ currency: "SEK", timezone: "Europe/Stockholm" });
  });

  it("delar långa perioder i 30-dagarsbitar, paginerar och tappar ingen data", async () => {
    const dateRange = { start: "2025-01-01", end: "2025-06-30" };
    const expected = await getConnector("mock_tiktok_ads").fetch({ tokens: { accessToken: "x" } }, { account, metrics: ["spend", "video_starts"], dimensions: ["campaign"], dateRange });
    const res = await tt.fetch({ tokens }, { account, metrics: ["spend", "video_starts"], dimensions: ["campaign"], dateRange });
    expect(sum(res.rows, "video_starts")).toBe(sum(expected.rows, "video_starts"));
    expect(new Set(res.rows.map((r) => r.dims.campaign))).toContain("Barnsparande");
  });

  it("översätter ålder och kön och räknar engagemang", async () => {
    const age = await tt.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["age"], dateRange: { start: "2025-01-01", end: "2025-01-10" } });
    expect(new Set(age.rows.map((r) => r.dims.age))).toEqual(new Set(["18–24", "25–34", "35–44", "45–54", "55+"]));
    const tot = await tt.fetch({ tokens }, { account, metrics: ["engagements", "likes", "comments", "shares", "follows"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-10" } });
    const r = tot.rows[0]!.metrics;
    expect(r.engagements).toBe(r.likes! + r.comments! + r.shares! + r.follows!);
  });

  it("kod 40002 blir kontobegränsat behörighetsfel, 40105 gäller hela inloggningen", async () => {
    const e1 = await tt.fetch({ tokens }, { account: { ...account, externalId: "7300000000000403" }, metrics: ["spend"], dimensions: [], dateRange: { start: "2025-01-01", end: "2025-01-02" } }).catch((e) => e);
    expect(e1).toBeInstanceOf(ConnectorAuthError);
    expect(e1.scope).toBe("account");
    const e2 = await tt.listAccounts({ tokens: { accessToken: "ogiltig" } }).catch((e) => e);
    expect(e2.scope).toBe("connection");
  });
});
