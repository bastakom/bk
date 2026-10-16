/**
 * Integrationstest mot lokal Postgres (`pnpm db:start`). Verifierar att row
 * level security isolerar byråer och att ett konto aldrig kan användas i en
 * annan kunds widget.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOwnerClient, db, withTenant } from "../src";

const owner = createOwnerClient();
const tag = `test-${Date.now()}`;
let wsA: string, wsB: string, clientA1: string, clientA2: string, accountA2: string, dashboardA1: string;

beforeAll(async () => {
  const mk = async (name: string) => (await owner.workspace.create({ data: { name, slug: `${tag}-${name}` } })).id;
  wsA = await mk("a");
  wsB = await mk("b");
  clientA1 = (await owner.client.create({ data: { workspaceId: wsA, name: "A1", slug: "a1" } })).id;
  clientA2 = (await owner.client.create({ data: { workspaceId: wsA, name: "A2", slug: "a2" } })).id;
  await owner.client.create({ data: { workspaceId: wsB, name: "B1", slug: "b1" } });
  const conn = await owner.connection.create({
    data: { workspaceId: wsA, connectorId: "mock_ga4", platform: "ga4", label: "t", encryptedTokens: "x", scopes: [] },
  });
  accountA2 = (
    await owner.connectedAccount.create({
      data: {
        workspaceId: wsA,
        connectionId: conn.id,
        connectorId: "mock_ga4",
        platform: "ga4",
        externalId: tag,
        name: "x",
        currency: "SEK",
        timezone: "Europe/Stockholm",
        clientSources: { create: { workspaceId: wsA, clientId: clientA2 } },
      },
    })
  ).id;
  dashboardA1 = (await owner.dashboard.create({ data: { workspaceId: wsA, clientId: clientA1, name: "D" } })).id;
});

afterAll(async () => {
  await owner.workspace.deleteMany({ where: { slug: { startsWith: tag } } });
  await owner.$disconnect();
  await db.$disconnect();
});

describe("row level security", () => {
  it("visar inga tenant-rader utan satt byrå", async () => {
    expect(await db.client.count()).toBe(0);
  });

  it("visar bara den egna byråns kunder", async () => {
    const names = await withTenant(wsA, (tx) => tx.client.findMany({ select: { name: true }, orderBy: { name: "asc" } }));
    expect(names.map((c) => c.name)).toEqual(["A1", "A2"]);
    const b = await withTenant(wsB, (tx) => tx.client.findMany({ select: { name: true } }));
    expect(b.map((c) => c.name)).toEqual(["B1"]);
  });

  it("hindrar skrivning till en annan byrå", async () => {
    await expect(withTenant(wsA, (tx) => tx.client.create({ data: { workspaceId: wsB, name: "Intrång", slug: "x" } }))).rejects.toThrow();
  });
});

describe("behörighet per kund", () => {
  const only = (ids: string[]) => ({ clientIds: ids });

  it("visar bara tillåtna kunder och deras dashboards", async () => {
    const r = await withTenant(wsA, async (tx) => ({ clients: await tx.client.findMany({ select: { name: true } }), dashboards: await tx.dashboard.count() }), db, only([clientA2]));
    expect(r.clients.map((c) => c.name)).toEqual(["A2"]);
    expect(r.dashboards).toBe(0);
    const a1 = await withTenant(wsA, (tx) => tx.dashboard.count(), db, only([clientA1]));
    expect(a1).toBe(1);
  });

  it("tom lista ger ingen kund, och begränsningen följer inte med till nästa transaktion", async () => {
    expect(await withTenant(wsA, (tx) => tx.client.count(), db, only([]))).toBe(0);
    expect(await withTenant(wsA, (tx) => tx.client.count())).toBe(2);
  });

  it("hindrar skrivning till en annan kund", async () => {
    await expect(withTenant(wsA, (tx) => tx.dashboard.create({ data: { workspaceId: wsA, clientId: clientA1, name: "Intrång" } }), db, only([clientA2]))).rejects.toThrow();
  });
});

describe("källa ↔ kund", () => {
  it("en källa kan inte användas i widgets hos en kund som inte valt den", async () => {
    await expect(
      withTenant(wsA, async (tx) => {
        const w = await tx.widget.create({ data: { workspaceId: wsA, clientId: clientA1, dashboardId: dashboardA1, type: "kpi", layout: {} } });
        await tx.widgetSource.create({ data: { workspaceId: wsA, clientId: clientA1, widgetId: w.id, accountId: accountA2 } });
      }),
    ).rejects.toThrow();
  });

  it("samma externa konto finns bara en gång per byrå", async () => {
    const conn = await owner.connection.findFirstOrThrow({ where: { workspaceId: wsA } });
    await expect(
      owner.connectedAccount.create({
        data: { workspaceId: wsA, connectionId: conn.id, connectorId: "mock_ga4", platform: "ga4", externalId: tag, name: "dubblett", currency: "SEK", timezone: "Europe/Stockholm" },
      }),
    ).rejects.toThrow();
  });

  it("flera kunder kan välja samma källa, och widgets fungerar när kunden valt den", async () => {
    await withTenant(wsA, async (tx) => {
      await tx.clientSource.create({ data: { workspaceId: wsA, clientId: clientA1, accountId: accountA2 } });
      const w = await tx.widget.create({ data: { workspaceId: wsA, clientId: clientA1, dashboardId: dashboardA1, type: "kpi", layout: {} } });
      await tx.widgetSource.create({ data: { workspaceId: wsA, clientId: clientA1, widgetId: w.id, accountId: accountA2 } });
    });
    const users = await withTenant(wsA, (tx) => tx.clientSource.count({ where: { accountId: accountA2 } }));
    expect(users).toBe(2);
  });

  it("när kunden tar bort källan försvinner den ur kundens widgets", async () => {
    await withTenant(wsA, (tx) => tx.clientSource.delete({ where: { clientId_accountId: { clientId: clientA1, accountId: accountA2 } } }));
    expect(await withTenant(wsA, (tx) => tx.widgetSource.count({ where: { clientId: clientA1, accountId: accountA2 } }))).toBe(0);
    expect(await withTenant(wsA, (tx) => tx.connectedAccount.count({ where: { id: accountA2 } }))).toBe(1);
  });

  it("en annan byrå ser inte kundernas val", async () => {
    expect(await withTenant(wsB, (tx) => tx.clientSource.count())).toBe(0);
  });
});
