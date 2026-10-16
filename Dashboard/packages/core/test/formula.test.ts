import { describe, expect, it } from "vitest";
import { describeFormula, evaluateFormula, FormulaError, parseFormula } from "../src";

const ev = (src: string, vals: Record<string, number>) => evaluateFormula(parseFormula(src), (m, p) => vals[p ? `${m}@${p}` : m] ?? null);

describe("formler", () => {
  it("följer räkneordning och parenteser", () => {
    expect(ev("spend + clicks * 2", { spend: 10, clicks: 3 })).toBe(16);
    expect(ev("(spend + clicks) * 2", { spend: 10, clicks: 3 })).toBe(26);
    expect(ev("-spend / 4", { spend: 10 })).toBe(-2.5);
    expect(ev("spend * 1,5", { spend: 10 })).toBe(15);
  });

  it("stöder källbegränsade referenser", () => {
    expect(ev("spend / sessions[ga4]", { spend: 100, "sessions@ga4": 50 })).toBe(2);
  });

  it("ger tydliga fel på svenska", () => {
    expect(() => parseFormula("spend / foo")).toThrow(/Okänd metric "foo"/);
    expect(() => parseFormula("spend / clicks[twitter]")).toThrow(/Okänd källa/);
    expect(() => parseFormula("(spend / clicks")).toThrow(/Förväntade "\)"/);
    expect(() => parseFormula("spend $ 2")).toThrow(FormulaError);
    expect(() => parseFormula("")).toThrow(/tom/);
  });

  it("evaluerar aldrig kod", () => {
    expect(() => parseFormula("process.exit()")).toThrow(FormulaError);
  });

  it("beskriver formeln läsbart", () => {
    expect(describeFormula(parseFormula("spend / sessions[ga4]"))).toBe("Spend / Besök (Google Analytics 4)");
  });
});
