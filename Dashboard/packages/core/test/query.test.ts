import { describe, expect, it } from "vitest";
import { breakdown, funnel, kpi, timeseries, type FactRow } from "../src";

const day = (date: string, metrics: FactRow["metrics"], dimensionValue = "", accountId = "a"): FactRow => ({ accountId, date, dimensionValue, metrics });
const jan = { start: "2025-01-01", end: "2025-01-03" };
const dec = { start: "2024-12-29", end: "2024-12-31" };

describe("kpi", () => {
  it("räknar CTR från summor över alla dagar", () => {
    const rows = [day("2025-01-01", { clicks: 1, impressions: 10 }), day("2025-01-02", { clicks: 10, impressions: 1000 })];
    const res = kpi(["ctr"], rows, null, jan);
    expect(res.items[0]!.value).toBeCloseTo(11 / 1010, 10);
    expect(res.items[0]!.delta.kind).toBe("none");
  });

  it("visar 'Ny' när föregående period hade data men värdet 0", () => {
    const res = kpi(["clicks"], [day("2025-01-01", { clicks: 5 })], [day("2024-12-30", { clicks: 0 })], jan);
    expect(res.items[0]!.delta.kind).toBe("new");
  });

  it("visar '–' när jämförelseperioden saknar data helt", () => {
    const res = kpi(["clicks"], [day("2025-01-01", { clicks: 5 })], [], jan);
    expect(res.items[0]!.delta.kind).toBe("none");
  });

  it("summerar flera konton", () => {
    const rows = [day("2025-01-01", { spend: 100, clicks: 10 }, "", "a"), day("2025-01-01", { spend: 50, clicks: 40 }, "", "b")];
    const res = kpi(["spend", "cpc"], rows, null, jan);
    expect(res.items[0]!.value).toBe(150);
    expect(res.items[1]!.value).toBe(3); // 150/50, inte (10 + 1.25)/2
  });

  it("markerar användare som approximativa", () => {
    expect(kpi(["users"], [day("2025-01-01", { users: 3 })], null, jan).items[0]!.approx).toBe(true);
  });
});

describe("timeseries", () => {
  it("en punkt per dag och jämförelse justerad per index", () => {
    const cur = [day("2025-01-01", { sessions: 10 }), day("2025-01-03", { sessions: 30 })];
    const prev = [day("2024-12-29", { sessions: 5 })];
    const res = timeseries(["sessions"], cur, prev, jan, dec, "day");
    expect(res.keys).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    expect(res.series[0]!.values).toEqual([10, 0, 30]);
    expect(res.series[0]!.previous).toEqual([5, 0, 0]);
    expect(res.series[0]!.total).toBe(40);
  });

  it("bounce rate per bucket är viktad på besök", () => {
    const rows = [day("2025-01-01", { sessions: 100, engaged_sessions: 50 }), day("2025-01-02", { sessions: 900, engaged_sessions: 600 })];
    const res = timeseries(["bounce_rate"], rows, null, jan, null, "month");
    expect(res.series[0]!.values[0]).toBeCloseTo(1 - 650 / 1000, 10);
  });
});

describe("breakdown", () => {
  const rows = [
    day("2025-01-01", { impressions: 100, engagements: 1 }, "Owner"),
    day("2025-01-02", { impressions: 50, engagements: 4 }, "Owner"),
    day("2025-01-01", { impressions: 300, engagements: 3 }, "Founder"),
    day("2025-01-01", { impressions: 20, engagements: 0 }, "Consultant"),
  ];

  it("grupperar, sorterar och räknar kvoter per rad", () => {
    const res = breakdown("job_title", ["impressions", "engagement_rate"], rows, null, { limit: 10, filters: [] });
    expect(res.rows.map((r) => r.label)).toEqual(["Founder", "Owner", "Consultant"]);
    expect(res.rows[1]!.values.engagement_rate).toBeCloseTo(5 / 150, 10);
    expect(res.total.impressions).toBe(470);
  });

  it("begränsar och lägger resten i Övrigt", () => {
    const res = breakdown("job_title", ["impressions"], rows, null, { limit: 1, filters: [], groupOther: true });
    expect(res.rows.map((r) => r.label)).toEqual(["Founder", "Övrigt"]);
    expect(res.rows[1]!.values.impressions).toBe(170);
    expect(res.distinctCount).toBe(3);
  });

  it("filtrerar på dimensionsvärde", () => {
    const res = breakdown("job_title", ["impressions"], rows, null, { limit: 10, filters: [{ dimension: "job_title", op: "not_contains", values: ["own"] }] });
    expect(res.rows.map((r) => r.label)).toEqual(["Founder", "Consultant"]);
  });

  it("sorterar på beräknad metric", () => {
    const res = breakdown("job_title", ["impressions", "engagement_rate"], rows, null, { limit: 10, filters: [], sort: { by: "engagement_rate", dir: "desc" } });
    expect(res.rows[0]!.label).toBe("Owner");
  });
});

describe("funnel", () => {
  it("andel av första steget och av föregående steg", () => {
    const res = funnel(["video_starts", "video_views", "video_completions"], [day("2025-01-01", { video_starts: 1000, video_views: 250, video_completions: 50 })]);
    expect(res.steps[1]).toMatchObject({ value: 250, ofFirst: 0.25, ofPrevious: 0.25 });
    expect(res.steps[2]).toMatchObject({ value: 50, ofFirst: 0.05, ofPrevious: 0.2 });
  });
});
