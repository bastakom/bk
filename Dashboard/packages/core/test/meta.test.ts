import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FAKE_META_TOKEN, startFakePlatforms } from "../src/dev/fake-platforms";
import { chunkRange, ConnectorAuthError, type TokenAuthConfig, type TokenSet } from "../src";
import { metaConnector, metaRowMetrics } from "../src/connectors/meta";

let fake: Awaited<ReturnType<typeof startFakePlatforms>>;
let tokens: TokenSet;
const auth = metaConnector.auth as TokenAuthConfig;
const account = { externalId: "act_1029384756", name: "FB", currency: "SEK", timezone: "Europe/Stockholm" };
const dateRange = { start: "2025-01-01", end: "2025-01-31" };

beforeAll(async () => {
  fake = await startFakePlatforms();
  Object.assign(process.env, fake.env, { META_THROTTLE_WAIT_MS: "50" });
});
afterAll(() => fake.close());

describe("Meta – inloggning med systemanvändar-token", () => {
  it("validerar token och begär bara ads_read", async () => {
    expect(auth.type).toBe("token");
    expect(auth.scopes).toEqual(["ads_read"]);
    const res = await auth.validate(`  ${FAKE_META_TOKEN}  `);
    expect(res.label).toBe("Rapportplattform (systemanvändare)");
    tokens = res.tokens;
    expect(tokens.accessToken).toBe(FAKE_META_TOKEN);
  });

  it("avvisar ogiltig token som behörighetsfel", async () => {
    await expect(auth.validate("fel-token")).rejects.toBeInstanceOf(ConnectorAuthError);
  });
});

describe("Meta – annonskonton och insights", () => {
  it("listar alla annonskonton som systemanvändaren ser, även kunders delade konton", async () => {
    const accounts = await metaConnector.listAccounts({ tokens });
    expect(accounts).toHaveLength(5);
    expect(accounts.find((a) => a.externalId === "act_5566778899")).toMatchObject({ currency: "EUR", parentName: "Demo Fastighetsförmedling AB" });
  });

  it("hämtar dagliga totaler och normaliserar actions", async () => {
    const res = await metaConnector.fetch({ tokens }, { account, metrics: metaConnector.availableMetrics(), dimensions: [], dateRange });
    expect(res.rows).toHaveLength(31);
    const r = res.rows[0]!.metrics;
    expect(r.spend).toBeGreaterThan(0);
    expect(r.engagements).toBeGreaterThanOrEqual(r.likes! + r.comments! + r.shares!);
    expect(r.video_starts).toBeGreaterThanOrEqual(r.video_completions!);
  });

  it("ger samma totaler som källan – inget tappas mellan sidor och 90-dagarsbitar", async () => {
    const { getConnector } = await import("../src/server");
    const long = { start: "2024-01-01", end: "2024-12-31" };
    const expected = await getConnector("mock_meta_ads").fetch({ tokens: { accessToken: "x" } }, { account, metrics: ["spend", "clicks"], dimensions: ["campaign"], dateRange: long });
    const res = await metaConnector.fetch({ tokens }, { account, metrics: ["spend", "clicks"], dimensions: ["campaign"], dateRange: long });
    const sum = (rows: { metrics: { clicks?: number } }[]) => rows.reduce((s, x) => s + (x.metrics.clicks ?? 0), 0);
    expect(sum(res.rows)).toBe(sum(expected.rows));
    expect(chunkRange(long)).toHaveLength(5);
  });

  it("översätter ålder, kön och enhet till svenska kategorier", async () => {
    const gender = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["gender"], dateRange });
    expect(new Set(gender.rows.map((r) => r.dims.gender))).toEqual(new Set(["Kvinna", "Man", "Okänt"]));
    const device = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["device"], dateRange });
    expect(new Set(device.rows.map((r) => r.dims.device))).toEqual(new Set(["Mobil", "Dator", "Surfplatta"]));
  });

  it("räknar bara konfigurerade konverteringstyper", () => {
    const m = metaRowMetrics(
      { date_start: "2025-01-01", actions: [{ action_type: "purchase", value: "3" }, { action_type: "lead", value: "2" }, { action_type: "link_click", value: "40" }] },
      ["purchase", "lead"],
    );
    expect(m.conversions).toBe(5);
  });

  it("hämtar annonser med hel text och bild till galleriet", async () => {
    const ads = await metaConnector.fetchCreatives!({ tokens }, account);
    expect(ads.length).toBeGreaterThan(0);
    expect(ads[0]!.text!.length).toBeGreaterThan(50);
    expect(ads[0]!.thumbnailUrl).toBeTruthy();
  });

  it("hämtar Metas förhandsvisning för uppspelning av videoannonser", async () => {
    const ads = await metaConnector.fetchCreatives!({ tokens }, account);
    const video = ads.find((a) => a.format === "video")!;
    const media = await metaConnector.resolveMedia!({ tokens }, account, video);
    expect(media).toMatchObject({ kind: "iframe", width: 320, height: 570 });
    expect(media!.url).toContain("&t=fake");
  });

  it("försöker igen vid anropsgräns (kod 17)", async () => {
    const res = await metaConnector.fetch({ tokens }, { account: { ...account, externalId: "act_429000001" }, metrics: ["spend"], dimensions: [], dateRange });
    expect(res.rows).toHaveLength(31);
  }, 120_000);

  it("saknad behörighet till ett konto påverkar bara det kontot", async () => {
    const err = await metaConnector.fetch({ tokens }, { account: { ...account, externalId: "act_403000001" }, metrics: ["spend"], dimensions: [], dateRange }).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorAuthError);
    expect(err.scope).toBe("account");
  });

  it("återkallad token (kod 190) gäller hela inloggningen", async () => {
    await fetch(`${fake.url}/__admin/meta/revoke`, { method: "POST" });
    const err = await metaConnector.listAccounts({ tokens }).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectorAuthError);
    expect(err.scope).toBe("connection");
  });
});

