import { describe, expect, it } from "vitest";
import { breakdown, convertFacts, FxTable, kpi, MetricRegistry, timeseries, type FactRow } from "../src";

const range = { start: "2025-03-01", end: "2025-03-02" };
const f = (accountId: string, platform: FactRow["platform"], date: string, metrics: FactRow["metrics"], dimensionValue = ""): FactRow => ({ accountId, platform, date, dimensionValue, metrics });

// Google Ads i SEK, Meta i SEK, ett Google Ads-konto i USD
const rows: FactRow[] = [
  f("ga-sek", "google_ads", "2025-03-01", { spend: 1000, clicks: 100, impressions: 10_000, conversions: 5, conversion_value: 4000 }),
  f("ga-sek", "google_ads", "2025-03-02", { spend: 1000, clicks: 50, impressions: 10_000, conversions: 5, conversion_value: 4000 }),
  f("meta", "meta_ads", "2025-03-01", { spend: 500, clicks: 10, impressions: 50_000, conversions: 2, conversion_value: 1000 }),
  f("ga-usd", "google_ads", "2025-03-01", { spend: 100, clicks: 40, impressions: 2_000 }),
  f("ga4", "ga4", "2025-03-01", { sessions: 300, engaged_sessions: 180 }),
  f("ga4", "ga4", "2025-03-02", { sessions: 100, engaged_sessions: 20 }),
];

describe("merge av flera källor", () => {
  it("summerar additiva metrics och räknar om kvoter från summorna", () => {
    const ads = rows.filter((r) => r.accountId !== "ga-usd" && r.platform !== "ga4");
    const res = kpi(["spend", "clicks", "ctr", "cpc", "cpm"], ads, null, range);
    const v = Object.fromEntries(res.items.map((i) => [i.metric, i.value]));
    expect(v.spend).toBe(2500);
    expect(v.clicks).toBe(160);
    expect(v.ctr).toBeCloseTo(160 / 70_000, 12);
    expect(v.cpc).toBeCloseTo(2500 / 160, 12);
    expect(v.cpm).toBeCloseTo((2500 / 70_000) * 1000, 12);
    // Medelvärdet av källornas CTR (0,75 % och 0,02 %) vore helt fel:
    expect(v.ctr).not.toBeCloseTo((150 / 20_000 + 10 / 50_000) / 2, 4);
  });

  it("bounce rate viktas på besök över dagar", () => {
    const res = kpi(["bounce_rate"], rows.filter((r) => r.platform === "ga4"), null, range);
    expect(res.items[0]!.value).toBeCloseTo(1 - 200 / 400, 12); // inte (0,4 + 0,8) / 2
  });

  it("visar källfördelning för additiva metrics", () => {
    const ads = rows.filter((r) => r.accountId !== "ga-usd" && r.platform !== "ga4");
    const spend = kpi(["spend"], ads, null, range).items[0]!;
    expect(spend.sources).toEqual([
      { platform: "google_ads", value: 2000, share: 0.8 },
      { platform: "meta_ads", value: 500, share: 0.2 },
    ]);
    // Kvoter får värde per källa men ingen andel
    const ctr = kpi(["ctr"], ads, null, range).items[0]!;
    expect(ctr.sources?.[0]).toMatchObject({ platform: "google_ads", share: null });
    expect(ctr.sources?.[0]!.value).toBeCloseTo(150 / 20_000, 12);
  });

  it("tidsserie per källa summerar till totalen", () => {
    const ads = rows.filter((r) => r.platform !== "ga4");
    const res = timeseries(["clicks"], ads, null, range, null, "day");
    const s = res.series[0]!;
    expect(res.platforms).toEqual(["google_ads", "meta_ads"]);
    s.values.forEach((total, i) => expect((s.bySource!.google_ads![i] ?? 0) + (s.bySource!.meta_ads![i] ?? 0)).toBe(total));
  });

  it("grupperar på gemensam dimension över källor", () => {
    const camp = [
      f("ga-sek", "google_ads", "2025-03-01", { clicks: 10, impressions: 100 }, "Pension 55+"),
      f("meta", "meta_ads", "2025-03-01", { clicks: 30, impressions: 900 }, "Pension 55+"),
      f("meta", "meta_ads", "2025-03-01", { clicks: 5, impressions: 50 }, "Barnsparande"),
    ];
    const res = breakdown("campaign", ["clicks", "ctr"], camp, null, { limit: 10, filters: [] });
    expect(res.rows[0]).toMatchObject({ label: "Pension 55+", platforms: ["google_ads", "meta_ads"] });
    expect(res.rows[0]!.values.ctr).toBeCloseTo(40 / 1000, 12);
    expect(res.rows[1]).toMatchObject({ label: "Barnsparande", platforms: ["meta_ads"] });
  });
});

