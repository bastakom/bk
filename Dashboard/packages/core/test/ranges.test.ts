import { describe, expect, it } from "vitest";
import { autoGranularity, bucketKey, compareRange, formatRange, resolvePreset } from "../src";

const today = "2026-10-12";

describe("perioder", () => {
  it("senaste 30 dagarna slutar igår", () => {
    expect(resolvePreset("last_30", today)).toEqual({ start: "2026-09-12", end: "2026-10-11" });
  });
  it("förra månaden, kvartalet och året", () => {
    expect(resolvePreset("last_month", today)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(resolvePreset("last_quarter", today)).toEqual({ start: "2026-07-01", end: "2026-09-30" });
    expect(resolvePreset("last_year", today)).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(resolvePreset("last_quarter", "2026-02-10")).toEqual({ start: "2025-10-01", end: "2025-12-31" });
  });
  it("föregående period har samma antal dagar för rullande perioder", () => {
    expect(compareRange({ start: "2026-09-12", end: "2026-10-11" }, "previous_period", "last_30")).toEqual({ start: "2026-08-13", end: "2026-09-11" });
    expect(compareRange({ start: "2025-03-01", end: "2025-03-10" }, "previous_period", "custom")).toEqual({ start: "2025-02-19", end: "2025-02-28" });
  });
  it("kalenderperioder jämförs med föregående kalenderperiod", () => {
    expect(compareRange({ start: "2025-01-01", end: "2025-12-31" }, "previous_period", "last_year")).toEqual({ start: "2024-01-01", end: "2024-12-31" });
    expect(compareRange({ start: "2026-09-01", end: "2026-09-30" }, "previous_period", "last_month")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(compareRange({ start: "2026-03-01", end: "2026-03-31" }, "previous_period", "last_month")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(compareRange({ start: "2026-07-01", end: "2026-09-30" }, "previous_period", "last_quarter")).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    // Pågående månad: samma antal dagar i förra månaden
    expect(compareRange({ start: "2026-10-01", end: "2026-10-12" }, "previous_period", "this_month")).toEqual({ start: "2026-09-01", end: "2026-09-12" });
  });
  it("samma period förra året hanterar skottdag", () => {
    expect(compareRange({ start: "2024-02-01", end: "2024-02-29" }, "previous_year")).toEqual({ start: "2023-02-01", end: "2023-02-28" });
  });
  it("ingen jämförelse", () => {
    expect(compareRange({ start: "2025-01-01", end: "2025-01-31" }, "none")).toBeNull();
  });
  it("väljer upplösning så att årsgrafer inte blir brus", () => {
    expect(autoGranularity({ start: "2025-01-01", end: "2025-01-30" })).toBe("day");
    expect(autoGranularity({ start: "2025-01-01", end: "2025-03-31" })).toBe("week");
    expect(autoGranularity({ start: "2025-01-01", end: "2025-12-31" })).toBe("month");
  });
  it("veckor börjar på måndag", () => {
    expect(bucketKey("2026-10-11", "week")).toBe("2026-10-05"); // söndag
    expect(bucketKey("2026-10-12", "week")).toBe("2026-10-12"); // måndag
  });
  it("formaterar perioder på svenska", () => {
    expect(formatRange({ start: "2025-01-01", end: "2025-12-31" })).toBe("1 jan. – 31 dec. 2025");
  });
});