describe("Meta – räckvidd och nya nyckeltal", () => {
  // Egen giltig token: tidigare tester återkallar den delade.
  beforeAll(() => {
    fake.state.metaTokens.add(FAKE_META_TOKEN);
    tokens = { accessToken: FAKE_META_TOKEN };
  });

  it("hämtar räckvidd för hela perioden, inte per dag", async () => {
    const [total] = await metaConnector.fetchPeriod!({ tokens }, { account, metrics: ["reach", "ad_recallers"], dateRange });
    const daily = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: [], dateRange });
    const impressions = daily.rows.reduce((s, r) => s + (r.metrics.impressions ?? 0), 0);
    expect(total!.metrics.reach).toBeGreaterThan(0);
    // Unika personer är färre än exponeringarna (frekvens > 1).
    expect(total!.metrics.reach!).toBeLessThan(impressions);
    expect(total!.metrics.ad_recallers).toBeGreaterThan(0);
  });

  it("delar upp räckvidden per kampanj och tillämpar kampanjfilter hos Meta", async () => {
    const all = await metaConnector.fetchPeriod!({ tokens }, { account, metrics: ["reach"], dimension: "campaign", dateRange });
    expect(all.length).toBeGreaterThan(1);
    const one = all[0]!.dims.campaign!;
    const filtered = await metaConnector.fetchPeriod!({ tokens }, { account, metrics: ["reach"], dimension: "campaign", dateRange, filters: [{ dimension: "campaign", op: "in", values: [one] }] });
    expect(filtered.map((r) => r.dims.campaign)).toEqual([one]);
  });

  it("kön × ålder blir en dimension, t.ex. Kvinna, 25–34", async () => {
    const res = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["age_gender"], dateRange });
    const values = new Set(res.rows.map((r) => r.dims.age_gender));
    expect([...values].some((v) => /^(Kvinna|Man), \d{2}–\d{2}|^(Kvinna|Man), 65\+/.test(v ?? ""))).toBe(true);
  });

  it("läser länkklick och sparade", () => {
    const m = metaRowMetrics({ date_start: "2025-01-01", inline_link_clicks: "12", actions: [{ action_type: "onsite_conversion.post_save", value: "3" }, { action_type: "post_reaction", value: "7" }] }, ["purchase"]);
    expect(m).toMatchObject({ link_clicks: 12, saves: 3, reactions: 7 });
  });
});

