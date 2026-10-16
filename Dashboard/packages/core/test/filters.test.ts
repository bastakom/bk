import { describe, expect, it } from "vitest";
import { dataFilterSchema, matchesDataFilter, planFilters, type DataFilter } from "../src/filters";
import { widgetConfigSchema } from "../src/widgets";

const all = () => true;
const campaign = (values: string[], op: DataFilter["op"] = "in", platform?: DataFilter["platform"]): DataFilter => ({ platform, dimension: "campaign", op, values });

describe("datafilter", () => {
  it("matchar utan hänsyn till versaler", () => {
    expect(matchesDataFilter("[BK] Höstkampanj", campaign(["höst"], "contains"))).toBe(true);
    expect(matchesDataFilter("[BK] Höstkampanj", campaign(["vår", "sommar"], "contains"))).toBe(false);
    expect(matchesDataFilter("Brand", campaign(["brand", "Generic"]))).toBe(true);
    expect(matchesDataFilter("Brand", campaign(["Brand"], "not_in"))).toBe(false);
    expect(matchesDataFilter("Retarget", campaign(["brand"], "not_contains"))).toBe(true);
  });

  it("läser äldre sparade filter", () => {
    const cfg = widgetConfigSchema.parse({ filters: [{ dimension: "job_title", op: "equals", value: "CEO" }] });
    expect(cfg.filters).toEqual([{ dimension: "job_title", op: "in", values: ["CEO"] }]);
    expect(dataFilterSchema.safeParse({ dimension: "campaign", op: "in", values: [] }).success).toBe(false);
  });

  it("KPI med kampanjfilter läser kampanjraderna och slår ihop dem", () => {
    const plan = planFilters("meta_ads", undefined, [campaign(["Höst"], "contains", "meta_ads")], all);
    expect(plan).toMatchObject({ fetchDimension: "campaign", collapse: true });
    expect(plan.apply).toHaveLength(1);
  });

  it("filter för en annan kanal påverkar inte kontot", () => {
    const plan = planFilters("google_ads", undefined, [campaign(["Höst"], "contains", "meta_ads")], all);
    expect(plan).toEqual({ fetchDimension: "", apply: [], collapse: false, skipped: [] });
  });

  it("tabell per kampanj filtreras direkt; filter på annan dimension hoppas över", () => {
    const age: DataFilter = { dimension: "age", op: "in", values: ["25–34"] };
    const plan = planFilters("meta_ads", "campaign", [campaign(["A"]), age], all);
    expect(plan.fetchDimension).toBe("campaign");
    expect(plan.apply).toEqual([campaign(["A"])]);
    expect(plan.skipped).toEqual([{ filter: age, reason: "other_dimension" }]);
  });

  it("alla-kanaler-filter på en dimension kanalen saknar markeras", () => {
    const kw: DataFilter = { dimension: "keyword", op: "contains", values: ["skor"] };
    const plan = planFilters("meta_ads", undefined, [kw], (d) => d !== "keyword");
    expect(plan.fetchDimension).toBe("");
    expect(plan.skipped).toEqual([{ filter: kw, reason: "unsupported" }]);
  });
});

describe("sammansatta dimensioner", () => {
  it("ett kampanjfilter gäller kampanjdelen av kampanj · konvertering", () => {
    const f = { dimension: "campaign" as const, op: "contains" as const, values: ["demoprodukt"] };
    expect(matchesDataFilter("Demoprodukt SE · Köp", f, "campaign_conversion")).toBe(true);
    expect(matchesDataFilter("Vinter · Köp Demoprodukt", f, "campaign_conversion")).toBe(false);
    const plan = planFilters("meta_ads", "campaign_conversion", [f], () => true);
    expect(plan.apply).toEqual([f]);
    expect(plan.skipped).toEqual([]);
  });

  it("ett konverteringsfilter gäller konverteringsdelen", () => {
    const f = { dimension: "conversion" as const, op: "in" as const, values: ["Köp"] };
    expect(matchesDataFilter("Demoprodukt SE · Köp", f, "campaign_conversion")).toBe(true);
    expect(matchesDataFilter("Demoprodukt SE · Köp Demoprodukt", f, "campaign_conversion")).toBe(false);
  });
});
