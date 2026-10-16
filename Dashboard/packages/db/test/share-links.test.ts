/** Delningslänkar: uppslag via token utan byrå-kontext, men inget annat läcker. */
import { afterAll, beforeAll, expect, it } from "vitest";
import { createOwnerClient, db } from "../src";

const owner = createOwnerClient();
const tag = `share-${Date.now()}`;
let ws: string;

beforeAll(async () => {
  ws = (await owner.workspace.create({ data: { name: tag, slug: tag } })).id;
  const client = await owner.client.create({ data: { workspaceId: ws, name: "K", slug: "k" } });
  const d = await owner.dashboard.create({ data: { workspaceId: ws, clientId: client.id, name: "D" } });
  await owner.shareLink.createMany({
    data: [
      { workspaceId: ws, clientId: client.id, dashboardId: d.id, token: `${tag}-ok` },
      { workspaceId: ws, clientId: client.id, dashboardId: d.id, token: `${tag}-revoked`, revokedAt: new Date() },
      { workspaceId: ws, clientId: client.id, dashboardId: d.id, token: `${tag}-expired`, expiresAt: new Date(Date.now() - 1000) },
    ],
  });
});
afterAll(async () => {
  await owner.workspace.delete({ where: { id: ws } });
  await owner.$disconnect();
  await db.$disconnect();
});

const lookup = (t: string) => db.$queryRaw<{ workspaceId: string }[]>`SELECT * FROM share_link_by_token(${t})`;

it("hittar en giltig länk via token utan att byrån är satt", async () => {
  const rows = await lookup(`${tag}-ok`);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.workspaceId).toBe(ws);
});

it("återkallade, utgångna och felaktiga token ger inget", async () => {
  expect(await lookup(`${tag}-revoked`)).toHaveLength(0);
  expect(await lookup(`${tag}-expired`)).toHaveLength(0);
  expect(await lookup("gissad-token")).toHaveLength(0);
});

it("tabellen kan fortfarande inte läsas direkt utan byrå-kontext", async () => {
  expect(await db.shareLink.count()).toBe(0);
});
