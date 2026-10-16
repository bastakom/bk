import { describe, expect, it } from "vitest";
import { mergeDuplicateRows } from "../src/types";

describe("mergeDuplicateRows", () => {
  it("summerar rader som fått samma dimensionsvärde efter normalisering", () => {
    const out = mergeDuplicateRows([
      { date: "2026-10-01", dims: { device: "Mobil" }, metrics: { spend: 10, clicks: 2 } },
      { date: "2026-10-01", dims: { device: "Mobil" }, metrics: { spend: 5, impressions: 100 } },
      { date: "2026-10-01", dims: { device: "Dator" }, metrics: { spend: 1 } },
      { date: "2026-10-02", dims: { device: "Mobil" }, metrics: { spend: 3 } },
    ]);
    expect(out).toEqual([
      { date: "2026-10-01", dims: { device: "Mobil" }, metrics: { spend: 15, clicks: 2, impressions: 100 } },
      { date: "2026-10-01", dims: { device: "Dator" }, metrics: { spend: 1 } },
      { date: "2026-10-02", dims: { device: "Mobil" }, metrics: { spend: 3 } },
    ]);
  });

  it("ändrar inte indata", () => {
    const rows = [
      { date: "2026-10-01", dims: { campaign: "Höst" }, metrics: { spend: 1 } },
      { date: "2026-10-01", dims: { campaign: "Höst" }, metrics: { spend: 2 } },
    ];
    mergeDuplicateRows(rows);
    expect(rows[0]!.metrics.spend).toBe(1);
  });
});
