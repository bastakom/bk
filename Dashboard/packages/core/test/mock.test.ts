import { describe, expect, it } from "vitest";
import { ConnectorAuthError } from "../src";
import { getConnector, listConnectors } from "../src/server";

const ctx = { tokens: { accessToken: "x" } };
const range = { start: "2025-01-01", end: "2025-01-31" };

describe("mock-connectors", () => {
  it("finns för alla fem plattformar", () => {
    expect(listConnectors().filter((c) => c.isMock).map((c) => c.platform).sort()).toEqual(["ga4", "google_ads", "linkedin_ads", "meta_ads", "tiktok_ads"]);
  });

  it("är deterministiska", async () => {
    const c = getConnector("mock_google_ads");
    const [account] = await c.listAccounts(ctx);
    const q = { account: account!, metrics: c.availableMetrics(), dimensions: [], dateRange: range };
    expect(await c.fetch(ctx, q)).toEqual(await c.fetch(ctx, q));
  });

  it("dimensionsuppdelning summerar exakt till dagens totaler", async () => {
    const c = getConnector("mock_linkedin_ads");
    const [account] = await c.listAccounts(ctx);
    const metrics = ["impressions", "clicks", "spend"] as const;
    const totals = await c.fetch(ctx, { account: account!, metrics: [...metrics], dimensions: [], dateRange: range });
    const split = await c.fetch(ctx, { account: account!, metrics: [...metrics], dimensions: ["job_title"], dateRange: range });
    for (const m of metrics) {
      const a = totals.rows.reduce((s, r) => s + (r.metrics[m] ?? 0), 0);
      const b = split.rows.reduce((s, r) => s + (r.metrics[m] ?? 0), 0);
      expect(b).toBeCloseTo(a, 2);
    }
  });

  it("returnerar en rad per dag och bara efterfrågade metrics", async () => {
    const c = getConnector("mock_ga4");
    const [account] = await c.listAccounts(ctx);
    const res = await c.fetch(ctx, { account: account!, metrics: ["sessions"], dimensions: [], dateRange: range });
    expect(res.rows).toHaveLength(31);
    expect(Object.keys(res.rows[0]!.metrics)).toEqual(["sessions"]);
  });

  it("rapporterar originalvaluta", async () => {
    const c = getConnector("mock_google_ads");
    const usd = (await c.listAccounts(ctx)).find((a) => a.currency === "USD")!;
    const res = await c.fetch(ctx, { account: usd, metrics: ["spend"], dimensions: [], dateRange: range });
    expect(res.currency).toBe("USD");
  });

  it("simulerar tappad behörighet", async () => {
    const c = getConnector("mock_meta_ads");
    const expired = (await c.listAccounts(ctx)).find((a) => a.externalId.endsWith("-expired"))!;
    const seedCtx = { tokens: { accessToken: "seed-token" } };
    await expect(c.fetch(seedCtx, { account: expired, metrics: ["spend"], dimensions: [], dateRange: range })).rejects.toBeInstanceOf(ConnectorAuthError);
    // Efter "Koppla om" (ny token) fungerar kontot igen
    await expect(c.fetch(ctx, { account: expired, metrics: ["spend"], dimensions: [], dateRange: range })).resolves.toBeTruthy();
  });
});