describe("valutaomräkning", () => {
  // 1 EUR = 11,00 SEK och 1,10 USD den 1 mars; ingen kurs den 2 mars (helg) → föregående dags kurs
  const fx = new FxTable([
    { date: "2025-02-28", currency: "SEK", perEur: 11.2 },
    { date: "2025-02-28", currency: "USD", perEur: 1.05 },
    { date: "2025-03-01", currency: "SEK", perEur: 11 },
    { date: "2025-03-01", currency: "USD", perEur: 1.1 },
  ]);
  const currencyOf = (id: string) => (id === "ga-usd" ? "USD" : "SEK");

  it("räknar om belopp per dag till rapportvalutan och lämnar volymer orörda", () => {
    const { rows: out, missing } = convertFacts(rows, currencyOf, "SEK", fx);
    const usd = out.find((r) => r.accountId === "ga-usd")!;
    expect(usd.metrics.spend).toBeCloseTo(100 * (11 / 1.1), 10); // 1000 SEK
    expect(usd.metrics.clicks).toBe(40);
    expect(missing).toEqual([]);
    // Originalet är oförändrat
    expect(rows.find((r) => r.accountId === "ga-usd")!.metrics.spend).toBe(100);
  });

  it("använder senast kända kurs över helger", () => {
    expect(fx.rate("USD", "SEK", "2025-03-02")).toBeCloseTo(11 / 1.1, 10);
    expect(fx.rate("USD", "SEK", "2025-02-28")).toBeCloseTo(11.2 / 1.05, 10);
  });

  it("CPC efter omräkning bygger på omräknad spend", () => {
    const { rows: out } = convertFacts(rows.filter((r) => r.platform === "google_ads"), currencyOf, "SEK", fx);
    const cpc = kpi(["cpc"], out, null, range).items[0]!.value!;
    expect(cpc).toBeCloseTo((2000 + 1000) / 190, 8);
  });

  it("rapporterar valutor som saknar kurs", () => {
    const { missing } = convertFacts([f("x", "meta_ads", "2025-03-01", { spend: 1 })], () => "JPY", "SEK", fx);
    expect(missing).toEqual(["JPY"]);
  });
});

describe("egna metrics (blended)", () => {
  const reg = new MetricRegistry([
    { id: "custom_total_roas", label: "Total ROAS", formula: "conversion_value / spend", format: "number", higherIsBetter: true },
    { id: "custom_cost_per_visit", label: "Kostnad per besök", formula: "spend / sessions[ga4]", format: "currency", higherIsBetter: false },
    { id: "custom_ads_ctr", label: "CTR Google Ads", formula: "ctr[google_ads] * 100", format: "number", higherIsBetter: true },
  ]);
  const sek = rows.filter((r) => r.accountId !== "ga-usd");

  it("räknar formeln på summor över alla källor", () => {
    const v = kpi(["custom_total_roas"], sek, null, range, reg).items[0]!.value;
    expect(v).toBeCloseTo((8000 + 1000) / 2500, 12);
  });

  it("källbegränsade referenser använder bara den källans summor", () => {
    const v = kpi(["custom_cost_per_visit"], sek, null, range, reg).items[0]!.value;
    expect(v).toBeCloseTo(2500 / 400, 12);
    const ctr = kpi(["custom_ads_ctr"], sek, null, range, reg).items[0]!.value;
    expect(ctr).toBeCloseTo((150 / 20_000) * 100, 12);
  });

  it("räknas om per bucket i tidsserier", () => {
    const res = timeseries(["custom_cost_per_visit"], sek, null, range, null, "day", reg);
    expect(res.series[0]!.values[0]).toBeCloseTo(1500 / 300, 12);
    expect(res.series[0]!.values[1]).toBeCloseTo(1000 / 100, 12);
  });

  it("ger null vid division med noll i stället för Infinity", () => {
    const v = kpi(["custom_cost_per_visit"], sek.filter((r) => r.platform !== "ga4"), null, range, reg).items[0]!.value;
    expect(v).toBeNull();
  });

  it("listar vilka basmetrics som behöver hämtas", () => {
    expect(reg.baseMetrics("custom_cost_per_visit").sort()).toEqual(["sessions", "spend"]);
    expect(reg.baseMetrics("custom_ads_ctr").sort()).toEqual(["clicks", "impressions"]);
  });
});
