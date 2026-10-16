import { describe, expect, it } from "vitest";
import { evaluateGoal, goalWindow } from "../src/goals";

describe("mål", () => {
  it("hittar kalenderperioden", () => {
    expect(goalWindow("month", "2026-02-14")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(goalWindow("quarter", "2026-11-03")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(goalWindow("year", "2026-06-30")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("volymmål: prognos från takten hittills", () => {
    // 200 leads på 10 av 30 dagar → prognos 600 mot mål 500
    const e = evaluateGoal({ additive: true, budget: false, higherIsBetter: true, target: 500, actual: 200, elapsedDays: 10, totalDays: 30 });
    expect(e.projection).toBe(600);
    expect(e.status).toBe("on_track");
    expect(e.expectedSoFar).toBeCloseTo(166.67, 1);
    expect(evaluateGoal({ additive: true, budget: false, higherIsBetter: true, target: 500, actual: 155, elapsedDays: 10, totalDays: 30 }).status).toBe("close");
    expect(evaluateGoal({ additive: true, budget: false, higherIsBetter: true, target: 500, actual: 100, elapsedDays: 10, totalDays: 30 }).status).toBe("behind");
  });

  it("budget: i takt inom ±10 %, annars över- eller underförbrukning", () => {
    const b = (actual: number) => evaluateGoal({ additive: true, budget: true, higherIsBetter: null, target: 30_000, actual, elapsedDays: 15, totalDays: 30 }).status;
    expect(b(15_000)).toBe("on_track");
    expect(b(18_000)).toBe("over_budget");
    expect(b(12_000)).toBe("under_budget");
  });

  it("kvoter jämförs åt rätt håll", () => {
    const cpa = (actual: number) => evaluateGoal({ additive: false, budget: false, higherIsBetter: false, target: 300, actual, elapsedDays: 5, totalDays: 30 }).status;
    expect(cpa(280)).toBe("on_track");
    expect(cpa(320)).toBe("close");
    expect(cpa(400)).toBe("behind");
    const roas = (actual: number) => evaluateGoal({ additive: false, budget: false, higherIsBetter: true, target: 4, actual, elapsedDays: 5, totalDays: 30 }).status;
    expect(roas(4.5)).toBe("on_track");
    expect(roas(3.7)).toBe("close");
    expect(roas(2)).toBe("behind");
  });

  it("utan data", () => {
    expect(evaluateGoal({ additive: true, budget: false, higherIsBetter: true, target: 10, actual: null, elapsedDays: 3, totalDays: 30 }).status).toBe("no_data");
  });
});
