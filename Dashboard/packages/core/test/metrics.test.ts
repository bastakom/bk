import { describe, expect, it } from "vitest";
import { computeDelta, computeMetric, formatDelta, formatMetric } from "../src";

describe("computeMetric – beräknade metrics räknas från summor", () => {
  it("CTR = klick / exponeringar", () => {
    expect(computeMetric("ctr", { clicks: 67, impressions: 3886 })).toBeCloseTo(0.01724, 5);
  });

  it("räknar aldrig medelvärde av dagliga kvoter (exempelrapportens fel)", () => {
    const days = [
      { clicks: 1, impressions: 10 }, // 10 %
      { clicks: 10, impressions: 1000 }, // 1 %
    ];
    const avgOfAvgs = days.reduce((s, d) => s + d.clicks / d.impressions, 0) / days.length; // 5,5 %
    const sums = { clicks: 11, impressions: 1010 };
    expect(computeMetric("ctr", sums)).toBeCloseTo(11 / 1010, 10);
    expect(computeMetric("ctr", sums)).not.toBeCloseTo(avgOfAvgs, 3);
  });

  it("CPM multipliceras med 1000", () => {
    expect(computeMetric("cpm", { spend: 25872.03, impressions: 50444 })).toBeCloseTo(512.89, 2);
  });

  it("CPC och CPA", () => {
    expect(computeMetric("cpc", { spend: 25872.03, clicks: 270 })).toBeCloseTo(95.82, 2);
    expect(computeMetric("cpa", { spend: 1000, conversions: 4 })).toBe(250);
  });

  it("bounce rate = 1 − engagerade/besök, viktad på besök", () => {
    // Två dagar med olika volym – vikten ska följa besöken
    const sums = { sessions: 100 + 900, engaged_sessions: 10 + 630 };
    expect(computeMetric("bounce_rate", sums)).toBeCloseTo(1 - 640 / 1000, 10);
  });

  it("returnerar null vid nämnare 0 eller saknad data", () => {
    expect(computeMetric("ctr", { clicks: 0, impressions: 0 })).toBeNull();
    expect(computeMetric("cpc", { spend: 10 })).toBeNull();
    expect(computeMetric("spend", {})).toBeNull();
  });
});

describe("computeDelta", () => {
  it("visar 'Ny' när föregående period var 0", () => {
    const d = computeDelta("clicks", 270, 0);
    expect(d.kind).toBe("new");
    expect(formatDelta("clicks", d)).toBe("Ny");
  });

  it("visar '–' utan jämförelsedata", () => {
    expect(formatDelta("clicks", computeDelta("clicks", 10, null))).toBe("–");
  });

  it("kostnadsmetrics: minskning är positivt", () => {
    const d = computeDelta("cpc", 0.37, 0.39);
    expect(d.kind === "change" && d.favorable).toBe(true);
  });

  it("procent-metrics anges i procentenheter", () => {
    const d = computeDelta("bounce_rate", 0.429, 0.435);
    expect(formatDelta("bounce_rate", d)).toBe("−0,6 pe");
  });

  it("relativ förändring för volymer", () => {
    expect(formatDelta("clicks", computeDelta("clicks", 67, 40))).toBe("+67,5 %");
  });
});

describe("formatMetric", () => {
  it("formaterar svenska siffror och valuta", () => {
    expect(formatMetric("impressions", 50444).replace(/\s/g, " ")).toBe("50 444");
    expect(formatMetric("cpc", 95.82, "SEK").replace(/\s/g, " ")).toBe("95,82 kr");
    expect(formatMetric("avg_session_duration", 150)).toBe("2:30 min");
  });
});

describe("delta-färg", () => {
  it("spend är neutral – mer spend är varken bra eller dåligt i sig", () => {
    const d = computeDelta("spend", 120, 100);
    expect(d.kind === "change" && d.favorable).toBeNull();
  });
});

describe("små förändringar", () => {
  it("visar två decimaler för små procentenhetsförändringar", () => {
    expect(formatDelta("ctr", computeDelta("ctr", 0.0058, 0.0055))).toBe("+0,03 pe");
  });
  it("visar ±0 när förändringen avrundas bort", () => {
    expect(formatDelta("ctr", computeDelta("ctr", 0.05500001, 0.055))).toBe("±0 pe");
  });
});
