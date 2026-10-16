import { describe, expect, it } from "vitest";
import { describeSchedule, nextRun, resolvePreset, compareRange } from "../src";

const tz = "Europe/Stockholm";

describe("schemaläggning", () => {
  it("veckovis: nästa måndag 07:00 svensk tid", () => {
    // Söndag 12 okt 2026 21:00 UTC → måndag 13 okt 07:00 CEST = 05:00 UTC
    const at = nextRun({ frequency: "WEEKLY", weekday: 1, hour: 7, timezone: tz }, new Date("2026-10-11T21:00:00Z"));
    expect(at.toISOString()).toBe("2026-10-12T05:00:00.000Z");
  });

  it("hoppar till nästa vecka om tiden passerat", () => {
    const at = nextRun({ frequency: "WEEKLY", weekday: 1, hour: 7, timezone: tz }, new Date("2026-10-12T05:00:00Z"));
    expect(at.toISOString()).toBe("2026-10-19T05:00:00.000Z");
  });

  it("hanterar övergång till vintertid (CET = UTC+1)", () => {
    // Sista söndagen i oktober 2026 är den 25:e
    const at = nextRun({ frequency: "WEEKLY", weekday: 1, hour: 7, timezone: tz }, new Date("2026-10-20T12:00:00Z"));
    expect(at.toISOString()).toBe("2026-10-26T06:00:00.000Z");
  });

  it("månadsvis: den 1:a kl. 08", () => {
    const at = nextRun({ frequency: "MONTHLY", dayOfMonth: 1, hour: 8, timezone: tz }, new Date("2026-10-12T10:00:00Z"));
    expect(at.toISOString()).toBe("2026-11-01T07:00:00.000Z");
  });

  it("månadsvis: sista dagen i månaden", () => {
    const at = nextRun({ frequency: "MONTHLY", dayOfMonth: 0, hour: 16, timezone: tz }, new Date("2027-02-10T10:00:00Z"));
    expect(at.toISOString()).toBe("2027-02-28T15:00:00.000Z");
  });

  it("beskriver schemat på svenska", () => {
    expect(describeSchedule({ frequency: "WEEKLY", weekday: 1, hour: 7, timezone: tz })).toBe("Varje måndag kl. 07:00");
    expect(describeSchedule({ frequency: "MONTHLY", dayOfMonth: 0, hour: 8, timezone: tz })).toBe("Sista dagen varje månad kl. 08:00");
  });
});

describe("förra veckan", () => {
  it("är hela föregående ISO-vecka och jämförs med veckan innan", () => {
    const r = resolvePreset("last_week", "2026-10-14"); // onsdag
    expect(r).toEqual({ start: "2026-10-05", end: "2026-10-11" });
    expect(compareRange(r, "previous_period", "last_week")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
  });
});