describe("Meta – konverteringar och geografi", () => {
  beforeAll(() => {
    fake.state.metaTokens.add(FAKE_META_TOKEN);
    tokens = { accessToken: FAKE_META_TOKEN };
  });

  it("custom conversions får sina namn från kontot, standardhändelser svenska namn", async () => {
    const res = await metaConnector.fetch({ tokens }, { account, metrics: ["conversions"], dimensions: ["conversion"], dateRange });
    const names = new Set(res.rows.map((r) => r.dims.conversion));
    expect(names).toEqual(new Set(["Köp", "Köp Demoprodukt", "Nyhetsbrev"]));
    // Bara konverteringstyper; länkklick och engagemang blir inga rader.
    expect(res.rows.every((r) => Object.keys(r.metrics).sort().join() === "conversion_value,conversions")).toBe(true);
  });

  it("konverteringar per kampanj: värdet är kampanj · konvertering", async () => {
    const res = await metaConnector.fetch({ tokens }, { account, metrics: ["conversions"], dimensions: ["campaign_conversion"], dateRange });
    const v = res.rows.find((r) => r.dims.campaign_conversion?.endsWith(" · Köp Demoprodukt"))!.dims.campaign_conversion!;
    expect(v.split(" · ")[0]!.length).toBeGreaterThan(0);
    // Summan per konvertering är densamma som utan kampanjuppdelning.
    const byConv = await metaConnector.fetch({ tokens }, { account, metrics: ["conversions"], dimensions: ["conversion"], dateRange });
    const sum = (rows: typeof res.rows, f: (r: (typeof res.rows)[number]) => boolean) => rows.filter(f).reduce((s, r) => s + (r.metrics.conversions ?? 0), 0);
    expect(sum(res.rows, (r) => r.dims.campaign_conversion!.endsWith(" · Köp"))).toBe(sum(byConv.rows, (r) => r.dims.conversion === "Köp"));
  });

  it("region och land i samma dimension, t.ex. Skåne · Sverige", async () => {
    const res = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["region_country"], dateRange });
    expect(res.rows.length).toBeGreaterThan(0);
    expect(res.rows.every((r) => r.dims.region_country!.endsWith(" · Sverige"))).toBe(true);
  });

  it("godtar Meta inte land + region hämtas bara regionen", async () => {
    fake.state.metaRejectCountryRegion = true;
    try {
      const res = await metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: ["region_country"], dateRange });
      expect(res.rows.length).toBeGreaterThan(0);
      expect(res.rows.some((r) => r.dims.region_country!.includes(" · "))).toBe(false);
    } finally {
      fake.state.metaRejectCountryRegion = false;
    }
  });

  it("två dimensioner: kampanj · annonsgrupp, enhet och region", async () => {
    const q = (dim: "campaign" | "campaign_ad_set" | "campaign_device" | "campaign_region") => metaConnector.fetch({ tokens }, { account, metrics: ["impressions"], dimensions: [dim], dateRange });
    const total = (rows: { metrics: { impressions?: number } }[]) => rows.reduce((s, r) => s + (r.metrics.impressions ?? 0), 0);
    const campaigns = await q("campaign");
    for (const dim of ["campaign_ad_set", "campaign_device", "campaign_region"] as const) {
      const res = await q(dim);
      expect(res.rows.every((r) => r.dims[dim]!.split(" · ").length === 2)).toBe(true);
      expect(total(res.rows)).toBe(total(campaigns.rows));
    }
    const devices = new Set((await q("campaign_device")).rows.map((r) => r.dims.campaign_device!.split(" · ")[1]));
    expect(devices).toEqual(new Set(["Mobil", "Dator", "Surfplatta"]));
  });
});
