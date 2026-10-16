/**
 * Mall-flödet: dashboard → kontooberoende definition → ny dashboard hos annan
 * kund via mappning. Kräver lokal Postgres (`pnpm db:start`).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDashboardFromDefinition, createOwnerClient, dashboardToDefinition } from "../src";

const db = createOwnerClient();
const tag = `tpl-${Date.now()}`;
let ws: string, clientA: string, clientB: string, dashboardId: string;
const acc: Record<string, string> = {};

beforeAll(async () => {
  ws = (await db.workspace.create({ data: { name: tag, slug: tag } })).id;
  clientA = (await db.client.create({ data: { workspaceId: ws, name: "A", slug: "a" } })).id;
  clientB = (await db.client.create({ data: { workspaceId: ws, name: "B", slug: "b" } })).id;
  const conn = await db.connection.create({ data: { workspaceId: ws, connectorId: "mock_ga4", platform: "ga4", label: "t", encryptedTokens: "x", scopes: [] } });
  const mk = async (key: string, clientId: string, platform: string) =>
    (acc[key] = (
      await db.connectedAccount.create({
        data: {
          workspaceId: ws,
          connectionId: conn.id,
          connectorId: `mock_${platform}`,
          platform,
          externalId: `${tag}-${key}`,
          name: key,
          currency: "SEK",
          timezone: "Europe/Stockholm",
          clientSources: { create: { workspaceId: ws, clientId } },
        },
      })
    ).id);
  await mk("a_ga4", clientA, "ga4");
  await mk("a_ads1", clientA, "google_ads");
  await mk("a_ads2", clientA, "google_ads");
  await mk("b_ga4", clientB, "ga4");
  await mk("b_ads", clientB, "google_ads");

  dashboardId = (await db.dashboard.create({ data: { workspaceId: ws, clientId: clientA, name: "Källa" } })).id;
  const widget = (accounts: string[], type = "kpi") =>
    db.widget.create({
      data: { workspaceId: ws, clientId: clientA, dashboardId, type, config: { metrics: ["clicks"] }, layout: { x: 0, y: 0, w: 3, h: 4 }, sources: { create: accounts.map((accountId) => ({ workspaceId: ws, accountId })) } },
    });
  await widget([acc.a_ga4!]);
  await widget([acc.a_ads1!, acc.a_ads2!]);
  await widget([], "text");
});

afterAll(async () => {
  await db.workspace.delete({ where: { id: ws } });
  await db.$disconnect();
});

describe("mallar", () => {
  it("ersätter konton med slots per plattform", async () => {
    const def = await dashboardToDefinition(db, dashboardId);
    expect(def.slots.map((s) => [s.key, s.label])).toEqual([
      ["ga4_1", "Google Analytics 4"],
      ["google_ads_1", "Google Ads 1"],
      ["google_ads_2", "Google Ads 2"],
    ]);
    expect(JSON.stringify(def)).not.toContain(acc.a_ga4!);
    expect(def.widgets.map((w) => w.slots)).toEqual([["ga4_1"], ["google_ads_1", "google_ads_2"], []]);
  });

  it("skapar dashboard hos ny kund enligt mappning, överhoppade källor utelämnas", async () => {
    const def = await dashboardToDefinition(db, dashboardId);
    const d = await createDashboardFromDefinition(db, {
      workspaceId: ws,
      clientId: clientB,
      name: "Från mall",
      definition: def,
      mapping: { ga4_1: acc.b_ga4!, google_ads_1: acc.b_ads!, google_ads_2: null },
    });
    const widgets = await db.widget.findMany({ where: { dashboardId: d.id }, include: { sources: true }, orderBy: { createdAt: "asc" } });
    expect(widgets.map((w) => w.sources.map((s) => s.accountId))).toEqual([[acc.b_ga4], [acc.b_ads], []]);
  });

  it("databasen vägrar mappa till en annan kunds konto", async () => {
    const def = await dashboardToDefinition(db, dashboardId);
    await expect(
      createDashboardFromDefinition(db, { workspaceId: ws, clientId: clientB, name: "Fel", definition: def, mapping: { ga4_1: acc.a_ga4!, google_ads_1: null, google_ads_2: null } }),
    ).rejects.toThrow();
  });
});
