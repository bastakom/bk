/**
 * Läser in alla konton som byråernas aktiva inloggningar ger åtkomst till (Databaser).
 *   pnpm --filter @rp/db exec tsx scripts/discover-all.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../../.env"), quiet: true });
const { createOwnerClient, discoverSources, ownerRunner } = await import("../src/index");

const client = createOwnerClient();
try {
  const conns = await client.connection.findMany({ where: { status: "ACTIVE" }, select: { id: true, connectorId: true, label: true } });
  for (const c of conns) {
    try {
      const r = await discoverSources(ownerRunner(client), c.id);
      console.log(`${c.connectorId} · ${c.label}: ${r.total} konton (${r.added} nya)`);
    } catch (e) {
      console.log(`${c.connectorId} · ${c.label}: FEL – ${e instanceof Error ? e.message : e}`);
    }
  }
} finally {
  await client.$disconnect();
}
