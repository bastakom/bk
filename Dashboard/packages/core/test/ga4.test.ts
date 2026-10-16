/**
 * GA4-connectorn mot den simulerade Google-servern: samma HTTP-anrop,
 * format och felkoder som mot riktiga Google.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFakeGoogle } from "../src/dev/fake-google";
import { ConnectorAuthError, oauthOf, type OAuthConfig, type TokenSet } from "../src";

let fake: Awaited<ReturnType<typeof startFakeGoogle>>;
let ga4: (typeof import("../src/connectors/ga4"))["ga4Connector"];
let auth: OAuthConfig;
let tokens: TokenSet;
const redirectUri = "http://localhost:3000/api/connect/callback";

beforeAll(async () => {
  fake = await startFakeGoogle();
  Object.assign(process.env, fake.env, { GA4_PAGE_SIZE: "200" });
  ga4 = (await import("../src/connectors/ga4")).ga4Connector;
  auth = oauthOf(ga4);
});
afterAll(() => fake.close());

async function login() {
  // Följ samtyckessidan precis som en användare: klicka "Tillåt" och plocka koden ur redirecten.
  const consent = await (await fetch(auth.getAuthorizationUrl({ state: "s1", redirectUri }))).text();
  const allow = /href="([^"]+)">Tillåt/.exec(consent)![1]!.replaceAll("&amp;", "&");
  const code = new URL(allow).searchParams.get("code")!;
  expect(new URL(allow).searchParams.get("state")).toBe("s1");
  return auth.exchangeCode({ code, redirectUri });
}

describe("GA4 OAuth", () => {
  it("är konfigurerad och begär bara läsrättigheter", () => {
    expect(ga4.isConfigured?.()).toBe(true);
    const url = new URL(auth.getAuthorizationUrl({ state: "x", redirectUri }));
    expect(url.searchParams.get("scope")).toBe("openid email https://www.googleapis.com/auth/analytics.readonly");
    expect(url.searchParams.get("access_type")).toBe("offline");
  });

  it("byter kod mot tokens med refresh token och e-post", async () => {
    tokens = await login();
    expect(tokens.accessToken).toMatch(/^fake-at-/);
    expect(tokens.refreshToken).toMatch(/^fake-rt-/);
    expect(tokens.extra?.email).toBe("marknad@bastakompisar.se");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });

  it("förnyar access token och behåller refresh token", async () => {
    const fresh = await auth.refresh(tokens);
    expect(fresh.accessToken).not.toBe(tokens.accessToken);
    expect(fresh.refreshToken).toBe(tokens.refreshToken);
    tokens = fresh;
  });
});

describe("GA4 Admin API", () => {
  it("listar properties med valuta och tidszon", async () => {
    const accounts = await ga4.listAccounts({ tokens });
    expect(accounts.length).toBe(6);
    expect(accounts.find((a) => a.externalId === "properties/312450981")).toMatchObject({
      name: "Demo Finans – webbplats",
      currency: "SEK",
      timezone: "Europe/Stockholm",
      parentName: "Bästa Kompisar – kundkonton",
    });
    expect(accounts.find((a) => a.externalId === "properties/429000001")?.currency).toBe("EUR");
  });
});

describe("GA4 Data API", () => {
  const account = { externalId: "properties/312450981", name: "Demo Finans", currency: "SEK", timezone: "Europe/Stockholm" };
  const dateRange = { start: "2025-01-01", end: "2025-01-31" };

  it("hämtar dagstotaler och mappar till det gemensamma schemat", async () => {
    const res = await ga4.fetch({ tokens }, { account, metrics: ["sessions", "users", "engaged_sessions", "session_duration", "conversions"], dimensions: [], dateRange });
    expect(res.rows).toHaveLength(31);
    const r = res.rows[0]!;
    expect(r.date).toBe("2025-01-01");
    expect(Object.keys(r.metrics).sort()).toEqual(["conversions", "engaged_sessions", "session_duration", "sessions", "users"]);
    // Besökstid = snitt × besök (räknas om från averageSessionDuration)
    expect(r.metrics.session_duration! / r.metrics.sessions!).toBeGreaterThan(30);
  });

  it("ger samma totaler som datakällan (mock-generatorn) – ingen data tappas", async () => {
    const { getConnector } = await import("../src/server");
    const expected = await getConnector("mock_ga4").fetch({ tokens: { accessToken: "x" } }, { account, metrics: ["sessions"], dimensions: [], dateRange });
    const res = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: [], dateRange });
    const sum = (rows: { metrics: { sessions?: number } }[]) => rows.reduce((s, r) => s + (r.metrics.sessions ?? 0), 0);
    expect(sum(res.rows)).toBe(sum(expected.rows));
  });

  it("sidvisningar, engagemangstid, sidtitel och stad", async () => {
    const res = await ga4.fetch({ tokens }, { account, metrics: ["page_views", "engagement_time", "users"], dimensions: ["page_title"], dateRange });
    expect(res.rows.some((r) => r.dims.page_title === "Pension")).toBe(true);
    const sum = (k: "page_views" | "engagement_time" | "users") => res.rows.reduce((s, r) => s + (r.metrics[k] ?? 0), 0);
    expect(sum("page_views")).toBeGreaterThan(sum("users"));
    expect(sum("engagement_time") / sum("users")).toBeGreaterThan(30);
    const cities = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: ["city"], dateRange });
    expect(cities.rows.some((r) => r.dims.city === "Malmö")).toBe(true);
  });

  it("två dimensioner: sida · trafikkälla och kampanj · enhet", async () => {
    const total = (rows: { metrics: { sessions?: number } }[]) => rows.reduce((s, r) => s + (r.metrics.sessions ?? 0), 0);
    const pages = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: ["page_path"], dateRange });
    const both = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: ["page_channel"], dateRange });
    expect(both.rows.some((r) => r.dims.page_channel === "/kontakt · Organic Search")).toBe(true);
    expect(total(both.rows)).toBe(total(pages.rows));
    const cd = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: ["campaign_device"], dateRange });
    expect(cd.rows.every((r) => r.dims.campaign_device!.includes(" · "))).toBe(true);
  });

  it("paginerar när svaret är större än en sida", async () => {
    fake.state.calls.clear();
    const res = await ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: ["page_path"], dateRange: { start: "2025-01-01", end: "2025-03-31" } });
    expect(res.rows.length).toBeGreaterThan(200);
    expect(fake.state.calls.get("properties/312450981")).toBe(Math.ceil(res.rows.length / 200));
    expect(res.rows[0]!.dims.page_path).toMatch(/^\//);
  });

  it("försöker igen vid 429 (kvot) och lyckas", async () => {
    const res = await ga4.fetch({ tokens }, { account: { ...account, externalId: "properties/429000001" }, metrics: ["sessions"], dimensions: [], dateRange });
    expect(res.rows.length).toBe(31);
    expect(fake.state.calls.get("properties/429000001")).toBe(3);
  }, 20_000);

  it("403 blir behörighetsfel (koppla om), inte ett tyst fel", async () => {
    await expect(ga4.fetch({ tokens }, { account: { ...account, externalId: "properties/403000001" }, metrics: ["sessions"], dimensions: [], dateRange })).rejects.toBeInstanceOf(ConnectorAuthError);
  });

  it("utgången access token ger behörighetsfel, och återkallad refresh token kan inte förnyas", async () => {
    fake.state.expireAccessTokens();
    await expect(ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: [], dateRange })).rejects.toBeInstanceOf(ConnectorAuthError);
    tokens = await auth.refresh(tokens);
    await expect(ga4.fetch({ tokens }, { account, metrics: ["sessions"], dimensions: [], dateRange })).resolves.toBeTruthy();
    fake.state.revokeRefreshTokens();
    await expect(auth.refresh(tokens)).rejects.toBeInstanceOf(ConnectorAuthError);
  });
});
